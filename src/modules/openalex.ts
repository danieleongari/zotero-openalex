import {
  GRAPH_PHYSICS_FIELD_CONFIG,
  GRAPH_PHYSICS_FIELD_KEYS,
  renderCollectionCitationGraphWindow,
  type GraphPhysicsSettings,
} from "./citationGraphWindow";

const OPENALEX_BASE_URL = "https://api.openalex.org";
const WORK_ID_PREFIX = "openalex.work_id:";
const CIT_COUNT_PREFIX = "openalex.cit_count:";
const CIT_DATE_PREFIX = "openalex.cit_date:";
const COLUMN_DATA_KEY = "openAlexCitations";
const COLUMN_LABEL = "Citations";
const TOOLS_SYNC_MENU_ID = "openalex-startup-sync-menuitem";
const COLLECTION_GRAPH_MENU_ID = "openalex-collection-citation-graph-menuitem";
const OPENALEX_API_KEY_PREF = "extensions.zotero-openalex.apiKey";
const OPENALEX_CORRECT_ARXIV_PREF = "correctArxivArticles";
const GRAPH_SHOW_TUNING_CONTROLS_PREF = "showGraphTuningControls";

const DOI_PATTERN = /\b10\.\d{4,9}\/[\-._;()/:A-Z0-9]+\b/i;
const ARXIV_URL_PATTERN = /arxiv\.org\/(?:abs|pdf)\/([^?#\s]+?)(?:\.pdf)?(?:[?#].*)?$/i;
const ARXIV_ID_MODERN_PATTERN = /^\d{4}\.\d{4,5}$/;
const ARXIV_ID_LEGACY_PATTERN = /^[a-z-]+(?:\.[a-z-]+)?\/\d{7}$/i;
const ARXIV_DOI_PREFIX = "10.48550/arXiv.";
const WORK_ID_LINE_PATTERN = /^openalex\.work_id:\s*(W\d+)\s*$/i;
const CIT_COUNT_LINE_PATTERN = /^openalex\.cit_count:\s*(\d+)\s*$/i;
const CIT_DATE_LINE_PATTERN = /^openalex\.cit_date:\s*(\d{4}-\d{1,2}-\d{1,2})\s*$/i;
const CITATION_KEY_LINE_PATTERN = /^Citation Key:\s*\S+/i;

interface OpenAlexMetadata {
  workID: string | null;
  citationCount: number | null;
  citationDate: Date | null;
}

interface UpdateOutcome {
  status: "updated" | "unchanged" | "skipped";
  message?: string;
}

interface OpenAlexWork {
  id?: string;
  cited_by_count?: number | string;
}

interface OpenAlexGraphWork extends OpenAlexWork {
  display_name?: string;
  publication_year?: number | string;
  referenced_works?: string[];
}

interface CollectionGraphNode {
  id: string;
  itemID: number;
  workID: string;
  label: string;
  citationCount: number | null;
  referencesCount: number | null;
  year: number | null;
  publisher: string | null;
  firstAuthor: string | null;
  lastAuthor: string | null;
  publicationDate: string | null;
  collectionPaths: string[];
}

interface CollectionGraphEdge {
  source: string;
  target: string;
}

interface CollectionGraphData {
  collectionName: string;
  nodes: CollectionGraphNode[];
  edges: CollectionGraphEdge[];
  skippedMissingWorkID: number;
  fetchFailures: number;
}

interface GraphScopeData {
  items: Zotero.Item[];
  collectionPathsByItemID: Map<number, string[]>;
}

interface DOIResolution {
  doi: string | null;
  arxivDOI: string | null;
  fromArxivURL: boolean;
}

let startupSyncInProgress = false;
let citationColumnRegistered = false;
let citationColumnRegistrationToken: string | null = null;
let startupInfoWindow: any = null;
let startupInfoUsesLineAPI = false;
let openAlexLastErrorMessage = "";

class OpenAlexWorkIDClass {
  private id = "";
  private version = "";
  private rootURI = "";
  private windowCleanup = new WeakMap<
    Window,
    {
      onItemPopupShowing?: () => void;
      onItemCommand?: () => void;
      onCollectionPopupShowing?: () => void;
      onCollectionCommand?: () => void;
      onSyncCommand?: () => void;
    }
  >();

  init({ id, version, rootURI }: { id: string; version: string; rootURI: string }) {
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
  }

  addToWindow(window: Window) {
    const doc = window.document;
    const itemMenuPopup = doc.querySelector("#zotero-itemmenu");
    const collectionMenuPopup = getCollectionMenuPopup(doc);
    if (!itemMenuPopup) return;

    this.removeFromWindow(window);

    const menuItem = doc.createXULElement("menuitem");
    menuItem.setAttribute("label", "Get OpenAlex-WorkID");
    menuItem.setAttribute("id", "workid-menuitem");
    const onItemCommand = async () => {
      try {
        await this.updateSelectedItems(window);
      } catch (error) {
        Zotero.debug("Error updating OpenAlex data from selection");
        Zotero.debug(error);
        window.alert("An error occurred while processing OpenAlex metadata.");
      }
    };
    menuItem.addEventListener("command", onItemCommand);

    itemMenuPopup.appendChild(menuItem);

    const onItemPopupShowing = () => {
      const pane = Zotero.getActiveZoteroPane();
      const selectedItems = pane ? pane.getSelectedItems() : [];
      (menuItem as any).hidden = selectedItems.length === 0;
    };
    itemMenuPopup.addEventListener("popupshowing", onItemPopupShowing);

    const collectionGraphMenuItem = doc.createXULElement("menuitem");
    collectionGraphMenuItem.setAttribute("label", "Generate OpenAlex Citation Graph...");
    collectionGraphMenuItem.setAttribute("id", COLLECTION_GRAPH_MENU_ID);

    const onCollectionCommand = async () => {
      try {
        await this.openCollectionCitationGraph(window);
      } catch (error) {
        Zotero.debug("Error opening OpenAlex citation graph");
        Zotero.debug(error);
        window.alert(`An error occurred while building the citation graph: ${String(error)}`);
      }
    };
    if (collectionMenuPopup) {
      collectionGraphMenuItem.addEventListener("command", onCollectionCommand);
      collectionMenuPopup.appendChild(collectionGraphMenuItem);

      const onCollectionPopupShowing = () => {
        const hasSelection = hasGraphScopeSelection();
        (collectionGraphMenuItem as any).hidden = !hasSelection;
      };
      collectionMenuPopup.addEventListener("popupshowing", onCollectionPopupShowing);

      this.windowCleanup.set(window, {
        onItemPopupShowing,
        onItemCommand,
        onCollectionPopupShowing,
        onCollectionCommand,
        onSyncCommand: this.addToolsSyncMenu(window),
      });
      return;
    }

    this.windowCleanup.set(window, {
      onItemPopupShowing,
      onItemCommand,
      onSyncCommand: this.addToolsSyncMenu(window),
    });
  }

  addToolsSyncMenu(window: Window) {
    const doc = window.document;
    const toolsPopup = doc.getElementById("menu_ToolsPopup");
    if (!toolsPopup) return undefined;

    const syncMenuItem = doc.createXULElement("menuitem");
    syncMenuItem.setAttribute("id", TOOLS_SYNC_MENU_ID);
    syncMenuItem.setAttribute("label", "Run OpenAlex Startup Sync");
    const onSyncCommand = () => {
      void this.runStartupSync({ forceRun: true, showSummary: true, source: "manual" });
    };
    syncMenuItem.addEventListener("command", onSyncCommand);
    toolsPopup.appendChild(syncMenuItem);

    return onSyncCommand;
  }

  removeFromWindow(window: Window) {
    const doc = window.document;
    const cleanup = this.windowCleanup.get(window);

    const menuItem = doc.getElementById("workid-menuitem");
    if (menuItem && cleanup?.onItemCommand) {
      menuItem.removeEventListener("command", cleanup.onItemCommand);
    }

    const itemMenuPopup = doc.querySelector("#zotero-itemmenu");
    if (itemMenuPopup && cleanup?.onItemPopupShowing) {
      itemMenuPopup.removeEventListener("popupshowing", cleanup.onItemPopupShowing);
    }

    if (menuItem) {
      menuItem.remove();
    }

    const collectionMenuPopup = getCollectionMenuPopup(doc);
    const collectionMenuItem = doc.getElementById(COLLECTION_GRAPH_MENU_ID);
    if (collectionMenuItem && cleanup?.onCollectionCommand) {
      collectionMenuItem.removeEventListener("command", cleanup.onCollectionCommand);
    }
    if (collectionMenuPopup && cleanup?.onCollectionPopupShowing) {
      collectionMenuPopup.removeEventListener("popupshowing", cleanup.onCollectionPopupShowing);
    }
    if (collectionMenuItem) {
      collectionMenuItem.remove();
    }

    const toolsMenuItem = doc.getElementById(TOOLS_SYNC_MENU_ID);
    if (toolsMenuItem && cleanup?.onSyncCommand) {
      toolsMenuItem.removeEventListener("command", cleanup.onSyncCommand);
    }
    if (toolsMenuItem) {
      toolsMenuItem.remove();
    }

    this.windowCleanup.delete(window);
  }

  addToAllWindows() {
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      this.addToWindow(win as unknown as Window);
    }
  }

  removeFromAllWindows() {
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      this.removeFromWindow(win as unknown as Window);
    }
  }

  registerCitationColumn() {
    if (citationColumnRegistered) {
      return;
    }

    if (
      !Zotero.ItemTreeManager ||
      typeof (Zotero.ItemTreeManager as any).registerColumn !== "function"
    ) {
      Zotero.debug("OpenAlex: ItemTreeManager.registerColumn is unavailable.");
      return;
    }

    try {
      citationColumnRegistrationToken = (Zotero.ItemTreeManager as any).registerColumn({
        pluginID: "zotero-openalex@example.com",
        dataKey: COLUMN_DATA_KEY,
        label: COLUMN_LABEL,
        width: "80",
        flex: 0,
        zoteroPersist: ["width", "ordinal", "hidden", "sortDirection"],
        dataProvider(item: Zotero.Item) {
          if (!item || !item.isRegularItem()) {
            return "";
          }

          const metadata = parseOpenAlexMetadata(item.getField("extra") || "");
          return metadata.citationCount === null ? "-" : String(metadata.citationCount);
        },
        renderCell(
          _index: number,
          data: string,
          column: any,
          _isFirstColumn: boolean,
          doc: Document,
        ) {
          const span = doc.createElement("span");
          span.className = `cell ${column.className || ""}`;
          span.style.textAlign = "center";
          span.innerText = data || "-";
          return span;
        },
      });
      citationColumnRegistered = true;
    } catch (error) {
      Zotero.debug("OpenAlex: failed to register Citations column");
      Zotero.debug(error);
    }
  }

  unregisterCitationColumn() {
    if (!citationColumnRegistered) {
      return;
    }

    const manager = Zotero.ItemTreeManager as any;
    if (!manager || typeof manager.unregisterColumn !== "function") {
      citationColumnRegistered = false;
      citationColumnRegistrationToken = null;
      return;
    }

    try {
      if (citationColumnRegistrationToken) {
        manager.unregisterColumn(citationColumnRegistrationToken);
      }
    } catch (error) {
      Zotero.debug("OpenAlex: failed to unregister Citations column");
      Zotero.debug(error);
    } finally {
      citationColumnRegistered = false;
      citationColumnRegistrationToken = null;
    }
  }

  async updateSelectedItems(window: Window) {
    const selectedItems = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];
    if (!selectedItems.length) {
      window.alert("No items selected.");
      return;
    }

    const numItems = selectedItems.length;
    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;

    for (const item of selectedItems) {
      if (!item.isRegularItem()) {
        skippedCount++;
        if (numItems === 1) {
          window.alert("Selected item is not a regular Zotero item.");
        }
        continue;
      }

      const outcome = await this.updateSingleItem(item, { refreshCitationDate: true });
      if (outcome.status === "updated") {
        updatedCount++;
      } else if (outcome.status === "unchanged") {
        unchangedCount++;
      } else {
        skippedCount++;
      }

      if (numItems === 1) {
        if (outcome.status === "updated") {
          window.alert(outcome.message || "OpenAlex metadata updated.");
        } else if (outcome.status === "unchanged") {
          window.alert("OpenAlex metadata is already up to date.");
        } else {
          window.alert(outcome.message || "No OpenAlex data found for the selected item.");
        }
      }
    }

    if (numItems > 1) {
      window.alert(
        `Finished OpenAlex update for ${numItems} items (${updatedCount} updated, ${unchangedCount} unchanged, ${skippedCount} skipped).`,
      );
    }
  }

  async updateSingleItem(
    item: Zotero.Item,
    { refreshCitationDate = false } = {},
  ): Promise<UpdateOutcome> {
    if (!item || !item.isRegularItem()) {
      return { status: "skipped", message: "Item is not a regular Zotero item." };
    }

    clearOpenAlexLastError();

    const extra = (item.getField("extra") as string) || "";
    const current = parseOpenAlexMetadata(extra);
    let itemChanged = false;

    let apiWork: OpenAlexWork | null = null;
    if (current.workID) {
      apiWork = await fetchOpenAlexWorkByID(current.workID);
    }

    if (!apiWork) {
      const doiResolution = resolveDOIForLookup(item, extra);
      if (doiResolution.fromArxivURL) {
        itemChanged = applyArXivCorrections(item, doiResolution.arxivDOI) || itemChanged;
      }

      const doi = doiResolution.doi;
      if (!doi) {
        if (itemChanged) {
          await item.saveTx();
          return { status: "updated", message: "arXiv metadata corrected." };
        }
        return {
          status: "skipped",
          message: "No DOI, arXiv URL, or OpenAlex-WorkID found for this item.",
        };
      }

      apiWork = await fetchOpenAlexWorkByDOI(doi);
    }

    if (!apiWork) {
      if (itemChanged) {
        await item.saveTx();
        return {
          status: "updated",
          message: "arXiv metadata corrected. No matching OpenAlex Work found.",
        };
      }

      const apiError = getOpenAlexLastError();
      if (apiError) {
        return { status: "skipped", message: `OpenAlex lookup failed: ${apiError}` };
      }
      return { status: "skipped", message: "No matching OpenAlex Work found." };
    }

    const fetchedWorkID = normalizeOpenAlexID(apiWork.id) || current.workID;
    const fetchedCitationCount = normalizeCitationCount(apiWork.cited_by_count);
    const shouldReplaceCitation =
      fetchedCitationCount !== null &&
      (refreshCitationDate || fetchedCitationCount !== current.citationCount);

    const updatedExtra = upsertOpenAlexMetadata(extra, {
      workID: fetchedWorkID,
      replaceCitation: shouldReplaceCitation,
      citationCount: fetchedCitationCount,
    });
    const extraChanged = updatedExtra !== extra;

    if (!extraChanged && !itemChanged) {
      return { status: "unchanged" };
    }

    if (extraChanged) {
      item.setField("extra", updatedExtra);
    }
    await item.saveTx();
    return { status: "updated" };
  }

  async openCollectionCitationGraph(window: Window) {
    const collection = getSelectedCollection();
    const libraryID = isLibrarySelectionActive() ? getSelectedLibraryID() : undefined;
    if (!collection && !libraryID) {
      window.alert("No collection or library selected.");
      return;
    }

    const graphWindow = openCollectionCitationGraphShellWindow();

    const updateProgress = (message: string, progress: number) => {
      Zotero.debug(`OpenAlex graph: ${message}`);
      updateCollectionCitationGraphShellStatus(graphWindow, message, progress);
    };

    try {
      const graphData = collection
        ? await buildCollectionCitationGraphData(collection, updateProgress)
        : await buildLibraryCitationGraphData(libraryID as number, updateProgress);
      if (!graphData.nodes.length) {
        const scopeLabel = collection ? "selected collection tree" : "selected library collections";
        updateProgress(`No eligible items found in the ${scopeLabel}.`, 100);
        window.alert(
          "No graph could be generated. Ensure some items have openalex.work_id in Extra.",
        );
        try {
          graphWindow?.close();
        } catch {
          // Ignore close errors.
        }
        return;
      }

      updateProgress(`Done: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`, 100);

      if (graphWindow && !graphWindow.closed) {
        renderCollectionCitationGraphWindow(graphWindow, graphData, {
          physics: getGraphPhysicsSettings(),
          showTuningControls: getBooleanPref(GRAPH_SHOW_TUNING_CONTROLS_PREF, false),
        });
      } else {
        openCollectionCitationGraphWindow(graphData);
      }
    } catch (error) {
      Zotero.debug("OpenAlex collection citation graph failed");
      Zotero.debug(error);
      updateProgress(`Failed: ${String(error)}`, 100);
      try {
        graphWindow?.close();
      } catch {
        // Ignore close errors.
      }
      window.alert(`Failed to build citation graph: ${String(error)}`);
    }
  }

  async main() {
    await waitForZoteroReady();

    this.addToAllWindows();
    this.registerCitationColumn();

    const autoUpdateOnStartup = getBooleanPref("autoUpdateOnStartup", true);
    if (!autoUpdateOnStartup) {
      return;
    }

    const startupDelayMs = Math.max(0, getNumberPref("startupDelayMs", 3000));
    setTimeout(() => {
      void this.runStartupSync({ source: "startup" });
    }, startupDelayMs);
  }

  async runStartupSync({
    forceRun = false,
    showSummary,
    source = "startup",
  }: {
    forceRun?: boolean;
    showSummary?: boolean;
    source?: string;
  } = {}) {
    const autoUpdateOnStartup = getBooleanPref("autoUpdateOnStartup", true);
    const shouldRun = forceRun || autoUpdateOnStartup;
    if (!shouldRun) {
      return;
    }

    const shouldShowSummary =
      typeof showSummary === "boolean" ? showSummary : getBooleanPref("showStartupSummary", true);

    if (startupSyncInProgress) {
      if (shouldShowSummary) {
        showStatusMessage("OpenAlex", "Startup sync is already running.");
        closeStatusWindow(2000);
      }
      return;
    }

    startupSyncInProgress = true;

    try {
      if (shouldShowSummary) {
        showStatusMessage("OpenAlex", `Startup sync started (${source}).`);
      }

      const staleMonths = getNumberPref("staleMonths", 3);
      const requestDelayMs = getNumberPref("requestDelayMs", 1000);

      let allRegularItems: Zotero.Item[] = [];
      try {
        allRegularItems = await getAllRegularItems();
      } catch (error) {
        Zotero.debug("OpenAlex startup sync: failed loading regular items");
        Zotero.debug(error);
        allRegularItems = [];
      }

      const candidates: Zotero.Item[] = [];
      for (const item of allRegularItems) {
        try {
          if (shouldUpdateOnStartup(item, staleMonths)) {
            candidates.push(item);
          }
        } catch (error) {
          Zotero.debug(`OpenAlex startup sync: failed eligibility check for item ${item?.id}`);
          Zotero.debug(error);
        }
      }

      Zotero.debug(
        `OpenAlex startup sync: ${candidates.length} candidate items out of ${allRegularItems.length}.`,
      );

      if (candidates.length === 0) {
        if (shouldShowSummary) {
          showStatusMessage("OpenAlex", "Startup sync ran: no items needed updates.");
          closeStatusWindow(2200);
        }
        return;
      }

      let updatedCount = 0;
      let unchangedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        let outcome: UpdateOutcome;
        try {
          outcome = await this.updateSingleItem(item, { refreshCitationDate: true });
        } catch (error) {
          Zotero.debug(`OpenAlex startup sync: item ${item.id} failed`);
          Zotero.debug(error);
          skippedCount++;
          if (requestDelayMs > 0 && i < candidates.length - 1) {
            await delay(requestDelayMs);
          }
          continue;
        }

        if (outcome.status === "updated") {
          updatedCount++;
        } else if (outcome.status === "unchanged") {
          unchangedCount++;
        } else {
          skippedCount++;
        }

        if (requestDelayMs > 0 && i < candidates.length - 1) {
          await delay(requestDelayMs);
        }
      }

      Zotero.debug(
        `OpenAlex startup sync complete: ${updatedCount} updated, ${unchangedCount} unchanged, ${skippedCount} skipped.`,
      );

      if (shouldShowSummary) {
        showStatusMessage(
          "OpenAlex",
          `Startup sync done: ${updatedCount} updated, ${unchangedCount} unchanged, ${skippedCount} skipped.`,
        );
        closeStatusWindow(2600);
      }

      const manager = Zotero.ItemTreeManager as any;
      if (manager && typeof manager.refreshColumns === "function") {
        manager.refreshColumns();
      }
    } catch (error) {
      Zotero.debug("OpenAlex startup sync failed");
      Zotero.debug(error);
      if (shouldShowSummary) {
        showStatusMessage(
          "OpenAlex",
          `Startup sync failed: ${String(error)}. Check Zotero debug output.`,
        );
        closeStatusWindow(3000);
      }
    } finally {
      startupSyncInProgress = false;
    }
  }
}

