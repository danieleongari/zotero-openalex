import { assert } from "chai";
import { __test__ as openAlexTest } from "../src/modules/openalex";
import { OpenAlexStore } from "../src/modules/openalexStore";

describe("OpenAlex SQLite store", function () {
  let databaseName: string;
  let store: OpenAlexStore;

  before(function () {
    databaseName = `zotero-openalex-test-${Date.now()}`;
    store = new OpenAlexStore(databaseName);
  });

  after(async function () {
    const path = store.path;
    await store.close();
    for (const suffix of ["", "-shm", "-wal"]) {
      try {
        await IOUtils.remove(`${path}${suffix}`, { ignoreAbsent: true });
      } catch {
        // Test cleanup should not hide an assertion result.
      }
    }
  });

  it("initializes its versioned schema idempotently", async function () {
    await store.initialize();
    await store.initialize();
    assert.match(store.path, new RegExp(`${databaseName}\\.sqlite$`));
  });

  it("migrates a version-1 Work cache and seeds its Author relationships", async function () {
    const legacyDatabaseName = `${databaseName}-legacy`;
    const legacyDB = new Zotero.DBConnection(legacyDatabaseName);
    await legacyDB.queryAsync("CREATE TABLE schemaVersion (version INTEGER NOT NULL)");
    await legacyDB.queryAsync("INSERT INTO schemaVersion (version) VALUES (1)");
    await legacyDB.queryAsync(`CREATE TABLE works (
      work_id TEXT PRIMARY KEY NOT NULL,
      cited_by_count INTEGER,
      fetched_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    )`);
    await legacyDB.queryAsync(
      `INSERT INTO works (work_id, cited_by_count, fetched_at, metadata_json)
       VALUES (?, ?, ?, ?)`,
      [
        "W900",
        4,
        "2026-07-14T09:00:00.000Z",
        JSON.stringify({
          id: "https://openalex.org/W900",
          authorships: [
            { author: { id: "https://openalex.org/A900", display_name: "Legacy Author" } },
          ],
        }),
      ],
    );
    const legacyPath = String(legacyDB.path || "");
    await legacyDB.closeDatabase(true);

    const migratedStore = new OpenAlexStore(legacyDatabaseName);
    try {
      await migratedStore.initialize();
      assert.isNotNull(await migratedStore.getWork("W900"));
      assert.deepEqual([...(await migratedStore.getAuthorIDsForWorks(["W900"]))], ["A900"]);
      assert.deepEqual(await migratedStore.getCacheStats(), { works: 1, authors: 0 });
    } finally {
      await migratedStore.close();
      for (const suffix of ["", "-shm", "-wal"]) {
        await IOUtils.remove(`${legacyPath}${suffix}`, { ignoreAbsent: true });
      }
    }
  });

  it("round-trips and replaces complete Work metadata", async function () {
    const firstPayload = {
      id: "https://openalex.org/W123",
      cited_by_count: 7,
      referenced_works: ["https://openalex.org/W456"],
      authorships: [{ author: { id: "https://openalex.org/A1", display_name: "Author" } }],
      open_access: { is_oa: true, oa_status: "gold" },
    };
    await store.upsertWork("W123", firstPayload, "2026-07-14T10:00:00.000Z");

    const first = await store.getWork("https://openalex.org/W123");
    assert.deepEqual(first?.metadata, firstPayload);
    assert.equal(first?.citedByCount, 7);
    assert.equal(first?.fetchedAt, "2026-07-14T10:00:00.000Z");

    const secondPayload = { ...firstPayload, cited_by_count: 9, topics: [{ id: "T1" }] };
    await store.upsertWork("W123", secondPayload, "2026-07-14T11:00:00.000Z");

    const second = await store.getWork("W123");
    assert.deepEqual(second?.metadata, secondPayload);
    assert.equal(second?.citedByCount, 9);
    assert.equal(second?.fetchedAt, "2026-07-14T11:00:00.000Z");
    assert.deepEqual([...(await store.getAuthorIDsForWorks(["W123"]))], ["A1"]);
  });

  it("round-trips complete Author metadata and denormalized h-index", async function () {
    const authorPayload = {
      id: "https://openalex.org/A1",
      display_name: "Author One",
      summary_stats: { h_index: 17, i10_index: 9 },
      affiliations: [
        {
          institution: {
            id: "https://openalex.org/I1",
            display_name: "Example University",
          },
          years: [2024, 2023],
        },
      ],
      topics: [{ id: "https://openalex.org/T1", display_name: "Testing" }],
    };
    await store.upsertAuthor("A1", authorPayload, "2026-07-14T11:30:00.000Z");

    const stored = await store.getAuthor("https://openalex.org/A1");
    assert.deepEqual(stored?.metadata, authorPayload);
    assert.equal(stored?.hIndex, 17);
    assert.equal(stored?.fetchedAt, "2026-07-14T11:30:00.000Z");
    assert.deepEqual(await store.getCacheStats(), { works: 1, authors: 1 });

    const oversizedLookup = Array.from({ length: 1005 }, (_value, index) => `A${index + 100}`);
    oversizedLookup.push("A1");
    assert.deepEqual([...(await store.getAuthors(oversizedLookup)).keys()], ["A1"]);
  });

  it("replaces Work-Author relationships and removes orphaned metadata on cleanup", async function () {
    await store.upsertWork(
      "W123",
      {
        id: "https://openalex.org/W123",
        authorships: [
          { author: { id: "https://openalex.org/A2", display_name: "Author Two" } },
          { author: { id: "A2", display_name: "Duplicate Author Two" } },
        ],
      },
      "2026-07-14T12:00:00.000Z",
    );
    await store.upsertAuthor(
      "A2",
      {
        id: "https://openalex.org/A2",
        display_name: "Author Two",
        summary_stats: { h_index: "8" },
      },
      "2026-07-14T12:00:00.000Z",
    );

    assert.deepEqual([...(await store.getAuthorIDsForWorks(["W123"]))], ["A2"]);
    const cleanup = await store.clean([]);
    assert.deepEqual(cleanup.before, { works: 1, authors: 2 });
    assert.deepEqual(cleanup.after, { works: 0, authors: 0 });
    assert.equal(cleanup.deletedWorks, 1);
    assert.equal(cleanup.deletedAuthors, 2);
  });

  it("rejects a payload whose ID does not match its cache key", async function () {
    let error: unknown = null;
    try {
      await store.upsertWork(
        "W123",
        { id: "https://openalex.org/W999", cited_by_count: 1 },
        "2026-07-14T12:00:00.000Z",
      );
    } catch (caught) {
      error = caught;
    }
    assert.instanceOf(error, Error);
  });

  it("updates a fresh item when its Work is absent from SQLite", function () {
    const today = new Date();
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const item = {
      isRegularItem: () => true,
      getField: (field: string) => {
        if (field === "extra") {
          return `openalex.work_id: W123\nopenalex.cit_count: 7\nopenalex.cit_date: ${date}`;
        }
        return "";
      },
    } as unknown as Zotero.Item;

    assert.isTrue(openAlexTest.shouldUpdateOnStartup(item, 3, new Set()));
    assert.isFalse(openAlexTest.shouldUpdateOnStartup(item, 3, new Set(["W123"])));
  });

  it("normalizes IDs and names while removing malformed and duplicate authorships", function () {
    assert.deepEqual(
      openAlexTest.normalizeOpenAlexAuthors([
        { author: { id: "https://openalex.org/a123", display_name: "  Alice   Author  " } },
        { author: { id: "A123", display_name: "Alice Alternate" } },
        { author: { id: "https://openalex.org/A456", display_name: "" } },
        { author: { id: "https://openalex.org/W999", display_name: "Not an author" } },
        { author: { display_name: "Missing ID" } },
      ]),
      [
        { id: "A123", name: "Alice Alternate", hIndex: null, affiliations: [] },
        { id: "A456", name: "A456", hIndex: null, affiliations: [] },
      ],
    );
  });

  it("normalizes cached Author affiliations without inventing years", function () {
    assert.deepEqual(
      openAlexTest.normalizeAuthorAffiliations([
        {
          institution: { id: "https://openalex.org/I2", display_name: " Zulu  University " },
          years: [2021, "2020", "bad"],
        },
        {
          institution: { id: "I2", display_name: "Zulu University" },
          years: [2021],
        },
      ]),
      [
        {
          institutionID: "I2",
          institutionName: "Zulu University",
          years: [2021, 2020],
        },
      ],
    );
  });

  it("normalizes, deduplicates, and caps OpenAlex Author request batches at 100 IDs", function () {
    const authorIDs = Array.from({ length: 205 }, (_value, index) => `A${index + 1}`);
    authorIDs.push("https://openalex.org/A1", "not-an-author");
    const batches = openAlexTest.buildOpenAlexAuthorIDBatches(authorIDs);

    assert.deepEqual(
      batches.map((batch) => batch.length),
      [100, 100, 5],
    );
    assert.equal(batches[0][0], "A1");
    assert.equal(batches[2][4], "A205");
  });
});
