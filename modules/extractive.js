/**
 * SummaRead extractive summarizer.
 *
 * Implements a lightweight Latent Semantic Analysis (LSA) extractive
 * summarisation pipeline inspired by Gong & Liu (2001) and
 * Steinberger & Jezek (2004). The implementation is intentionally
 * dependency-free so it can run entirely in-browser inside a Chrome
 * extension context.
 */
(function () {
  window.SummaRead = window.SummaRead || {};

  const STOP_WORDS = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'it',
    'this',
    'that',
    'as',
    'by',
    'from',
    'have',
    'has',
    'had',
    'not',
    'they',
    'we',
    'you',
    'he',
    'she',
    'his',
    'her',
    'its',
    'our',
    'their',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'also',
    'more'
  ]);

  /**
   * Counts words with the same broad whitespace tokenisation used for the API
   * metadata, preserving a predictable measure for both source and summary.
   *
   * @param {string} text - Text to count.
   * @returns {number} Number of whitespace-delimited words.
   */
  function countWords(text) {
    const normalizedText = String(text || '').trim();
    return normalizedText ? normalizedText.split(/\s+/).length : 0;
  }

  /**
   * STAGE 1 - Sentence Segmentation.
   *
   * Splits text with the requested sentence-boundary expression, filters out
   * very short fragments, and stores original sentence positions for natural
   * order reconstruction after topic selection.
   *
   * @param {string} text - Input document text.
   * @returns {{ text: string, originalIndex: number }[]} Filtered sentences.
   */
  function segmentSentences(text) {
    return String(text || '')
      .trim()
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((sentence, originalIndex) => ({
        text: sentence.trim(),
        originalIndex
      }))
      .filter((sentence) => sentence.text.length >= 20);
  }

  /**
   * STAGE 2 - Text Preprocessing.
   *
   * Lowercases each sentence, removes punctuation, drops the fixed stop-word
   * list, and removes words shorter than three characters.
   *
   * @param {string} sentence - Sentence text to preprocess.
   * @returns {string[]} Tokens retained for term weighting.
   */
  function tokenizeSentence(sentence) {
    return sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  }

  /**
   * STAGE 2 - Text Preprocessing.
   *
   * Applies tokenisation to every segmented sentence.
   *
   * @param {{ text: string, originalIndex: number }[]} sentences - Sentences.
   * @returns {string[][]} Token arrays aligned to sentence order.
   */
  function preprocessSentences(sentences) {
    return sentences.map((sentence) => tokenizeSentence(sentence.text));
  }

  /**
   * STAGE 3 - Vocabulary Collection.
   *
   * Builds the unique term list across all sentence token arrays.
   *
   * @param {string[][]} tokenizedSentences - Token arrays.
   * @returns {string[]} Unique vocabulary terms.
   */
  function buildVocabulary(tokenizedSentences) {
    const vocabulary = [];
    const seen = new Set();

    tokenizedSentences.forEach((tokens) => {
      tokens.forEach((token) => {
        if (!seen.has(token)) {
          seen.add(token);
          vocabulary.push(token);
        }
      });
    });

    return vocabulary;
  }

  /**
   * STAGE 3 - Build Terms-by-Sentences Matrix.
   *
   * Creates A where rows are unique terms and columns are sentences. Each cell
   * stores the requested lightweight TF-IDF weight:
   * TF(term, sentence) * log(totalSentences / (1 + documentFrequency(term))).
   *
   * @param {string[][]} tokenizedSentences - Token arrays by sentence.
   * @param {string[]} vocabulary - Unique term list.
   * @returns {number[][]} Terms-by-sentences TF-IDF matrix.
   */
  function buildTermSentenceMatrix(tokenizedSentences, vocabulary) {
    const sentenceCount = tokenizedSentences.length;
    const vocabularyIndex = new Map(vocabulary.map((term, index) => [term, index]));
    const documentFrequency = new Array(vocabulary.length).fill(0);
    const sentenceTermCounts = tokenizedSentences.map((tokens) => {
      const counts = new Map();

      tokens.forEach((token) => {
        counts.set(token, (counts.get(token) || 0) + 1);
      });

      counts.forEach((count, term) => {
        const termIndex = vocabularyIndex.get(term);
        if (typeof termIndex === 'number' && count > 0) {
          documentFrequency[termIndex] += 1;
        }
      });

      return counts;
    });

    const matrix = vocabulary.map((term, termIndex) => {
      const idf = Math.log(sentenceCount / (1 + documentFrequency[termIndex]));

      return tokenizedSentences.map((tokens, sentenceIndex) => {
        if (!tokens.length) {
          return 0;
        }

        const count = sentenceTermCounts[sentenceIndex].get(term) || 0;
        const tf = count / tokens.length;
        return tf * idf;
      });
    });

    return matrix;
  }

  /**
   * Multiplies A * vector for a terms-by-sentences matrix A.
   *
   * @param {number[][]} matrix - Terms-by-sentences matrix.
   * @param {number[]} vector - Sentence-length vector.
   * @returns {number[]} Term-length product vector.
   */
  function multiplyMatrixVector(matrix, vector) {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
  }

  /**
   * Multiplies A^T * vector for a terms-by-sentences matrix A.
   *
   * @param {number[][]} matrix - Terms-by-sentences matrix.
   * @param {number[]} vector - Term-length vector.
   * @returns {number[]} Sentence-length product vector.
   */
  function multiplyTransposeVector(matrix, vector) {
    const sentenceCount = matrix[0] ? matrix[0].length : 0;
    const result = new Array(sentenceCount).fill(0);

    matrix.forEach((row, termIndex) => {
      row.forEach((value, sentenceIndex) => {
        result[sentenceIndex] += value * vector[termIndex];
      });
    });

    return result;
  }

  /**
   * Calculates the Euclidean norm of a vector.
   *
   * @param {number[]} vector - Numeric vector.
   * @returns {number} Vector magnitude.
   */
  function vectorNorm(vector) {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  }

  /**
   * Normalises a vector to unit length.
   *
   * @param {number[]} vector - Numeric vector.
   * @returns {number[]} Unit vector.
   */
  function normalizeVector(vector) {
    const norm = vectorNorm(vector);

    if (!Number.isFinite(norm) || norm === 0) {
      throw new Error('Cannot normalize zero or invalid vector.');
    }

    return vector.map((value) => value / norm);
  }

  /**
   * Computes an absolute distance between two vectors for convergence checks.
   *
   * @param {number[]} left - First vector.
   * @param {number[]} right - Second vector.
   * @returns {number} Sum of absolute element-wise differences.
   */
  function vectorDifference(left, right) {
    return left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0);
  }

  /**
   * Creates a deterministic non-zero starting vector for power iteration.
   *
   * The algorithm specification calls for a random vector. A deterministic
   * pseudo-random-looking vector gives the same numerical benefit while keeping
   * browser results reproducible across runs and easier to debug.
   *
   * @param {number} length - Vector length.
   * @param {number} componentIndex - Singular component being extracted.
   * @returns {number[]} Unit-length starting vector.
   */
  function createInitialVector(length, componentIndex) {
    const vector = Array.from({ length }, (_, index) => {
      const value = Math.sin((index + 1) * (componentIndex + 1) * 12.9898) * 43758.5453;
      return value - Math.floor(value) + 0.01;
    });

    return normalizeVector(vector);
  }

  /**
   * Validates that every matrix value is finite.
   *
   * @param {number[][]} matrix - Matrix to validate.
   * @returns {boolean} Whether all values are finite numbers.
   */
  function isFiniteMatrix(matrix) {
    return matrix.every((row) => row.every((value) => Number.isFinite(value)));
  }

  /**
   * Validates that every vector value is finite.
   *
   * @param {number[]} vector - Vector to validate.
   * @returns {boolean} Whether all values are finite numbers.
   */
  function isFiniteVector(vector) {
    return vector.every((value) => Number.isFinite(value));
  }

  /**
   * STAGE 4 - Singular Value Decomposition by Power Iteration.
   *
   * Extracts the top K right singular vectors. Each iteration estimates the
   * dominant eigenvector of A^T A using b_new = A^T * (A * b), converts that
   * to singular triplet data, then deflates A with A - sigma * u * v^T so the
   * next pass can discover a different latent concept.
   *
   * @param {number[][]} matrix - Terms-by-sentences TF-IDF matrix.
   * @param {number} componentCount - Number of singular vectors to extract.
   * @returns {{ sigma: number, u: number[], v: number[] }[]} Singular components.
   */
  function extractSingularComponents(matrix, componentCount) {
    if (!matrix.length || !matrix[0] || !matrix[0].length || !isFiniteMatrix(matrix)) {
      throw new Error('Invalid matrix for SVD.');
    }

    const workingMatrix = matrix.map((row) => row.slice());
    const sentenceCount = workingMatrix[0].length;
    const components = [];

    for (let componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
      let vector = createInitialVector(sentenceCount, componentIndex);

      for (let iteration = 0; iteration < 20; iteration += 1) {
        const projectedTerms = multiplyMatrixVector(workingMatrix, vector);
        const nextVector = normalizeVector(multiplyTransposeVector(workingMatrix, projectedTerms));
        const difference = vectorDifference(vector, nextVector);

        vector = nextVector;

        if (difference < 1e-6) {
          break;
        }
      }

      if (!isFiniteVector(vector)) {
        throw new Error('SVD produced an invalid right singular vector.');
      }

      const projectedTerms = multiplyMatrixVector(workingMatrix, vector);
      const sigma = vectorNorm(projectedTerms);

      if (!Number.isFinite(sigma) || sigma <= 1e-12) {
        break;
      }

      const leftVector = projectedTerms.map((value) => value / sigma);

      if (!isFiniteVector(leftVector)) {
        throw new Error('SVD produced an invalid left singular vector.');
      }

      components.push({
        sigma,
        u: leftVector,
        v: vector.slice()
      });

      workingMatrix.forEach((row, termIndex) => {
        row.forEach((value, sentenceIndex) => {
          row[sentenceIndex] = value - sigma * leftVector[termIndex] * vector[sentenceIndex];
        });
      });
    }

    if (!components.length) {
      throw new Error('SVD did not produce usable components.');
    }

    return components;
  }

  /**
   * Scores each sentence by the absolute sum of its TF-IDF term weights.
   *
   * @param {number[][]} matrix - Terms-by-sentences TF-IDF matrix.
   * @returns {number[]} Sentence scores.
   */
  function scoreSentencesByTfIdf(matrix) {
    const sentenceCount = matrix[0] ? matrix[0].length : 0;
    const scores = new Array(sentenceCount).fill(0);

    matrix.forEach((row) => {
      row.forEach((weight, sentenceIndex) => {
        scores[sentenceIndex] += Math.abs(weight);
      });
    });

    return scores;
  }

  /**
   * Selects the highest-scoring sentences not already present in the selection.
   *
   * @param {number[]} scores - Sentence scores.
   * @param {Set<number>} selected - Existing selected sentence indices.
   * @param {number} targetCount - Desired total number of selected sentences.
   * @returns {Set<number>} Mutated selection set.
   */
  function fillSelectionByScores(scores, selected, targetCount) {
    scores
      .map((score, sentenceIndex) => ({ score, sentenceIndex }))
      .sort((left, right) => right.score - left.score || left.sentenceIndex - right.sentenceIndex)
      .some((candidate) => {
        if (!selected.has(candidate.sentenceIndex)) {
          selected.add(candidate.sentenceIndex);
        }

        return selected.size >= targetCount;
      });

    return selected;
  }

  /**
   * STAGE 5 - Sentence Selection using the Gong & Liu method.
   *
   * For each latent topic, picks the sentence with the highest absolute value
   * in that topic's right singular vector. If a topic points to a sentence that
   * was already selected, the next highest unused sentence is chosen.
   *
   * @param {{ sigma: number, u: number[], v: number[] }[]} components - SVD components.
   * @param {number} targetCount - Desired number of selected sentences.
   * @param {number[]} fallbackScores - TF-IDF scores used if topics do not fill selection.
   * @returns {number[]} Selected local sentence indices.
   */
  function selectSentencesFromComponents(components, targetCount, fallbackScores) {
    const selected = new Set();

    components.some((component) => {
      component.v
        .map((value, sentenceIndex) => ({
          sentenceIndex,
          score: Math.abs(value)
        }))
        .sort((left, right) => right.score - left.score || left.sentenceIndex - right.sentenceIndex)
        .some((candidate) => {
          if (!selected.has(candidate.sentenceIndex)) {
            selected.add(candidate.sentenceIndex);
            return true;
          }

          return false;
        });

      return selected.size >= targetCount;
    });

    if (selected.size < targetCount) {
      fillSelectionByScores(fallbackScores, selected, targetCount);
    }

    return Array.from(selected);
  }

  /**
   * STAGE 5 fallback - Frequency-safe sentence selection.
   *
   * If SVD fails or produces invalid values, this falls back to the strongest
   * TF-IDF sentences so the public API still returns a useful extract.
   *
   * @param {number[][]} matrix - Terms-by-sentences TF-IDF matrix.
   * @param {number} targetCount - Desired number of selected sentences.
   * @returns {number[]} Selected local sentence indices.
   */
  function selectSentencesByTfIdf(matrix, targetCount) {
    const selected = new Set();
    fillSelectionByScores(scoreSentencesByTfIdf(matrix), selected, targetCount);
    return Array.from(selected);
  }

  /**
   * STAGE 6 - Positional Re-sort.
   *
   * Converts local filtered-sentence indices to original document sentence
   * indices, sorts by original position, and returns both forms for rendering
   * and API metadata.
   *
   * @param {number[]} selectedLocalIndices - Selected indices in filtered sentence array.
   * @param {{ text: string, originalIndex: number }[]} sentences - Filtered sentences.
   * @returns {{ localIndices: number[], originalIndices: number[] }} Ordered selection.
   */
  function sortSelectionByOriginalPosition(selectedLocalIndices, sentences) {
    const ordered = selectedLocalIndices
      .map((localIndex) => ({
        localIndex,
        originalIndex: sentences[localIndex].originalIndex
      }))
      .sort((left, right) => left.originalIndex - right.originalIndex);

    return {
      localIndices: ordered.map((item) => item.localIndex),
      originalIndices: ordered.map((item) => item.originalIndex)
    };
  }

  /**
   * Builds a complete API response object.
   *
   * @param {string} summary - Summary text.
   * @param {{ text: string, originalIndex: number }[]} sentences - Filtered sentences.
   * @param {number[]} selectedIndices - Selected original sentence indices.
   * @param {string} originalText - Source text.
   * @param {string} note - Human-readable status note.
   * @returns {{ summary: string, sentences: string[], selectedIndices: number[], wordCount: number, originalWordCount: number, note: string }} Summary response.
   */
  function createResponse(summary, sentences, selectedIndices, originalText, note) {
    return {
      summary,
      sentences: sentences.map((sentence) => sentence.text),
      selectedIndices,
      wordCount: countWords(summary),
      originalWordCount: countWords(originalText),
      note
    };
  }

  /**
   * PUBLIC API.
   *
   * Runs the complete LSA extractive summarisation pipeline:
   * sentence segmentation, preprocessing, TF-IDF matrix construction,
   * power-iteration SVD, Gong & Liu topic representative selection, and
   * final positional re-sort for readable document order.
   *
   * @param {string} text - Source document text.
   * @param {number} [n=3] - Desired number of summary sentences.
   * @returns {{ summary: string, sentences: string[], selectedIndices: number[], wordCount: number, originalWordCount: number, note: string }} Summary response.
   */
  function summarize(text, n = 3) {
    const originalText = String(text || '');

    if (!originalText.trim()) {
      return createResponse('', [], [], originalText, 'No readable text found');
    }

    const sentences = segmentSentences(originalText);

    if (sentences.length <= 3) {
      return createResponse(
        originalText.trim(),
        sentences,
        sentences.map((sentence) => sentence.originalIndex),
        originalText,
        'Page is already short'
      );
    }

    const targetCount = Math.max(1, Math.min(sentences.length, Math.floor(Number(n) || 3)));
    const componentCount = Math.min(3, targetCount, sentences.length);
    const tokenizedSentences = preprocessSentences(sentences);
    const vocabulary = buildVocabulary(tokenizedSentences);

    if (!vocabulary.length) {
      return createResponse(
        sentences.slice(0, targetCount).map((sentence) => sentence.text).join(' '),
        sentences,
        sentences.slice(0, targetCount).map((sentence) => sentence.originalIndex),
        originalText,
        'LSA summary generated'
      );
    }

    const matrix = buildTermSentenceMatrix(tokenizedSentences, vocabulary);
    let selectedLocalIndices;
    let note = 'LSA summary generated';

    try {
      const components = extractSingularComponents(matrix, componentCount);
      selectedLocalIndices = selectSentencesFromComponents(
        components,
        targetCount,
        scoreSentencesByTfIdf(matrix)
      );
    } catch (error) {
      console.warn('SummaRead LSA summarization failed; falling back to TF-IDF.', error);
      selectedLocalIndices = selectSentencesByTfIdf(matrix, Math.min(3, targetCount));
      note = 'LSA failed; TF-IDF fallback summary generated';
    }

    const sortedSelection = sortSelectionByOriginalPosition(selectedLocalIndices, sentences);
    const summary = sortedSelection.localIndices.map((index) => sentences[index].text).join(' ');

    return createResponse(summary, sentences, sortedSelection.originalIndices, originalText, note);
  }

  window.SummaRead.summarizer = {
    summarize
  };
})();