export const openAlexWorkID = new OpenAlexWorkIDClass();

function getCollectionMenuPopup(doc: Document) {
  return doc.querySelector("#zotero-collectionmenu");
}

function getSelectedCollectionID() {
  return Zotero.getMainWindow()?.ZoteroPane?.getSelectedCollection(true);
}

function getSelectedCollection() {
  return Zotero.getMainWindow()?.ZoteroPane?.getSelectedCollection();
}

function getSelectedLibraryID() {
  return Zotero.getMainWindow()?.ZoteroPane?.getSelectedLibraryID?.();
}

function isLibrarySelectionActive() {
  const pane = Zotero.getMainWindow()?.ZoteroPane;
  if (!pane) return false;

  if (pane.getSelectedCollection?.(true)) {
    return false;
  }

  if (pane.getSelectedSavedSearch?.(true)) {
    return false;
  }

  const libraryID = pane.getSelectedLibraryID?.();
  return typeof libraryID === "number" && libraryID > 0;
}

function hasGraphScopeSelection() {
  if (getSelectedCollectionID()) {
    return true;
  }
  return isLibrarySelectionActive();
}

async function buildCollectionCitationGraphData(
  rootCollection: Zotero.Collection,
  updateProgress: (message: string, progress: number) => void,
): Promise<CollectionGraphData> {
  const scopedData = collectCollectionItemsRecursively(rootCollection);
  return buildCitationGraphDataFromScope(
    rootCollection.name,
    scopedData,
    updateProgress,
    "Reading collection and subcollections...",
  );
}

