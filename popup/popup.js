(function () {
  const DEFAULT_SETTINGS = {
    fontSizeScale: 1.0,
    lineHeightScale: 1.6,
    contrastMode: false,
    letterSpacing: 0,
    fontFamily: 'default',
    saturationScale: 1.0,
    highlightLinks: false,
    hideImages: false,
    stopAnimations: false,
    summarisationMode: 'lsa',
    geminiApiKey: '',
    aiModeEnabled: false
  };

  const messageTypes = window.SummaRead.MESSAGE_TYPES;
  const statusText = document.getElementById('status');
  const statusDot = document.getElementById('status-dot');
  const settingsButton = document.getElementById('settings-button');
  const settingsMenu = document.getElementById('settings-menu');
  const summaryButton = document.getElementById('summarise-page');
  const summaryButtonLabel = document.getElementById('summary-button-label');
  const summarySpinner = document.getElementById('summary-spinner');
  const summaryPanel = document.getElementById('summary-output-panel');
  const summaryOutput = document.getElementById('summary-output');
  const wordCountBadge = document.getElementById('word-count-badge');
  const summaryModeBadge = document.getElementById('summary-mode-badge');
  const speakSummaryButton = document.getElementById('speak-summary');
  const modeButtons = Array.from(document.querySelectorAll('.mode-button'));
  const aiWarning = document.getElementById('ai-warning');
  const apiKeyPanel = document.getElementById('api-key-panel');
  const apiKeyInput = document.getElementById('gemini-api-key');
  const apiKeyMessage = document.getElementById('api-key-message');
  const apiKeySpinner = document.getElementById('api-key-spinner');
  const apiKeyButtonLabel = document.getElementById('api-key-button-label');
  const validateApiKeyButton = document.getElementById('validate-api-key');
  const removeApiKeyButton = document.getElementById('remove-api-key');
  const speechRate = document.getElementById('speech-rate');
  const speechRateValue = document.getElementById('rate-value');
  const voiceSelect = document.getElementById('voice-select');
  const visualDrawers = Array.from(document.querySelectorAll('.visual-drawer'));
  const settingCards = Array.from(document.querySelectorAll('.setting-card'));
  const settingInputs = Array.from(document.querySelectorAll('.setting-input'));
  const fontOptions = Array.from(document.querySelectorAll('.font-option'));
  const valueLabels = {
    fontSizeScale: document.getElementById('fontSizeScale-value'),
    lineHeightScale: document.getElementById('lineHeightScale-value'),
    letterSpacing: document.getElementById('letterSpacing-value'),
    saturationScale: document.getElementById('saturationScale-value')
  };

  let settings = { ...DEFAULT_SETTINGS };
  let latestSummary = '';
  let latestPageText = '';
  let openVisualDrawerId = null;
  const speechRates = [0.75, 1, 1.5, 2];
  const debounceTimers = {};

  function setStatus(message, state = 'ready') {
    statusText.textContent = message;
    statusDot.classList.remove('bg-green-500', 'bg-yellow-400', 'bg-red-500');

    if (state === 'working') {
      statusDot.classList.add('bg-yellow-400');
    } else if (state === 'error') {
      statusDot.classList.add('bg-red-500');
    } else {
      statusDot.classList.add('bg-green-500');
    }
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    return tab || null;
  }

  async function sendToActiveTab(message) {
    const tab = await getActiveTab();

    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      await injectContentScripts(tab.id);
      return chrome.tabs.sendMessage(tab.id, message);
    }
  }

  async function injectContentScripts(tabId) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'modules/constants.js',
          'modules/storage.js',
          'modules/extractive.js',
          'modules/gemini.js',
          'modules/speech.js',
          'modules/controls.js',
          'content/page-text.js',
          'content/content.js',
          'content/sidebar.js'
        ]
      });
    } catch (error) {
      throw new Error('SummaRead cannot run on this page. Try a normal webpage and refresh the tab.');
    }
  }

  async function getSettings() {
    const storedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...storedSettings
    };
  }

  async function persistSettings(nextSettings) {
    settings = {
      ...DEFAULT_SETTINGS,
      ...nextSettings
    };

    await chrome.storage.sync.set(settings);

    const settingsForPage = {
      ...settings
    };
    delete settingsForPage.geminiApiKey;

    try {
      await sendToActiveTab({
        type: messageTypes.UPDATE_SETTINGS,
        settings: settingsForPage
      });
    } catch (error) {
      console.warn('SummaRead could not apply settings to the active tab:', error.message);
    }
  }

  function formatSettingValue(key, value) {
    if (key === 'letterSpacing') {
      return `${value}px`;
    }

    if (key === 'fontSizeScale' || key === 'saturationScale') {
      return `${Number(value).toFixed(1)}x`;
    }

    if (key === 'lineHeightScale') {
      return Number(value).toFixed(1);
    }

    return String(value);
  }

  function updateValueLabel(key, value) {
    if (valueLabels[key]) {
      valueLabels[key].textContent = formatSettingValue(key, value);
    }
  }

  function isSettingActive(key) {
    if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
      return Boolean(settings[key]);
    }

    return settings[key] !== DEFAULT_SETTINGS[key];
  }

  function updateCardStates() {
    settingCards.forEach((card) => {
      const key = card.dataset.settingKey;
      const drawer = card.dataset.drawerTarget ? document.getElementById(card.dataset.drawerTarget) : null;
      card.classList.toggle('active', isSettingActive(key) || Boolean(drawer && drawer.classList.contains('open')));
    });

    fontOptions.forEach((option) => {
      option.classList.toggle('active', option.dataset.fontValue === settings.fontFamily);
    });
  }

  function hasGeminiKey() {
    return Boolean(settings.aiModeEnabled && settings.geminiApiKey);
  }

  function renderModeState() {
    const isAiMode = settings.summarisationMode === 'ai';
    const hasKey = hasGeminiKey();

    modeButtons.forEach((button) => {
      const isActive = button.dataset.mode === settings.summarisationMode;
      button.classList.toggle('active-lsa', isActive && button.dataset.mode === 'lsa');
      button.classList.toggle('active-ai', isActive && button.dataset.mode === 'ai');
    });

    aiWarning.classList.toggle('hidden', !(isAiMode && !hasKey));
    removeApiKeyButton.classList.toggle('hidden', !settings.geminiApiKey);
    summaryButton.disabled = isAiMode && !hasKey;
    summaryButtonLabel.textContent = isAiMode && !hasKey ? 'Add Gemini API Key' : 'Summarise This Page';
  }

  function renderSettings() {
    settingInputs.forEach((input) => {
      const key = input.dataset.settingKey;
      input.value = settings[key];
      updateValueLabel(key, settings[key]);
    });

    updateCardStates();
    renderModeState();
  }

  function closeVisualDrawers(exceptId = null) {
    visualDrawers.forEach((drawer) => {
      if (drawer.id !== exceptId) {
        drawer.classList.remove('open');
      }
    });

    if (!exceptId) {
      openVisualDrawerId = null;
    }
  }

  function toggleVisualDrawer(drawerId) {
    const drawer = document.getElementById(drawerId);

    if (!drawer) {
      return;
    }

    if (openVisualDrawerId === drawerId && drawer.classList.contains('open')) {
      drawer.classList.remove('open');
      openVisualDrawerId = null;
      updateCardStates();
      return;
    }

    closeVisualDrawers(drawerId);
    drawer.classList.add('open');
    openVisualDrawerId = drawerId;
    updateCardStates();
  }

  function switchTab(targetPanelId) {
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== targetPanelId);
    });

    document.querySelectorAll('.tab-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.tabTarget === targetPanelId);
    });

    document.querySelectorAll('.bottom-nav-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.tabTarget === targetPanelId);
    });

    settingsMenu.classList.add('hidden');
    setStatus(targetPanelId === 'summary-panel' ? 'Summarise & Speech' : 'Visual & Reading');
  }

  function setSummaryLoading(isLoading) {
    summaryButton.disabled = isLoading;
    summarySpinner.classList.toggle('hidden', !isLoading);
    summaryButtonLabel.textContent = isLoading ? 'Summarising...' : 'Summarise This Page';
    if (!isLoading) {
      renderModeState();
    }
  }

  function revealSummaryPanel() {
    summaryPanel.classList.remove('hidden', 'summary-enter');
    void summaryPanel.offsetWidth;
    summaryPanel.classList.add('summary-enter');
  }

  function renderSummaryError(message) {
    latestSummary = '';
    speakSummaryButton.disabled = true;
    summaryModeBadge.textContent = settings.summarisationMode === 'ai' ? '✨ Gemini 2.0 Flash' : '🧠 LSA';
    summaryModeBadge.className =
      settings.summarisationMode === 'ai'
        ? 'rounded-full bg-green-800 px-2.5 py-1 text-[11px] font-bold text-green-100'
        : 'rounded-full bg-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-200';
    summaryOutput.innerHTML = `
      <div class="flex items-start gap-3 text-slate-300">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-500 text-xs font-bold text-red-300">!</span>
        <div>
          <p class="font-semibold text-white">No readable text found</p>
          <p class="mt-1 text-sm leading-6 text-slate-400">${escapeHtml(message)}</p>
        </div>
      </div>
    `;
    wordCountBadge.textContent = '0 words (from 0)';
    revealSummaryPanel();
  }

  function renderSummary(result) {
    latestSummary = result.summary || '';
    latestPageText = result.sourceText || latestPageText;

    if (!latestSummary) {
      renderSummaryError('This page may be mostly controls, media, or protected browser content.');
      return;
    }

    summaryOutput.textContent = latestSummary;
    wordCountBadge.textContent = `${result.wordCount || 0} words (from ${result.originalWordCount || 0})`;
    if (result.mode === 'ai') {
      summaryModeBadge.textContent = '✨ Gemini 2.0 Flash';
      summaryModeBadge.className = 'rounded-full bg-green-800 px-2.5 py-1 text-[11px] font-bold text-green-100';
    } else {
      summaryModeBadge.textContent = '🧠 LSA';
      summaryModeBadge.className = 'rounded-full bg-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-200';
    }
    speakSummaryButton.disabled = false;
    revealSummaryPanel();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function updateSetting(key, value, statusMessage = 'Settings updated') {
    const nextSettings = {
      ...settings,
      [key]: value
    };

    try {
      await persistSettings(nextSettings);
      renderSettings();
      setStatus(statusMessage);
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  function debounceSetting(key, value) {
    window.clearTimeout(debounceTimers[key]);
    debounceTimers[key] = window.setTimeout(() => {
      updateSetting(key, value);
    }, 300);
  }

  async function resetPageStyles() {
    const nextSettings = {
      ...settings,
      fontSizeScale: DEFAULT_SETTINGS.fontSizeScale,
      lineHeightScale: DEFAULT_SETTINGS.lineHeightScale,
      contrastMode: DEFAULT_SETTINGS.contrastMode,
      letterSpacing: DEFAULT_SETTINGS.letterSpacing,
      fontFamily: DEFAULT_SETTINGS.fontFamily,
      saturationScale: DEFAULT_SETTINGS.saturationScale
    };

    await persistSettings(nextSettings);
    renderSettings();
    closeVisualDrawers();
    setStatus('Page styles reset');
  }

  async function resetAll() {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    settings = { ...DEFAULT_SETTINGS };
    renderSettings();
    closeVisualDrawers();
    await sendToActiveTab({
      type: messageTypes.RESET_SETTINGS
    });
    setStatus('All settings reset');
  }

  async function summarisePage() {
    if (settings.summarisationMode === 'ai' && !hasGeminiKey()) {
      apiKeyPanel.classList.add('open');
      setStatus('Add a Gemini API key to use AI Mode', 'error');
      return;
    }

    setSummaryLoading(true);
    setStatus('Summarising...', 'working');

    try {
      const result = await sendToActiveTab({
        type: messageTypes.SUMMARIZE_TEXT
      });

      if (!result || !result.ok) {
        throw new Error(result && result.message ? result.message : 'Unable to summarise this page');
      }

      renderSummary(result);
      setStatus(result.note || 'Summary ready');
    } catch (error) {
      renderSummaryError('Try a page with more readable article text, then run SummaRead again.');
      setStatus(error.message, 'error');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function switchSummarisationMode(mode) {
    await updateSetting('summarisationMode', mode, mode === 'ai' ? 'AI Mode selected' : 'LSA Mode selected');

    if (mode === 'ai' && !hasGeminiKey()) {
      apiKeyPanel.classList.add('open');
      setStatus('Add a Gemini API key to use AI Mode', 'error');
    }
  }

  function setApiKeyLoading(isLoading) {
    validateApiKeyButton.disabled = isLoading;
    apiKeySpinner.classList.toggle('hidden', !isLoading);
    apiKeyButtonLabel.textContent = isLoading ? 'Validating...' : 'Validate & Save';
  }

  async function validateAndSaveApiKey() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      apiKeyMessage.textContent = '✗ Enter an API key';
      apiKeyMessage.className = 'text-xs text-red-300';
      return;
    }

    setApiKeyLoading(true);
    apiKeyMessage.textContent = '';
    setStatus('Validating Gemini API key...', 'working');

    try {
      const result = await chrome.runtime.sendMessage({
        type: messageTypes.VALIDATE_GEMINI_KEY,
        apiKey
      });

      if (result && result.quotaLimited) {
        await persistSettings({
          ...settings,
          geminiApiKey: apiKey,
          aiModeEnabled: true,
          summarisationMode: 'ai'
        });
        apiKeyInput.value = '';
        apiKeyPanel.classList.remove('open');
        apiKeyMessage.textContent = '✓ Key saved. Gemini quota is limited right now.';
        apiKeyMessage.className = 'text-xs text-yellow-300';
        renderSettings();
        setStatus('Key saved, but Gemini quota is currently limited', 'error');
        return;
      }

      if (!result || !result.valid) {
        apiKeyMessage.textContent = result && result.error ? `✗ ${result.error}` : '✗ Could not validate key';
        apiKeyMessage.className = 'text-xs text-red-300';
        setStatus(result && result.error ? result.error : 'Invalid Gemini API key', 'error');
        return;
      }

      await persistSettings({
        ...settings,
        geminiApiKey: apiKey,
        aiModeEnabled: true,
        summarisationMode: 'ai'
      });
      apiKeyInput.value = '';
      apiKeyPanel.classList.remove('open');
      apiKeyMessage.textContent = '✓ API key saved';
      apiKeyMessage.className = 'text-xs text-green-300';
      renderSettings();
      setStatus('✓ API key saved');
    } catch (error) {
      apiKeyMessage.textContent = `✗ ${error.message || 'Could not validate key'}`;
      apiKeyMessage.className = 'text-xs text-red-300';
      setStatus(error.message, 'error');
    } finally {
      setApiKeyLoading(false);
    }
  }

  async function removeApiKey() {
    try {
      apiKeyInput.value = '';
      await persistSettings({
        ...settings,
        geminiApiKey: '',
        aiModeEnabled: false,
        summarisationMode: 'lsa'
      });
      apiKeyPanel.classList.remove('open');
      apiKeyMessage.textContent = 'Key removed';
      apiKeyMessage.className = 'text-xs text-slate-400';
      renderSettings();
      setStatus('Gemini API key removed');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function speakText(text, message) {
    const readableText = String(text || '').trim();

    if (!readableText) {
      setStatus('No text available to speak', 'error');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: messageTypes.SPEAK_TEXT,
        text: readableText.slice(0, 4000),
        rate: Number(speechRate.value),
        voiceName: voiceSelect.value || undefined
      });
      setStatus(message, 'working');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function getPageText() {
    const response = await sendToActiveTab({
      type: messageTypes.EXTRACT_TEXT
    });

    latestPageText = response && response.text ? response.text : '';
    return latestPageText;
  }

  async function loadVoices() {
    if (!chrome.tts || !chrome.tts.getVoices) {
      return;
    }

    chrome.tts.getVoices((voices) => {
      voices
        .slice()
        .sort((left, right) => {
          const leftEnglish = /^en\b/i.test(left.lang || '');
          const rightEnglish = /^en\b/i.test(right.lang || '');

          if (leftEnglish !== rightEnglish) {
            return leftEnglish ? -1 : 1;
          }

          return (left.voiceName || '').localeCompare(right.voiceName || '');
        })
        .forEach((voice) => {
          const option = document.createElement('option');
          option.value = voice.voiceName || '';
          option.textContent = `${voice.voiceName || 'Unnamed voice'}${voice.lang ? ` (${voice.lang})` : ''}`;
          voiceSelect.appendChild(option);
        });
    });
  }

  function bindTabs() {
    document.querySelectorAll('.tab-button, .bottom-nav-button').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.tabTarget) {
          switchTab(button.dataset.tabTarget);
        }
      });
    });
  }

  function bindSettingsCards() {
    settingCards.forEach((card) => {
      card.addEventListener('click', () => {
        const key = card.dataset.settingKey;

        if (card.dataset.kind === 'toggle') {
          updateSetting(key, !Boolean(settings[key]));
          return;
        }

        toggleVisualDrawer(card.dataset.drawerTarget);
      });
    });
  }

  function bindSettingInputs() {
    settingInputs.forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.settingKey;
        const value = Number(input.value);
        settings = {
          ...settings,
          [key]: value
        };
        updateValueLabel(key, value);
        updateCardStates();
        debounceSetting(key, value);
      });
    });

    fontOptions.forEach((option) => {
      option.addEventListener('click', () => {
        updateSetting('fontFamily', option.dataset.fontValue);
      });
    });
  }

  function bindSpeechControls() {
    document.getElementById('speech-settings-toggle').addEventListener('click', () => {
      const drawer = document.getElementById('speech-settings-drawer');
      drawer.classList.toggle('open');
      document.getElementById('speech-settings-toggle').setAttribute('aria-expanded', String(drawer.classList.contains('open')));
    });

    speechRate.addEventListener('click', () => {
      const currentRate = Number(speechRate.value) || 1;
      const currentIndex = speechRates.indexOf(currentRate);
      const nextRate = speechRates[(currentIndex + 1) % speechRates.length];
      speechRate.value = String(nextRate);
      speechRateValue.textContent = `${nextRate}x`;
      setStatus(`Speech speed ${speechRateValue.textContent}`);
    });

    summaryButton.addEventListener('click', summarisePage);
    speakSummaryButton.addEventListener('click', () => speakText(latestSummary, 'Speaking summary...'));

    document.getElementById('play-speech').addEventListener('click', async () => {
      const text = latestSummary || latestPageText || (await getPageText());
      speakText(text, latestSummary ? 'Speaking summary...' : 'Speaking page text...');
    });

    document.getElementById('pause-speech').addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({
          type: messageTypes.PAUSE_SPEECH
        });
        setStatus('Paused');
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });

    document.getElementById('stop-speech').addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({
          type: messageTypes.STOP_SPEECH
        });
        setStatus('Stopped');
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });
  }

  function bindModeControls() {
    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        switchSummarisationMode(button.dataset.mode);
      });
    });

    document.getElementById('open-api-setup').addEventListener('click', () => {
      apiKeyPanel.classList.add('open');
      apiKeyInput.focus();
    });

    document.getElementById('get-gemini-key').addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://aistudio.google.com/app/apikey'
      });
    });

    validateApiKeyButton.addEventListener('click', validateAndSaveApiKey);
    removeApiKeyButton.addEventListener('click', removeApiKey);
  }

  function bindResetControls() {
    settingsButton.addEventListener('click', () => {
      settingsMenu.classList.toggle('hidden');
    });

    document.getElementById('settings-reset-all').addEventListener('click', async () => {
      settingsMenu.classList.add('hidden');
      try {
        await resetAll();
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });

    document.getElementById('reset-page-styles').addEventListener('click', async () => {
      try {
        await resetPageStyles();
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });

    document.getElementById('reset-all').addEventListener('click', async () => {
      try {
        await resetAll();
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });
  }

  async function initialize() {
    settings = await getSettings();
    openVisualDrawerId = document.querySelector('.visual-drawer.open')?.id || null;
    renderSettings();
    switchTab('summary-panel');
    await loadVoices();
    bindTabs();
    bindModeControls();
    bindSettingsCards();
    bindSettingInputs();
    bindSpeechControls();
    bindResetControls();
    setStatus('Ready');
  }

  initialize().catch((error) => {
    setStatus(error.message, 'error');
  });
})();
