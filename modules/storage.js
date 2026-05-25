(function () {
  window.SummaRead = window.SummaRead || {};

  const DEFAULT_SETTINGS = {
    fontSizeScale: 1.0,
    lineHeightScale: 1.6,
    contrastMode: false,
    letterSpacing: 0,
    fontFamily: 'default',
    highlightLinks: false,
    hideImages: false,
    stopAnimations: false
  };

  async function getSettings() {
    const storedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...storedSettings
    };
  }

  async function saveSettings(partial) {
    const currentSettings = await getSettings();
    const nextSettings = {
      ...currentSettings,
      ...partial
    };

    await chrome.storage.sync.set(nextSettings);
    return nextSettings;
  }

  async function resetSettings() {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }

  window.SummaRead.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  window.SummaRead.storage = {
    getSettings,
    saveSettings,
    resetSettings
  };
})();
