const PROXY_ORIGIN = "https://anon0q.darkdeckles.workers.dev";

const THEME_KEY = "anon0q_theme";
const RECENT_KEY = "anon0q_recent";

const PROFILE_ID_KEY = "anon0q_profile_id";
const PROFILE_PREFIX = "anon0q_profile_";

let currentProfileId = null;

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}

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

  writeJson(THEME_KEY, { theme: themeName });
}

function pushRecent(url) {
  let recent = readJson(RECENT_KEY, []);
  recent = recent.filter((item) => item.url !== url);
  recent.unshift({ url, lastOpenedAt: Date.now() });
  recent = recent.slice(0, 10);
  writeJson(RECENT_KEY, recent);

  // also sync into current profile
  if (!currentProfileId) {
    currentProfileId = getOrCreateProfileId();
  }
  const profile = loadProfile(currentProfileId) || {};
  const themeObj = readJson(THEME_KEY, { theme: "default" });
  profile.theme = profile.theme || (themeObj && themeObj.theme) || "default";
  profile.saved = profile.saved || [];
  profile.recent = recent;
  saveProfile(currentProfileId, profile);
}

(function init() {
  currentProfileId = getOrCreateProfileId();

  // apply stored theme
  const storedTheme = readJson(THEME_KEY, { theme: "default" });
  applyTheme(storedTheme.theme || "default");

  const rawUrl = getQueryParam("url");
  const frame = document.getElementById("viewerFrame");
  const urlLabel = document.getElementById("viewerUrl");
  const backBtn = document.getElementById("viewerBack");

  const normalized = normalizeUrl(rawUrl);

  if (normalized) {
    urlLabel.textContent = normalized;
    pushRecent(normalized);
    const proxied = `${PROXY_ORIGIN}/proxy?url=${encodeURIComponent(
      normalized
    )}`;
    frame.src = proxied;
  } else if (rawUrl) {
    urlLabel.textContent = `invalid url: ${rawUrl}`;
    frame.src = "about:blank";
  } else {
    urlLabel.textContent = "no url provided";
    frame.src = "about:blank";
  }

  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
})();