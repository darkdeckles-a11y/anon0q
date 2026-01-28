const urlInput = document.querySelector("#urlInput");
const goButton = document.querySelector("#goButton");

const THEME_KEY = "anon0q_theme";

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

function handleGo(rawValue) {
  const fromInput = urlInput ? urlInput.value : "";
  const source = typeof rawValue === "string" && rawValue.length ? rawValue : fromInput;
  const raw = source.trim();
  if (!raw) {
    if (urlInput) urlInput.focus();
    return;
  }
  const target = `viewer.html?url=${encodeURIComponent(raw)}`;
  window.location.href = target;
}

if (goButton) {
  goButton.addEventListener("click", () => handleGo());
}

if (urlInput) {
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGo();
    }
  });
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

// initial load
(function init() {
  const storedTheme = readJson(THEME_KEY, { theme: "default" });
  applyTheme(storedTheme.theme || "default");
})();