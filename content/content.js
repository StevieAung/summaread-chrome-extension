(function () {
  const messageTypes = window.SummaRead.MESSAGE_TYPES;
  let sidebarOpen = false;

  function setSidebarOpen(sidebar, isOpen) {
    sidebarOpen = isOpen;
    sidebar.setAttribute('aria-hidden', String(!isOpen));
    sidebar.style.transform = isOpen ? 'translateX(0)' : 'translateX(100%)';
  }

  function ensureSidebar() {
    let sidebar = document.getElementById('summaread-sidebar');

    if (sidebar) {
      return sidebar;
    }

    sidebar = document.createElement('aside');
    sidebar.id = 'summaread-sidebar';
    sidebar.setAttribute('aria-hidden', 'true');
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.right = '0';
    sidebar.style.zIndex = '2147483646';
    sidebar.style.width = '360px';
    sidebar.style.maxWidth = 'calc(100vw - 48px)';
    sidebar.style.height = '100vh';
    sidebar.style.maxHeight = '100vh';
    sidebar.style.overflow = 'hidden';
    sidebar.style.background = '#020617';
    sidebar.style.color = '#ffffff';
    sidebar.style.borderLeft = '1px solid #1e293b';
    sidebar.style.boxShadow = '-24px 0 60px rgba(15, 23, 42, 0.36)';
    sidebar.style.fontFamily = 'Inter, Arial, sans-serif';
    sidebar.style.transform = 'translateX(100%)';
    sidebar.style.transition = 'transform 180ms ease';
    sidebar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid #1e293b;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;background:#22c55e;color:#020617;font-weight:800;font-size:12px;">SR</div>
          <div>
            <div style="font-weight:800;font-size:16px;line-height:1.2;">SummaRead</div>
            <div style="color:#94a3b8;font-size:12px;line-height:1.4;">Mini accessibility panel</div>
          </div>
        </div>
        <button type="button" data-summaread-close style="border:1px solid #334155;border-radius:8px;background:#0f172a;color:#ffffff;cursor:pointer;font:inherit;font-size:12px;padding:7px 9px;">Close</button>
      </div>
      <div style="display:grid;gap:12px;padding:16px;">
        <button type="button" data-summaread-summary style="border:0;border-radius:12px;background:#22c55e;color:#020617;cursor:pointer;font-weight:800;padding:12px;">Summarise Page</button>
        <div data-summaread-output style="min-height:220px;max-height:calc(100vh - 220px);overflow:auto;border:1px solid #1e293b;border-radius:12px;background:#0f172a;color:#cbd5e1;font-size:14px;line-height:1.6;padding:12px;">
          Open SummaRead from the toolbar or summarise this page here.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button type="button" data-summaread-speak style="border:1px solid #22c55e;border-radius:10px;background:transparent;color:#86efac;cursor:pointer;font-weight:700;padding:10px;">Speak</button>
          <button type="button" data-summaread-stop style="border:1px solid #334155;border-radius:10px;background:#0f172a;color:#ffffff;cursor:pointer;font-weight:700;padding:10px;">Stop</button>
        </div>
      </div>
    `;

    sidebar.querySelector('[data-summaread-close]').addEventListener('click', () => {
      setSidebarOpen(sidebar, false);
    });

    sidebar.querySelector('[data-summaread-summary]').addEventListener('click', async () => {
      const output = sidebar.querySelector('[data-summaread-output]');
      output.textContent = 'Summarising page...';

      try {
        const response = await handleMessage({
          type: messageTypes.SUMMARIZE_TEXT
        });
        output.textContent = response.summary || response.note || 'No summary generated.';
      } catch (error) {
        output.textContent = error.message;
      }
    });

    sidebar.querySelector('[data-summaread-speak]').addEventListener('click', async () => {
      const output = sidebar.querySelector('[data-summaread-output]');
      await handleMessage({
        type: messageTypes.SPEAK_TEXT,
        text: output.textContent
      });
    });

    sidebar.querySelector('[data-summaread-stop]').addEventListener('click', async () => {
      await handleMessage({
        type: messageTypes.STOP_SPEECH
      });
    });

    document.documentElement.appendChild(sidebar);
    return sidebar;
  }

  function toggleSidebar() {
    const sidebar = ensureSidebar();
    setSidebarOpen(sidebar, !sidebarOpen);
    return {
      ok: true,
      message: sidebarOpen ? 'Sidebar opened' : 'Sidebar closed'
    };
  }

  async function summarizePage(message) {
    const page = window.SummaRead.pageText.extract();
    const settings = await window.SummaRead.storage.getSettings();
    let result;

    if (settings.summarisationMode === 'ai' && settings.geminiApiKey) {
      try {
        result = await window.SummaRead.gemini.summarize(page.text, settings.geminiApiKey);
      } catch (error) {
        console.warn('SummaRead: AI mode failed, falling back to LSA:', error.message);
        result = window.SummaRead.summarizer.summarize(page.text, message.count || 3);
        result.mode = 'lsa';
        result.note = `AI unavailable - used LSA fallback. ${error.message}`;
      }
    } else {
      result = window.SummaRead.summarizer.summarize(page.text, message.count || 3);
      result.mode = result.mode || 'lsa';
    }

    return {
      ok: true,
      summary: result.summary,
      note: result.note,
      wordCount: result.wordCount,
      originalWordCount: result.originalWordCount,
      selectedIndices: result.selectedIndices,
      title: page.title,
      url: page.url,
      sourceText: page.text
    };
  }

  async function updateSettings(settings) {
    const savedSettings = await window.SummaRead.storage.saveSettings(settings || {});
    window.SummaRead.accessibility.applySettings(savedSettings);

    return {
      ok: true,
      message: 'Settings updated',
      settings: savedSettings
    };
  }

  async function resetSettings() {
    window.SummaRead.accessibility.resetSettings();

    return {
      ok: true,
      message: 'Settings reset'
    };
  }

  async function handleMessage(message) {
    if (!message || !message.type) {
      return {
        ok: false,
        message: 'Missing message type'
      };
    }

    if (message.type === messageTypes.SUMMARIZE_TEXT) {
      return summarizePage(message);
    }

    if (message.type === messageTypes.EXTRACT_TEXT) {
      const result = window.SummaRead.pageText.extract();
      return {
        ok: true,
        ...result
      };
    }

    if (message.type === messageTypes.SPEAK_TEXT) {
      return window.SummaRead.tts.speak(message.text, message.rate, message.voiceURI || message.voiceName);
    }

    if (message.type === messageTypes.STOP_SPEECH) {
      return window.SummaRead.tts.stop();
    }

    if (message.type === messageTypes.PAUSE_SPEECH) {
      window.SummaRead.tts.pause();
      return {
        ok: true,
        message: 'Speech paused'
      };
    }

    if (message.type === messageTypes.RESUME_SPEECH) {
      window.SummaRead.tts.resume();
      return {
        ok: true,
        message: 'Speech resumed'
      };
    }

    if (message.type === messageTypes.UPDATE_SETTINGS) {
      return updateSettings(message.settings);
    }

    if (message.type === messageTypes.RESET_SETTINGS) {
      return resetSettings();
    }

    if (message.type === messageTypes.TOGGLE_SIDEBAR) {
      return toggleSidebar();
    }

    return {
      ok: false,
      message: `Unsupported message type: ${message.type}`
    };
  }

  async function initializeSavedSettings() {
    try {
      const settings = await window.SummaRead.storage.getSettings();
      window.SummaRead.accessibility.applySettings(settings);
    } catch (error) {
      console.warn('SummaRead could not restore saved settings.', error);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        const response = await handleMessage(message);
        sendResponse(response);
      } catch (error) {
        console.warn('SummaRead message handler failed.', error);
        sendResponse({
          ok: false,
          message: error.message || 'SummaRead message handler failed'
        });
      }
    })();

    return true;
  });

  window.addEventListener('summaread:message', (event) => {
    handleMessage(event.detail).catch((error) => {
      console.warn('SummaRead sidebar trigger failed.', error);
    });
  });

  initializeSavedSettings();
})();
