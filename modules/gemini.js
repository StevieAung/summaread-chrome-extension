/*
 * PRIVACY: Page text is sent to Google's Gemini API only when:
 * 1. The user has explicitly selected AI Mode
 * 2. The user has provided their own API key
 * 3. The user clicks Summarise
 * No data is sent automatically or without user action.
 * The API key is stored locally in chrome.storage.sync.
 * It is never logged, displayed in full, or transmitted anywhere
 * except directly to the Gemini API endpoint.
 */
(function () {
  window.SummaRead = window.SummaRead || {};

  const MODEL = 'gemini-2.0-flash';
  const DEFAULT_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  const MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

  function countWords(text) {
    const normalizedText = String(text || '').trim();
    return normalizedText ? normalizedText.split(/\s+/).length : 0;
  }

  function buildPrompt(text, maxSentences) {
    return `You are an accessibility assistant helping users understand web content.
Summarise the following webpage text in exactly ${maxSentences} clear, informative sentences.
Focus on the main ideas. Write in plain English. Do not add commentary.
Do not start with phrases like "This article" or "The text".
Just return the ${maxSentences} sentences, nothing else.

Text: ${text}`;
  }

  function createGeminiError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  async function callGemini(prompt, apiKey) {
    const endpoint = window.SummaRead.GEMINI_API_ENDPOINT || DEFAULT_ENDPOINT;

    let response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256,
            candidateCount: 1
          }
        })
      });
    } catch (error) {
      throw new Error('Could not reach Gemini API. Check your internet connection.');
    }

    const data = await response.json().catch(() => ({}));
    const errorStatus = data.error && data.error.status ? data.error.status : '';
    const errorMessage = data.error && data.error.message ? data.error.message : response.statusText;
    const errorDetails = JSON.stringify(data.error && data.error.details ? data.error.details : []);
    const combinedErrorText = `${errorStatus} ${errorMessage} ${errorDetails}`;

    if (/API_KEY_INVALID|API key not valid|API key not found|invalid API key/i.test(combinedErrorText)) {
      throw new Error('Invalid API key. Please check your Gemini API key in SummaRead settings.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Gemini API permission denied: ${errorMessage}`);
    }

    if (response.status === 429) {
      throw createGeminiError(`Gemini quota limit reached: ${errorMessage}`, 'RESOURCE_EXHAUSTED');
    }

    if (response.status === 404) {
      throw new Error(`Gemini model unavailable: ${errorMessage}`);
    }

    if (!response.ok) {
      throw new Error(`AI summarisation failed: ${errorMessage}`);
    }

    const text = data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) {
      throw new Error('AI summarisation failed: Gemini returned an empty response');
    }

    return text.trim();
  }

  async function summarize(text, apiKey, options = {}) {
    const maxSentences = Number(options.maxSentences) || 3;
    const sourceText = String(text || '');
    const truncatedText = sourceText.length > 4000 ? sourceText.slice(0, 4000) : sourceText;

    try {
      const summary = await callGemini(buildPrompt(truncatedText, maxSentences), apiKey);

      return {
        summary,
        mode: 'ai',
        model: MODEL,
        wordCount: countWords(summary),
        originalWordCount: countWords(sourceText),
        note: 'AI-enhanced summary'
      };
    } catch (error) {
      if (
        error.message.startsWith('Invalid API key') ||
        error.message.startsWith('Too many requests') ||
        error.message.startsWith('Gemini quota limit reached') ||
        error.message.startsWith('Could not reach Gemini API') ||
        error.message.startsWith('AI summarisation failed')
      ) {
        throw error;
      }

      throw new Error(`AI summarisation failed: ${error.message}`);
    }
  }

  async function validateKey(apiKey) {
    try {
      const response = await fetch(MODELS_ENDPOINT, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey
        }
      });
      const data = await response.json().catch(() => ({}));
      const errorStatus = data.error && data.error.status ? data.error.status : '';
      const errorMessage = data.error && data.error.message ? data.error.message : response.statusText;
      const errorDetails = JSON.stringify(data.error && data.error.details ? data.error.details : []);
      const combinedErrorText = `${errorStatus} ${errorMessage} ${errorDetails}`;

      if (/API_KEY_INVALID|API key not valid|API key not found|invalid API key/i.test(combinedErrorText)) {
        throw new Error('Invalid API key. Please check your Gemini API key in SummaRead settings.');
      }

      if (response.status === 429) {
        return {
          valid: false,
          quotaLimited: true,
          error: `Gemini quota limit reached: ${errorMessage}`
        };
      }

      if (!response.ok) {
        throw new Error(`Gemini API validation failed: ${errorMessage}`);
      }

      const models = Array.isArray(data.models) ? data.models : [];
      const requestedModel = models.find((model) => {
        const modelName = model.name || '';
        return modelName === `models/${MODEL}` || modelName.endsWith(`/${MODEL}`);
      });

      if (!requestedModel) {
        throw new Error(`${MODEL} is not available for this API key/project.`);
      }

      const supportedMethods = requestedModel.supportedGenerationMethods || [];

      if (!supportedMethods.includes('generateContent')) {
        throw new Error(`${MODEL} is available, but it does not support generateContent for this project.`);
      }

      return { valid: true };
    } catch (error) {
      if (error.code === 'RESOURCE_EXHAUSTED') {
        return {
          valid: false,
          quotaLimited: true,
          error: error.message
        };
      }

      return {
        valid: false,
        error: error.message
      };
    }
  }

  window.SummaRead.gemini = {
    summarize,
    validateKey
  };
})();