async function buildLibraryCitationGraphData(
  libraryID: number,
  updateProgress: (message: string, progress: number) => void,
): Promise<CollectionGraphData> {
  const libraryName = String(Zotero.Libraries.getName(libraryID) || `Library ${libraryID}`).trim();
  const scopedData = collectLibraryItemsRecursively(libraryID, libraryName);
  return buildCitationGraphDataFromScope(
    libraryName,
    scopedData,
    updateProgress,
    "Reading library collections...",
  );
}

async function buildCitationGraphDataFromScope(
  scopeName: string,
  scopedData: GraphScopeData,
  updateProgress: (message: string, progress: number) => void,
  initialProgressMessage: string,
): Promise<CollectionGraphData> {
  updateProgress(initialProgressMessage, 8);
  const scopedItems = scopedData.items;

  const eligibleNodes: CollectionGraphNode[] = [];
  let skippedMissingWorkID = 0;

  for (const item of scopedItems) {
    const extra = (item.getField("extra") as string) || "";
    const metadata = parseOpenAlexMetadata(extra);
    if (!metadata.workID) {
      skippedMissingWorkID++;
      continue;
    }

    const title = getItemTitleSafe(item);
    const authorDateInfo = extractLocalNodeAuthorAndDate(item);
    const collectionPaths = scopedData.collectionPathsByItemID.get(item.id) || [];
    eligibleNodes.push({
      id: `n${item.id}`,
      itemID: item.id,
      workID: metadata.workID,
      label: truncateLabel(title || "Untitled", 84),
      citationCount: metadata.citationCount,
      referencesCount: null,
      year: normalizeYear(item.getField("date") as string),
      publisher: extractPublisherForHover(item),
      firstAuthor: authorDateInfo.firstAuthor,
      lastAuthor: authorDateInfo.lastAuthor,
      publicationDate: authorDateInfo.itemDate,
      collectionPaths,
    });
  }

  if (!eligibleNodes.length) {
    return {
      collectionName: scopeName,
      nodes: [],
      edges: [],
      skippedMissingWorkID,
      fetchFailures: 0,
    };
  }

  updateProgress("Fetching OpenAlex references...", 18);

  const nodeIDsByWorkID = new Map<string, string[]>();
  for (const node of eligibleNodes) {
    const current = nodeIDsByWorkID.get(node.workID) || [];
    current.push(node.id);
    nodeIDsByWorkID.set(node.workID, current);
  }

  const requestDelayMs = Math.max(0, getNumberPref("requestDelayMs", 1000));
  const workCache = new Map<string, OpenAlexGraphWork | null>();
  const edgeKeySet = new Set<string>();
  let fetchFailures = 0;

  for (let index = 0; index < eligibleNodes.length; index++) {
    const source = eligibleNodes[index];
    const progress = 18 + Math.floor((index / eligibleNodes.length) * 76);
    updateProgress(`Reading references for ${index + 1}/${eligibleNodes.length}...`, progress);

    const work = await fetchOpenAlexGraphWorkByID(source.workID, workCache);
    if (!work) {
      fetchFailures++;
      continue;
    }

    const openAlexCitationCount = normalizeCitationCount(work.cited_by_count);
    if (openAlexCitationCount !== null) {
      source.citationCount = openAlexCitationCount;
    }

    const references = Array.isArray(work.referenced_works) ? work.referenced_works : [];
    source.referencesCount = references.length;
    for (const rawRef of references) {
      const referencedWorkID = normalizeOpenAlexID(rawRef);
      if (!referencedWorkID) continue;

      const targetNodeIDs = nodeIDsByWorkID.get(referencedWorkID) || [];
      for (const targetNodeID of targetNodeIDs) {
        if (targetNodeID === source.id) continue;
        edgeKeySet.add(`${source.id}|${targetNodeID}`);
      }
    }

    if (requestDelayMs > 0 && index < eligibleNodes.length - 1) {
      await delay(requestDelayMs);
    }
  }

  const edges: CollectionGraphEdge[] = [...edgeKeySet]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => {
      const [source, target] = key.split("|");
      return { source, target };
    });

  updateProgress("Finalizing graph...", 96);

  return {
    collectionName: scopeName,
    nodes: eligibleNodes,
    edges,
    skippedMissingWorkID,
    fetchFailures,
  };
}

