const DATABASE_NAME = "zotero-openalex";
const SCHEMA_VERSION = 1;
const SQLITE_PARAMETER_LIMIT = 999;

export interface OpenAlexWorkPayload {
  id?: string;
  cited_by_count?: number | string;
  referenced_works?: string[];
  [key: string]: unknown;
}

export interface StoredOpenAlexWork {
  workID: string;
  citedByCount: number | null;
  fetchedAt: string;
  metadata: OpenAlexWorkPayload;
}

interface StoredOpenAlexWorkRow {
  work_id: string;
  cited_by_count: number | null;
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
        await this.db.queryAsync("INSERT INTO schemaVersion (version) VALUES (?)", [
          SCHEMA_VERSION,
        ]);
      } else if (Number(currentVersion) !== SCHEMA_VERSION) {
        throw new Error(
          `Unsupported OpenAlex cache schema version ${String(currentVersion)} (expected ${SCHEMA_VERSION}).`,
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
  }

  async getWork(workID: string) {
    const works = await this.getWorks([workID]);
    const normalizedWorkID = normalizeWorkID(workID);
    return normalizedWorkID ? works.get(normalizedWorkID) || null : null;
  }

  async getWorks(workIDs: Iterable<string>) {
    await this.initialize();

    const normalizedIDs = [...new Set([...workIDs].map(normalizeWorkID).filter(isString))];
    const works = new Map<string, StoredOpenAlexWork>();

    for (let offset = 0; offset < normalizedIDs.length; offset += SQLITE_PARAMETER_LIMIT) {
      const chunk = normalizedIDs.slice(offset, offset + SQLITE_PARAMETER_LIMIT);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = (await this.db.queryAsync(
        `SELECT work_id, cited_by_count, fetched_at, metadata_json
         FROM works
         WHERE work_id IN (${placeholders})`,
        chunk,
      )) as StoredOpenAlexWorkRow[];

      for (const row of rows) {
        const parsed = parseStoredRow(row);
        if (parsed) works.set(parsed.workID, parsed);
      }
    }

    return works;
  }
}

function parseStoredRow(row: StoredOpenAlexWorkRow): StoredOpenAlexWork | null {
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

function normalizeWorkID(value: unknown) {
  if (!value) return null;
  const match = String(value).match(/W\d+/i);
  return match ? match[0].toUpperCase() : null;
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

function isString(value: string | null): value is string {
  return value !== null;
}

export const __test__ = {
  normalizeWorkID,
  normalizeCitationCount,
  parseStoredRow,
};
