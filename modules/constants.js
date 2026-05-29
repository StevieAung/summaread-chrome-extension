(function () {
  window.SummaRead = window.SummaRead || {};

  window.SummaRead.MESSAGE_TYPES = {
    SUMMARIZE_TEXT: 'SUMMARIZE_TEXT',
    EXTRACT_TEXT: 'EXTRACT_TEXT',
    SPEAK_TEXT: 'SPEAK_TEXT',
    PAUSE_SPEECH: 'PAUSE_SPEECH',
    RESUME_SPEECH: 'RESUME_SPEECH',
    STOP_SPEECH: 'STOP_SPEECH',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    RESET_SETTINGS: 'RESET_SETTINGS',
    TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
    GEMINI_SUMMARIZE: 'GEMINI_SUMMARIZE',
    VALIDATE_GEMINI_KEY: 'VALIDATE_GEMINI_KEY'
  };

  window.SummaRead.GEMINI_API_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  window.SummaRead.GEMINI_KEY_STORAGE = 'geminiApiKey';
})();