function collectCollectionItemsRecursively(rootCollection: Zotero.Collection): GraphScopeData {
  return collectItemsFromCollectionRoots([
    { collection: rootCollection, path: rootCollection.name },
  ]);
}

function collectLibraryItemsRecursively(libraryID: number, libraryName: string): GraphScopeData {
  const libraryCollections = Zotero.Collections.getByLibrary(libraryID, false) || [];
  const topLevelCollections = libraryCollections.filter((collection) => !collection.parentID);

  return collectItemsFromCollectionRoots(
    topLevelCollections.map((collection) => ({
      collection,
      path: `${libraryName} / ${collection.name}`,
    })),
  );
}

function collectItemsFromCollectionRoots(
  roots: Array<{ collection: Zotero.Collection; path: string }>,
): GraphScopeData {
  const itemByID = new Map<number, Zotero.Item>();
  const collectionPathsByItemID = new Map<number, Set<string>>();
  const queue = [...roots];
  const seenCollectionIDs = new Set<number>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const currentCollection = current.collection;
    if (seenCollectionIDs.has(currentCollection.id)) continue;
    seenCollectionIDs.add(currentCollection.id);

    const rawItems = currentCollection.getChildItems(false, false) || [];
    const scopedItems = rawItems.filter((item) => {
      try {
        return item.isRegularItem() && item.isTopLevelItem();
      } catch (_error) {
        return false;
      }
    });

    for (const item of scopedItems) {
      itemByID.set(item.id, item);
      if (!collectionPathsByItemID.has(item.id)) {
        collectionPathsByItemID.set(item.id, new Set<string>());
      }
      collectionPathsByItemID.get(item.id)?.add(current.path);
    }

    const childCollections = ((currentCollection as any).getChildCollections?.(false, false) ||
      []) as Zotero.Collection[];

    for (const child of childCollections) {
      if (!seenCollectionIDs.has(child.id)) {
        queue.push({
          collection: child,
          path: `${current.path} / ${child.name}`,
        });
      }
    }
  }

  return {
    items: [...itemByID.values()],
    collectionPathsByItemID: new Map<number, string[]>(
      [...collectionPathsByItemID.entries()].map(([itemID, paths]) => [
        itemID,
        [...paths].sort((left, right) => left.localeCompare(right)),
      ]),
    ),
  };
}

