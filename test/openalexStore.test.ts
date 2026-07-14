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
});
