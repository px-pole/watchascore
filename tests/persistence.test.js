import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPersistence } from "../js/core/persistence.js";

function createStorageMock() {
  const store = new Map();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

describe("createPersistence", () => {
  const storageKey = "scoreboard_state_test";
  const prefsKey = "scoreboard_prefs_test";
  const initialState = {
    theme: "default",
    mode: "leagues",
    visibilityMode: "none",
    running: false,
    homeScore: 0,
  };

  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    vi.restoreAllMocks();
  });

  it("saves the full state and compact preferences", () => {
    const persistence = createPersistence({
      storageKey,
      prefsKey,
      initialState,
    });
    const data = {
      ...initialState,
      theme: "forest",
      mode: "cups",
      visibilityMode: "glow",
      homeScore: 2,
    };

    persistence.save(data);

    expect(JSON.parse(localStorage.getItem(storageKey))).toEqual({
      version: 1,
      data,
    });
    expect(JSON.parse(localStorage.getItem(prefsKey))).toEqual({
      version: 1,
      data: {
        theme: "forest",
        mode: "cups",
        visibilityMode: "glow",
      },
    });
  });

  it("loads saved state and forces running to false", () => {
    localStorage.setItem(
      prefsKey,
      JSON.stringify({
        theme: "light",
        mode: "cups",
        visibilityMode: "contrast",
      }),
    );
    localStorage.setItem(
      storageKey,
      JSON.stringify({ homeScore: 3, running: true, theme: "forest" }),
    );

    const persistence = createPersistence({
      storageKey,
      prefsKey,
      initialState,
    });

    expect(persistence.load()).toEqual({
      ...initialState,
      homeScore: 3,
      running: false,
      theme: "forest",
    });
  });

  it("falls back to saved preferences when no full state exists", () => {
    localStorage.setItem(
      prefsKey,
      JSON.stringify({
        theme: "light",
        mode: "cups",
        visibilityMode: "contrast",
      }),
    );

    const persistence = createPersistence({
      storageKey,
      prefsKey,
      initialState,
    });

    expect(persistence.load()).toEqual({
      ...initialState,
      theme: "light",
      mode: "cups",
      visibilityMode: "contrast",
    });
  });

  it("migrates legacy unversioned state before loading it", () => {
    localStorage.setItem(storageKey, JSON.stringify({ homeScore: 4 }));

    const persistence = createPersistence({
      storageKey,
      prefsKey,
      initialState,
      storageVersion: 1,
      migrations: {
        0: (data) => ({
          ...data,
          visibilityMode: data.visibilityMode || "none",
        }),
      },
    });

    expect(persistence.load()).toEqual({
      ...initialState,
      homeScore: 4,
      visibilityMode: "none",
    });
  });

  it("migrates versioned state through each registered version", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 1, data: { homeScore: 5 } }),
    );

    const persistence = createPersistence({
      storageKey,
      prefsKey,
      initialState,
      storageVersion: 3,
      migrations: {
        1: (data) => ({ ...data, awayScore: 2 }),
        2: (data) => ({ ...data, theme: "forest" }),
      },
    });

    expect(persistence.load()).toEqual({
      ...initialState,
      homeScore: 5,
      awayScore: 2,
      theme: "forest",
    });
  });

  it("clears malformed storage entries and falls back to safe defaults", () => {
    localStorage.setItem(storageKey, "{not valid json");
    localStorage.setItem(
      prefsKey,
      JSON.stringify({ version: 1, data: { theme: "light" } }),
    );

    const persistence = createPersistence({
      storageKey,
      prefsKey,
      initialState,
    });

    expect(persistence.load()).toEqual({
      ...initialState,
      theme: "light",
    });
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("ignores future-version records and falls back to defaults", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 999, data: { homeScore: 77 } }),
    );
    localStorage.setItem(
      prefsKey,
      JSON.stringify({ version: 1, data: { theme: "forest" } }),
    );

    const persistence = createPersistence({
      storageKey,
      prefsKey,
      initialState,
    });

    expect(persistence.load()).toEqual({
      ...initialState,
      theme: "forest",
    });
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
