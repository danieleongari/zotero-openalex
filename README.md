# Zotero OpenAlex

[Zotero 9](https://www.zotero.org) plugin to obtain OpenAlex metadata using the [OpenAlex](https://openalex.org) web API.

Stores OpenAlex metadata in machine-readable keys in the `Extra` field:

`openalex.work_id: <workID>`

`openalex.cit_count: <count>`

`openalex.cit_date: <YYYY-MM-DD>`

Legacy lines (`OpenAlex-WorkID: ...` and `Citations: ... (OpenAlex) [...]`) are still parsed and are migrated to the new format when an item is updated.

The plugin keeps this data updated:

- from the context-menu command `Get OpenAlex-WorkID` for selected items
- automatically at startup for items that are missing Work ID/citation data or have stale citations

Staleness is controlled by preferences and defaults to 3 months.

Startup sync is intentionally delayed by a few seconds (`startupDelayMs`, default `3000`) so Zotero UI and database initialization can complete before the scan begins.

The plugin registers a `Citations` column in Zotero's library view. When no OpenAlex citation value is available, the column shows `-`.

Currently, the Zotero item's DOI is used to identify the item in OpenAlex. If a Zotero item does not have a DOI field, you can enter its DOI in the `Extra` field.

In the future, I plan to implement using other metadata when the DOI is missing to obtain a broader range of OpenAlex work ID's.

## Development

```sh
./make-zips3
```

then find the plugin as `build/zotero-openalex-*.xpi`
