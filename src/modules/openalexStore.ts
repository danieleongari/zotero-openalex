const DATABASE_NAME = "zotero-openalex";
const SCHEMA_VERSION = 2;
const SQLITE_PARAMETER_LIMIT = 999;

export interface OpenAlexWorkPayload {
  id?: string;
  cited_by_count?: number | string;
  referenced_works?: string[];
  authorships?: Array<{
    author?: {
      id?: string;
      display_name?: string;
    };
  }>;
  [key: string]: unknown;
}

export interface OpenAlexAuthorPayload {
  id?: string;
  display_name?: string;
  summary_stats?: {
    h_index?: number | string;
    [key: string]: unknown;
  };
  affiliations?: Array<{
    institution?: {
      id?: string;
      display_name?: string;
      [key: string]: unknown;
    };
    years?: Array<number | string>;
  }>;
  [key: string]: unknown;
}

export interface StoredOpenAlexWork {
  workID: string;
  citedByCount: number | null;
  fetchedAt: string;
  metadata: OpenAlexWorkPayload;
}

export interface StoredOpenAlexAuthor {
  authorID: string;
  hIndex: number | null;
  fetchedAt: string;
  metadata: OpenAlexAuthorPayload;
}

export interface OpenAlexCacheStats {
  works: number;
  authors: number;
}

export interface OpenAlexCacheCleanupResult {
  before: OpenAlexCacheStats;
  after: OpenAlexCacheStats;
  deletedWorks: number;
  deletedAuthors: number;
}

interface StoredOpenAlexWorkRow {
  work_id: string;
  cited_by_count: number | null;
  fetched_at: string;
  metadata_json: string;
}

interface StoredOpenAlexAuthorRow {
  author_id: string;
  h_index: number | null;
  fetched_at: string;
  metadata_json: string;
}

export class OpenAlexStore {
  private readonly db: any;
  private initialized = false;

  constructor(databaseName = DATABASE_NAME) {
    this.db = new Zotero.DBConnection(databaseName);
  }

  get path() {
    return String(this.db.path || "");
  }

  async initialize() {
    if (this.initialized) return;

    await this.db.executeTransaction(async () => {
      await this.db.queryAsync(
        "CREATE TABLE IF NOT EXISTS schemaVersion (version INTEGER NOT NULL)",
      );
      await this.db.queryAsync(`CREATE TABLE IF NOT EXISTS works (
        work_id TEXT PRIMARY KEY NOT NULL,
        cited_by_count INTEGER,
        fetched_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      )`);

      const currentVersion = await this.db.valueQueryAsync(
        "SELECT version FROM schemaVersion LIMIT 1",
      );
      if (currentVersion === false || currentVersion === null || currentVersion === undefined) {
        await this.createAuthorSchema();
        await this.db.queryAsync("INSERT INTO schemaVersion (version) VALUES (?)", [
          SCHEMA_VERSION,
        ]);
      } else if (Number(currentVersion) === 1) {
        await this.createAuthorSchema();
        await this.populateWorkAuthorRelationships();
        await this.db.queryAsync("UPDATE schemaVersion SET version = ?", [SCHEMA_VERSION]);
      } else if (Number(currentVersion) === SCHEMA_VERSION) {
        await this.createAuthorSchema();
      } else {
        throw new Error(
          `Unsupported OpenAlex cache schema version ${String(currentVersion)} (expected 1 or ${SCHEMA_VERSION}).`,
        );
      }
    });

    this.initialized = true;
  }

  async close() {
    if (this.db.closed) return;
    await this.db.closeDatabase(true);
    this.initialized = false;
  }

