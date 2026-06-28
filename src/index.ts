import Addon from "./addon";
import { config } from "../package.json";
import { openAlexWorkID } from "./modules/openalex";

if (!(Zotero as any)[config.addonInstance]) {
  _globalThis.addon = new Addon();
  (Zotero as any)[config.addonInstance] = _globalThis.addon;

  Object.defineProperty(_globalThis, "OpenAlexWorkID", {
    get() {
      return openAlexWorkID;
    },
  });
}
