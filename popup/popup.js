(function () {
  const messageTypes = window.SummaRead.MESSAGE_TYPES;
  const controls = {
    fontSizeScale: document.getElementById('fontSizeScale'),
    lineHeightScale: document.getElementById('lineHeightScale'),
    letterSpacing: document.getElementById('letterSpacing'),
    fontFamily: document.getElementById('fontFamily'),
    contrastMode: document.getElementById('contrastMode'),
    highlightLinks: document.getElementById('highlightLinks'),
    hideImages: document.getElementById('hideImages'),
    stopAnimations: document.getElementById('stopAnimations')
  };
  const status = document.getElementById('status');

  function setStatus(text) {
    status.textContent = text;
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    return tab;
  }

  async function sendToActiveTab(message) {
    const tab = await getActiveTab();

    if (!tab || !tab.id) {
      return null;
    }

    return chrome.tabs.sendMessage(tab.id, message);
  }

  function renderSettings(settings) {
    controls.fontSizeScale.value = settings.fontSizeScale;
    controls.lineHeightScale.value = settings.lineHeightScale;
    controls.letterSpacing.value = settings.letterSpacing;
    controls.fontFamily.value = settings.fontFamily;
    controls.contrastMode.checked = settings.contrastMode;
    controls.highlightLinks.checked = settings.highlightLinks;
    controls.hideImages.checked = settings.hideImages;
    controls.stopAnimations.checked = settings.stopAnimations;
  }

  function readControlValue(control) {
    if (control.type === 'checkbox') {
      return control.checked;
    }

    if (control.type === 'range') {
      return Number(control.value);
    }

    return control.value;
  }

  async function updateSetting(key, value) {
    const settings = await window.SummaRead.storage.saveSettings({ [key]: value });
    await sendToActiveTab({
      type: messageTypes.UPDATE_SETTINGS,
      settings
    });
    setStatus('Saved');
  }

  Object.entries(controls).forEach(([key, control]) => {
    control.addEventListener('input', () => {
      updateSetting(key, readControlValue(control));
    });
  });

  document.getElementById('resetSettings').addEventListener('click', async () => {
    const settings = await window.SummaRead.storage.resetSettings();
    renderSettings(settings);
    await sendToActiveTab({ type: messageTypes.RESET_SETTINGS });
    setStatus('Settings reset');
  });

  document.getElementById('toggleSidebar').addEventListener('click', async () => {
    await sendToActiveTab({ type: messageTypes.TOGGLE_SIDEBAR });
    setStatus('Sidebar toggled');
  });

  document.getElementById('speakPage').addEventListener('click', async () => {
    const response = await sendToActiveTab({ type: messageTypes.EXTRACT_TEXT });
    const text = response && response.text ? response.text.slice(0, 4000) : '';

    if (!text) {
      setStatus('No readable text found');
      return;
    }

    await chrome.runtime.sendMessage({
      type: messageTypes.SPEAK_TEXT,
      text
    });
    setStatus('Speaking page text');
  });

  document.getElementById('stopSpeech').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: messageTypes.STOP_SPEECH });
    setStatus('Speech stopped');
  });

  async function initialize() {
    const settings = await window.SummaRead.storage.getSettings();
    renderSettings(settings);
  }

  initialize();
})();
