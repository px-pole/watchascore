export const CURRENT_STORAGE_VERSION = 1;

export function createPersistence({
  storageKey,
  prefsKey,
  initialState,
  stateKeyPrefix = null,
  normalizeState = (data) => data,
  storageVersion = CURRENT_STORAGE_VERSION,
  migrations = {},
}) {
  const migrateRecord = (record) => {
    if (!record || typeof record !== "object") return null;

    let version = Number.isInteger(record.version) ? record.version : 0;
    let data = record.version === undefined ? record : record.data;
    if (!data || typeof data !== "object") return null;
    if (version > storageVersion) return null;

    while (version < storageVersion) {
      const migrate = migrations[version];
      if (typeof migrate === "function") data = migrate(data);
      version += 1;
    }

    return data;
  };

  const readRecord = (key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return migrateRecord(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  };

  // Migrates legacy mode values before normal load/save operations begin.
  const migrateLegacyMode = () => {
    const fallbackMode = initialState.mode;

    const migrateKey = (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const data = migrateRecord(parsed);
        if (!data || data.mode !== "worldcup") return;
        const nextData = { ...data, mode: fallbackMode };
        localStorage.setItem(
          key,
          JSON.stringify({ version: storageVersion, data: nextData }),
        );
      } catch (e) {
        // Ignore malformed entries and continue with remaining keys.
      }
    };

    migrateKey(prefsKey);

    if (!stateKeyPrefix) return;

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(stateKeyPrefix)) continue;
      migrateKey(key);
    }
  };

  migrateLegacyMode();

  return {
    // Saves the current state and compact preference data to localStorage.
    save(data) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ version: storageVersion, data }),
        );
        const prefs = {
          theme: data.theme,
          mode: data.mode,
          visibilityMode: data.visibilityMode,
        };
        localStorage.setItem(
          prefsKey,
          JSON.stringify({ version: storageVersion, data: prefs }),
        );
      } catch (e) {
        if (e.name === "QuotaExceededError")
          console.error("Persistence: Quota exceeded");
      }
    },

    // Loads state from localStorage and falls back to defaults when needed.
    load() {
      const savedState = readRecord(storageKey);
      const savedPrefs = readRecord(prefsKey);
      const prefs =
        savedPrefs && typeof savedPrefs === "object" ? savedPrefs : {};

      try {
        if (savedState) {
          return normalizeState({
            ...initialState,
            ...savedState,
            running: false,
          });
        }
      } catch (e) {
        console.error("Persistence: Error parsing data", e);
      }

      return normalizeState({ ...initialState, ...prefs });
    },
  };
}
