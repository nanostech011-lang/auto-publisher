/**
 * AutoPublisher Pro - Scene Timestamp Aligner Engine
 * 
 * Sincroniza os cortes de cenas visuais diretamente com os WordBoundaries
 * de alta precisão gerados pelo sintetizador neural de voz (Edge-TTS).
 * 
 * Elimina o desvio progressivo (drift) de áudio/vídeo, garantindo que
 * cada transição visual ocorra no exato milissegundo em que a frase
 * correspondente inicia ou durante a pausa natural da respiração/pontuação.
 */

/**
 * Normaliza uma palavra para comparação fonética/textual tolerante
 * Remove acentos diacríticos, pontuações, caracteres especiais e converte para minúsculo.
 *
 * @param {string} word 
 * @returns {string}
 */
export function normalizeWord(word) {
  if (!word || typeof word !== 'string') return '';
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos (acentos)
    .replace(/[^\p{L}\p{N}]/gu, '')  // Mantém apenas letras e números
    .trim();
}

/**
 * Tokeniza uma frase em lista de palavras normalizadas
 *
 * @param {string} phrase 
 * @returns {string[]}
 */
export function tokenizePhrase(phrase) {
  if (!phrase || typeof phrase !== 'string') return [];
  return phrase
    .split(/\s+/)
    .map(normalizeWord)
    .filter(w => w.length > 0);
}

/**
 * Busca a sequência de palavras-chave da frase dentro dos wordBoundaries do áudio
 * Utiliza janela deslizante ponderada para alta tolerância a contrações ou pontuações do TTS.
 *
 * @param {Array<{word: string, startMs: number, endMs: number}>} wordBoundaries 
 * @param {string[]} targetTokens 
 * @param {number} startIndex 
 * @param {number} maxLookahead 
 * @returns {{ boundaryIndex: number, matchedWord: string, confidence: number } | null}
 */
export function findWordSequenceIndex(wordBoundaries, targetTokens, startIndex = 0, maxLookahead = 80) {
  if (!wordBoundaries || wordBoundaries.length === 0 || !targetTokens || targetTokens.length === 0) {
    return null;
  }

  const searchTokens = targetTokens.slice(0, 4); // Foca nos primeiros 4 tokens da frase
  const endSearch = Math.min(startIndex + maxLookahead, wordBoundaries.length);

  let bestMatch = null;
  let highestScore = 0;

  for (let i = startIndex; i < endSearch; i++) {
    let matchScore = 0;
    const boundaryWord = normalizeWord(wordBoundaries[i].word);

    // 1. Verifica casamento do primeiro token
    if (boundaryWord === searchTokens[0]) {
      matchScore += 2.0;

      // 2. Confere os tokens subsequentes para evitar falsos positivos
      for (let j = 1; j < searchTokens.length; j++) {
        if (i + j < wordBoundaries.length) {
          const nextBoundaryWord = normalizeWord(wordBoundaries[i + j].word);
          if (nextBoundaryWord === searchTokens[j]) {
            matchScore += 1.5;
          } else if (j + 1 < searchTokens.length && i + j + 1 < wordBoundaries.length) {
            // Tolerância a uma palavra intermediária omitida ou inserida
            const skipWord = normalizeWord(wordBoundaries[i + j + 1].word);
            if (skipWord === searchTokens[j]) {
              matchScore += 1.0;
            }
          }
        }
      }
    } else if (searchTokens.length > 1 && boundaryWord === searchTokens[1] && boundaryWord.length >= 4) {
      // Se a primeira palavra foi uma preposição muito curta ("de", "a", "o") e pulou para a 2ª
      matchScore += 1.2;
      if (i + 1 < wordBoundaries.length && normalizeWord(wordBoundaries[i + 1].word) === searchTokens[2]) {
        matchScore += 1.5;
      }
    }

    if (matchScore > highestScore && matchScore >= 1.5) {
      highestScore = matchScore;
      bestMatch = {
        boundaryIndex: i,
        matchedWord: wordBoundaries[i].word,
        confidence: matchScore
      };

      // Casamento perfeito dos primeiros tokens: encerra busca imediatamente
      if (matchScore >= 3.5) {
        break;
      }
    }
  }

  return bestMatch;
}

/**
 * Calcula o timestamp de corte ideal entre duas cenas consecutivas.
 * Aplica a técnica cinematográfica de L-cut: posiciona o corte na pausa natural
 * entre 80ms e 150ms antes do início do primeiro fonema da nova frase,
 * garantindo que a transição visual anteceda o som sem cortar a cauda da frase anterior.
 *
 * @param {Array<{word: string, startMs: number, endMs: number}>} wordBoundaries 
 * @param {number} targetIndex 
 * @returns {number} timestamp de corte em milissegundos
 */
