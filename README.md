# SummaRead

SummaRead is a Chrome Manifest V3 extension for web accessibility and page comprehension. It can extract readable page text, generate summaries, read content aloud, and apply optional visual/reading adjustments to the current webpage.

The project uses plain browser technologies only:

- Chrome Extension Manifest V3
- HTML
- CSS
- Vanilla JavaScript
- No framework
- No npm build step

## Features

- Offline extractive summarisation with an in-browser LSA algorithm.
- Optional AI-enhanced summarisation using Google Gemini 2.0 Flash.
- Text-to-speech controls with browser voices.
- Visual accessibility controls for contrast, font size, line height, letter spacing, font family, and saturation.
- Reading controls for highlighted links, hidden images, and stopped animations.
- Floating page trigger and slide-out sidebar.
- Settings saved with `chrome.storage.sync`.

## Summarisation Modes

SummaRead supports two summary modes.

`LSA Mode` is the default. It runs fully in the browser using `modules/extractive.js` and does not send page text to any external service.

`AI Mode` is optional. It uses Google Gemini 2.0 Flash through the user's own API key. Page text is sent to Gemini only when the user selects AI Mode, has saved a valid API key, and clicks Summarise.

## Privacy

SummaRead does not send page text automatically.

Gemini API requests happen only when:

- AI Mode is selected.
- A Gemini API key has been saved.
- The user clicks the summarise button.

The Gemini API key is stored in `chrome.storage.sync`. It is never hardcoded, logged, or displayed in full.

## Project Structure

```text
.
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   ├── content.css
│   ├── content.js
│   ├── page-text.js
│   └── sidebar.js
├── modules/
│   ├── constants.js
│   ├── controls.js
│   ├── extractive.js
│   ├── gemini.js
│   ├── speech.js
│   └── storage.js
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── assets/
│   └── logo.svg
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Key Files

- `manifest.json`: extension manifest, permissions, popup, background worker, content script load order, and Gemini host permission.
- `background/service-worker.js`: initializes default settings on install.
- `popup/popup.html`: popup UI markup.
- `popup/popup.css`: popup styling.
- `popup/popup.js`: popup interactions, tab switching, settings, summarise actions, speech controls, and Gemini key setup.
- `content/content.js`: main content-script message router.
- `content/page-text.js`: extracts readable text from the current page.
- `content/sidebar.js`: injects the floating SummaRead button.
- `modules/extractive.js`: offline LSA extractive summariser.
- `modules/gemini.js`: optional Gemini API integration.
- `modules/controls.js`: applies user-selected accessibility styles to webpages.
- `modules/storage.js`: settings wrapper around `chrome.storage.sync`.

## Installation For Development

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on Developer mode.
4. Click Load unpacked.
5. Select this project folder.
6. Pin SummaRead from the extensions menu.

After making changes, click Reload on the extension card in `chrome://extensions`.

## Gemini API Setup

1. Open the SummaRead popup.
2. Select AI Mode.
3. Click Set up.
4. Paste a Gemini API key.
5. Click Validate & Save.

You can create a key from Google AI Studio:

```text
https://aistudio.google.com/app/apikey
```

If Gemini fails because of an invalid key, rate limit, or network issue, SummaRead falls back to the offline LSA summariser.

## Permissions

SummaRead requests:

- `storage`: save settings and API key.
- `activeTab`: interact with the current tab after user action.
- `scripting`: inject content scripts when needed.
- `tts`: browser text-to-speech.

Host permissions:

- `https://generativelanguage.googleapis.com/*`: used only for Gemini AI Mode.

## Development Notes

- This extension intentionally avoids a build step.
- Keep popup scripts external because Chrome extension pages block inline scripts by default.
- Content scripts load in this order: constants, storage, extractive, Gemini, speech, controls, page text, router, sidebar.
- Accessibility controls are non-invasive by default. The page is only changed after the user enables or adjusts a control.
