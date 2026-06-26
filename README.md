# Open Alex Work ID

[Zotero 7](https://www.zotero.org) plugin to obtain the [OpenAlex](https://openalex.org) Work ID using the OpenAlex web API. Stores the work ID in the `Extra` field of the Zotero item with the format `OpenAlex Work ID: <workID>`.

Currently, the Zotero item's DOI is used to identify the item in OpenAlex. If a Zotero item does not have a DOI field, you can enter its DOI in the `Extra` field.

In the future, I plan to implement using other metadata when the DOI is missing to obtain a broader range of OpenAlex work ID's.

Download the latest version of the plugin [on github](https://github.com/mtillman14/zotero-openalex/releases/latest).

## Development

```sh
./make-zip3
```

then find the plugin as `build/zotero-openalex-*.xpi`