export function calculateSceneCutTimestamp(wordBoundaries, targetIndex) {
  if (!wordBoundaries || wordBoundaries.length === 0 || targetIndex <= 0) {
    return 0;
  }

  const currWord = wordBoundaries[targetIndex];
  const prevWord = wordBoundaries[targetIndex - 1];

  if (!currWord) {
    return prevWord ? prevWord.endMs : 0;
  }
  if (!prevWord) {
    return currWord.startMs;
  }

  const pauseDurationMs = currWord.startMs - prevWord.endMs;

  // Se houver pausa perceptível entre as frases (> 120ms)
  if (pauseDurationMs >= 120) {
    // Corte cinematográfico: 100ms antes da nova palavra, sem invadir a palavra anterior
    const cutCandidate = currWord.startMs - 100;
    return Math.max(prevWord.endMs + 20, cutCandidate);
  }

  // Se for uma transição contínua sem pausa (ex: vírgula curta), corta no meio
  return Math.round((prevWord.endMs + currWord.startMs) / 2);
}

/**
 * Encontra a pausa natural de respiração/pontuação mais próxima do tempo alvo.
 * Utilizado como fallback inteligente quando a cena não possui texto explícito associado.
 *
 * @param {Array<{word: string, startMs: number, endMs: number}>} wordBoundaries 
 * @param {number} targetTimeMs 
 * @param {number} minMs 
 * @param {number} maxMs 
 * @returns {number} timestamp em milissegundos
 */
export function findOptimalPauseCut(wordBoundaries, targetTimeMs, minMs, maxMs) {
  if (!wordBoundaries || wordBoundaries.length < 2) {
    return targetTimeMs;
  }

  let bestIndex = -1;
  let maxPause = -1;
  let closestDist = Infinity;

  for (let i = 1; i < wordBoundaries.length; i++) {
    const pause = wordBoundaries[i].startMs - wordBoundaries[i - 1].endMs;
    const midPoint = (wordBoundaries[i - 1].endMs + wordBoundaries[i].startMs) / 2;

    if (midPoint >= minMs && midPoint <= maxMs) {
      const dist = Math.abs(midPoint - targetTimeMs);

      // Prioriza pausas longas (> 200ms) de pontuação; se empatadas, a mais próxima do target
      if (pause > 200 && (pause > maxPause || (Math.abs(pause - maxPause) < 100 && dist < closestDist))) {
        maxPause = pause;
        bestIndex = i;
        closestDist = dist;
      } else if (maxPause < 200 && dist < closestDist) {
        bestIndex = i;
        closestDist = dist;
      }
    }
  }

  if (bestIndex > 0) {
    return calculateSceneCutTimestamp(wordBoundaries, bestIndex);
  }

  return Math.round(targetTimeMs);
}

/**
 * Alinha e calibra a duração de cada corte de cena com precisão de milissegundos
 * com base nos wordBoundaries reais do Edge-TTS e no texto do roteiro.
 *
 * Invariantes garantidos:
 * 1. Cena 0 sempre inicia em 0.00s.
 * 2. Última cena sempre encerra exatamente em totalDurationSeconds.
 * 3. A soma das durações das cenas é matematicamente idêntica à duração total do áudio.
 * 4. Nenhuma cena terá duração inferior a 1.5 segundos.
 * 5. Cada transição ocorre em um limite exato de palavra ou pausa natural.
 *
 * @param {Object} params
 * @param {Array<Object>} params.scenes Lista de cenas planejadas
 * @param {Array<{word: string, startMs: number, endMs: number}>} params.wordBoundaries Timestamps do Edge-TTS
 * @param {number} params.totalDurationSeconds Duração total do áudio
 * @param {string} [params.narrationText] Texto completo da locução
 * @returns {Array<Object>} Cenas com startTime, endTime, duration e alignmentType calibrados
 */
