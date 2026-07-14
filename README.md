# Zotero OpenAlex

Zotero OpenAlex is a Zotero plugin that fetches OpenAlex metadata for your items and keeps citation data up to date.

It stores machine-readable fields in each item's `Extra` field:

- `openalex.work_id: W...`
- `openalex.cit_count: N`
- `openalex.cit_date: YYYY-MM-DD`

Only `openalex.*` lines are parsed and managed by the plugin.

The complete OpenAlex Work response is also cached locally in
`zotero-openalex.sqlite` in the Zotero data directory. The cache is shared by items with the same
OpenAlex Work ID and is not synchronized through Zotero Sync.

## What the plugin does

- Uses DOI-based lookup against the OpenAlex API to retrieve complete Work metadata.
- Stores as Extra `openalex.work_id`, `openalex.cit_count`, `openalex.cit_date`
- Stores the complete OpenAlex Work JSON in a local SQLite database.
- Updates citation counts when the `cit_date` is older that 3 months (or a span that the user can customize)
- Show the number of citations as the column "Citations"
- Right clicking on Libraries and Collections, the user can "Generate OpenAlex Citation Graph..." showing which article is citing what, among the items in the Collection or its SubCollections. Graphs read references from SQLite and only request OpenAlex metadata that is missing from the cache.

## Installation

1. Download the latest `.xpi` from this repository's releases.
2. Open Zotero.
3. Install the `.xpi` as a plugin.
4. Restart Zotero if requested.

## Usage

### Usage: Manual update

1. Select one or more regular items in Zotero.
2. Open the item context menu.
3. Click `Get OpenAlex-WorkID`.

For a single item, Zotero shows a direct result message. For multiple items, Zotero shows an aggregate summary.

### Usage: Startup sync

When enabled, startup sync scans regular items and updates those that are missing metadata, have
stale citation dates, or do not yet have a complete SQLite cache record. The first startup after
installing this version can therefore take longer while existing `Extra` metadata is backfilled.

### Usage: Custom Settings

The main settings can be customized in the Zotero plugin settings panel (Windows: Edit > Settings):

- `apiKey` (default empty): optional OpenAlex API key.
- `autoUpdateOnStartup` (default `true`): check items for updates at startup.
- `staleMonths` (default `3`): months after which the number of citations is updated.
- `correctArxivArticles` (default `true`): when the DOI is missing and the URL specifies it is an arXiv article, change the `Item Type` to preprint and add the DOI accordingly.
- `showGraphTuningControls` (default `false`): show tunable graph coefficients directly in the Citation Graph window.

When `showGraphTuningControls` is enabled, the Citation Graph window shows a tuning panel with all physics coefficients and a `Regenerate` button.

These and other settings are also customizable via: Edit > Settings > Advanced > Config Editor > `extensions.zotero-openalex.*`

### Usage: Optional API key

The plugin works without an API key. You can optionally set one in Zotero settings to improve request allowance.

Get an OpenAlex API key at:

[https://openalex.org/settings/api-key](https://openalex.org/settings/api-key)

## Metadata behavior

- Existing `openalex.work_id`, `openalex.cit_count`, and `openalex.cit_date` lines are replaced when updated.
- New lines are inserted before `Citation Key:` when present, otherwise appended.
- Citation date is updated whenever a complete OpenAlex refresh is saved.
- URL, `Extra`, and SQLite writes use the same fetched Work and timestamp. If one datastore fails,
  the plugin attempts to restore the previous values.

## Privacy notes

- The API key is stored in local Zotero preferences.
- The plugin does not write your API key into item metadata.
- Requests are sent to the OpenAlex API endpoint (`https://api.openalex.org`).
- Complete Work responses are stored locally in `zotero-openalex.sqlite`. This file remains on the
  device and is not synchronized through Zotero Sync.

## Development (Developer)

This project uses TypeScript and `zotero-plugin-scaffold`.

### Requirements

- Node.js and npm
- Zotero installed locally

### Install dependencies

```sh
npm install
```

### Run in development mode

```sh
npm start
```

### Build

```sh
npm run build
```

### Lint and format checks

```sh
npm run lint:check
```

### Auto-fix lint/format

```sh
npm run lint:fix
```

### Tests

```sh
npm test
```

### Release

```sh
npm run release
```

## Project structure (Developer)

- `src/index.ts`: plugin global binding and entry wiring.
- `src/addon.ts`: addon state container.
- `src/hooks.ts`: lifecycle hooks (`onStartup`, window load/unload, shutdown).
- `src/modules/openalex.ts`: OpenAlex logic, metadata parsing/upsert, menu wiring, startup sync, citations column.
- `src/modules/openalexStore.ts`: versioned SQLite storage for complete OpenAlex Work responses.
- `addon/`: runtime assets (`manifest.json`, `bootstrap.js`, prefs/panes assets).
- `zotero-plugin.config.ts`: scaffold build and release configuration.

## Troubleshooting

- If API calls fail with `401/403`, verify the API key.
- If updates are skipped, verify the item has a DOI (field or `Extra`).
- If startup sync feels slow, increase `requestDelayMs` cautiously and adjust `staleMonths`.
- If the first sync after upgrading is slow, allow it to finish populating `zotero-openalex.sqlite`.
  Later citation graphs will reuse these cached Work records.

## Acknowledgements

- OpenAlex Work-ID retrieval inspired by [mtillman14/open-alex-work-id](https://github.com/mtillman14/open-alex-work-id)
- Citation Graph inspired by [Exyeus/zotero-citation-visualizer](https://github.com/Exyeus/zotero-citation-visualier)
- Citation column inspired by [daeh/zotero-citation-tally](https://github.com/daeh/zotero-citation-tally)

Thread opened on Zotero's forum at
[https://forums.zotero.org/discussion/132439/making-a-strong-zotero-openalex-connection](https://forums.zotero.org/discussion/132439/making-a-strong-zotero-openalex-connection),
to gather feedback and enthusiasts interested to collaborate.

Disclaimer: This is an unofficial plugin. The author is not affiliated with, endorsed by, or associated with Zotero or OpenAlex.
