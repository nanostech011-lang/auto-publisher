import fs from 'fs';
import path from 'path';

/**
 * Utilitario para formatar tempo em horas:minutos:segundos.centesimos para ASS (H:MM:SS.CC)
 */
function formatAssTime(ms) {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((ms % 1000) / 10);

  const h = hours.toString();
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const cc = centiseconds.toString().padStart(2, '0');

  return `${h}:${mm}:${ss}.${cc}`;
}

/**
 * Utilitario para formatar tempo em HH:MM:SS,mmm para SRT
 */
function formatSrtTime(ms) {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = ms % 1000;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const mmm = millis.toString().padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Utilitario para escapar caracteres especiais de scripts ASS (\, {, })
 */
export function escapeAssText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');
}

/**
 * Converte qualquer formato de cor hex (&H0000D7FF, &H00FFFF, FFFF00) para o formato padrão inline do ASS (\1c&HBBGGRR&)
 */
export function toAssInlineColor(color) {
  if (!color) return '&HFFFFFF&';
  let hex = String(color).replace(/^&H/i, '').replace(/&$/, '').trim();
  // Se for 8 dígitos AABBGGRR (formato de estilo ASS), remove os primeiros 2 dígitos (Alpha AA)
  if (hex.length === 8) {
    hex = hex.slice(2);
  }
  // Garante 6 dígitos BBGGRR
  hex = hex.padStart(6, '0').slice(-6);
  return `&H${hex.toUpperCase()}&`;
}

/**
 * Calcula a capacidade máxima de caracteres por linha com base no tamanho da fonte e margens (Fase 1B)
 * Fórmula: floor((1080 - MarginL - MarginR) / (fontSize * k))
 * com k ≈ 0.68 em caixa alta e ≈ 0.56 em caixa mista.
 */
export function computeLineCapacity({
  fontSize = 58,
  marginL = 120,
  marginR = 120,
  casing = 'mixed'
} = {}) {
  const k = (casing === 'uppercase' || casing === 'upper') ? 0.68 : 0.56;
  const availableWidth = Math.max(200, 1080 - (marginL + marginR));
  const capacity = Math.floor(availableWidth / (fontSize * k));
  return Math.max(12, capacity);
}

/**
 * Normaliza uma palavra para comparação fonética/lexical removendo pontuações e acentos
 */
