import { openAlexWorkID } from "./modules/openalex";
import { config } from "../package.json";
import { version } from "../package.json";

async function onStartup() {
  try {
    Zotero.PreferencePanes.register({
      pluginID: config.addonID,
      src: rootURI + "preferences.xhtml",
      scripts: [rootURI + "preferences.js"],
      label: "Zotero OpenAlex",
      image: rootURI + "content/icons/openalex.svg",
    });
  } catch (error) {
    Zotero.debug("OpenAlex: preference pane registration skipped.");
    Zotero.debug(error);
  }

  openAlexWorkID.init({
    id: config.addonID,
    version,
    rootURI,
  });

  try {
    await openAlexWorkID.main();
  } catch (error) {
    Zotero.debug("OpenAlex: startup main failed.");
    Zotero.debug(error);
  }

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow) {
  openAlexWorkID.addToWindow(win as any);
}

async function onMainWindowUnload(win: _ZoteroTypes.MainWindow) {
  openAlexWorkID.removeFromWindow(win as any);
}

async function onShutdown() {
  openAlexWorkID.removeFromAllWindows();
  openAlexWorkID.unregisterCitationColumn();
  try {
    await openAlexWorkID.shutdown();
  } catch (error) {
    Zotero.debug("OpenAlex: failed closing metadata database.");
    Zotero.debug(error);
  }
  addon.data.alive = false;
  delete (Zotero as any)[addon.data.config.addonInstance];
}

async function onAppShutdown() {
  await openAlexWorkID.shutdown();
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onAppShutdown,
};
