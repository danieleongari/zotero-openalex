const OPENALEX_API_KEY_PREF = "extensions.zotero-openalex.apiKey";
const OPENALEX_CORRECT_ARXIV_PREF = "extensions.zotero-openalex.correctArxivArticles";
const OPENALEX_OVERWRITE_ARTICLE_URL_PREF = "extensions.zotero-openalex.overwriteArticleURL";
const OPENALEX_AUTO_UPDATE_ON_STARTUP_PREF = "extensions.zotero-openalex.autoUpdateOnStartup";
const OPENALEX_STALE_MONTHS_PREF = "extensions.zotero-openalex.staleMonths";
const OPENALEX_SHOW_GRAPH_TUNING_CONTROLS_PREF =
  "extensions.zotero-openalex.showGraphTuningControls";
const OPENALEX_MINIMUM_AUTHOR_H_INDEX_PREF = "extensions.zotero-openalex.minimumAuthorHIndex";
const OPENALEX_TEST_WORK_PATH = "doi%3A10.7717%2Fpeerj.4375";
let openAlexPaneInitialized = false;

function getBooleanPrefValue(prefKey, fallback) {
  const value = Zotero.Prefs.get(prefKey, true);
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return typeof value === "undefined" || value === null ? fallback : Boolean(value);
}

function normalizeStaleMonths(value, fallback = 3) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(36, parsed));
}

function normalizeMinimumAuthorHIndex(value, fallback = 5) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1000, parsed));
}

function setAPIStatus(message, isError = false) {
  const statusEl = document.getElementById("openalex-api-key-status");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#b3261e" : "";
}

function setCacheStatus(message, isError = false) {
  const statusEl = document.getElementById("openalex-cache-status");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#b3261e" : "";
}

function setCrossrefRestoreStatus(message, isError = false) {
  const statusEl = document.getElementById("openalex-restore-crossref-status");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#b3261e" : "";
}

function updateCrossrefRestoreProgress(progressEl, progress) {
  const totalItems = Number(progress?.totalItems) || 0;
  const processedItems = Number(progress?.processedItems) || 0;
  progressEl.hidden = false;

  if (totalItems > 0) {
    progressEl.value = Math.max(0, Math.min(100, Math.round((processedItems / totalItems) * 100)));
  } else {
    progressEl.removeAttribute("value");
  }

  setCrossrefRestoreStatus(progress?.message || "Checking Zotero items…");
}

async function restoreCrossrefURLs(restoreBtn, progressEl) {
  const bridge = getOpenAlexBridge();
  if (!bridge || typeof bridge.restoreCrossrefURLs !== "function") {
    setCrossrefRestoreStatus("Crossref URL restoration is unavailable.", true);
    return;
  }

  restoreBtn.disabled = true;
  progressEl.hidden = false;
  progressEl.removeAttribute("value");
  setCrossrefRestoreStatus("Checking Zotero items…");

  try {
    const result = await bridge.restoreCrossrefURLs((progress) => {
      updateCrossrefRestoreProgress(progressEl, progress);
    });

    progressEl.value = 100;
    const eligibleItems = Number(result?.eligibleItems) || 0;
    const restoredItems = Number(result?.restoredItems) || 0;
    const missingDOIItems = Number(result?.missingDOIItems) || 0;
    const unresolvedItems = Number(result?.unresolvedItems) || 0;
    const failedItems = Number(result?.failedItems) || 0;
    const rateLimitedItems = Number(result?.rateLimitedItems) || 0;
    const lookupFailedItems = Number(result?.lookupFailedItems) || 0;
    const saveFailedItems = Number(result?.saveFailedItems) || 0;

    if (!eligibleItems) {
      setCrossrefRestoreStatus("No items with OpenAlex Work URLs were found.");
      return;
    }

    setCrossrefRestoreStatus(
      `Finished: ${restoredItems} of ${eligibleItems} URLs restored; ${missingDOIItems} missing DOI; ${unresolvedItems} without a Crossref primary URL; ${failedItems} failed (${rateLimitedItems} still rate-limited, ${lookupFailedItems} lookup, ${saveFailedItems} save).`,
      failedItems > 0,
    );
  } catch (error) {
    progressEl.value = 0;
    setCrossrefRestoreStatus(`Crossref URL restoration failed: ${String(error)}`, true);
  } finally {
    restoreBtn.disabled = false;
  }
}

function updateCacheCountElements(stats) {
  const worksEl = document.getElementById("openalex-cache-works-count");
  const authorsEl = document.getElementById("openalex-cache-authors-count");
  if (worksEl) {
    worksEl.textContent = `Works metadata: ${Number(stats?.works) || 0}`;
  }
  if (authorsEl) {
    authorsEl.textContent = `Authors metadata: ${Number(stats?.authors) || 0}`;
  }
}

