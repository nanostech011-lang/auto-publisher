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
 * Agrupa palavras individuais em blocos prosódicos dinâmicos com análise em dois passes:
 * respeitando pausas naturais de fala (fronteiras fortes >= 260ms) e pontuação.
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
 * Gera arquivo de legenda Advanced SubStation Alpha (.ass) com estilo profissional:
 * 1 evento Dialogue por card para eliminar reflow/tremor, animação de entrada fade,
 * e sweep de cor dinâmica por palavra via tag \t.
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
  popAnimation = true
}) {
  const chosenTheme = SUBTITLE_THEMES[theme] || SUBTITLE_THEMES.GOLD_PUNCH;
  const fName = fontName || chosenTheme.fontName;
  const fSize = fontSize || chosenTheme.fontSize;
  const pColor = primaryColor || chosenTheme.primaryColor;
  const aColor = activeWordColor || chosenTheme.activeWordColor;
  const oColor = outlineColor || chosenTheme.outlineColor;
  const oWidth = outlineWidth || chosenTheme.outlineWidth;
  const sWidth = shadowWidth || chosenTheme.shadowWidth;
  const mV = marginV || chosenTheme.marginV;

  const inlineActive = toAssInlineColor(aColor);
  const inlinePrimary = toAssInlineColor(pColor);

  const chunks = groupWordsIntoChunks(wordBoundaries, 3);

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
Style: Default,${fName},${fSize},${pColor},${aColor},${oColor},&H80000000,-1,0,0,0,100,100,0,0,1,${oWidth},${sWidth},2,40,40,${mV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const eventLines = [];

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const nextChunk = chunks[cIdx + 1];

    // Duração do card estendida até o próximo chunk se o gap for curto (< 350ms)
    const gapToNext = nextChunk ? Math.min(350, Math.max(0, nextChunk.startMs - chunk.endMs)) : 0;
    const cardEndMs = chunk.endMs + gapToNext;

    const startStr = formatAssTime(chunk.startMs);
    const endStr = formatAssTime(cardEndMs);

    const activeBord = Math.round(Number(oWidth || 4) + 3);
    const inactiveBord = Math.round(Number(oWidth || 4));

    const words = chunk.words;
    const midPoint = words.length > 2 ? Math.ceil(words.length / 2) : -1;

    // Constrói a linha única com sweep de cor por palavra via \t
    const formattedWords = words.map((w, idx) => {
      const upper = escapeAssText(w.word.toUpperCase());
      const tIn = Math.max(0, w.startMs - chunk.startMs);
      const rawDur = w.endMs - w.startMs;
      const minActiveMs = Math.max(130, rawDur);
      const tOut = Math.min(cardEndMs - chunk.startMs, tIn + minActiveMs);

      const lineBreak = (idx === midPoint) ? '\\N' : '';
      return `${lineBreak}{\\1c${inlinePrimary}\\t(${tIn},${tIn + 35},\\1c${inlineActive}\\bord${activeBord}\\blur3)\\t(${tOut},${tOut + 35},\\1c${inlinePrimary}\\bord${inactiveBord}\\blur0)}${upper}{\\r}`;
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
export function generateSrtSubtitles({ wordBoundaries, outputSrtPath, wordsPerChunk = 4 }) {
  const chunks = groupWordsIntoChunks(wordBoundaries, wordsPerChunk);
  const srtBlocks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    // Caixa mista preservando capitalização original para acessibilidade e SEO do YouTube CC
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
