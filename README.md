# Zotero OpenAlex

Zotero OpenAlex is a Zotero plugin that fetches OpenAlex metadata for your items and keeps citation data up to date.

It stores machine-readable fields in each item's `Extra` field:

- `openalex.work_id: W...`
- `openalex.cit_count: N`
- `openalex.cit_date: YYYY-MM-DD`

Only `openalex.*` lines are parsed and managed by the plugin.

## Compatibility

- Zotero strict minimum version: `6.999`
- Zotero strict maximum version: `9.*`

## What the plugin does

- Adds a context-menu action (`Get OpenAlex-WorkID`) to update selected regular items.
- Runs optional startup synchronization to refresh missing/stale OpenAlex metadata.
- Adds a `Citations` column in the Zotero items table.
- Uses DOI-based lookup against the OpenAlex API.

If an item has no DOI in the DOI field, the plugin also tries DOI text found in `Extra`.

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

When enabled, startup sync scans regular items and updates those that are missing metadata or have stale citation dates.

### Usage: Preferences (User)

Preferences are stored under `extensions.zotero-openalex.*`.

Most of these could be customized in the Settings panel of Zotero dedicated to the plugin (in Windows: Edit > Settings).

- `autoUpdateOnStartup` (default `true`): enable startup sync.
- `staleMonths` (default `3`): citation data older than this is considered stale.
- `requestDelayMs` (default `1000`): delay between OpenAlex API calls during startup sync.
- `startupDelayMs` (default `3000`): delay before startup sync begins after Zotero startup.
- `showStartupSummary` (default `true`): show startup status/summary window.
- `apiKey` (default empty): optional OpenAlex API key.
- `correctArxivArticles` (default `true`): when the DOI is missing and the URL specifies it is an arXiv article, change the `Item Type` to preprint and add the DOI accordingly.

### Usage: Optional API key (User)

The plugin works without an API key. You can optionally set one in Zotero settings to improve request allowance.

Get an OpenAlex API key at:

https://openalex.org/settings/api-key

## Metadata behavior

- Existing `openalex.work_id`, `openalex.cit_count`, and `openalex.cit_date` lines are replaced when updated.
- New lines are inserted before `Citation Key:` when present, otherwise appended.
- Citation date is updated when citation count changes or when refresh is forced.

## Privacy notes

- The API key is stored in local Zotero preferences.
- The plugin does not write your API key into item metadata.
- Requests are sent to the OpenAlex API endpoint (`https://api.openalex.org`).

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
- `addon/`: runtime assets (`manifest.json`, `bootstrap.js`, prefs/panes assets).
- `zotero-plugin.config.ts`: scaffold build and release configuration.

## Troubleshooting

- If API calls fail with `401/403`, verify the API key.
- If updates are skipped, verify the item has a DOI (field or `Extra`).
- If startup sync feels slow, increase `requestDelayMs` cautiously and adjust `staleMonths`.