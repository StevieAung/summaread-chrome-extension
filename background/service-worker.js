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

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function countWords(text) {
  const normalizedText = String(text || '').trim();
  return normalizedText ? normalizedText.split(/\s+/).length : 0;
}

function buildGeminiPrompt(text, maxSentences) {
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
  let response;

  try {
    response = await fetch(GEMINI_API_ENDPOINT, {
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
  const apiStatus = data.error && data.error.status ? data.error.status : '';
  const apiMessage = data.error && data.error.message ? data.error.message : response.statusText;
  const apiDetails = JSON.stringify(data.error && data.error.details ? data.error.details : []);
  const combinedErrorText = `${apiStatus} ${apiMessage} ${apiDetails}`;

  if (/API_KEY_INVALID|API key not valid|API key not found|invalid API key/i.test(combinedErrorText)) {
    throw new Error('Invalid API key. Please check your Gemini API key in SummaRead settings.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Gemini API permission denied: ${apiMessage}`);
  }

  if (response.status === 429) {
    throw createGeminiError(`Gemini quota limit reached: ${apiMessage}`, 'RESOURCE_EXHAUSTED');
  }

  if (response.status === 404) {
    throw new Error(`Gemini model unavailable: ${apiMessage}`);
  }

  if (!response.ok) {
    throw new Error(`AI summarisation failed: ${apiMessage}`);
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

async function summarizeWithGemini(text, apiKey, options = {}) {
  const maxSentences = Number(options.maxSentences) || 3;
  const sourceText = String(text || '');
  const truncatedText = sourceText.length > 4000 ? sourceText.slice(0, 4000) : sourceText;
  const summary = await callGemini(buildGeminiPrompt(truncatedText, maxSentences), apiKey);

  return {
    summary,
    mode: 'ai',
    model: GEMINI_MODEL,
    wordCount: countWords(summary),
    originalWordCount: countWords(sourceText),
    note: 'AI-enhanced summary'
  };
}

async function handleGeminiSummarize(message) {
  const storedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  if (!storedSettings.geminiApiKey) {
    throw new Error('No Gemini API key saved. Add your key in SummaRead settings.');
  }

  return summarizeWithGemini(message.text, storedSettings.geminiApiKey, message.options);
}

async function handleGeminiKeyValidation(message) {
  const apiKey = String(message.apiKey || '').trim();

  if (!apiKey) {
    return {
      valid: false,
      error: 'Enter a Gemini API key'
    };
  }

  try {
    const response = await fetch(GEMINI_MODELS_ENDPOINT, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      }
    });
    const data = await response.json().catch(() => ({}));
    const apiStatus = data.error && data.error.status ? data.error.status : '';
    const apiMessage = data.error && data.error.message ? data.error.message : response.statusText;
    const apiDetails = JSON.stringify(data.error && data.error.details ? data.error.details : []);
    const combinedErrorText = `${apiStatus} ${apiMessage} ${apiDetails}`;

    if (/API_KEY_INVALID|API key not valid|API key not found|invalid API key/i.test(combinedErrorText)) {
      throw new Error('Invalid API key. Please check your Gemini API key in SummaRead settings.');
    }

    if (response.status === 429) {
      return {
        valid: false,
        quotaLimited: true,
        error: `Gemini quota limit reached: ${apiMessage}`
      };
    }

    if (!response.ok) {
      throw new Error(`Gemini API validation failed: ${apiMessage}`);
    }

    const models = Array.isArray(data.models) ? data.models : [];
    const requestedModel = models.find((model) => {
      const modelName = model.name || '';
      return modelName === `models/${GEMINI_MODEL}` || modelName.endsWith(`/${GEMINI_MODEL}`);
    });

    if (!requestedModel) {
      throw new Error(`${GEMINI_MODEL} is not available for this API key/project.`);
    }

    const supportedMethods = requestedModel.supportedGenerationMethods || [];

    if (!supportedMethods.includes('generateContent')) {
      throw new Error(`${GEMINI_MODEL} is available, but it does not support generateContent for this project.`);
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

chrome.runtime.onInstalled.addListener(async () => {
  const existingSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({
    ...DEFAULT_SETTINGS,
    ...existingSettings
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'GEMINI_SUMMARIZE') {
    (async () => {
      try {
        const result = await handleGeminiSummarize(message);
        sendResponse({
          ok: true,
          ...result
        });
      } catch (error) {
        sendResponse({
          ok: false,
          message: error.message || 'Gemini summarisation failed'
        });
      }
    })();

    return true;
  }

  if (message.type === 'VALIDATE_GEMINI_KEY') {
    (async () => {
      const result = await handleGeminiKeyValidation(message);
      sendResponse(result);
    })();

    return true;
  }

  if (message.type === 'SPEAK_TEXT') {
    const options = {
      enqueue: false,
      rate: Number(message.rate) || 1.0
    };

    if (message.voiceName) {
      options.voiceName = message.voiceName;
    }

    chrome.tts.speak(message.text || '', options);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'PAUSE_SPEECH') {
    if (chrome.tts.pause) {
      chrome.tts.pause();
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'STOP_SPEECH') {
    chrome.tts.stop();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
