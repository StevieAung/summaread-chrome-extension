(function () {
  window.SummaRead = window.SummaRead || {};

  const STYLE_ID = 'summaread-styles';

  function getStyleElement() {
    let style = document.getElementById(STYLE_ID);

    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    return style;
  }

  function getFontFamily(fontFamily) {
    if (fontFamily === 'dyslexic') {
      return '"OpenDyslexic", "Comic Sans MS", Arial, sans-serif';
    }

    if (fontFamily === 'legible') {
      return '"Atkinson Hyperlegible", Arial, sans-serif';
    }

    if (fontFamily === 'mono') {
      return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
    }

    return '';
  }

  function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function buildCss(settings) {
    const defaults = window.SummaRead.DEFAULT_SETTINGS || {
      fontSizeScale: 1.0,
      lineHeightScale: 1.6,
      letterSpacing: 0,
      saturationScale: 1.0
    };
    const fontSizeScale = toNumber(settings.fontSizeScale, 1.0);
    const lineHeightScale = toNumber(settings.lineHeightScale, 1.6);
    const letterSpacing = toNumber(settings.letterSpacing, 0);
    const saturationScale = toNumber(settings.saturationScale, 1.0);
    const fontSizePx = (16 * fontSizeScale).toFixed(2);
    const fontFamily = getFontFamily(settings.fontFamily);
    const filters = [];
    const readableTargets =
      'body, body p, body li, body article, body main, body section, body div, body span, body a, body button, body input, body textarea, body select';
    const css = [];

    // Keep the original page untouched until the user chooses a non-default control.
    if (fontSizeScale !== defaults.fontSizeScale) {
      css.push(`html { font-size: ${fontSizePx}px !important; }`);
      css.push(`${readableTargets} { font-size: ${fontSizePx}px !important; }`);
    }

    if (lineHeightScale !== defaults.lineHeightScale) {
      css.push(`${readableTargets} { line-height: ${lineHeightScale} !important; }`);
    }

    if (letterSpacing !== defaults.letterSpacing) {
      css.push(`${readableTargets} { letter-spacing: ${letterSpacing}px !important; }`);
    }

    if (fontFamily) {
      css.push(`${readableTargets} { font-family: ${fontFamily} !important; }`);
    }

    if (settings.contrastMode) {
      filters.push('contrast(1.25)');
      filters.push('saturate(1.1)');
    }

    if (saturationScale !== defaults.saturationScale) {
      filters.push(`saturate(${saturationScale})`);
    }

    if (filters.length) {
      css.push(`html { filter: ${filters.join(' ')} !important; }`);
    }

    if (settings.highlightLinks) {
      css.push('body a { background: yellow !important; color: black !important; outline: 2px solid #facc15 !important; outline-offset: 2px !important; }');
    }

    if (settings.hideImages) {
      css.push('body img, body picture, body video, body svg { display: none !important; }');
    }

    if (settings.stopAnimations) {
      css.push('body *, body *::before, body *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }');
    }

    return css.join('\n');
  }

  function applySettings(settings) {
    const css = buildCss(settings || {});

    if (!css) {
      resetSettings();
      return;
    }

    const style = getStyleElement();
    style.textContent = css;
  }

  function resetSettings() {
    const style = document.getElementById(STYLE_ID);

    if (style) {
      style.remove();
    }
  }

  window.SummaRead.accessibility = {
    applySettings,
    resetSettings
  };
})();
