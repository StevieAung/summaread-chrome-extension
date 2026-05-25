(function () {
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
  const messageTypes = window.SummaRead.MESSAGE_TYPES;
  const status = document.getElementById('status');
  const summaryOutput = document.getElementById('summary-output');
  const wordCountBadge = document.getElementById('word-count-badge');
  const summarySpinner = document.getElementById('summary-spinner');
  const summaryButtonLabel = document.getElementById('summary-button-label');
  const summariseButton = document.getElementById('summarise-page');
  const speakSummaryButton = document.getElementById('speak-summary');
  const rateInput = document.getElementById('speech-rate');
  const rateValue = document.getElementById('rate-value');
  const voiceSelect = document.getElementById('voice-select');
  const settingControls = Array.from(document.querySelectorAll('.setting-control'));
  const valueLabels = {
    fontSizeScale: document.getElementById('fontSizeScale-value'),
    lineHeightScale: document.getElementById('lineHeightScale-value'),
    letterSpacing: document.getElementById('letterSpacing-value')
  };
  let latestSummary = '';
  let latestPageText = '';

  function setStatus(message) {
    status.textContent = message;
  }

  function setLoading(isLoading) {
    summarySpinner.classList.toggle('hidden', !isLoading);
    summariseButton.disabled = isLoading;
    summaryButtonLabel.textContent = isLoading ? 'Summarising' : 'Summarise This Page';
    summaryButtonLabel.classList.toggle('loading-dots', isLoading);
  }

  function animateSummaryOutput() {
    summaryOutput.classList.remove('summary-output-enter');
    void summaryOutput.offsetWidth;
    summaryOutput.classList.add('summary-output-enter');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderFriendlyError(message) {
    latestSummary = '';
    speakSummaryButton.disabled = true;
    summaryOutput.innerHTML = `
      <div class="flex h-full flex-col items-start justify-center gap-2 text-slate-300">
        <span class="flex h-8 w-8 items-center justify-center rounded-full border border-green-500 text-sm font-bold text-green-400">!</span>
        <p class="font-semibold text-white">No readable text found</p>
        <p class="text-sm leading-6 text-slate-400">${escapeHtml(message)}</p>
      </div>
    `;
    wordCountBadge.textContent = 'Summary: 0 words (from 0 words on page)';
    animateSummaryOutput();
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

    return chrome.tabs.sendMessage(tab.id, message);
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

  function updateValueLabel(key, value) {
    if (!valueLabels[key]) {
      return;
    }

    if (key === 'letterSpacing') {
      valueLabels[key].textContent = `${value}px`;
      return;
    }

    if (key === 'fontSizeScale') {
      valueLabels[key].textContent = `${Number(value).toFixed(1)}x`;
      return;
    }

    valueLabels[key].textContent = Number(value).toFixed(1);
  }

  function renderSettings(settings) {
    settingControls.forEach((control) => {
      const key = control.dataset.settingKey;
      const value = settings[key];

      if (control.type === 'checkbox') {
        control.checked = Boolean(value);
      } else {
        control.value = value;
      }

      updateValueLabel(key, value);
    });
  }

  async function getSettings() {
    const storedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...storedSettings
    };
  }

  async function saveSetting(key, value) {
    const currentSettings = await getSettings();
    const nextSettings = {
      ...currentSettings,
      [key]: value
    };

    await chrome.storage.sync.set(nextSettings);
    await sendToActiveTab({
      type: messageTypes.UPDATE_SETTINGS,
      settings: nextSettings
    });
    setStatus('Saved page setting');
  }

  async function resetPageStyles() {
    const currentSettings = await getSettings();
    const nextSettings = {
      ...currentSettings,
      fontSizeScale: DEFAULT_SETTINGS.fontSizeScale,
      lineHeightScale: DEFAULT_SETTINGS.lineHeightScale,
      contrastMode: DEFAULT_SETTINGS.contrastMode,
      letterSpacing: DEFAULT_SETTINGS.letterSpacing,
      fontFamily: DEFAULT_SETTINGS.fontFamily
    };

    await chrome.storage.sync.set(nextSettings);
    renderSettings(nextSettings);
    await sendToActiveTab({
      type: messageTypes.UPDATE_SETTINGS,
      settings: nextSettings
    });
    setStatus('Page styles reset');
  }

  async function resetAll() {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    renderSettings(DEFAULT_SETTINGS);
    await sendToActiveTab({
      type: messageTypes.RESET_SETTINGS
    });
    setStatus('All settings reset');
  }

  function switchTab(targetPanelId) {
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== targetPanelId);
    });

    document.querySelectorAll('.tab-button').forEach((button) => {
      const isActive = button.dataset.tabTarget === targetPanelId;
      button.classList.toggle('bg-green-500', isActive);
      button.classList.toggle('text-slate-950', isActive);
      button.classList.toggle('text-slate-300', !isActive);
      button.classList.toggle('hover:text-white', !isActive);
    });
  }

  function renderSummary(result) {
    latestSummary = result.summary || '';
    latestPageText = result.sourceText || latestPageText;

    if (!latestSummary) {
      renderFriendlyError('This page may be mostly interactive controls, media, or protected browser content.');
      return;
    }

    summaryOutput.textContent = latestSummary || 'No summary could be generated.';
    wordCountBadge.textContent = `Summary: ${result.wordCount || 0} words (from ${result.originalWordCount || 0} words on page)`;
    speakSummaryButton.disabled = !latestSummary;
    animateSummaryOutput();
  }

  async function summarisePage() {
    setLoading(true);
    setStatus('Summarising current page...');

    try {
      const result = await sendToActiveTab({
        type: messageTypes.SUMMARIZE_TEXT
      });

      if (!result || !result.ok) {
        throw new Error(result && result.message ? result.message : 'Summary failed');
      }

      if (!result.summary && result.note === 'No readable text found') {
        renderFriendlyError('SummaRead could not find enough article text to summarise on this page.');
        setStatus('No readable text found');
        return;
      }

      renderSummary(result);
      setStatus(result.note || 'Summary generated');
    } catch (error) {
      renderFriendlyError('Unable to summarise this page. Try refreshing the tab and running SummaRead again.');
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function speakText(text, label) {
    const readableText = String(text || '').trim();

    if (!readableText) {
      setStatus('No text available to speak');
      return;
    }

    await chrome.runtime.sendMessage({
      type: messageTypes.SPEAK_TEXT,
      text: readableText.slice(0, 4000),
      rate: Number(rateInput.value),
      voiceName: voiceSelect.value || undefined
    });
    setStatus(label);
  }

  async function getPageText() {
    const result = await sendToActiveTab({
      type: messageTypes.EXTRACT_TEXT
    });

    latestPageText = result && result.text ? result.text : '';
    return latestPageText;
  }

  async function loadVoices() {
    if (!chrome.tts || !chrome.tts.getVoices) {
      return;
    }

    chrome.tts.getVoices((voices) => {
      const sortedVoices = voices.slice().sort((left, right) => {
        const leftEnglish = /^en\b/i.test(left.lang || '');
        const rightEnglish = /^en\b/i.test(right.lang || '');

        if (leftEnglish !== rightEnglish) {
          return leftEnglish ? -1 : 1;
        }

        return (left.voiceName || '').localeCompare(right.voiceName || '');
      });

      sortedVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.voiceName || '';
        option.textContent = `${voice.voiceName || 'Unnamed voice'}${voice.lang ? ` (${voice.lang})` : ''}`;
        voiceSelect.appendChild(option);
      });
    });
  }

  function bindEvents() {
    document.querySelectorAll('.tab-button').forEach((button) => {
      button.addEventListener('click', () => {
        switchTab(button.dataset.tabTarget);
        setStatus(button.textContent.trim());
      });
    });

    settingControls.forEach((control) => {
      control.addEventListener('input', async () => {
        const key = control.dataset.settingKey;
        const value = readControlValue(control);

        updateValueLabel(key, value);

        try {
          await saveSetting(key, value);
        } catch (error) {
          setStatus(error.message);
        }
      });
    });

    rateInput.addEventListener('input', () => {
      rateValue.textContent = `${Number(rateInput.value).toFixed(1)}x`;
      setStatus(`Speech rate ${rateValue.textContent}`);
    });

    summariseButton.addEventListener('click', summarisePage);
    speakSummaryButton.addEventListener('click', () => speakText(latestSummary, 'Speaking summary'));

    document.getElementById('play-speech').addEventListener('click', async () => {
      const text = latestSummary || latestPageText || (await getPageText());
      await speakText(text, latestSummary ? 'Speaking summary' : 'Speaking page text');
    });

    document.getElementById('pause-speech').addEventListener('click', async () => {
      await chrome.runtime.sendMessage({
        type: messageTypes.PAUSE_SPEECH
      });
      setStatus('Speech paused');
    });

    document.getElementById('stop-speech').addEventListener('click', async () => {
      await chrome.runtime.sendMessage({
        type: messageTypes.STOP_SPEECH
      });
      setStatus('Speech stopped');
    });

    document.getElementById('reset-page-styles').addEventListener('click', async () => {
      try {
        await resetPageStyles();
      } catch (error) {
        setStatus(error.message);
      }
    });

    document.getElementById('reset-all').addEventListener('click', async () => {
      try {
        await resetAll();
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  async function initialize() {
    const settings = await getSettings();
    renderSettings(settings);
    switchTab('summary-panel');
    await loadVoices();
    bindEvents();
    setStatus('Ready');
  }

  initialize();
})();
