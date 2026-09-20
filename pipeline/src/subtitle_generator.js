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
 * Agrupa palavras individuais em blocos curtos e dinâmicos de 2 a 3 palavras para máxima retenção vertical (Hormozi / Shorts style).
 */
export function groupWordsIntoChunks(wordBoundaries, wordsPerChunk = 3) {
  const chunks = [];
  let currentWords = [];

  for (let i = 0; i < wordBoundaries.length; i++) {
    const wb = wordBoundaries[i];
    currentWords.push(wb);

    const isPunctuation = /[.?!,;:]$/.test(wb.word);
    if (currentWords.length >= wordsPerChunk || isPunctuation || i === wordBoundaries.length - 1) {
      const startMs = currentWords[0].startMs;
      const endMs = currentWords[currentWords.length - 1].endMs;
      chunks.push({
        startMs,
        endMs,
        words: [...currentWords]
      });
      currentWords = [];
    }
  }

  return chunks;
}

export const SUBTITLE_THEMES = {
  GOLD_PUNCH: {
    fontName: 'Arial',
    fontSize: 74,
    primaryColor: '&H00FFFFFF',     // Branco puro (&HAABBGGRR: AA=00, BB=FF, GG=FF, RR=FF)
    activeWordColor: '&H0000FFFF',  // Amarelo Neon Luminous (BGR: BB=00, GG=FF, RR=FF -> RGB 255, 255, 0)
    outlineColor: '&H00000000',     // Preto puro
    outlineWidth: 5.0,
    shadowWidth: 2.5,
    marginV: 380,
    popScale: 122
  },
  CYAN_ELECTRIC: {
    fontName: 'Arial',
    fontSize: 74,
    primaryColor: '&H00FFFFFF',     // Branco puro
    activeWordColor: '&H00FFFF00',  // Ciano elétrico (BGR: BB=FF, GG=FF, RR=00 -> RGB 0, 255, 255)
    outlineColor: '&H00000000',     // Preto puro
    outlineWidth: 5.0,
    shadowWidth: 2.5,
    marginV: 380,
    popScale: 122
  },
  EMERALD_NEON: {
    fontName: 'Arial',
    fontSize: 74,
    primaryColor: '&H00FFFFFF',
    activeWordColor: '&H0000FF00',  // Verde Neon (BGR: BB=00, GG=FF, RR=00 -> RGB 0, 255, 0)
    outlineColor: '&H00000000',
    outlineWidth: 5.0,
    shadowWidth: 2.5,
    marginV: 380,
    popScale: 122
  }
};

/**
 * Gera arquivo de legenda Advanced SubStation Alpha (.ass) com estilo karaokê animado
 * e efeito Spring Pop (bounce) nas palavras ativas para máxima retenção de audiência.
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
  const pScale = chosenTheme.popScale || 122;

  const inlineActive = toAssInlineColor(aColor);
  const inlinePrimary = toAssInlineColor(pColor);

  const chunks = groupWordsIntoChunks(wordBoundaries, 3);

  const header = `[Script Info]
Title: AutoPublisher Pro Subtitles
ScriptType: v4.00+
WrapStyle: 0
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

    // Para cada palavra ativa dentro do chunk, gera uma linha no .ass
    for (let i = 0; i < chunk.words.length; i++) {
      const activeWord = chunk.words[i];
      const nextWordInChunk = chunk.words[i + 1];

      const startStr = formatAssTime(activeWord.startMs);

      // Garante que palavras curtas (artigos/preposições de 30-70ms) permaneçam destacadas
      // por no mínimo 130ms (pelo menos 4 frames a 30fps) para registro nítido na visão do usuário
      const rawWordDur = activeWord.endMs - activeWord.startMs;
      const minActiveMs = Math.max(130, rawWordDur);

      let targetEndMs;
      if (nextWordInChunk) {
        // Se há próxima palavra no chunk, estende até o início dela ou garante duração mínima
        targetEndMs = Math.max(activeWord.startMs + minActiveMs, nextWordInChunk.startMs);
      } else {
        // Se é a última palavra do chunk, mantém na tela até o fim do chunk ou até o início do próximo chunk (máx 350ms)
        const gapToNextChunk = nextChunk ? Math.min(350, Math.max(0, nextChunk.startMs - chunk.endMs)) : 0;
        targetEndMs = Math.max(activeWord.startMs + minActiveMs, chunk.endMs + gapToNextChunk);
      }

      const endStr = formatAssTime(Math.max(activeWord.endMs, targetEndMs));

      // Monta o texto do chunk destacando a palavra ativa com cores vibrantes e animação pop
      const formattedChunk = chunk.words
        .map((w, idx) => {
          const upper = w.word.toUpperCase();
          if (idx === i) {
            // Palavra ativa: Cor vibrante + Efeito Spring Pop punchy
            if (popAnimation) {
              return `{\\1c${inlineActive}\\t(0,80,\\fscx${pScale}\\fscy${pScale})\\t(80,180,\\fscx106\\fscy106)}${upper}{\\r}`;
            }
            return `{\\1c${inlineActive}\\fscx112\\fscy112}${upper}{\\r}`;
          }
          // Palavras inativas do chunk em branco nítido
          return `{\\1c${inlinePrimary}\\fscx100\\fscy100}${upper}{\\r}`;
        })
        .join(' ');

      eventLines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${formattedChunk}`);
    }
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
 * Gera arquivo de legenda tradicional .srt
 */
export function generateSrtSubtitles({ wordBoundaries, outputSrtPath, wordsPerChunk = 4 }) {
  const chunks = groupWordsIntoChunks(wordBoundaries, wordsPerChunk);
  const srtBlocks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const text = chunk.words.map(w => w.word.toUpperCase()).join(' ');
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
