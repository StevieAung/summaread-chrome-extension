(function () {
  const messageTypes = window.SummaRead.MESSAGE_TYPES;
  let currentSettings = null;
  let originalInlineStyles = null;

  function rememberOriginalStyles() {
    if (originalInlineStyles) {
      return;
    }

    originalInlineStyles = {
      fontSize: document.documentElement.style.fontSize,
      lineHeight: document.documentElement.style.lineHeight,
      letterSpacing: document.documentElement.style.letterSpacing,
      fontFamily: document.documentElement.style.fontFamily
    };
  }

  function applySettings(settings) {
    currentSettings = settings;
    rememberOriginalStyles();

    document.documentElement.style.fontSize = `${settings.fontSizeScale * 100}%`;
    document.documentElement.style.lineHeight = String(settings.lineHeightScale);
    document.documentElement.style.letterSpacing = `${settings.letterSpacing}px`;
    document.documentElement.style.fontFamily =
      settings.fontFamily === 'default' ? originalInlineStyles.fontFamily : settings.fontFamily;

    document.documentElement.classList.toggle('summaread-contrast', settings.contrastMode);
    document.documentElement.classList.toggle('summaread-highlight-links', settings.highlightLinks);
    document.documentElement.classList.toggle('summaread-hide-images', settings.hideImages);
    document.documentElement.classList.toggle('summaread-stop-animations', settings.stopAnimations);
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
      applySettings(window.SummaRead.DEFAULT_SETTINGS);
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

  initialize();
})();
