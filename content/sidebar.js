(function () {
  window.SummaRead = window.SummaRead || {};

  const FAB_ID = 'summaread-fab';
  const STORAGE_KEY = 'summaread-sidebar-y';
  const BUTTON_SIZE = 48;
  const DRAG_THRESHOLD = 4;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getSavedY() {
    let rawValue = null;

    try {
      rawValue = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }

    if (rawValue === null) {
      return null;
    }

    const saved = Number(rawValue);

    if (!Number.isFinite(saved)) {
      return null;
    }

    return clamp(saved, BUTTON_SIZE / 2, window.innerHeight - BUTTON_SIZE / 2);
  }

  function saveY(value) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        String(clamp(value, BUTTON_SIZE / 2, window.innerHeight - BUTTON_SIZE / 2))
      );
    } catch (error) {
      // Some pages disable storage access; dragging should still work for this session.
    }
  }

  function setButtonY(button, value) {
    const nextY = clamp(value, BUTTON_SIZE / 2, window.innerHeight - BUTTON_SIZE / 2);
    button.style.top = `${nextY}px`;
    button.style.transform = 'translateY(-50%)';
    return nextY;
  }

  function sendToggleMessage() {
    const messageTypes = window.SummaRead.MESSAGE_TYPES || {};
    window.dispatchEvent(
      new CustomEvent('summaread:message', {
        detail: {
          type: messageTypes.TOGGLE_SIDEBAR || 'TOGGLE_SIDEBAR'
        }
      })
    );
  }

  function createButton() {
    if (document.getElementById(FAB_ID)) {
      return;
    }

    const button = document.createElement('button');
    button.id = FAB_ID;
    button.type = 'button';
    button.textContent = 'SR';
    button.setAttribute('aria-label', 'Toggle SummaRead sidebar');
    button.style.position = 'fixed';
    button.style.right = '0';
    button.style.top = '50%';
    button.style.transform = 'translateY(-50%)';
    button.style.zIndex = '2147483647';
    button.style.width = `${BUTTON_SIZE}px`;
    button.style.height = `${BUTTON_SIZE}px`;
    button.style.border = '0';
    button.style.borderRadius = '50% 0 0 50%';
    button.style.background = '#22c55e';
    button.style.color = '#ffffff';
    button.style.cursor = 'grab';
    button.style.font = '700 14px/1 Arial, sans-serif';
    button.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.28)';
    button.style.userSelect = 'none';
    button.style.padding = '0';

    const savedY = getSavedY();

    if (savedY !== null) {
      setButtonY(button, savedY);
    }

    let startY = 0;
    let startTop = 0;
    let dragged = false;

    button.addEventListener('mousedown', (event) => {
      event.preventDefault();

      startY = event.clientY;
      startTop = button.getBoundingClientRect().top + BUTTON_SIZE / 2;
      dragged = false;
      button.style.cursor = 'grabbing';

      function handleMouseMove(moveEvent) {
        const deltaY = moveEvent.clientY - startY;

        if (Math.abs(deltaY) > DRAG_THRESHOLD) {
          dragged = true;
        }

        setButtonY(button, startTop + deltaY);
      }

      function handleMouseUp() {
        button.style.cursor = 'grab';
        saveY(button.getBoundingClientRect().top + BUTTON_SIZE / 2);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });

    button.addEventListener('click', () => {
      if (dragged) {
        dragged = false;
        return;
      }

      sendToggleMessage();
    });

    window.addEventListener('resize', () => {
      const currentY = button.getBoundingClientRect().top + BUTTON_SIZE / 2;
      const nextY = setButtonY(button, currentY);
      saveY(nextY);
    });

    document.documentElement.appendChild(button);
  }

  createButton();
})();
