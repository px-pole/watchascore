import { beforeEach, describe, expect, it, vi } from "vitest";
import { createShellUiManager } from "../js/core/shell-ui.js";

function createStorageMock() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

function createShellFixture() {
  document.body.innerHTML = `
    <header>
      <button id="help-fab" aria-expanded="false" class="attention">Help</button>
      <div id="help-panel" aria-hidden="true"></div>
      <button id="help-close-btn">Close help</button>
      <button id="header-menu-toggle" aria-expanded="false">Menu</button>
      <div id="header-controls" aria-hidden="true"></div>
    </header>
  `;

  return {
    header: document.querySelector("header"),
    helpFab: document.getElementById("help-fab"),
    helpPanel: document.getElementById("help-panel"),
    helpCloseBtn: document.getElementById("help-close-btn"),
    headerMenuToggle: document.getElementById("header-menu-toggle"),
    headerControls: document.getElementById("header-controls"),
  };
}

describe("createShellUiManager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("marks the help fab for attention until it has been seen", () => {
    const ui = createShellFixture();
    const storage = createStorageMock();
    const manager = createShellUiManager({
      getUi: () => ui,
      helpFabSeenKey: "seen-key",
      storage,
      isMobileViewport: () => false,
    });

    manager.initHelpAttentionHint();

    expect(ui.helpFab.classList.contains("attention")).toBe(true);
  });

  it("opens and closes the help panel while syncing focus and storage", () => {
    const ui = createShellFixture();
    const storage = createStorageMock();
    const manager = createShellUiManager({
      getUi: () => ui,
      helpFabSeenKey: "seen-key",
      storage,
      isMobileViewport: () => false,
    });

    ui.helpFab.focus();
    manager.setHelpPanel(true);

    expect(ui.helpPanel.classList.contains("active")).toBe(true);
    expect(ui.helpPanel.getAttribute("aria-hidden")).toBe("false");
    expect(ui.helpFab.getAttribute("aria-expanded")).toBe("true");
    expect(storage.getItem("seen-key")).toBe("1");
    expect(document.activeElement).toBe(ui.helpCloseBtn);

    manager.setHelpPanel(false);

    expect(ui.helpPanel.classList.contains("active")).toBe(false);
    expect(ui.helpPanel.getAttribute("aria-hidden")).toBe("true");
    expect(ui.helpFab.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(ui.helpFab);
  });

  it("toggles the mobile header menu only when the viewport is mobile", () => {
    const ui = createShellFixture();
    const manager = createShellUiManager({
      getUi: () => ui,
      helpFabSeenKey: "seen-key",
      storage: createStorageMock(),
      isMobileViewport: () => true,
    });

    manager.toggleHeaderMenu();

    expect(ui.header.classList.contains("menu-open")).toBe(true);
    expect(ui.headerMenuToggle.getAttribute("aria-expanded")).toBe("true");
    expect(ui.headerControls.getAttribute("aria-hidden")).toBe("false");
  });

  it("syncs the desktop header state by closing the mobile menu", () => {
    const ui = createShellFixture();
    ui.header.classList.add("menu-open");
    const manager = createShellUiManager({
      getUi: () => ui,
      helpFabSeenKey: "seen-key",
      storage: createStorageMock(),
      isMobileViewport: () => false,
    });

    manager.syncHeaderMenuViewportState();

    expect(ui.header.classList.contains("menu-open")).toBe(false);
    expect(ui.headerMenuToggle.getAttribute("aria-expanded")).toBe("false");
    expect(ui.headerControls.getAttribute("aria-hidden")).toBe("false");
  });
});
