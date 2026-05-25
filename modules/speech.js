(function () {
  window.SummaRead = window.SummaRead || {};

  function getSpeechSynthesis() {
    return window.speechSynthesis || null;
  }

  function getVoiceByURI(voiceURI) {
    if (!voiceURI) {
      return null;
    }

    return getVoices().find((voice) => voice.voiceURI === voiceURI) || null;
  }

  function speak(text, rate = 1.0, voiceURI = null) {
    const speech = getSpeechSynthesis();
    const readableText = String(text || '').trim();

    if (!speech) {
      return {
        ok: false,
        message: 'Speech synthesis is not available'
      };
    }

    if (!readableText) {
      return {
        ok: false,
        message: 'No text to speak'
      };
    }

    speech.cancel();

    const utterance = new SpeechSynthesisUtterance(readableText);
    const voice = getVoiceByURI(voiceURI);

    utterance.rate = Number(rate) || 1.0;

    if (voice) {
      utterance.voice = voice;
    }

    speech.speak(utterance);

    return {
      ok: true,
      message: 'Speaking'
    };
  }

  function pause() {
    const speech = getSpeechSynthesis();

    if (speech) {
      speech.pause();
    }
  }

  function resume() {
    const speech = getSpeechSynthesis();

    if (speech) {
      speech.resume();
    }
  }

  function stop() {
    const speech = getSpeechSynthesis();

    if (!speech) {
      return {
        ok: false,
        message: 'Speech synthesis is not available'
      };
    }

    speech.cancel();

    return {
      ok: true,
      message: 'Speech stopped'
    };
  }

  function getVoices() {
    const speech = getSpeechSynthesis();

    if (!speech) {
      return [];
    }

    return speech.getVoices().slice().sort((left, right) => {
      const leftEnglish = /^en\b/i.test(left.lang || '');
      const rightEnglish = /^en\b/i.test(right.lang || '');

      if (leftEnglish !== rightEnglish) {
        return leftEnglish ? -1 : 1;
      }

      return (left.name || '').localeCompare(right.name || '');
    });
  }

  function isSpeaking() {
    const speech = getSpeechSynthesis();
    return Boolean(speech && speech.speaking);
  }

  window.SummaRead.tts = {
    speak,
    pause,
    resume,
    stop,
    getVoices,
    isSpeaking
  };
})();
