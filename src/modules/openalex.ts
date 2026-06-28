const OPENALEX_BASE_URL = "https://api.openalex.org";
const WORK_ID_PREFIX = "openalex.work_id:";
const CIT_COUNT_PREFIX = "openalex.cit_count:";
const CIT_DATE_PREFIX = "openalex.cit_date:";
const COLUMN_DATA_KEY = "openAlexCitations";
const COLUMN_LABEL = "Citations";
const TOOLS_SYNC_MENU_ID = "openalex-startup-sync-menuitem";
const OPENALEX_API_KEY_PREF = "extensions.zotero-openalex.apiKey";

const DOI_PATTERN = /\b10\.\d{4,9}\/[\-._;()/:A-Z0-9]+\b/i;
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

let startupSyncInProgress = false;
let citationColumnRegistered = false;
let startupInfoWindow: any = null;
let startupInfoUsesLineAPI = false;
let openAlexLastErrorMessage = "";

class OpenAlexWorkIDClass {
  private id = "";
  private version = "";
  private rootURI = "";

  init({ id, version, rootURI }: { id: string; version: string; rootURI: string }) {
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
  }

  addToWindow(window: Window) {
    const doc = window.document;
    const itemMenuPopup = doc.querySelector("#zotero-itemmenu");
    if (!itemMenuPopup) return;

    let menuItem = doc.getElementById("workid-menuitem");
    if (menuItem) {
      menuItem.remove();
    }

    menuItem = doc.createXULElement("menuitem");
    menuItem.setAttribute("label", "Get OpenAlex-WorkID");
    menuItem.setAttribute("id", "workid-menuitem");
    menuItem.addEventListener("command", async () => {
      try {
        await this.updateSelectedItems(window);
      } catch (error) {
        Zotero.debug("Error updating OpenAlex data from selection");
        Zotero.debug(error);
        window.alert("An error occurred while processing OpenAlex metadata.");
      }
    });

    itemMenuPopup.appendChild(menuItem);

    itemMenuPopup.addEventListener("popupshowing", () => {
      const pane = Zotero.getActiveZoteroPane();
      const selectedItems = pane ? pane.getSelectedItems() : [];
      (menuItem as any).hidden = selectedItems.length === 0;
    });

    this.addToolsSyncMenu(window);
  }

  addToolsSyncMenu(window: Window) {
    const doc = window.document;
    const toolsPopup = doc.getElementById("menu_ToolsPopup");
    if (!toolsPopup) return;

    let syncMenuItem = doc.getElementById(TOOLS_SYNC_MENU_ID);
    if (syncMenuItem) {
      syncMenuItem.remove();
    }

    syncMenuItem = doc.createXULElement("menuitem");
    syncMenuItem.setAttribute("id", TOOLS_SYNC_MENU_ID);
    syncMenuItem.setAttribute("label", "Run OpenAlex Startup Sync");
    syncMenuItem.addEventListener("command", () => {
      void this.runStartupSync({ forceRun: true, showSummary: true, source: "manual" });
    });
    toolsPopup.appendChild(syncMenuItem);
  }

  removeFromWindow(window: Window) {
    const doc = window.document;
    const menuItem = doc.getElementById("workid-menuitem");
    if (menuItem) menuItem.remove();

    const toolsMenuItem = doc.getElementById(TOOLS_SYNC_MENU_ID);
    if (toolsMenuItem) toolsMenuItem.remove();
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

    if (!Zotero.ItemTreeManager || typeof (Zotero.ItemTreeManager as any).registerColumn !== "function") {
      Zotero.debug("OpenAlex: ItemTreeManager.registerColumn is unavailable.");
      return;
    }

    try {
      (Zotero.ItemTreeManager as any).registerColumn({
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
        renderCell(_index: number, data: string, column: any, _isFirstColumn: boolean, doc: Document) {
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
          window.alert("OpenAlex-WorkID and citations updated in the Extra field.");
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

  async updateSingleItem(item: Zotero.Item, { refreshCitationDate = false } = {}): Promise<UpdateOutcome> {
    if (!item || !item.isRegularItem()) {
      return { status: "skipped", message: "Item is not a regular Zotero item." };
    }

    clearOpenAlexLastError();

    const extra = (item.getField("extra") as string) || "";
    const current = parseOpenAlexMetadata(extra);

    let apiWork: OpenAlexWork | null = null;
    if (current.workID) {
      apiWork = await fetchOpenAlexWorkByID(current.workID);
    }

    if (!apiWork) {
      const doi = extractDOIForLookup(item, extra);
      if (!doi) {
        return { status: "skipped", message: "No DOI or OpenAlex-WorkID found for this item." };
      }

      apiWork = await fetchOpenAlexWorkByDOI(doi);
    }

    if (!apiWork) {
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

    if (updatedExtra === extra) {
      return { status: "unchanged" };
    }

    item.setField("extra", updatedExtra);
    await item.saveTx();
    return { status: "updated" };
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

      const allRegularItems = await getAllRegularItems();
      const candidates = allRegularItems.filter((item) => shouldUpdateOnStartup(item, staleMonths));

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
        const outcome = await this.updateSingleItem(item, { refreshCitationDate: true });

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
        showStatusMessage("OpenAlex", "Startup sync failed. Check Zotero debug output.");
        closeStatusWindow(3000);
      }
    } finally {
      startupSyncInProgress = false;
    }
  }
}

export const openAlexWorkID = new OpenAlexWorkIDClass();

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
    updatedLines = updatedLines.filter(
      (line) => !WORK_ID_LINE_PATTERN.test(line.trim()),
    );
    insertBeforeMatch(updatedLines, CITATION_KEY_LINE_PATTERN, `${WORK_ID_PREFIX} ${workID}`);
  }

  if (replaceCitation) {
    updatedLines = updatedLines.filter(
      (line) => !CIT_COUNT_LINE_PATTERN.test(line.trim()) && !CIT_DATE_LINE_PATTERN.test(line.trim()),
    );
    if (typeof citationCount === "number" && citationCount >= 0) {
      const citationDate = formatDate(new Date());
      insertBeforeMatch(updatedLines, CITATION_KEY_LINE_PATTERN, `${CIT_DATE_PREFIX} ${citationDate}`);
      insertBeforeMatch(updatedLines, CITATION_KEY_LINE_PATTERN, `${CIT_COUNT_PREFIX} ${citationCount}`);
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
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function extractDOIForLookup(item: Zotero.Item, extra: string) {
  const fromField = normalizeDOI(item.getField("DOI") as string);
  if (fromField) return fromField;
  return extractDOIFromExtra(extra);
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
      library && !library.deleted && (library.libraryType === "user" || library.libraryType === "group"),
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
  const byFilter = await requestOpenAlexJSON(`${OPENALEX_BASE_URL}/works?${fallbackParams.toString()}`);
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
        setOpenAlexLastError("OpenAlex rejected the request (401/403). Your API key may be invalid.");
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
  const readiness = [Zotero.initializationPromise, Zotero.unlockPromise, Zotero.uiReadyPromise].filter(Boolean);
  if (readiness.length) {
    await Promise.all(readiness);
  }
}

export const __test__ = {
  parseOpenAlexMetadata,
  upsertOpenAlexMetadata,
  normalizeDOI,
};