function truncateLabel(value: string, maxLength: number) {
  const trimmed = String(value || "").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function getItemTitleSafe(item: Zotero.Item) {
  const rawTitle = String(item.getField("title") || "").trim();
  if (rawTitle) return rawTitle;

  const maybeDisplayTitle = (item as any).getDisplayTitle;
  if (typeof maybeDisplayTitle === "function") {
    try {
      const fallback = String(maybeDisplayTitle.call(item) || "").trim();
      if (fallback) return fallback;
    } catch (_error) {
      // Ignore and keep fallback below.
    }
  }

  return "Untitled";
}

function extractPublisherForHover(item: Zotero.Item) {
  const publisher = String(item.getField("publisher") || "").trim();
  if (publisher) return publisher;

  const publicationTitle = String(item.getField("publicationTitle") || "").trim();
  if (publicationTitle) return publicationTitle;

  return null;
}

function extractLocalNodeAuthorAndDate(item: Zotero.Item) {
  const creators = (((item as any).getCreators?.() || []) as any[]).filter((creator) => creator);
  const authorLikeCreators = creators.filter((creator) => {
    const typeName = getCreatorTypeName(creator);
    return typeName === "author" || typeName === "inventor";
  });
  const creatorsForHover = authorLikeCreators.length ? authorLikeCreators : creators;

  let firstAuthor = creatorsForHover.length ? formatCreatorName(creatorsForHover[0]) : undefined;
  let lastAuthor = creatorsForHover.length
    ? formatCreatorName(creatorsForHover[creatorsForHover.length - 1])
    : undefined;

  const firstCreatorField = String((item as any).firstCreator || "").trim();
  if (!firstAuthor && firstCreatorField) {
    firstAuthor = firstCreatorField;
  }
  if (!lastAuthor && firstCreatorField) {
    lastAuthor = firstCreatorField;
  }

  const itemDate = String(item.getField("date") || "").trim() || undefined;
  return {
    firstAuthor: firstAuthor || null,
    lastAuthor: lastAuthor || null,
    itemDate: itemDate || null,
  };
}

function formatCreatorName(creator: any): string | undefined {
  const singleFieldName = String(creator?.name || "").trim();
  if (singleFieldName) {
    return singleFieldName;
  }

  const lastName = String(creator?.lastName || "").trim();
  const firstName = String(creator?.firstName || "").trim();

  if (lastName && firstName) {
    return `${lastName}, ${firstName}`;
  }
  if (lastName) {
    return lastName;
  }
  if (firstName) {
    return firstName;
  }
  return undefined;
}

function getCreatorTypeName(creator: any) {
  const directType = String(creator?.creatorType || creator?.creatorTypeName || "")
    .trim()
    .toLowerCase();
  if (directType) {
    return directType;
  }

  const creatorTypeID = Number.parseInt(String(creator?.creatorTypeID), 10);
  if (Number.isFinite(creatorTypeID) && (Zotero as any).CreatorTypes?.getName) {
    try {
      return String((Zotero as any).CreatorTypes.getName(creatorTypeID) || "")
        .trim()
        .toLowerCase();
    } catch (_error) {
      return "";
    }
  }

  return "";
}

function normalizeYear(value: string | undefined) {
  if (!value) return null;
  const match = String(value).match(/\b(18|19|20|21)\d{2}\b/);
  return match ? Number.parseInt(match[0], 10) : null;
}

async function fetchOpenAlexGraphWorkByID(
  workID: string,
  cache: Map<string, OpenAlexGraphWork | null>,
) {
  const normalizedWorkID = normalizeOpenAlexID(workID);
  if (!normalizedWorkID) return null;

  if (cache.has(normalizedWorkID)) {
    return cache.get(normalizedWorkID) || null;
  }

  const params = buildOpenAlexParams({
    select: "id,display_name,publication_year,referenced_works,cited_by_count",
  });
  const url = `${OPENALEX_BASE_URL}/works/${normalizedWorkID}?${params.toString()}`;
  const work = (await requestOpenAlexJSON(url)) as OpenAlexGraphWork | null;
  cache.set(normalizedWorkID, work || null);
  return work || null;
}

function openCollectionCitationGraphWindow(graphData: CollectionGraphData) {
  const popup = openCollectionCitationGraphShellWindow();
  if (!popup) {
    throw new Error("Unable to open graph window.");
  }
  renderCollectionCitationGraphWindow(popup, graphData, {
    physics: getGraphPhysicsSettings(),
    showTuningControls: getBooleanPref(GRAPH_SHOW_TUNING_CONTROLS_PREF, false),
  });
}

function openCollectionCitationGraphShellWindow() {
  const mainWin = Zotero.getMainWindow() as Window | undefined;
  if (!mainWin) {
    return null;
  }

  const availableWidthRaw = Number(mainWin.screen?.availWidth || mainWin.innerWidth || 1280);
  const availableHeightRaw = Number(mainWin.screen?.availHeight || mainWin.innerHeight || 900);

  const availableWidth =
    Number.isFinite(availableWidthRaw) && availableWidthRaw > 0 ? availableWidthRaw : 1280;
  const availableHeight =
    Number.isFinite(availableHeightRaw) && availableHeightRaw > 0 ? availableHeightRaw : 900;

  const minWidth = 760;
  const minHeight = 520;
  const targetWidth = 1200;
  const targetHeight = 820;

  const width = Math.max(minWidth, Math.min(targetWidth, Math.floor(availableWidth - 36)));
  const height = Math.max(minHeight, Math.min(targetHeight, Math.floor(availableHeight - 64)));

  const left = Math.max(0, Math.floor((availableWidth - width) / 2));
  const top = Math.max(0, Math.floor((availableHeight - height) / 2));

  let popup: Window | null = null;
  try {
    if (typeof (mainWin as any).openDialog === "function") {
      popup = (mainWin as any).openDialog(
        "about:blank",
        "_blank",
        `chrome,dialog=no,resizable,centerscreen,width=${width},height=${height}`,
      ) as Window;
    }
  } catch (error) {
    Zotero.debug("OpenAlex graph: openDialog failed");
    Zotero.debug(error);
    popup = null;
  }

  if (!popup) {
    try {
      if (typeof mainWin.open === "function") {
        popup = mainWin.open(
          "about:blank",
          "_blank",
          `popup=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`,
        );
      }
    } catch (error) {
      Zotero.debug("OpenAlex graph: window.open failed");
      Zotero.debug(error);
      popup = null;
    }
  }

  if (!popup) {
    return null;
  }

  const loadingHTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>OpenAlex Citation Graph</title>
  <style>
    :root {
      color-scheme: dark;
      --bg-0: #0d121a;
      --bg-1: #131b27;
      --panel: rgba(17, 26, 38, 0.9);
      --border: #2b3d53;
      --text: #d6e4f2;
      --muted: #8ca3bb;
      --accent: #53a1ff;
    }

    body {
      font-family: "Segoe UI", "Noto Sans", sans-serif;
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(1200px 650px at 110% -8%, rgba(58, 109, 171, 0.24), transparent 70%),
        radial-gradient(900px 600px at -20% 120%, rgba(88, 53, 131, 0.16), transparent 75%),
        linear-gradient(165deg, var(--bg-1), var(--bg-0));
      color: var(--text);
    }

    .card {
      width: min(560px, calc(100% - 32px));
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 12px 34px rgba(3, 8, 13, 0.35);
      backdrop-filter: blur(3px);
    }

    .title {
      font-size: 13px;
      font-weight: 600;
      color: #e8f4ff;
      letter-spacing: 0.01em;
      margin-bottom: 6px;
    }

    .status {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }

    .status::before {
      content: "";
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      margin-right: 8px;
      background: var(--accent);
      box-shadow: 0 0 0 5px rgba(83, 161, 255, 0.16);
      vertical-align: middle;
      animation: pulse 1.25s ease-in-out infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(0.85);
        opacity: 0.72;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">OpenAlex Citation Graph</div>
    <div class="status" id="graph-loading-status">Building citation graph...</div>
  </div>
</body>
</html>`;
  popup.document.open();
  popup.document.write(loadingHTML);
  popup.document.close();
  return popup;
}

function updateCollectionCitationGraphShellStatus(
  popup: Window | null,
  message: string,
  progress?: number,
) {
  if (!popup || popup.closed) {
    return;
  }

  try {
    const doc = popup.document;
    const statusNode = doc.getElementById("graph-loading-status");
    if (!statusNode) {
      return;
    }

    const progressText =
      typeof progress === "number" && Number.isFinite(progress)
        ? ` (${Math.max(0, Math.min(100, Math.round(progress)))}%)`
        : "";
    statusNode.textContent = `${message}${progressText}`;
  } catch (_error) {
    // Ignore status update errors in partially closed windows.
  }
}

function parseOpenAlexMetadata(extra: string): OpenAlexMetadata {
  const metadata: OpenAlexMetadata = {
    workID: null,
    citationCount: null,
    citationDate: null,
  };

  if (!extra) return metadata;

  const lines = extra.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = WORK_ID_LINE_PATTERN.exec(line);
    if (match && match[1]) {
      metadata.workID = normalizeOpenAlexID(match[1]) || metadata.workID;
      continue;
    }

    const countMatch = CIT_COUNT_LINE_PATTERN.exec(line);
    if (countMatch && countMatch[1]) {
      metadata.citationCount = Number.parseInt(countMatch[1], 10);
      continue;
    }

    const dateMatch = CIT_DATE_LINE_PATTERN.exec(line);
    if (dateMatch && dateMatch[1]) {
      metadata.citationDate = parseCitationDate(dateMatch[1]);
      continue;
    }
  }

  return metadata;
}

function upsertOpenAlexMetadata(
  extra: string,
  {
    workID,
    replaceCitation,
    citationCount,
  }: { workID: string | null; replaceCitation: boolean; citationCount: number | null },
) {
  const lines = (extra || "").split(/\r?\n/);
  let updatedLines = lines;

  if (workID) {
    updatedLines = updatedLines.filter((line) => !WORK_ID_LINE_PATTERN.test(line.trim()));
    insertBeforeMatch(updatedLines, CITATION_KEY_LINE_PATTERN, `${WORK_ID_PREFIX} ${workID}`);
  }

  if (replaceCitation) {
    updatedLines = updatedLines.filter(
      (line) =>
        !CIT_COUNT_LINE_PATTERN.test(line.trim()) && !CIT_DATE_LINE_PATTERN.test(line.trim()),
    );
    if (typeof citationCount === "number" && citationCount >= 0) {
      const citationDate = formatDate(new Date());
      insertBeforeMatch(
        updatedLines,
        CITATION_KEY_LINE_PATTERN,
        `${CIT_DATE_PREFIX} ${citationDate}`,
      );
      insertBeforeMatch(
        updatedLines,
        CITATION_KEY_LINE_PATTERN,
        `${CIT_COUNT_PREFIX} ${citationCount}`,
      );
    }
  }

  return normalizeExtraString(updatedLines.join("\n"));
}

function insertBeforeMatch(lines: string[], pattern: RegExp, lineToInsert: string) {
  const index = lines.findIndex((line) => pattern.test((line || "").trim()));
  if (index < 0) {
    lines.push(lineToInsert);
  } else {
    lines.splice(index, 0, lineToInsert);
  }
}

function normalizeExtraString(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractDOIForLookup(item: Zotero.Item, extra: string) {
  return resolveDOIForLookup(item, extra).doi;
}

function resolveDOIForLookup(item: Zotero.Item, extra: string): DOIResolution {
  const fromField = normalizeDOI(item.getField("DOI") as string);
  if (fromField) {
    return { doi: fromField, arxivDOI: null, fromArxivURL: false };
  }

  const fromExtra = extractDOIFromExtra(extra);
  if (fromExtra) {
    return { doi: fromExtra, arxivDOI: null, fromArxivURL: false };
  }

  if (!getBooleanPref(OPENALEX_CORRECT_ARXIV_PREF, true)) {
    return { doi: null, arxivDOI: null, fromArxivURL: false };
  }

  const arxivID = extractArXivIDFromURL(item.getField("url") as string);
  if (!arxivID) {
    return { doi: null, arxivDOI: null, fromArxivURL: false };
  }

  const arxivDOI = buildArXivDOI(arxivID);
  const normalizedArxivDOI = normalizeDOI(arxivDOI);
  if (!normalizedArxivDOI) {
    return { doi: null, arxivDOI: null, fromArxivURL: false };
  }

  return {
    doi: normalizedArxivDOI,
    arxivDOI,
    fromArxivURL: true,
  };
}

function extractDOIFromExtra(extra: string) {
  if (!extra) return null;

  const lines = extra.split(/\r?\n/);
  for (const line of lines) {
    const doiLineMatch = line.match(/^DOI:\s*(.+)$/i);
    if (doiLineMatch && doiLineMatch[1]) {
      const normalized = normalizeDOI(doiLineMatch[1]);
      if (normalized) return normalized;
    }
  }

  const rawMatch = extra.match(DOI_PATTERN);
  return rawMatch ? normalizeDOI(rawMatch[0]) : null;
}

function normalizeDOI(value: string | undefined) {
  if (!value) return null;

  let doi = String(value).trim();
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  doi = doi.replace(/^doi:\s*/i, "");
  doi = doi.replace(/\s+/g, "");

  const match = doi.match(DOI_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

function extractArXivIDFromURL(urlValue: string | undefined) {
  if (!urlValue) return null;

  const trimmed = String(urlValue).trim();
  if (!trimmed || !/arxiv/i.test(trimmed)) {
    return null;
  }

  const match = trimmed.match(ARXIV_URL_PATTERN);
  if (!match || !match[1]) {
    return null;
  }

  return normalizeArXivID(match[1]);
}

function normalizeArXivID(value: string | undefined) {
  if (!value) return null;

  let arxivID = String(value).trim();
  arxivID = arxivID.replace(/^\/+/, "").replace(/\/+$/, "");
  arxivID = arxivID.replace(/\.pdf$/i, "");
  arxivID = arxivID.replace(/v\d+$/i, "");

  if (ARXIV_ID_MODERN_PATTERN.test(arxivID)) {
    return arxivID;
  }

  if (ARXIV_ID_LEGACY_PATTERN.test(arxivID)) {
    return arxivID;
  }

  return null;
}

function buildArXivDOI(arxivID: string) {
  return `${ARXIV_DOI_PREFIX}${arxivID}`;
}

function applyArXivCorrections(item: Zotero.Item, arxivDOI: string | null) {
  if (!arxivDOI) return false;

  let changed = false;

  const currentDOI = normalizeDOI(item.getField("DOI") as string);
  if (!currentDOI) {
    item.setField("DOI", arxivDOI);
    changed = true;
  }

  const preprintTypeID = getPreprintItemTypeID();
  if (preprintTypeID && item.itemType !== "preprint") {
    if (item.setType(preprintTypeID)) {
      changed = true;
    }
  }

  return changed;
}

function getPreprintItemTypeID() {
  const typeID = Zotero.ItemTypes?.getID?.("preprint");
  return typeof typeID === "number" && typeID > 0 ? typeID : null;
}

function normalizeOpenAlexID(value: string | undefined) {
  if (!value) return null;
  const match = String(value).match(/W\d+/i);
  return match ? match[0].toUpperCase() : null;
}

function normalizeCitationCount(value: number | string | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function parseCitationDate(value: string | undefined) {
  if (!value) return null;

  const parts = value.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isCitationStale(citationDate: Date | null, staleMonths: number) {
  if (!citationDate || staleMonths <= 0) return true;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - staleMonths);
  return citationDate < cutoff;
}

function shouldUpdateOnStartup(item: Zotero.Item, staleMonths: number) {
  if (!item || !item.isRegularItem()) return false;

  const extra = (item.getField("extra") as string) || "";
  const metadata = parseOpenAlexMetadata(extra);

  const doi = extractDOIForLookup(item, extra);
  const hasLookupIdentifier = Boolean(metadata.workID || doi);
  if (!hasLookupIdentifier) return false;

  if (!metadata.workID) return true;
  if (metadata.citationCount === null) return true;

  return isCitationStale(metadata.citationDate, staleMonths);
}

async function getAllRegularItems() {
  const allLibraries = Zotero.Libraries.getAll().filter(
    (library: any) =>
      library &&
      !library.deleted &&
      (library.libraryType === "user" || library.libraryType === "group"),
  );

  const itemIDs = new Set<number>();

  for (const library of allLibraries) {
    const search = new Zotero.Search();
    (search as any).libraryID = library.libraryID;
    search.addCondition("deleted", "false", "");
    search.addCondition("itemType", "isNot", "attachment");
    search.addCondition("itemType", "isNot", "note");

    const ids = await search.search();
    for (const id of ids) {
      itemIDs.add(id as number);
    }
  }

  if (!itemIDs.size) return [] as Zotero.Item[];
  return Zotero.Items.getAsync([...itemIDs]);
}

function getBooleanPref(key: string, fallback: boolean) {
  try {
    const value = Zotero.Prefs.get(`extensions.zotero-openalex.${key}`, true);
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return value ? true : false;
  } catch (_error) {
    return fallback;
  }
}

function getNumberPref(key: string, fallback: number) {
  try {
    const value = Zotero.Prefs.get(`extensions.zotero-openalex.${key}`, true);
    const numeric = Number.parseInt(String(value), 10);
    return Number.isFinite(numeric) ? numeric : fallback;
  } catch (_error) {
    return fallback;
  }
}

function getFloatPref(key: string, fallback: number, min: number, max: number) {
  try {
    const value = Zotero.Prefs.get(`extensions.zotero-openalex.${key}`, true);
    const numeric = Number.parseFloat(String(value));
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, numeric));
  } catch (_error) {
    return fallback;
  }
}

function getGraphPhysicsSettings(): GraphPhysicsSettings {
  const next = {} as GraphPhysicsSettings;

  for (let i = 0; i < GRAPH_PHYSICS_FIELD_KEYS.length; i++) {
    const key = GRAPH_PHYSICS_FIELD_KEYS[i];
    const config = GRAPH_PHYSICS_FIELD_CONFIG[key];
    next[key] = getFloatPref(config.prefSuffix, config.default, config.min, config.max);
  }

  return next;
}

function getOpenAlexAPIKey() {
  try {
    return Zotero.Prefs.get(OPENALEX_API_KEY_PREF, true) || "";
  } catch (_error) {
    return "";
  }
}

function buildOpenAlexParams(initialValues: Record<string, string> = {}) {
  const params = new URLSearchParams({
    select: "id,cited_by_count",
    ...initialValues,
  });

  const apiKey = String(getOpenAlexAPIKey()).trim();
  if (apiKey) params.set("api_key", apiKey);

  return params;
}

async function fetchOpenAlexWorkByDOI(doi: string) {
  const normalizedDOI = normalizeDOI(doi);
  if (!normalizedDOI) return null;

  const params = buildOpenAlexParams();
  const encodedDOI = encodeURIComponent(`doi:${normalizedDOI}`);
  const url = `${OPENALEX_BASE_URL}/works/${encodedDOI}?${params.toString()}`;
  const byPath = await requestOpenAlexJSON(url);
  if (byPath?.id) return byPath;

  const fallbackParams = buildOpenAlexParams({
    filter: `doi:${normalizedDOI}`,
    "per-page": "1",
  });
  const byFilter = await requestOpenAlexJSON(
    `${OPENALEX_BASE_URL}/works?${fallbackParams.toString()}`,
  );
  if (byFilter?.results && Array.isArray(byFilter.results) && byFilter.results.length > 0) {
    return byFilter.results[0] as OpenAlexWork;
  }

  return null;
}

async function fetchOpenAlexWorkByID(workID: string) {
  const normalizedWorkID = normalizeOpenAlexID(workID);
  if (!normalizedWorkID) return null;

  const params = buildOpenAlexParams();
  const url = `${OPENALEX_BASE_URL}/works/${normalizedWorkID}?${params.toString()}`;
  return requestOpenAlexJSON(url);
}

async function requestOpenAlexJSON(url: string): Promise<any> {
  try {
    if (typeof fetch === "function") {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (response && response.ok) {
        clearOpenAlexLastError();
        return await response.json();
      }

      let bodyMessage = "";
      try {
        const body = (await response.json()) as any;
        bodyMessage = body?.message || body?.error || "";
      } catch (_parseError) {
        // Keep empty body message.
      }

      const status = response?.status || 0;
      if (status === 401 || status === 403) {
        setOpenAlexLastError(
          "OpenAlex rejected the request (401/403). Your API key may be invalid.",
        );
      } else {
        const nonOkMessage = bodyMessage || `HTTP ${status || "unknown"}`;
        setOpenAlexLastError(nonOkMessage);
      }
      Zotero.debug(`OpenAlex fetch returned non-OK status ${status || "unknown"}.`);
    }
  } catch (_fetchError) {
    setOpenAlexLastError("network error");
    Zotero.debug("OpenAlex fetch failed.");
  }

  try {
    if (Zotero.HTTP && typeof Zotero.HTTP.request === "function") {
      const xhr = await Zotero.HTTP.request("GET", url, {
        headers: { Accept: "application/json" },
        timeout: 15000,
      });
      clearOpenAlexLastError();
      return JSON.parse(xhr.responseText || "{}");
    }
  } catch (xhrError: any) {
    const status = Number.parseInt(String(xhrError?.status || 0), 10);
    if (status === 401 || status === 403) {
      setOpenAlexLastError("OpenAlex rejected the request (401/403). Your API key may be invalid.");
    } else {
      const statusMessage = status ? `HTTP ${status}` : "request failed";
      setOpenAlexLastError(statusMessage);
    }
    Zotero.debug("OpenAlex HTTP request failed.");
  }

  return null;
}

function clearOpenAlexLastError() {
  openAlexLastErrorMessage = "";
}

function setOpenAlexLastError(message: string) {
  openAlexLastErrorMessage = String(message || "").trim();
}

function getOpenAlexLastError() {
  return openAlexLastErrorMessage;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function showStatusMessage(title: string, message: string) {
  const progressWindow = getOrCreateInfoWindow(title);
  if (!progressWindow) {
    Zotero.debug(`${title}: ${message}`);
    return;
  }

  try {
    if (startupInfoUsesLineAPI && typeof progressWindow.changeLine === "function") {
      progressWindow.changeLine({ text: message, type: "default" });
    } else if (typeof progressWindow.addDescription === "function") {
      progressWindow.addDescription(message);
    }
  } catch (_error) {
    Zotero.debug(`${title}: ${message}`);
  }
}

function closeStatusWindow(delayMs = 2500) {
  if (!startupInfoWindow) return;

  try {
    if (typeof startupInfoWindow.startCloseTimer === "function") {
      startupInfoWindow.startCloseTimer(delayMs);
    } else if (typeof startupInfoWindow.close === "function") {
      setTimeout(() => {
        try {
          startupInfoWindow?.close();
        } catch (_error) {
          // Ignore close errors.
        }
        startupInfoWindow = null;
        startupInfoUsesLineAPI = false;
      }, delayMs);
      return;
    }
  } catch (_error) {
    // Ignore close timer errors.
  }

  startupInfoWindow = null;
  startupInfoUsesLineAPI = false;
}

function getOrCreateInfoWindow(title: string) {
  if (startupInfoWindow) return startupInfoWindow;

  try {
    const progressWindow = createProgressWindow() as any;
    if (!progressWindow) return null;

    if (typeof progressWindow.createLine === "function") {
      startupInfoUsesLineAPI = true;
      progressWindow
        .createLine({
          text: "Starting update...",
          type: "default",
          progress: 0,
        })
        .show();
    } else {
      startupInfoUsesLineAPI = false;
      if (typeof progressWindow.changeHeadline === "function") {
        progressWindow.changeHeadline(title);
      }
      if (typeof progressWindow.show === "function") {
        progressWindow.show();
      }
    }

    startupInfoWindow = progressWindow;
    return startupInfoWindow;
  } catch (_error) {
    startupInfoWindow = null;
    startupInfoUsesLineAPI = false;
    return null;
  }
}

function createProgressWindow() {
  if (!Zotero || typeof Zotero.ProgressWindow !== "function") {
    return null;
  }

  try {
    return new (Zotero.ProgressWindow as any)("Zotero OpenAlex", {
      closeOnClick: true,
      closeTime: -1,
    });
  } catch (_error) {
    try {
      return new (Zotero.ProgressWindow as any)();
    } catch (_innerError) {
      return null;
    }
  }
}

async function waitForZoteroReady() {
  const readiness = [
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ].filter(Boolean);
  if (readiness.length) {
    await Promise.all(readiness);
  }
}

export const __test__ = {
  parseOpenAlexMetadata,
  upsertOpenAlexMetadata,
  normalizeDOI,
  extractArXivIDFromURL,
  normalizeArXivID,
  buildArXivDOI,
  resolveDOIForLookup,
};
