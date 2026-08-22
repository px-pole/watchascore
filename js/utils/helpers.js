// Formats a value as a two-digit string.
export const pad = (n) => String(n).padStart(2, "0");
// Formats a string with an initial capital letter.
export const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

// Computes the edit distance between two strings.
export const levenshteinDistance = (s1, s2) => {
  if (s1.length < s2.length) [s1, s2] = [s2, s1];
  if (s2.length === 0) return s1.length;
  let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    let currRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = prevRow[j + 1] + 1;
      const deletions = currRow[j] + 1;
      const subs = prevRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currRow.push(Math.min(insertions, deletions, subs));
    }
    prevRow = currRow;
  }
  return prevRow[s2.length];
};

// Debounces repeated calls until the input has been idle for the wait period.
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Checks whether shortcut handling should be ignored for the target element.
export function isEditableShortcutTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.isContentEditable) return true;
  return Boolean(
    target.closest(
      'input, textarea, select, button, [role="button"], [contenteditable="true"], [contenteditable="plaintext-only"]',
    ),
  );
}

export function shouldIgnoreGlobalShortcut(target) {
  if (!target) return false;
  if (isEditableShortcutTarget(target)) return true;
  if (
    target instanceof Element &&
    target.closest("button, input, select, textarea")
  ) {
    return true;
  }
  return false;
}

// Prevents scroll events in a popup from chaining to the page.
export function preventPopupScrollChaining(popup) {
  if (!popup) return;

  let lastTouchY = 0;

  const isScrollable = () => popup.scrollHeight > popup.clientHeight;
  const atTop = () => popup.scrollTop <= 0;
  const atBottom = () =>
    popup.scrollTop + popup.clientHeight >= popup.scrollHeight - 1;

  const shouldBlock = (deltaY) => {
    if (!isScrollable()) return false;
    return (deltaY < 0 && atTop()) || (deltaY > 0 && atBottom());
  };

  popup.addEventListener(
    "wheel",
    (e) => {
      if (shouldBlock(e.deltaY)) e.preventDefault();
    },
    { passive: false },
  );

  popup.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length > 0) lastTouchY = e.touches[0].clientY;
    },
    { passive: true },
  );

  popup.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 0) return;
      const currentTouchY = e.touches[0].clientY;
      const deltaY = lastTouchY - currentTouchY;
      lastTouchY = currentTouchY;
      if (shouldBlock(deltaY)) e.preventDefault();
    },
    { passive: false },
  );
}

// Normalizes keyboard events to the app's supported shortcut keys.
export function getShortcutKey(e) {
  switch (e.code) {
    case "Space":
      return "space";
    case "KeyH":
      return "h";
    case "KeyA":
      return "a";
    case "KeyX":
      return "x";
    case "KeyC":
      return "c";
  }

  switch ((e.key || "").toLowerCase()) {
    case " ":
    case "spacebar":
      return "space";
    case "h":
    case "a":
    case "x":
    case "c":
      return (e.key || "").toLowerCase();
    default:
      return "";
  }
}

export function normalizeStateValue(key, value) {
  if (key === "homeScore" || key === "awayScore") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue)
      ? Math.max(0, Math.round(numericValue))
      : 0;
  }

  if (key === "clockSec") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue)
      ? Math.max(0, Math.round(numericValue))
      : 0;
  }

  if (key === "status") {
    return typeof value === "string" ? value.slice(0, 30) : "";
  }

  if (key === "teamNamesVisible" || key === "clockVisible") {
    return value === true || value === false ? value : true;
  }

  if (key === "penaltyMode") {
    return value === true;
  }

  if (key === "homeTeam" || key === "awayTeam") {
    if (!value || typeof value !== "object") return null;
    return {
      ...(value || {}),
      id: typeof value.id === "string" ? value.id.slice(0, 120) : "",
      name: typeof value.name === "string" ? value.name.slice(0, 120) : "",
    };
  }

  return value;
}
