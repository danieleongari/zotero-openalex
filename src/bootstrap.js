function install() {}
function uninstall() {}

async function startup({ id, version, rootURI }) {
    Zotero.PreferencePanes.register({
        pluginID: 'zotero-openalex@example.com',
        src: rootURI + 'preferences.xhtml',
        scripts: [rootURI + 'preferences.js']
    });
    Services.scriptloader.loadSubScript(rootURI + 'zotero-openalex.js');
    OpenAlexWorkID.init({ id, version, rootURI });
    OpenAlexWorkID.addToAllWindows();
    await OpenAlexWorkID.main();
}

function shutdown() {
    OpenAlexWorkID.removeFromAllWindows();
    OpenAlexWorkID = undefined;
}