const OPENALEX_API_KEY_PREF = "extensions.zotero-openalex.apiKey";
const OPENALEX_CORRECT_ARXIV_PREF = "extensions.zotero-openalex.correctArxivArticles";
const OPENALEX_AUTO_UPDATE_ON_STARTUP_PREF = "extensions.zotero-openalex.autoUpdateOnStartup";
const OPENALEX_STALE_MONTHS_PREF = "extensions.zotero-openalex.staleMonths";
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

function setAPIStatus(message, isError = false) {
  const statusEl = document.getElementById("openalex-api-key-status");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#b3261e" : "";
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
  const inputEl = document.getElementById("openalex-api-key-input");
  const clearBtn = document.getElementById("openalex-api-key-clear");
  const testBtn = document.getElementById("openalex-api-key-test");
  if (!autoUpdateCheckbox || !staleMonthsInput || !arxivCheckbox || !inputEl || !clearBtn || !testBtn) {
    return;
  }

  if (openAlexPaneInitialized) {
    return;
  }
  openAlexPaneInitialized = true;

  autoUpdateCheckbox.checked = getBooleanPrefValue(OPENALEX_AUTO_UPDATE_ON_STARTUP_PREF, true);

  const storedStaleMonthsValue = Zotero.Prefs.get(OPENALEX_STALE_MONTHS_PREF, true);
  staleMonthsInput.value = String(normalizeStaleMonths(storedStaleMonthsValue, 3));

  arxivCheckbox.checked = getBooleanPrefValue(OPENALEX_CORRECT_ARXIV_PREF, true);

  const storedValue = Zotero.Prefs.get("extensions.zotero-openalex.apiKey", true) || "";
  inputEl.value = storedValue;

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
