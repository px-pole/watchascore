export function createPersistence({ storageKey, prefsKey, initialState, stateKeyPrefix = null }) {
  // Migrates legacy mode values before normal load/save operations begin.
  const migrateLegacyMode = () => {
    const fallbackMode = initialState.mode;

    const migrateKey = (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        if (parsed.mode !== 'worldcup') return;
        localStorage.setItem(key, JSON.stringify({ ...parsed, mode: fallbackMode }));
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
        localStorage.setItem(storageKey, JSON.stringify(data));
        const prefs = {
          theme: data.theme,
          mode: data.mode,
          visibilityMode: data.visibilityMode
        };
        localStorage.setItem(prefsKey, JSON.stringify(prefs));
      } catch (e) {
        if (e.name === 'QuotaExceededError') console.error('Persistence: Quota exceeded');
      }
    },

    // Loads state from localStorage and falls back to defaults when needed.
    load() {
      const savedState = localStorage.getItem(storageKey);
      const savedPrefs = localStorage.getItem(prefsKey);
      let prefs = {};

      try {
        if (savedPrefs) {
          prefs = JSON.parse(savedPrefs);
        }
        if (savedState) {
          return { ...initialState, ...JSON.parse(savedState), running: false };
        }
      } catch (e) {
        console.error('Persistence: Error parsing data', e);
      }

      return { ...initialState, ...prefs };
    }
  };
}