function getOpenAlexBridge() {
  return globalThis.OpenAlexWorkID || Zotero.OpenAlexAddon?.openAlexWorkID;
}

async function refreshMetadataCacheStats() {
  const bridge = getOpenAlexBridge();
  if (!bridge || typeof bridge.getMetadataCacheStats !== "function") {
    setCacheStatus("Metadata cache is unavailable.", true);
    return;
  }

  try {
    updateCacheCountElements(await bridge.getMetadataCacheStats());
  } catch (error) {
    setCacheStatus(`Could not read metadata cache statistics: ${String(error)}`, true);
  }
}

async function cleanMetadataCache(cleanBtn) {
  const bridge = getOpenAlexBridge();
  if (!bridge || typeof bridge.cleanMetadataCache !== "function") {
    setCacheStatus("Metadata cache is unavailable.", true);
    return;
  }

  const confirmed = window.confirm(
    "Clean the OpenAlex metadata cache?\n\nWorks not referenced by current Zotero items and Authors without remaining Works will be deleted.",
  );
  if (!confirmed) {
    return;
  }

  cleanBtn.disabled = true;
  setCacheStatus("Checking current Zotero items and cleaning metadata cache…");
  try {
    const result = await bridge.cleanMetadataCache();
    updateCacheCountElements(result?.after);
    setCacheStatus(
      `Cache cleaned: ${Number(result?.deletedWorks) || 0} Works and ${Number(result?.deletedAuthors) || 0} Authors removed.`,
    );
  } catch (error) {
    setCacheStatus(`Metadata cache cleanup failed: ${String(error)}`, true);
    await refreshMetadataCacheStats();
  } finally {
    cleanBtn.disabled = false;
  }
}

function saveAPIKeyValue(inputEl) {
  const value = String(inputEl?.value || "").trim();
  Zotero.Prefs.set(OPENALEX_API_KEY_PREF, value, true);
}

async function requestOpenAlexTest(url) {
  if (typeof fetch === "function") {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      return { ok: response.ok, status: response.status || 0 };
    } catch (_error) {
      // Fall through to Zotero.HTTP.
    }
  }

  if (Zotero.HTTP && typeof Zotero.HTTP.request === "function") {
    try {
      const xhr = await Zotero.HTTP.request("GET", url, {
        headers: { Accept: "application/json" },
        timeout: 15000,
        successCodes: false,
      });
      const status = xhr?.status || 0;
      return { ok: status >= 200 && status < 300, status };
    } catch (error) {
      return { ok: false, status: error?.status || 0 };
    }
  }

  return { ok: false, status: 0 };
}

async function testAPIConnection(inputEl, testBtn) {
  saveAPIKeyValue(inputEl);
  const apiKey = String(inputEl?.value || "").trim();

  const params = new URLSearchParams({
    select: "id,cited_by_count",
  });
  if (apiKey) {
    params.set("api_key", apiKey);
  }

  const url = `https://api.openalex.org/works/${OPENALEX_TEST_WORK_PATH}?${params.toString()}`;
  setAPIStatus("Testing OpenAlex connection...");
  testBtn.disabled = true;

  try {
    const result = await requestOpenAlexTest(url);
    if (result.ok) {
      setAPIStatus("OpenAlex connection successful.", false);
      return;
    }

    if (result.status === 401 || result.status === 403) {
      setAPIStatus("OpenAlex rejected the request (401/403). Your API key may be invalid.", true);
      return;
    }

    const detail = result.status ? `HTTP ${result.status}` : "network error";
    setAPIStatus(`OpenAlex connection failed (${detail}).`, true);
  } finally {
    testBtn.disabled = false;
  }
}

