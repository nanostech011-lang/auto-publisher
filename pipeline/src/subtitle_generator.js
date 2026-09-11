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
 * Agrupa palavras individuais em blocos curtos de 3 a 5 palavras para exibicao dinamica vertical.
 */
export function groupWordsIntoChunks(wordBoundaries, wordsPerChunk = 4) {
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

/**
 * Gera arquivo de legenda Advanced SubStation Alpha (.ass) com estilo karaokê animado
 */
export function generateAssSubtitles({
  wordBoundaries,
  outputAssPath,
  fontName = 'Arial',
  fontSize = 65,
  primaryColor = '&H00FFFFFF',     // Branco
  activeWordColor = '&H0000D7FF',  // Dourado / Amarelo Ouro
  outlineColor = '&H00000000',     // Preto
  outlineWidth = 4,
  shadowWidth = 2,
  marginV = 380                    // Safe zone otimizada para Shorts/Reels/TikTok (acima dos botões e descrição)
}) {
  const chunks = groupWordsIntoChunks(wordBoundaries, 4);

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
Style: Default,${fontName},${fontSize},${primaryColor},${activeWordColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,${outlineWidth},${shadowWidth},2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const eventLines = [];

  for (const chunk of chunks) {
    // Para cada palavra ativa dentro do chunk, gera uma linha no .ass
    for (let i = 0; i < chunk.words.length; i++) {
      const activeWord = chunk.words[i];
      const nextWord = chunk.words[i + 1];

      const startStr = formatAssTime(activeWord.startMs);
      // Previne flicker na tela: estende o evento até o início da próxima palavra ou até o fim do chunk
      const effectiveEndMs = nextWord ? nextWord.startMs : chunk.endMs;
      const endStr = formatAssTime(Math.max(activeWord.endMs, effectiveEndMs));

      // Monta o texto do chunk destacando a palavra ativa em maiusculo
      const formattedChunk = chunk.words
        .map((w, idx) => {
          const upper = w.word.toUpperCase();
          if (idx === i) {
            // Palavra ativa: Cor de destaque + leve aumento de escala
            return `{\\c${activeWordColor}\\fscx108\\fscy108}${upper}{\\r}`;
          }
          return `{\\c${primaryColor}}${upper}{\\r}`;
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