function normalizeWordForMatching(word) {
  if (!word) return '';
  return String(word)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Sanitiza e funde prefixos simbólicos (@ e #) que o Edge-TTS divide em boundaries separados
 */
export function sanitizeEdgeTtsBoundaries(wordBoundaries) {
  if (!Array.isArray(wordBoundaries) || wordBoundaries.length === 0) return [];
  const merged = [];

  for (let i = 0; i < wordBoundaries.length; i++) {
    const curr = wordBoundaries[i];
    const next = wordBoundaries[i + 1];

    if ((curr.word === '@' || curr.word === '#') && next && (next.startMs - curr.endMs <= 250)) {
      merged.push({
        word: curr.word + next.word,
        startMs: curr.startMs,
        endMs: next.endMs,
        durationMs: next.endMs - curr.startMs
      });
      i++; // consome o próximo pois foi fundido ao símbolo
    } else if (curr.word && curr.word.trim().length > 0) {
      merged.push({ ...curr });
    }
  }

  return merged;
}

/**
 * Recupera pontuação, acentos e caixa original alinhando os wordBoundaries do Edge-TTS
 * com os tokens correspondentes do texto falado (spokenText) com busca ancorada estritamente monotônica
 */
export function attachPunctuation(rawBoundaries, spokenText) {
  const wordBoundaries = sanitizeEdgeTtsBoundaries(rawBoundaries);
  if (!wordBoundaries || wordBoundaries.length === 0) return [];
  if (!spokenText || typeof spokenText !== 'string' || !spokenText.trim()) {
    return wordBoundaries.map(wb => ({ ...wb }));
  }

  // Tokeniza o texto falado preservando pontuação anexa a cada palavra
  const spokenTokens = spokenText.trim().split(/\s+/).filter(t => t.length > 0);
  let spokenCursor = 0;

  return wordBoundaries.map(wb => {
    const normWb = normalizeWordForMatching(wb.word);
    if (!normWb) return { ...wb };

    let bestMatchIdx = -1;
    const windowEnd = Math.min(spokenTokens.length, spokenCursor + 8);

    // 1. Busca correspondência exata normalizada na janela
    for (let j = spokenCursor; j < windowEnd; j++) {
      const normCand = normalizeWordForMatching(spokenTokens[j]);
      if (normCand === normWb) {
        bestMatchIdx = j;
        break;
      }
    }

    // 2. Se não achou exato, busca por prefixo/composto (ex: micro-tarefas, execute-a)
    if (bestMatchIdx === -1) {
      for (let j = spokenCursor; j < windowEnd; j++) {
        const normCand = normalizeWordForMatching(spokenTokens[j]);
        if (normCand.startsWith(normWb) || normWb.startsWith(normCand)) {
          bestMatchIdx = j;
          break;
        }
      }
    }

    if (bestMatchIdx !== -1) {
      const matchedToken = spokenTokens[bestMatchIdx];
      spokenCursor = bestMatchIdx + 1;
      return {
        ...wb,
        word: matchedToken
      };
    }

    // Se não encontrou, preserva a palavra do TTS sem corromper o cursor
    return { ...wb };
  });
}

/**
 * Encontra o melhor ponto de quebra em 2 linhas (\N) minimizando o desbalanceamento
 * e preservando artigos e preposições curtas junto da palavra seguinte
 */
export function findSmartLineBreakIndex(words, maxCharsPerLine = 26) {
  if (!words || words.length <= 2) return -1;

  const totalLength = words.map(w => w.word.length).reduce((a, b) => a + b, 0) + (words.length - 1);
  if (totalLength <= maxCharsPerLine) return -1; // Cabe em 1 linha só

  const shortParticles = new Set([
    'o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos',
    'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas',
    'por', 'com', 'pra', 'pro', 'se', 'que', 'ao', 'aos', 'à', 'às'
  ]);

  let bestIndex = Math.ceil(words.length / 2);
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const line1Words = words.slice(0, i);
    const line2Words = words.slice(i);

    const len1 = line1Words.map(w => w.word.length).reduce((a, b) => a + b, 0) + (line1Words.length - 1);
    const len2 = line2Words.map(w => w.word.length).reduce((a, b) => a + b, 0) + (line2Words.length - 1);

    let penalty = Math.abs(len1 - len2) * 1.5;

    // Penalidade severa se qualquer linha estourar a capacidade máxima
    if (len1 > maxCharsPerLine) penalty += (len1 - maxCharsPerLine) * 12;
    if (len2 > maxCharsPerLine) penalty += (len2 - maxCharsPerLine) * 12;

    const prevWordClean = line1Words[line1Words.length - 1].word.toLowerCase().replace(/[^a-záàâãéêíóôõúç]/g, '');
    const nextWordClean = line2Words[0].word.toLowerCase().replace(/[^a-záàâãéêíóôõúç]/g, '');

    // Nunca separar artigo ou preposição da palavra seguinte
    if (shortParticles.has(prevWordClean)) {
      penalty += 35;
    }

    // Bônus se quebrar logo após pontuação fraca (vírgula, dois pontos, travessão)
    if (/[,;:\—\-]$/.test(line1Words[line1Words.length - 1].word)) {
      penalty -= 15;
    }

    // Bônus se a segunda linha começar com conjunção
    if (['e', 'mas', 'porém', 'porque', 'quando', 'onde', 'como'].includes(nextWordClean)) {
      penalty -= 8;
    }

    if (penalty < bestScore) {
      bestScore = penalty;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Agrupa palavras em orações completas com sentido fechado (5 a 12 palavras, 1.2s a 5.5s)
 * Layout full_sentences para leitura fluida e natural sem fadiga visual
 */
export function groupWordsIntoFullSentences(wordBoundaries, layoutOpts = {}) {
  if (!wordBoundaries || !Array.isArray(wordBoundaries) || wordBoundaries.length === 0) return [];

  const maxCharsPerLine = layoutOpts.maxCharsPerLine || 26;
  const maxCardChars = maxCharsPerLine * 2; // Capacidade de 2 linhas confortáveis
  const minCardDurationMs = layoutOpts.minCardDurationMs || 1000;
  const maxCardDurationMs = layoutOpts.maxCardDurationMs || 5000;

  const rawChunks = [];
  let currentWords = [];

  for (let i = 0; i < wordBoundaries.length; i++) {
    const wb = wordBoundaries[i];
    const nextWb = wordBoundaries[i + 1];
    currentWords.push(wb);

    const isSentenceEnd = /[.?!;]$/.test(wb.word);
    const gapToNext = nextWb ? (nextWb.startMs - wb.endMs) : 0;
    // Pausa verdadeira de fim de oração é >= 400ms (vírgulas normais no PT-BR têm ~280-350ms)
    const isStrongPause = gapToNext >= 400;

    const currentDuration = wb.endMs - currentWords[0].startMs;
    const currentCharCount = currentWords.map(w => w.word.length).reduce((a, b) => a + b, 0) + (currentWords.length - 1);

    // Condições para fechar o card
    const shouldBreak =
      isSentenceEnd ||
      isStrongPause ||
      currentDuration >= maxCardDurationMs ||
      currentCharCount >= maxCardChars ||
      currentWords.length >= 12 ||
      i === wordBoundaries.length - 1;

    if (shouldBreak) {
      // Se estourou por limite de caracteres/tempo sem pontuação forte, tenta achar vírgula ou conjunção próxima
      if (!isSentenceEnd && !isStrongPause && currentWords.length > 5 && i < wordBoundaries.length - 1) {
        let splitPoint = -1;
        for (let j = currentWords.length - 2; j >= 3; j--) {
          // Não quebra em "se" pois é predominantemente pronome reflexivo (ex: se refugia, se vê)
          if (/[,]$/.test(currentWords[j].word) || /^(mas|porém|porque|quando|onde|como)$/i.test(currentWords[j + 1].word)) {
            splitPoint = j + 1;
            break;
          }
        }

        if (splitPoint > 0 && splitPoint < currentWords.length) {
          const chunk1 = currentWords.slice(0, splitPoint);
          const remainder = currentWords.slice(splitPoint);

          rawChunks.push({
            startMs: chunk1[0].startMs,
            endMs: chunk1[chunk1.length - 1].endMs,
            words: chunk1
          });
          currentWords = remainder;
          continue;
        }
      }

      rawChunks.push({
        startMs: currentWords[0].startMs,
        endMs: currentWords[currentWords.length - 1].endMs,
        words: [...currentWords]
      });
      currentWords = [];
    }
  }

  // Pós-processamento 1: Elimina cards órfãos de 1 palavra unindo ao vizinho mais adequado
  const mergedOrphans = [];
  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    if (chunk.words.length === 1) {
      if (mergedOrphans.length > 0 && mergedOrphans[mergedOrphans.length - 1].words.length < 12) {
        const prev = mergedOrphans[mergedOrphans.length - 1];
        prev.words.push(...chunk.words);
        prev.endMs = chunk.endMs;
        continue;
      } else if (i < rawChunks.length - 1) {
        const next = rawChunks[i + 1];
        next.words.unshift(...chunk.words);
        next.startMs = chunk.startMs;
        continue;
      }
    }
    mergedOrphans.push(chunk);
  }

  // Pós-processamento 2: Invariante Estrita de Não-Sobreposição (Zero Overlap Guaranteed)
  const consolidated = [];
  for (let i = 0; i < mergedOrphans.length; i++) {
    const chunk = mergedOrphans[i];
    const nextChunk = mergedOrphans[i + 1];

    // Se duração menor que o mínimo confortável, expande apenas até o espaço seguro antes do próximo
    const naturalDuration = chunk.endMs - chunk.startMs;
    if (naturalDuration < minCardDurationMs) {
      const maxPossibleEnd = nextChunk ? Math.max(chunk.endMs, nextChunk.startMs - 20) : (chunk.startMs + minCardDurationMs);
      chunk.endMs = Math.min(chunk.startMs + minCardDurationMs, maxPossibleEnd);
    }

    // Invariante Mandatória: chunk.endMs NUNCA pode alcançar ou ultrapassar nextChunk.startMs
    if (nextChunk && chunk.endMs >= nextChunk.startMs) {
      chunk.endMs = Math.max(chunk.words[chunk.words.length - 1].endMs, nextChunk.startMs - 20);
    }

    consolidated.push(chunk);
  }

  return consolidated;
}

/**
 * Agrupa palavras individuais em blocos curtos rápidos estilo Hormozi (layout fast_words)
 */
export function groupWordsIntoChunks(wordBoundaries, wordsPerChunk = 3) {
  if (!wordBoundaries || !Array.isArray(wordBoundaries) || wordBoundaries.length === 0) return [];
  const chunks = [];
  let currentWords = [];

  for (let i = 0; i < wordBoundaries.length; i++) {
    const wb = wordBoundaries[i];
    const nextWb = wordBoundaries[i + 1];
    currentWords.push(wb);

    const isStrongPunctuation = /[.?!;:]$/.test(wb.word);
    const isWeakPunctuation = /[,]$/.test(wb.word);
    const gapToNext = nextWb ? (nextWb.startMs - wb.endMs) : 0;
    const isStrongGap = gapToNext >= 260;
    const isWeakGap = gapToNext >= 110;

    const currentDuration = wb.endMs - currentWords[0].startMs;

    const shouldBreak =
      isStrongPunctuation ||
      isStrongGap ||
      (currentWords.length >= wordsPerChunk && (isWeakPunctuation || isWeakGap || currentDuration >= 600)) ||
      currentWords.length >= wordsPerChunk + 1 ||
      i === wordBoundaries.length - 1;

    if (shouldBreak) {
      chunks.push({
        startMs: currentWords[0].startMs,
        endMs: currentWords[currentWords.length - 1].endMs,
        words: [...currentWords]
      });
      currentWords = [];
    }
  }

  return chunks;
}

export const SUBTITLE_THEMES = {
  GOLD_PUNCH: {
    fontName: 'Montserrat-Black',
    fontSize: 74,
    primaryColor: '&H00FFFFFF',     // Branco puro (&HAABBGGRR: AA=00, BB=FF, GG=FF, RR=FF)
    activeWordColor: '&H0000FFFF',  // Amarelo Neon Luminous (BGR: BB=00, GG=FF, RR=FF -> RGB 255, 255, 0)
    outlineColor: '&H00000000',     // Preto puro
    outlineWidth: 5.0,
    shadowWidth: 2.5,
    marginV: 560,
    popScale: 132
  },
  CYAN_ELECTRIC: {
    fontName: 'Montserrat-Black',
    fontSize: 74,
    primaryColor: '&H00FFFFFF',     // Branco puro
    activeWordColor: '&H00FFFF00',  // Ciano elétrico (BGR: BB=FF, GG=FF, RR=00 -> RGB 0, 255, 255)
    outlineColor: '&H00000000',     // Preto puro
    outlineWidth: 5.0,
    shadowWidth: 2.5,
    marginV: 560,
    popScale: 132
  },
  EMERALD_NEON: {
    fontName: 'Montserrat-Black',
    fontSize: 74,
    primaryColor: '&H00FFFFFF',
    activeWordColor: '&H0000FF00',  // Verde Neon (BGR: BB=00, GG=FF, RR=00 -> RGB 0, 255, 0)
    outlineColor: '&H00000000',
    outlineWidth: 5.0,
    shadowWidth: 2.5,
    marginV: 560,
    popScale: 132
  },
  WHITE_CLEAN: {
    fontName: 'Montserrat-Black',
    fontSize: 76,
    primaryColor: '&H00E0E0E0',     // Branco suave de fundo
    activeWordColor: '&H00FFFFFF',  // Branco puro e brilhante para palavra ativa
    outlineColor: '&H00000000',     // Borda preta nítida
    outlineWidth: 5.5,
    shadowWidth: 3.0,
    marginV: 560,
    popScale: 130
  },
  TIKTOK_VIRAL: {
    fontName: 'Montserrat-Black',
    fontSize: 80,
    primaryColor: '&H0000FFFF',     // Amarelo neon
    activeWordColor: '&H000000FF',  // Vermelho vivo para a palavra ativa
    outlineColor: '&H00000000',     // Preto para outline
    outlineWidth: 6.0,
    shadowWidth: 3.0,
    marginV: 560,
    popScale: 136
  }
};

/**
 * Gera arquivo de legenda Advanced SubStation Alpha (.ass) com suporte a layouts:
 * - 'full_sentences' (Padrão): orações completas em 1-2 linhas confortáveis com karaokê contínuo
 * - 'fast_words': blocos rápidos de 2-3 palavras soltas estilo Hormozi
 * - 'static_cards': cartões de texto estáticos sem karaokê (modo visual/NONE)
 */
export function generateAssSubtitles({
  wordBoundaries,
  outputAssPath,
  theme = 'GOLD_PUNCH',
  fontName = null,
  fontSize = null,
  primaryColor = null,
  activeWordColor = null,
  outlineColor = null,
  outlineWidth = null,
  shadowWidth = null,
  marginV = null,
  popAnimation = true,
  subtitlesLayout = 'full_sentences',
  spokenText = null
}) {
  const chosenTheme = SUBTITLE_THEMES[theme] || SUBTITLE_THEMES.GOLD_PUNCH;
  const layout = subtitlesLayout || 'full_sentences';
  const isFullSentences = layout === 'full_sentences';
  const isStaticCards = layout === 'static_cards';

  // Calibra tamanho da fonte e margens de acordo com o layout
  // full_sentences: fonte 58px, margens laterais 120px para não colidir com UI do TikTok/Reels à direita
  const defaultFontSize = isFullSentences ? 58 : chosenTheme.fontSize;
  const fName = fontName || chosenTheme.fontName;
  const fSize = fontSize || defaultFontSize;
  const pColor = primaryColor || chosenTheme.primaryColor;
  const aColor = activeWordColor || chosenTheme.activeWordColor;
  const oColor = outlineColor || chosenTheme.outlineColor;
  const oWidth = outlineWidth || chosenTheme.outlineWidth;
  const sWidth = shadowWidth || chosenTheme.shadowWidth;
  const mV = marginV || chosenTheme.marginV;

  const marginL = isFullSentences ? 120 : 40;
  const marginR = isFullSentences ? 120 : 40;

  const inlineActive = toAssInlineColor(aColor);
  const inlinePrimary = toAssInlineColor(pColor);

  // Alinha pontuação se o spokenText foi fornecido
  const enrichedBoundaries = (spokenText && Array.isArray(wordBoundaries))
    ? attachPunctuation(wordBoundaries, spokenText)
    : wordBoundaries;

  const capacity = computeLineCapacity({
    fontSize: fSize,
    marginL,
    marginR,
    casing: isFullSentences ? 'mixed' : 'uppercase'
  });

  const chunks = isFullSentences
    ? groupWordsIntoFullSentences(enrichedBoundaries, { maxCharsPerLine: capacity })
    : groupWordsIntoChunks(enrichedBoundaries, 3);

  const header = `[Script Info]
Title: AutoPublisher Pro Subtitles
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fName},${fSize},${pColor},${aColor},${oColor},&H80000000,-1,0,0,0,100,100,0,0,1,${oWidth},${sWidth},2,${marginL},${marginR},${mV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const eventLines = [];

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const nextChunk = chunks[cIdx + 1];

    // Duração do card estendida confortavelmente até a proximidade do próximo chunk
    // Mantém sempre pelo menos 20ms de margem limpa antes do próximo chunk para evitar colisão visual no libass
    const gapToNext = nextChunk ? Math.max(0, nextChunk.startMs - chunk.endMs) : 0;
    const extendMs = Math.min(250, gapToNext);
    const cardEndMs = nextChunk
      ? Math.min(nextChunk.startMs - 20, chunk.endMs + extendMs)
      : (chunk.endMs + 300);

    const startStr = formatAssTime(chunk.startMs);
    const endStr = formatAssTime(cardEndMs);

    const activeBord = Math.round(Number(oWidth || 4) + 3);
    const inactiveBord = Math.round(Number(oWidth || 4));

    const words = chunk.words;

    if (isStaticCards) {
      // Modo estático para vídeos sem narração (NONE)
      const rawText = words.map(w => w.word).join(' ');
      const splitIdx = findSmartLineBreakIndex(words, capacity);
      let renderedText = rawText;
      if (splitIdx > 0 && splitIdx < words.length) {
        const line1 = words.slice(0, splitIdx).map(w => w.word).join(' ');
        const line2 = words.slice(splitIdx).map(w => w.word).join(' ');
        renderedText = `${line1}\\N${line2}`;
      }
      eventLines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,{\\fad(120,120)}${escapeAssText(renderedText)}`);
      continue;
    }

    // Calcula quebra de linha inteligente em 2 linhas (\N)
    const splitPoint = isFullSentences
      ? findSmartLineBreakIndex(words, capacity)
      : (words.length > 2 ? Math.ceil(words.length / 2) : -1);

    // Constrói a linha única com frase completa visível e sweep de destaque dinâmico
    const formattedWords = words.map((w, idx) => {
      const surfaceText = isFullSentences
        ? escapeAssText(w.word)
        : escapeAssText(w.word.toUpperCase());

      const tIn = Math.max(0, w.startMs - chunk.startMs);
      const wordEndRel = w.endMs - chunk.startMs;
      let tOut;
      if (idx < words.length - 1) {
        const nextWordStartRel = words[idx + 1].startMs - chunk.startMs;
        tOut = Math.min(nextWordStartRel, Math.max(tIn + 40, wordEndRel));
      } else {
        tOut = Math.min(cardEndMs - chunk.startMs, Math.max(tIn + 60, wordEndRel));
      }

      const lineBreak = (idx === splitPoint) ? '\\N' : '';

      return `${lineBreak}{\\1c${inlinePrimary}\\t(${tIn},${tIn + 35},\\1c${inlineActive}\\bord${activeBord}\\blur3)\\t(${tOut},${tOut + 35},\\1c${inlinePrimary}\\bord${inactiveBord}\\blur0)}${surfaceText}{\\r}`;
    });

    const cardText = `{\\fad(70,90)}${formattedWords.join(' ')}`;
    eventLines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${cardText}`);
  }

  const fullAssContent = header + eventLines.join('\n') + '\n';

  const dir = path.dirname(outputAssPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputAssPath, fullAssContent, 'utf8');
  return outputAssPath;
}

/**
 * Gera arquivo de legenda tradicional .srt em caixa mista para YouTube CC e SEO
 */
export function generateSrtSubtitles({
  wordBoundaries,
  outputSrtPath,
  wordsPerChunk = 4,
  subtitlesLayout = 'full_sentences',
  spokenText = null
}) {
  const enrichedBoundaries = (spokenText && Array.isArray(wordBoundaries))
    ? attachPunctuation(wordBoundaries, spokenText)
    : wordBoundaries;

  const chunks = (subtitlesLayout === 'full_sentences')
    ? groupWordsIntoFullSentences(enrichedBoundaries)
    : groupWordsIntoChunks(enrichedBoundaries, wordsPerChunk);

  const srtBlocks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    // Caixa mista preservando capitalização e acentos originais para acessibilidade e SEO do YouTube CC
    const text = chunk.words.map(w => w.word).join(' ');
    const block = `${i + 1}\n${formatSrtTime(chunk.startMs)} --> ${formatSrtTime(chunk.endMs)}\n${text}\n`;
    srtBlocks.push(block);
  }

  const dir = path.dirname(outputSrtPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputSrtPath, srtBlocks.join('\n'), 'utf8');
  return outputSrtPath;
}
