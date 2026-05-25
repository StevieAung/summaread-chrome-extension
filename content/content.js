(function () {
  const messageTypes = window.SummaRead.MESSAGE_TYPES;
  let currentSettings = null;

  function applySettings(settings) {
    currentSettings = settings;
    window.SummaRead.accessibility.applySettings(settings);
  }

  function ensureSidebar() {
    let sidebar = document.getElementById('summaread-sidebar');

    if (sidebar) {
      return sidebar;
    }

    sidebar = document.createElement('aside');
    sidebar.id = 'summaread-sidebar';
    sidebar.hidden = true;
    sidebar.innerHTML = `
      <div class="summaread-sidebar-header">
        <span>SummaRead</span>
        <button class="summaread-sidebar-button" type="button" data-summaread-close>Close</button>
      </div>
      <div class="summaread-sidebar-body" data-summaread-content>
        Select text or use the popup to summarize this page.
      </div>
    `;

    sidebar.querySelector('[data-summaread-close]').addEventListener('click', () => {
      sidebar.hidden = true;
    });

    document.documentElement.appendChild(sidebar);
    return sidebar;
  }

  function toggleSidebar() {
    const sidebar = ensureSidebar();
    sidebar.hidden = !sidebar.hidden;
  }

  async function initialize() {
    const settings = await window.SummaRead.storage.getSettings();
    applySettings(settings);
    ensureSidebar();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }

    if (message.type === messageTypes.EXTRACT_TEXT) {
      const page = window.SummaRead.pageText.extract();
      sendResponse({ ok: true, ...page });
      return true;
    }

    if (message.type === messageTypes.UPDATE_SETTINGS) {
      applySettings({
        ...currentSettings,
        ...message.settings
      });
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === messageTypes.RESET_SETTINGS) {
      currentSettings = window.SummaRead.DEFAULT_SETTINGS;
      window.SummaRead.accessibility.resetSettings();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === messageTypes.TOGGLE_SIDEBAR) {
      toggleSidebar();
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  window.addEventListener('summaread:message', (event) => {
    const message = event.detail;

    if (!message || !message.type) {
      return;
    }

    if (message.type === messageTypes.TOGGLE_SIDEBAR) {
      toggleSidebar();
    }
  });

  initialize();
})();
