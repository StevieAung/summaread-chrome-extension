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

chrome.runtime.onInstalled.addListener(async () => {
  const existingSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({
    ...DEFAULT_SETTINGS,
    ...existingSettings
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'SPEAK_TEXT') {
    chrome.tts.speak(message.text || '', {
      enqueue: false,
      rate: 1.0
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'STOP_SPEECH') {
    chrome.tts.stop();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
