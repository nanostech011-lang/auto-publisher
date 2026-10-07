/**
 * AutoPublisher Pro - Timing Estimator (Modo Sem Locução / audioMode: NONE)
 * 
 * Estima a cadência temporal de palavras e frases quando não há síntese neural de voz,
 * permitindo alinhamento de cenas e geração de legendas sincronizadas por duração visual.
 */

/**
 * Estima marcações temporais de palavras (word boundaries) para um texto e duração alvo.
 * Considera comprimento das palavras e pausas naturais de pontuação.
 * 
 * @param {string} text Texto completo a ser distribuído
 * @param {number} totalDurationSec Duração total em segundos
 * @param {Object} [options] Configurações de padding
 * @returns {Array<{ word: string, start: number, end: number }>} Lista de palavras com timestamps (segundos)
 */
export function estimateWordBoundaries(text = '', totalDurationSec = 15.0, options = {}) {
  const startPadding = options.startPaddingSec ?? 0.3;
  const endPadding = options.endPaddingSec ?? 0.5;
  const availableDuration = Math.max(1.0, totalDurationSec - startPadding - endPadding);

  if (!text || typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const rawWords = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (rawWords.length === 0) return [];

  // 1. Calcula peso relativo de cada palavra
  // Base: comprimento da palavra + peso extra para pontuação final (pausas de respiração)
  const weights = rawWords.map(w => {
    let weight = Math.max(1, w.length);
    if (/[.!?]$/.test(w)) {
      weight += 6; // Pausa longa de ponto
    } else if (/[,;:—]$/.test(w)) {
      weight += 3; // Pausa média de vírgula
    }
    return weight;
  });

  const totalWeight = weights.reduce((acc, val) => acc + val, 0);

  // 2. Distribui a duração disponível proporcionalmente
  const boundaries = [];
  let currentStart = startPadding;

  for (let i = 0; i < rawWords.length; i++) {
    const word = rawWords[i];
    const duration = (weights[i] / totalWeight) * availableDuration;
    // Pequeno intervalo entre palavras (gap) se não for colado
    const wordDur = Math.max(0.12, duration * 0.92);
    const end = Math.min(totalDurationSec - endPadding, currentStart + wordDur);

    boundaries.push({
      word,
      start: Number(currentStart.toFixed(3)),
      end: Number(end.toFixed(3))
    });

    currentStart += duration;
  }

  // Garante que a última palavra termine antes do limite
  if (boundaries.length > 0) {
    const last = boundaries[boundaries.length - 1];
    if (last.end > totalDurationSec) {
      last.end = Number((totalDurationSec - 0.1).toFixed(3));
    }
  }

  return boundaries;
}

/**
 * Estima a duração ideal de um vídeo puramente visual baseado no número de cenas ou texto
 */
export function estimateVisualDuration(scenes = [], narrationText = '', fallbackDurationSec = 15.0) {
  if (scenes && scenes.length > 0) {
    const scenesDuration = scenes.reduce((acc, s) => acc + (parseFloat(s.duration) || 3.5), 0);
    if (scenesDuration >= 5.0) return Number(scenesDuration.toFixed(1));
  }

  if (narrationText && typeof narrationText === 'string') {
    const wordCount = narrationText.trim().split(/\s+/).length;
    // Cadência visual de leitura confortável: ~2.5 palavras por segundo
    const estimated = Math.max(10.0, Math.min(60.0, wordCount / 2.5));
    return Number(estimated.toFixed(1));
  }

  return fallbackDurationSec;
}
