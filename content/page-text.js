(function () {
  window.SummaRead = window.SummaRead || {};

  const CONTENT_SELECTORS = ['main', '[role="main"]', 'article', '.content', '.post', 'body'];
  const STRIP_SELECTORS = 'script, style, nav, footer, header, aside';

  function getTextFromElement(element) {
    if (!element) {
      return '';
    }

    const clone = element.cloneNode(true);
    clone.querySelectorAll(STRIP_SELECTORS).forEach((node) => {
      node.remove();
    });

    return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function countWords(text) {
    const normalizedText = String(text || '').trim();
    return normalizedText ? normalizedText.split(/\s+/).length : 0;
  }

  function extract() {
    let selectedText = '';

    CONTENT_SELECTORS.some((selector) => {
      const element = document.querySelector(selector);
      const text = getTextFromElement(element);

      if (text.length > 150) {
        selectedText = text;
        return true;
      }

      return false;
    });

    return {
      title: document.title,
      url: location.href,
      text: selectedText,
      wordCount: countWords(selectedText)
    };
  }

  window.SummaRead.pageText = {
    extract
  };
})();
