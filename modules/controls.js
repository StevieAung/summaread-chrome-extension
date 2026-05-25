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
    const fontSizeScale = toNumber(settings.fontSizeScale, 1.0);
    const lineHeightScale = toNumber(settings.lineHeightScale, 1.6);
    const letterSpacing = toNumber(settings.letterSpacing, 0);
    const fontFamily = getFontFamily(settings.fontFamily);
    const css = [
      `html { font-size: calc(1em * ${fontSizeScale}) !important; }`,
      `body { line-height: ${lineHeightScale} !important; letter-spacing: ${letterSpacing}px !important; }`
    ];

    if (fontFamily) {
      css.push(`body { font-family: ${fontFamily} !important; }`);
    }

    if (settings.contrastMode) {
      css.push('html { filter: contrast(1.25) saturate(1.1) !important; }');
    }

    if (settings.highlightLinks) {
      css.push('a { background: yellow !important; color: black !important; }');
    }

    if (settings.hideImages) {
      css.push('img { display: none !important; }');
    }

    if (settings.stopAnimations) {
      css.push('*, *::before, *::after { animation: none !important; transition: none !important; }');
    }

    return css.join('\n');
  }

  function applySettings(settings) {
    const style = getStyleElement();
    style.textContent = buildCss(settings || {});
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
