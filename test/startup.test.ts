import { assert } from "chai";
import { config } from "../package.json";

describe("startup", function () {
  it("should have plugin instance defined", function () {
    // @ts-expect-error Zotero plugin instance is dynamically attached
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });
});
