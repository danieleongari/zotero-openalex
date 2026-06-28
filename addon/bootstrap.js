function install() {}
function uninstall() {}

async function startup({ id, version, rootURI }) {
    try {
        Zotero.PreferencePanes.register({
            pluginID: 'zotero-openalex@example.com',
            src: rootURI + 'preferences.xhtml',
            scripts: [rootURI + 'preferences.js']
        });
    } catch (error) {
        Zotero.debug('OpenAlex: preference pane registration skipped.');
        Zotero.debug(error);
    }

    Services.scriptloader.loadSubScript(rootURI + 'zotero-openalex.js');
    OpenAlexWorkID.init({ id, version, rootURI });
    OpenAlexWorkID.addToAllWindows();
    void OpenAlexWorkID.main().catch((error) => {
        Zotero.debug('OpenAlex: startup main failed.');
        Zotero.debug(error);
    });
}

function shutdown() {
    OpenAlexWorkID.removeFromAllWindows();
    OpenAlexWorkID = undefined;
}