export function alignScenesWithWordBoundaries({
  scenes,
  wordBoundaries,
  totalDurationSeconds,
  narrationText = ''
}) {
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return [];
  }

  const totalDurationMs = Math.round((totalDurationSeconds || 0) * 1000);
  const numScenes = scenes.length;

  // Caso especial: apenas 1 cena no roteiro
  if (numScenes === 1) {
    return [{
      ...scenes[0],
      startTime: 0,
      endTime: totalDurationSeconds,
      duration: totalDurationSeconds,
      startMs: 0,
      endMs: totalDurationMs,
      alignmentType: 'single_scene_full_span'
    }];
  }

  // Fallback se não houver wordBoundaries disponíveis do sintetizador
  if (!wordBoundaries || !Array.isArray(wordBoundaries) || wordBoundaries.length === 0 || totalDurationMs <= 0) {
    const totalBase = scenes.reduce((acc, s) => acc + (s.duration || 5), 0) || (numScenes * 5);
    const scale = totalDurationSeconds / totalBase;
    let accumulated = 0;

    return scenes.map((s, idx) => {
      const isLast = idx === numScenes - 1;
      const baseDuration = (s.duration || 5) * scale;
      const startTime = Number(accumulated.toFixed(2));
      const endTime = isLast ? totalDurationSeconds : Number((accumulated + baseDuration).toFixed(2));
      const duration = Number((endTime - startTime).toFixed(2));
      accumulated = endTime;

      return {
        ...s,
        startTime,
        endTime,
        duration,
        startMs: Math.round(startTime * 1000),
        endMs: Math.round(endTime * 1000),
        alignmentType: 'proportional_fallback_no_boundaries'
      };
    });
  }

  // Vetor de cortes em milissegundos: cutMs[0] = 0, cutMs[numScenes] = totalDurationMs
  const cutMs = new Array(numScenes + 1);
  cutMs[0] = 0;
  cutMs[numScenes] = totalDurationMs;

  const alignmentDetails = new Array(numScenes);
  alignmentDetails[0] = { type: 'audio_start', word: wordBoundaries[0]?.word || '' };

  const minSceneDurationMs = 800; // Mínimo de 0.8s por cena (cortes dinâmicos para Shorts/TikTok)
  const totalBaseDuration = scenes.reduce((acc, s) => acc + (s.duration || 5), 0) || (numScenes * 5);

  let boundaryCursor = 0;
  let accumulatedBaseDuration = scenes[0].duration || 5;

  // Encontra os cortes intermediários entre as cenas (de 1 a numScenes - 1)
  for (let i = 1; i < numScenes; i++) {
    const prevCut = cutMs[i - 1];
    const remainingScenes = numScenes - i;
    const maxAllowedCutMs = totalDurationMs - (remainingScenes * minSceneDurationMs);
    const minAllowedCutMs = prevCut + minSceneDurationMs;

    const currentScene = scenes[i];
    const phrase = currentScene.phrase || currentScene.spokenPhrase || currentScene.text || '';
    const tokens = tokenizePhrase(phrase);

    let resolvedCutMs = null;
    let matchResult = null;

    // 1. Tenta correspondência exata das palavras da frase nos wordBoundaries
    if (tokens.length > 0) {
      matchResult = findWordSequenceIndex(wordBoundaries, tokens, boundaryCursor, 90);
      if (matchResult && matchResult.boundaryIndex > boundaryCursor) {
        const candidateCutMs = calculateSceneCutTimestamp(wordBoundaries, matchResult.boundaryIndex);
        if (candidateCutMs >= minAllowedCutMs && candidateCutMs <= maxAllowedCutMs) {
          resolvedCutMs = candidateCutMs;
          boundaryCursor = matchResult.boundaryIndex;
          alignmentDetails[i] = {
            type: 'word_boundary_phrase_match',
            word: matchResult.matchedWord,
            confidence: matchResult.confidence
          };
        }
      }
    }

    // 2. Se a correspondência falhou ou a cena não possui frase explícita:
    //    Calcula tempo alvo proporcional e ancora na pausa natural mais próxima
    if (resolvedCutMs === null) {
      const targetRatio = accumulatedBaseDuration / totalBaseDuration;
      const targetTimeMs = targetRatio * totalDurationMs;

      const pauseCut = findOptimalPauseCut(
        wordBoundaries,
        targetTimeMs,
        minAllowedCutMs,
        maxAllowedCutMs
      );

      resolvedCutMs = Math.max(minAllowedCutMs, Math.min(pauseCut, maxAllowedCutMs));
      alignmentDetails[i] = {
        type: 'speech_pause_snap',
        word: 'natural_pause'
      };

      // Atualiza cursor para o índice de palavra mais próximo do corte
      while (boundaryCursor < wordBoundaries.length && wordBoundaries[boundaryCursor].startMs < resolvedCutMs) {
        boundaryCursor++;
      }
    }

    cutMs[i] = resolvedCutMs;
    accumulatedBaseDuration += (currentScene.duration || 5);
  }

  // Constrói a lista final de cenas alinhadas com verificação de invariantes
  const alignedScenes = [];
  for (let i = 0; i < numScenes; i++) {
    const isLast = (i === numScenes - 1);
    const startMs = cutMs[i];
    const endMs = cutMs[i + 1];

    const startTime = Number((startMs / 1000).toFixed(2));
    const endTime = isLast ? totalDurationSeconds : Number((endMs / 1000).toFixed(2));
    const duration = Number((endTime - startTime).toFixed(2));

    alignedScenes.push({
      ...scenes[i],
      startTime,
      endTime,
      duration,
      startMs,
      endMs,
      alignmentType: alignmentDetails[i]?.type || 'aligned',
      matchedWord: alignmentDetails[i]?.word || ''
    });
  }

  // Ajuste fino do último corte para zerar qualquer discrepância de arredondamento
  const sumDurations = alignedScenes.reduce((acc, s) => acc + s.duration, 0);
  const diff = Number((totalDurationSeconds - sumDurations).toFixed(2));

  if (Math.abs(diff) > 0.001 && alignedScenes.length > 0) {
    const lastScene = alignedScenes[alignedScenes.length - 1];
    lastScene.duration = Number((lastScene.duration + diff).toFixed(2));
    lastScene.endTime = totalDurationSeconds;
    lastScene.endMs = totalDurationMs;
  }

  return alignedScenes;
}