function initOpenAlexPreferencesPane() {
  const autoUpdateCheckbox = document.getElementById("auto-update-on-startup");
  const staleMonthsInput = document.getElementById("stale-months");
  const arxivCheckbox = document.getElementById("openalex-correct-arxiv");
  const overwriteArticleURLCheckbox = document.getElementById("openalex-overwrite-article-url");
  const restoreCrossrefURLsBtn = document.getElementById("openalex-restore-crossref-urls");
  const restoreCrossrefProgress = document.getElementById("openalex-restore-crossref-progress");
  const showGraphTuningControlsCheckbox = document.getElementById(
    "openalex-show-graph-tuning-controls",
  );
  const minimumAuthorHIndexInput = document.getElementById("minimum-author-h-index");
  const cacheCleanBtn = document.getElementById("openalex-cache-clean");
  const inputEl = document.getElementById("openalex-api-key-input");
  const clearBtn = document.getElementById("openalex-api-key-clear");
  const testBtn = document.getElementById("openalex-api-key-test");
  if (
    !autoUpdateCheckbox ||
    !staleMonthsInput ||
    !arxivCheckbox ||
    !overwriteArticleURLCheckbox ||
    !restoreCrossrefURLsBtn ||
    !restoreCrossrefProgress ||
    !showGraphTuningControlsCheckbox ||
    !minimumAuthorHIndexInput ||
    !cacheCleanBtn ||
    !inputEl ||
    !clearBtn ||
    !testBtn
  ) {
    return;
  }

  if (openAlexPaneInitialized) {
    return;
  }
  openAlexPaneInitialized = true;

  autoUpdateCheckbox.checked = getBooleanPrefValue(OPENALEX_AUTO_UPDATE_ON_STARTUP_PREF, true);

  const storedStaleMonthsValue = Zotero.Prefs.get(OPENALEX_STALE_MONTHS_PREF, true);
  staleMonthsInput.value = String(normalizeStaleMonths(storedStaleMonthsValue, 3));

  arxivCheckbox.checked = getBooleanPrefValue(OPENALEX_CORRECT_ARXIV_PREF, false);
  overwriteArticleURLCheckbox.checked = getBooleanPrefValue(
    OPENALEX_OVERWRITE_ARTICLE_URL_PREF,
    false,
  );

  const storedValue = Zotero.Prefs.get("extensions.zotero-openalex.apiKey", true) || "";
  inputEl.value = storedValue;
  showGraphTuningControlsCheckbox.checked = getBooleanPrefValue(
    OPENALEX_SHOW_GRAPH_TUNING_CONTROLS_PREF,
    false,
  );
  const storedMinimumAuthorHIndex = Zotero.Prefs.get(OPENALEX_MINIMUM_AUTHOR_H_INDEX_PREF, true);
  minimumAuthorHIndexInput.value = String(
    normalizeMinimumAuthorHIndex(storedMinimumAuthorHIndex, 5),
  );

  autoUpdateCheckbox.addEventListener("command", () => {
    Zotero.Prefs.set(
      OPENALEX_AUTO_UPDATE_ON_STARTUP_PREF,
      Boolean(autoUpdateCheckbox.checked),
      true,
    );
  });

  const saveStaleMonths = () => {
    const normalized = normalizeStaleMonths(staleMonthsInput.value, 3);
    staleMonthsInput.value = String(normalized);
    Zotero.Prefs.set(OPENALEX_STALE_MONTHS_PREF, normalized, true);
  };

  staleMonthsInput.addEventListener("change", saveStaleMonths);

  arxivCheckbox.addEventListener("command", () => {
    Zotero.Prefs.set(OPENALEX_CORRECT_ARXIV_PREF, Boolean(arxivCheckbox.checked), true);
  });

  overwriteArticleURLCheckbox.addEventListener("command", () => {
    Zotero.Prefs.set(
      OPENALEX_OVERWRITE_ARTICLE_URL_PREF,
      Boolean(overwriteArticleURLCheckbox.checked),
      true,
    );
  });

  restoreCrossrefURLsBtn.addEventListener("command", () => {
    void restoreCrossrefURLs(restoreCrossrefURLsBtn, restoreCrossrefProgress);
  });

  showGraphTuningControlsCheckbox.addEventListener("command", () => {
    Zotero.Prefs.set(
      OPENALEX_SHOW_GRAPH_TUNING_CONTROLS_PREF,
      Boolean(showGraphTuningControlsCheckbox.checked),
      true,
    );
  });

  const saveMinimumAuthorHIndex = () => {
    const normalized = normalizeMinimumAuthorHIndex(minimumAuthorHIndexInput.value, 5);
    minimumAuthorHIndexInput.value = String(normalized);
    Zotero.Prefs.set(OPENALEX_MINIMUM_AUTHOR_H_INDEX_PREF, normalized, true);
  };
  minimumAuthorHIndexInput.addEventListener("change", saveMinimumAuthorHIndex);

  cacheCleanBtn.addEventListener("command", () => {
    void cleanMetadataCache(cacheCleanBtn);
  });
  void refreshMetadataCacheStats();

  const saveHandler = () => {
    saveAPIKeyValue(inputEl);
  };

  inputEl.addEventListener("input", saveHandler);
  inputEl.addEventListener("change", saveHandler);

  clearBtn.addEventListener("command", () => {
    Zotero.Prefs.set(OPENALEX_API_KEY_PREF, "", true);
    inputEl.value = "";
    setAPIStatus("OpenAlex API key cleared.");
  });

  testBtn.addEventListener("command", () => {
    void testAPIConnection(inputEl, testBtn);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOpenAlexPreferencesPane, { once: true });
} else {
  initOpenAlexPreferencesPane();
}

if (typeof window !== "undefined") {
  window.initOpenAlexPreferencesPane = initOpenAlexPreferencesPane;
}
