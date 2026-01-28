const settingsPanel = document.querySelector('[data-view-section="settings"]');
const recentListEl = document.querySelector("#recentList");
const savedListEl = document.querySelector("#savedList");
const savedInput = document.querySelector("#savedInput");
const saveSiteButton = document.querySelector("#saveSiteButton");
const emergencyCloseButton = document.querySelector("#emergencyClose");
const themeChips = Array.from(document.querySelectorAll(".theme-chip"));
const currentIdDisplay = document.querySelector("#currentIdDisplay");
const importIdInput = document.querySelector("#importIdInput");
const importIdButton = document.querySelector("#importIdButton");

const THEME_KEY = "anon0q_theme";
const RECENT_KEY = "anon0q_recent";
const SAVED_KEY = "anon0q_saved";

const PROFILE_ID_KEY = "anon0q_profile_id";
const PROFILE_PREFIX = "anon0q_profile_";

let currentProfileId = null;

function normalizeUrl(input) {
  if (!input) return "";
  try {
    return new URL(input).toString();
  } catch {
    try {
      return new URL("https://" + input).toString();
    } catch {
      return "";
    }
  }
}

// storage helpers
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function generateProfileId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function getOrCreateProfileId() {
  let id = readJson(PROFILE_ID_KEY, null);
  if (typeof id === "string" && id.length) {
    return id;
  }
  const newId = generateProfileId();
  writeJson(PROFILE_ID_KEY, newId);
  return newId;
}

function loadProfile(id) {
  return readJson(PROFILE_PREFIX + id, {});
}

function saveProfile(id, data) {
  writeJson(PROFILE_PREFIX + id, data);
}

// recent / saved rendering
function renderList(listEl, items, emptyText) {
  listEl.innerHTML = "";
  if (!items || !items.length) {
    const empty = document.createElement("div");
    empty.className = "settings-empty";
    empty.textContent = emptyText;
    listEl.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settings-link";

    const spanUrl = document.createElement("span");
    spanUrl.className = "settings-link-url";
    spanUrl.textContent = item.url;

    button.appendChild(spanUrl);

    if (item.lastOpenedAt || item.addedAt) {
      const meta = document.createElement("span");
      meta.className = "settings-link-meta";
      meta.textContent = item.lastOpenedAt ? "recent" : "saved";
      button.appendChild(meta);
    }

    button.addEventListener("click", () => {
      const target = `viewer.html?url=${encodeURIComponent(item.url)}`;
      window.location.href = target;
    });

    listEl.appendChild(button);
  });
}

function syncRecent() {
  const recent = readJson(RECENT_KEY, []);
  renderList(recentListEl, recent, "no recent yet");
}

function syncSaved() {
  const saved = readJson(SAVED_KEY, []);
  renderList(savedListEl, saved, "nothing saved");
}

function syncProfileFromGlobals() {
  if (!currentProfileId) return;
  const themeObj = readJson(THEME_KEY, { theme: "default" });
  const saved = readJson(SAVED_KEY, []);
  const recent = readJson(RECENT_KEY, []);
  const profile = {
    theme: themeObj.theme || "default",
    saved,
    recent,
  };
  saveProfile(currentProfileId, profile);
}

// saved sites add
saveSiteButton?.addEventListener("click", () => {
  const raw = savedInput.value.trim();
  if (!raw) {
    savedInput.focus();
    return;
  }
  const normalized = normalizeUrl(raw);
  if (!normalized) {
    savedInput.value = "";
    savedInput.focus();
    return;
  }
  let saved = readJson(SAVED_KEY, []);
  if (!saved.some((s) => s.url === normalized)) {
    saved.unshift({
      url: normalized,
      addedAt: Date.now(),
    });
    saved = saved.slice(0, 20);
    writeJson(SAVED_KEY, saved);
    syncProfileFromGlobals();
  }
  savedInput.value = "";
  syncSaved();
});

savedInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveSiteButton.click();
  }
});

// emergency close
emergencyCloseButton?.addEventListener("click", () => {
  window.close();
  setTimeout(() => {
    window.location.replace("about:blank");
  }, 50);
});

// theme handling
function applyTheme(themeName) {
  const body = document.body;
  body.classList.remove(
    "theme-crimson",
    "theme-dark-purple",
    "theme-deep-blue",
    "theme-sad-grass",
    "theme-minimal"
  );

  if (themeName && themeName !== "default") {
    const cls =
      themeName === "dark-purple"
        ? "theme-dark-purple"
        : themeName === "deep-blue"
        ? "theme-deep-blue"
        : themeName === "sad-grass"
        ? "theme-sad-grass"
        : themeName === "minimal"
        ? "theme-minimal"
        : themeName === "crimson"
        ? "theme-crimson"
        : "";
    if (cls) body.classList.add(cls);
  }

  themeChips.forEach((chip) => {
    chip.classList.toggle(
      "theme-chip--active",
      chip.getAttribute("data-theme") === themeName
    );
  });

  writeJson(THEME_KEY, { theme: themeName });
  syncProfileFromGlobals();
}

themeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const theme = chip.getAttribute("data-theme") || "default";
    applyTheme(theme);
  });
});

// id import
importIdButton?.addEventListener("click", () => {
  const raw = (importIdInput?.value || "").trim();
  if (!raw) {
    if (importIdInput) importIdInput.focus();
    return;
  }
  currentProfileId = raw;
  writeJson(PROFILE_ID_KEY, currentProfileId);

  const profile = loadProfile(currentProfileId);
  const theme = (profile && profile.theme) || "default";
  const saved = (profile && profile.saved) || [];
  const recent = (profile && profile.recent) || [];

  writeJson(THEME_KEY, { theme });
  writeJson(SAVED_KEY, saved);
  writeJson(RECENT_KEY, recent);

  if (currentIdDisplay) {
    currentIdDisplay.textContent = currentProfileId;
  }

  applyTheme(theme);
  syncRecent();
  syncSaved();
});

importIdInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (importIdButton) importIdButton.click();
  }
});

// initial load
(function init() {
  currentProfileId = getOrCreateProfileId();

  if (currentIdDisplay) {
    currentIdDisplay.textContent = currentProfileId;
  }

  // load profile, or fall back to existing globals
  const profile = loadProfile(currentProfileId);
  const themeObj = readJson(THEME_KEY, { theme: "default" });
  const theme =
    (profile && profile.theme) || (themeObj && themeObj.theme) || "default";

  const savedFromProfile = (profile && profile.saved) || null;
  const recentFromProfile = (profile && profile.recent) || null;

  if (savedFromProfile) {
    writeJson(SAVED_KEY, savedFromProfile);
  }
  if (recentFromProfile) {
    writeJson(RECENT_KEY, recentFromProfile);
  }

  applyTheme(theme);
  syncRecent();
  syncSaved();

  // ensure profile is synced with whatever globals ended up as
  syncProfileFromGlobals();
})();