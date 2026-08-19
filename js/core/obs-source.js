export function createObsSourceManager({
  getUi,
  urlParams = new URLSearchParams(window.location.search),
  doc = document,
  win = window,
  userAgent = () => navigator.userAgent || "",
} = {}) {
  let obsHoleResizeObserver = null;
  let obsHoleRafId = 0;

  // Scrolls the viewport back to the top.
  function ensureTopScrollPosition() {
    win.scrollTo(0, 0);
  }

  // Re-applies the top scroll position after late layout shifts.
  function ensureTopScrollPositionWithFallback() {
    ensureTopScrollPosition();

    // Handle late layout shifts (fonts/images/transitions) after load.
    win.requestAnimationFrame(() => {
      ensureTopScrollPosition();
      win.requestAnimationFrame(ensureTopScrollPosition);
    });

    win.setTimeout(ensureTopScrollPosition, 120);
  }

  function bindTopScrollHandlers() {
    doc.addEventListener("DOMContentLoaded", ensureTopScrollPosition);
    win.addEventListener("pageshow", ensureTopScrollPosition);
  }

  // Detects whether the app is running inside an OBS browser source.
  function isObsSourceContext() {
    const obsParam = (urlParams.get("obs") || "").toLowerCase();
    if (obsParam === "1" || obsParam === "true") return true;
    if (obsParam === "0" || obsParam === "false") return false;
    return /\bOBS\b|\bobs-browser\b/i.test(userAgent());
  }

  // Toggles the OBS-specific root class based on the current context.
  function syncObsSourceModeClass() {
    doc.documentElement.classList.toggle("obs-source", isObsSourceContext());
  }

  // Updates CSS custom properties used to punch a hole in the OBS background.
  function updateObsBackgroundHoleVars() {
    if (!doc.documentElement.classList.contains("obs-source")) return;
    const scoreboardWrap =
      getUi().scoreboardWrap || doc.querySelector(".scoreboard-wrap");
    if (!scoreboardWrap) return;

    const rect = scoreboardWrap.getBoundingClientRect();
    const left = Math.max(0, Math.round(rect.left));
    const top = Math.max(0, Math.round(rect.top));
    const width = Math.max(0, Math.round(rect.width));
    const height = Math.max(0, Math.round(rect.height));
    const root = doc.documentElement;

    root.style.setProperty("--obs-hole-left", `${left}px`);
    root.style.setProperty("--obs-hole-top", `${top}px`);
    root.style.setProperty("--obs-hole-width", `${width}px`);
    root.style.setProperty("--obs-hole-height", `${height}px`);
  }

  // Schedules a single animation-frame refresh for the OBS hole geometry.
  function scheduleObsBackgroundHoleSync() {
    if (!doc.documentElement.classList.contains("obs-source")) return;
    if (obsHoleRafId) win.cancelAnimationFrame(obsHoleRafId);
    obsHoleRafId = win.requestAnimationFrame(() => {
      obsHoleRafId = 0;
      updateObsBackgroundHoleVars();
    });
  }

  // Sets up resize and scroll tracking for the OBS background cutout.
  function setupObsBackgroundHoleSync() {
    if (!isObsSourceContext()) return;
    const scoreboardWrap =
      getUi().scoreboardWrap || doc.querySelector(".scoreboard-wrap");
    if (!scoreboardWrap) return;

    if ("ResizeObserver" in win) {
      obsHoleResizeObserver?.disconnect();
      obsHoleResizeObserver = new ResizeObserver(() =>
        scheduleObsBackgroundHoleSync(),
      );
      obsHoleResizeObserver.observe(scoreboardWrap);
    }

    win.addEventListener("scroll", scheduleObsBackgroundHoleSync, {
      passive: true,
    });
    scheduleObsBackgroundHoleSync();
  }

  // Marks the app as loaded and optionally skips the entrance animation.
  function finalizeLoadedState({ instant = false } = {}) {
    doc.body.classList.add("content-loaded");
    if (instant) {
      doc.body.classList.add("entrance-finished");
      return;
    }
    win.setTimeout(() => doc.body.classList.add("entrance-finished"), 1500);
  }

  // Removes the preloader immediately when the app is running in OBS.
  function bypassPreloaderForObs() {
    if (!isObsSourceContext()) return;
    const preloader = doc.getElementById("preloader");
    if (preloader) preloader.remove();
    finalizeLoadedState({ instant: true });
  }

  return {
    bindTopScrollHandlers,
    ensureTopScrollPositionWithFallback,
    isObsSourceContext,
    syncObsSourceModeClass,
    setupObsBackgroundHoleSync,
    scheduleObsBackgroundHoleSync,
    finalizeLoadedState,
    bypassPreloaderForObs,
  };
}