  async executeTransaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.initialize();
    return this.db.executeTransaction(callback);
  }

  async upsertWork(workID: string, metadata: OpenAlexWorkPayload, fetchedAt: string) {
    await this.initialize();

    const normalizedWorkID = normalizeWorkID(workID);
    const payloadWorkID = normalizeWorkID(metadata?.id);
    if (!normalizedWorkID || payloadWorkID !== normalizedWorkID) {
      throw new Error(`OpenAlex payload ID does not match ${workID}.`);
    }

    const metadataJSON = JSON.stringify(metadata);
    if (!metadataJSON) {
      throw new Error(`OpenAlex payload for ${normalizedWorkID} could not be serialized.`);
    }

    await this.db.queryAsync(
      `INSERT INTO works (work_id, cited_by_count, fetched_at, metadata_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(work_id) DO UPDATE SET
         cited_by_count = excluded.cited_by_count,
         fetched_at = excluded.fetched_at,
         metadata_json = excluded.metadata_json`,
      [normalizedWorkID, normalizeCitationCount(metadata.cited_by_count), fetchedAt, metadataJSON],
    );

    await this.replaceWorkAuthors(normalizedWorkID, extractAuthorIDs(metadata));
  }

  async upsertAuthor(authorID: string, metadata: OpenAlexAuthorPayload, fetchedAt: string) {
    await this.initialize();

    const normalizedAuthorID = normalizeAuthorID(authorID);
    const payloadAuthorID = normalizeAuthorID(metadata?.id);
    if (!normalizedAuthorID || payloadAuthorID !== normalizedAuthorID) {
      throw new Error(`OpenAlex Author payload ID does not match ${authorID}.`);
    }

    const metadataJSON = JSON.stringify(metadata);
    if (!metadataJSON) {
      throw new Error(`OpenAlex Author payload for ${normalizedAuthorID} could not be serialized.`);
    }

    await this.db.queryAsync(
      `INSERT INTO authors (author_id, h_index, fetched_at, metadata_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(author_id) DO UPDATE SET
         h_index = excluded.h_index,
         fetched_at = excluded.fetched_at,
         metadata_json = excluded.metadata_json`,
      [
        normalizedAuthorID,
        normalizeHIndex(metadata.summary_stats?.h_index),
        fetchedAt,
        metadataJSON,
      ],
    );
  }

  async getWork(workID: string) {
    const works = await this.getWorks([workID]);
    const normalizedWorkID = normalizeWorkID(workID);
    return normalizedWorkID ? works.get(normalizedWorkID) || null : null;
  }

  async getWorks(workIDs: Iterable<string>) {
    await this.initialize();

    const normalizedIDs = normalizeUniqueIDs(workIDs, normalizeWorkID);
    const works = new Map<string, StoredOpenAlexWork>();

    for (const chunk of chunksOf(normalizedIDs, SQLITE_PARAMETER_LIMIT)) {
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = (await this.db.queryAsync(
        `SELECT work_id, cited_by_count, fetched_at, metadata_json
         FROM works
         WHERE work_id IN (${placeholders})`,
        chunk,
      )) as StoredOpenAlexWorkRow[];

      for (const row of rows) {
        const parsed = parseStoredWorkRow(row);
        if (parsed) works.set(parsed.workID, parsed);
      }
    }

    return works;
  }

  async getAuthor(authorID: string) {
    const authors = await this.getAuthors([authorID]);
    const normalizedAuthorID = normalizeAuthorID(authorID);
    return normalizedAuthorID ? authors.get(normalizedAuthorID) || null : null;
  }

  async getAuthors(authorIDs: Iterable<string>) {
    await this.initialize();

    const normalizedIDs = normalizeUniqueIDs(authorIDs, normalizeAuthorID);
    const authors = new Map<string, StoredOpenAlexAuthor>();

    for (const chunk of chunksOf(normalizedIDs, SQLITE_PARAMETER_LIMIT)) {
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = (await this.db.queryAsync(
        `SELECT author_id, h_index, fetched_at, metadata_json
         FROM authors
         WHERE author_id IN (${placeholders})`,
        chunk,
      )) as StoredOpenAlexAuthorRow[];

      for (const row of rows) {
        const parsed = parseStoredAuthorRow(row);
        if (parsed) authors.set(parsed.authorID, parsed);
      }
    }

    return authors;
  }

  async getAuthorIDsForWorks(workIDs: Iterable<string>) {
    await this.initialize();

    const normalizedIDs = normalizeUniqueIDs(workIDs, normalizeWorkID);
    const authorIDs = new Set<string>();

    for (const chunk of chunksOf(normalizedIDs, SQLITE_PARAMETER_LIMIT)) {
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = (await this.db.queryAsync(
        `SELECT DISTINCT author_id
         FROM work_authors
         WHERE work_id IN (${placeholders})`,
        chunk,
      )) as Array<{ author_id: string }>;

      for (const row of rows) {
        const authorID = normalizeAuthorID(row.author_id);
        if (authorID) authorIDs.add(authorID);
      }
    }

    return authorIDs;
  }

  async getCacheStats(): Promise<OpenAlexCacheStats> {
    await this.initialize();
    const works = await this.db.valueQueryAsync("SELECT COUNT(*) FROM works");
    const authors = await this.db.valueQueryAsync("SELECT COUNT(*) FROM authors");
    return {
      works: normalizeRowCount(works),
      authors: normalizeRowCount(authors),
    };
  }

  async clean(validWorkIDs: Iterable<string>): Promise<OpenAlexCacheCleanupResult> {
    await this.initialize();
    const validIDs = new Set(normalizeUniqueIDs(validWorkIDs, normalizeWorkID));
    const before = await this.getCacheStats();

    await this.db.executeTransaction(async () => {
      const storedRows = (await this.db.queryAsync("SELECT work_id FROM works")) as Array<{
        work_id: string;
      }>;
      const obsoleteWorkIDs = storedRows
        .filter((row) => {
          const workID = normalizeWorkID(row.work_id);
          return !workID || !validIDs.has(workID);
        })
        .map((row) => String(row.work_id));

      for (const chunk of chunksOf(obsoleteWorkIDs, SQLITE_PARAMETER_LIMIT)) {
        const placeholders = chunk.map(() => "?").join(", ");
        await this.db.queryAsync(
          `DELETE FROM work_authors WHERE work_id IN (${placeholders})`,
          chunk,
        );
        await this.db.queryAsync(`DELETE FROM works WHERE work_id IN (${placeholders})`, chunk);
      }

      await this.db.queryAsync(
        `DELETE FROM authors
         WHERE NOT EXISTS (
           SELECT 1 FROM work_authors WHERE work_authors.author_id = authors.author_id
         )`,
      );
    });

    const after = await this.getCacheStats();
    return {
      before,
      after,
      deletedWorks: Math.max(0, before.works - after.works),
      deletedAuthors: Math.max(0, before.authors - after.authors),
    };
  }

  private async createAuthorSchema() {
    await this.db.queryAsync(`CREATE TABLE IF NOT EXISTS authors (
      author_id TEXT PRIMARY KEY NOT NULL,
      h_index INTEGER,
      fetched_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    )`);
    await this.db.queryAsync(`CREATE TABLE IF NOT EXISTS work_authors (
      work_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      PRIMARY KEY (work_id, author_id)
    )`);
    await this.db.queryAsync(
      "CREATE INDEX IF NOT EXISTS work_authors_author_id ON work_authors (author_id)",
    );
    await this.db.queryAsync(
      "CREATE INDEX IF NOT EXISTS work_authors_work_id ON work_authors (work_id)",
    );
  }

  private async populateWorkAuthorRelationships() {
    const rows = (await this.db.queryAsync(
      "SELECT work_id, metadata_json FROM works",
    )) as StoredOpenAlexWorkRow[];

    for (const row of rows) {
      try {
        const workID = normalizeWorkID(row.work_id);
        const metadata = JSON.parse(row.metadata_json) as OpenAlexWorkPayload;
        if (!workID || normalizeWorkID(metadata?.id) !== workID) continue;
        await this.replaceWorkAuthors(workID, extractAuthorIDs(metadata));
      } catch {
        // Keep the existing Work row even when its cached JSON is malformed.
      }
    }
  }

  private async replaceWorkAuthors(workID: string, authorIDs: Iterable<string>) {
    await this.db.queryAsync("DELETE FROM work_authors WHERE work_id = ?", [workID]);
    for (const authorID of normalizeUniqueIDs(authorIDs, normalizeAuthorID)) {
      await this.db.queryAsync(
        "INSERT OR IGNORE INTO work_authors (work_id, author_id) VALUES (?, ?)",
        [workID, authorID],
      );
    }
  }
}

