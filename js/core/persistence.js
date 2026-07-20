export function createPersistence({ storageKey, prefsKey, initialState }) {
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