function parseStoredWorkRow(row: StoredOpenAlexWorkRow): StoredOpenAlexWork | null {
  try {
    const workID = normalizeWorkID(row.work_id);
    const metadata = JSON.parse(row.metadata_json) as OpenAlexWorkPayload;
    if (!workID || normalizeWorkID(metadata?.id) !== workID) return null;

    return {
      workID,
      citedByCount: normalizeCitationCount(row.cited_by_count),
      fetchedAt: String(row.fetched_at),
      metadata,
    };
  } catch {
    return null;
  }
}

function parseStoredAuthorRow(row: StoredOpenAlexAuthorRow): StoredOpenAlexAuthor | null {
  try {
    const authorID = normalizeAuthorID(row.author_id);
    const metadata = JSON.parse(row.metadata_json) as OpenAlexAuthorPayload;
    if (!authorID || normalizeAuthorID(metadata?.id) !== authorID) return null;

    return {
      authorID,
      hIndex: normalizeHIndex(row.h_index),
      fetchedAt: String(row.fetched_at),
      metadata,
    };
  } catch {
    return null;
  }
}

function extractAuthorIDs(metadata: OpenAlexWorkPayload) {
  const authorIDs = new Set<string>();
  for (const authorship of Array.isArray(metadata.authorships) ? metadata.authorships : []) {
    const authorID = normalizeAuthorID(authorship?.author?.id);
    if (authorID) authorIDs.add(authorID);
  }
  return authorIDs;
}

function normalizeWorkID(value: unknown) {
  if (!value) return null;
  const match = String(value).match(/(?:^|\/)(W\d+)\/?$/i) || String(value).match(/\b(W\d+)\b/i);
  return match ? String(match[1]).toUpperCase() : null;
}

function normalizeAuthorID(value: unknown) {
  if (!value) return null;
  const match = String(value).match(/(?:^|\/)(A\d+)\/?$/i) || String(value).match(/\b(A\d+)\b/i);
  return match ? String(match[1]).toUpperCase() : null;
}

function normalizeCitationCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function normalizeHIndex(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function normalizeRowCount(value: unknown) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeUniqueIDs(
  values: Iterable<string>,
  normalizer: (value: unknown) => string | null,
) {
  return [...new Set([...values].map(normalizer).filter(isString))];
}

function chunksOf<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size));
  }
  return chunks;
}

function isString(value: string | null): value is string {
  return value !== null;
}

export const __test__ = {
  normalizeWorkID,
  normalizeAuthorID,
  normalizeCitationCount,
  normalizeHIndex,
  extractAuthorIDs,
  parseStoredWorkRow,
  parseStoredAuthorRow,
};
