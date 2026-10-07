import fs from 'fs';
import path from 'path';
import ffmpeg from './ffmpeg_env.js';
import { synthesizeVoiceWithTimestamps } from './voice_synthesizer.js';

/**
 * Higieniza o texto da transcrição preservando rigorosamente a acentuação em Português (PT-BR)
 * e decodificando entidades HTML/numéricas comuns do YouTube (ex: &atilde;, &#39;, &eacute;)
 */
export function cleanPtBrTranscriptText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&aacute;/gi, 'á')
    .replace(/&agrave;/gi, 'à')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&acirc;/gi, 'â')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&iacute;/gi, 'í')
    .replace(/&icirc;/gi, 'î')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Agrave;/g, 'À')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&Acirc;/g, 'Â')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Ecirc;/g, 'Ê')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&Ocirc;/g, 'Ô')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta e repara corrupções de codificação UTF-8 / Mojibake comuns em PT-BR
 */
export function repairMojibake(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\u00c3\u00a1/g, 'á')
    .replace(/\u00c3\u00a0/g, 'à')
    .replace(/\u00c3\u00a2/g, 'â')
    .replace(/\u00c3\u00a3/g, 'ã')
    .replace(/\u00c3\u00a9/g, 'é')
    .replace(/\u00c3\u00aa/g, 'ê')
    .replace(/\u00c3\u00ad/g, 'í')
    .replace(/\u00c3\u00b3/g, 'ó')
    .replace(/\u00c3\u00b4/g, 'ô')
    .replace(/\u00c3\u00b5/g, 'õ')
    .replace(/\u00c3\u00ba/g, 'ú')
    .replace(/\u00c3\u00a7/g, 'ç')
    .replace(/\u00c3\u0081/g, 'Á')
    .replace(/\u00c3\u0080/g, 'À')
    .replace(/\u00c3\u0082/g, 'Â')
    .replace(/\u00c3\u0083/g, 'Ã')
    .replace(/\u00c3\u0089/g, 'É')
    .replace(/\u00c3\u008a/g, 'Ê')
    .replace(/\u00c3\u008d/g, 'Í')
    .replace(/\u00c3\u0093/g, 'Ó')
    .replace(/\u00c3\u0094/g, 'Ô')
    .replace(/\u00c3\u0095/g, 'Õ')
    .replace(/\u00c3\u009a/g, 'Ú')
    .replace(/\u00c3\u0087/g, 'Ç');
}

/**
 * Expande abreviações e símbolos informais para leitura natural em voz alta
 */
export function expandPtBrAbbreviations(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\bvc\b/gi, (m) => m[0] === 'V' ? 'Você' : 'você')
    .replace(/\bvcs\b/gi, (m) => m[0] === 'V' ? 'Vocês' : 'vocês')
    .replace(/\bpq\b/gi, (m) => m[0] === 'P' ? 'Porque' : 'porque')
    .replace(/\b(tb|tbm)\b/gi, (m) => m[0] === 'T' ? 'Também' : 'também')
    .replace(/\bmsm\b/gi, (m) => m[0] === 'M' ? 'Mesmo' : 'mesmo')
    .replace(/\bpra\b/gi, 'para')
    .replace(/\bpro\b/gi, 'para o')
    .replace(/\bpras\b/gi, 'para as')
    .replace(/\bpros\b/gi, 'para os')
    .replace(/(\d+)\s*%/g, '$1 por cento')
    .replace(/%/g, ' por cento ')
    .replace(/\s*&\s*/g, ' e ')
    .replace(/\bn[º°]\s*(\d+)/gi, 'número $1')
    .replace(/\bn[º°]\b/gi, 'número')
    .replace(/R\$\s*(\d+)/g, '$1 reais')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Insere vírgulas antes de conjunções adversativas e causais quando ausentes
 * preservando '?', '!', reticências '...' e travessões '—' para entonação expressiva
 */
export function insertProsodicPunctuation(text) {
  if (!text || typeof text !== 'string') return '';

  // Conjunções que demandam micropausa respiratória em PT-BR
  const conjunctions = ['mas', 'porém', 'porque', 'contudo', 'todavia', 'no entanto'];
  const pattern = new RegExp(`([^,\\.?!;:\\—\\-\\s]+)\\s+(${conjunctions.join('|')})\\b`, 'gi');

  return text.replace(pattern, (match, word, conj) => {
    // Evita duplicar se já havia pontuação
    return `${word}, ${conj}`;
  });
}

/**
 * Limita a taxa de locução base do canal ao intervalo aceitável [-6%, +4%] (Decisão D6)
 */
export function clampRate(rateStr, defaultRate = '+0%') {
  if (!rateStr || typeof rateStr !== 'string') return defaultRate;
  const match = rateStr.match(/([+-]?\d+)/);
  if (!match) return defaultRate;
  const num = parseInt(match[1], 10);
  const clamped = Math.max(-6, Math.min(4, num));
  return `${clamped >= 0 ? '+' : ''}${clamped}%`;
}

/**
 * Calcula a taxa específica para cada tipo de bloco com base na taxa base clamped
 * gancho +3 p.p., ciência 0, hack -2 p.p., CTA +1 p.p.
 */
export function getBlockRate(baseRateStr, blockType = 'science') {
  const clamped = clampRate(baseRateStr, '+0%');
  const baseNum = parseInt(clamped.match(/([+-]?\d+)/)[1], 10);

  let delta = 0;
  switch (blockType) {
    case 'hook':
      delta = 3;
      break;
    case 'science':
    case 'body':
      delta = 0;
      break;
    case 'hack':
      delta = -2;
      break;
    case 'cta':
      delta = 1;
      break;
    default:
      delta = 0;
  }

  // Teto global mantido em [-6%, +4%]
  const finalNum = Math.max(-6, Math.min(4, baseNum + delta));
  return `${finalNum >= 0 ? '+' : ''}${finalNum}%`;
}

/**
 * Pipeline principal de enriquecimento prosódico para PT-BR
 */
export function enhancePtBrProsody(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. Decodifica entidades HTML e limpa espaços
  let processed = cleanPtBrTranscriptText(text);

  // 2. Corrige mojibake
  processed = repairMojibake(processed);

  // 3. Normalização Unicode canônica NFC
  processed = processed.normalize('NFC');

  // 4. Expansão de abreviações e símbolos
  processed = expandPtBrAbbreviations(processed);

  // 5. Inserção de pontuação prosódica para pausas respiratórias humanas
  processed = insertProsodicPunctuation(processed);

  return processed;
}

/**
 * Divide o texto do roteiro em segmentos para síntese segmentada com pausas controladas
 */
export function segmentForSynthesis(text, blocks = null) {
  if (!text || typeof text !== 'string') return [];

  if (blocks && typeof blocks === 'object') {
    const segments = [];
    const blockTypes = ['hook', 'science', 'hack', 'cta'];
    for (const bType of blockTypes) {
      const bText = blocks[bType] || blocks[`${bType}Text`];
      if (bText && typeof bText === 'string' && bText.trim().length > 0) {
        segments.push({
          blockType: bType,
          text: enhancePtBrProsody(bText.trim()),
          pauseAfterMs: 400 // 400ms exatos entre blocos conceituais
        });
      }
    }
    if (segments.length > 0) return segments;
  }

  // Fallback: divide por parágrafos ou frases fortes se não houver blocos explícitos
  const rawParagraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
  if (rawParagraphs.length > 1) {
    return rawParagraphs.map((p, idx) => ({
      blockType: idx === 0 ? 'hook' : (idx === rawParagraphs.length - 1 ? 'cta' : 'body'),
      text: enhancePtBrProsody(p),
      pauseAfterMs: 400
    }));
  }

  // Se for texto corrido único, divide por orações delimitadas por pontuação forte
  const sentenceMatches = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
  return sentenceMatches
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map((s, idx) => ({
      blockType: idx === 0 ? 'hook' : (idx === sentenceMatches.length - 1 ? 'cta' : 'body'),
      text: enhancePtBrProsody(s),
      pauseAfterMs: 250 // 250ms entre frases regulares
    }));
}

/**
 * Síntese segmentada com pausas exatas e recalculo de wordBoundaries acumulados
 */
export async function synthesizeSegmentedVoiceWithTimestamps({
  text,
  voice = 'pt-BR-AntonioNeural',
  baseRate = '+0%',
  pitch = '+0Hz',
  outputAudioPath,
  scratchDir,
  blocks = null
}) {
  const segments = segmentForSynthesis(text, blocks);
  if (segments.length <= 1) {
    // Texto simples ou único bloco: sintetiza diretamente com rate seguro
    const safeRate = clampRate(baseRate, '+0%');
    return synthesizeVoiceWithTimestamps({
      text: enhancePtBrProsody(text),
      voice,
      rate: safeRate,
      pitch,
      outputAudioPath
    });
  }

  const workDir = scratchDir || path.dirname(outputAudioPath);
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  const segmentAudioFiles = [];
  const combinedWordBoundaries = [];
  let accumulatedOffsetMs = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segAudioPath = path.join(workDir, `tts_seg_${i + 1}.mp3`);
    const segRate = getBlockRate(baseRate, seg.blockType);

    const result = await synthesizeVoiceWithTimestamps({
      text: seg.text,
      voice,
      rate: segRate,
      pitch,
      outputAudioPath: segAudioPath
    });

    // Desloca os wordBoundaries pelo offset acumulado
    for (const wb of result.wordBoundaries) {
      combinedWordBoundaries.push({
        word: wb.word,
        startMs: wb.startMs + accumulatedOffsetMs,
        endMs: wb.endMs + accumulatedOffsetMs,
        durationMs: wb.durationMs
      });
    }

    segmentAudioFiles.push({
      path: segAudioPath,
      durationMs: result.durationMs,
      pauseAfterMs: (i === segments.length - 1) ? 0 : seg.pauseAfterMs
    });

    accumulatedOffsetMs += result.durationMs + ((i === segments.length - 1) ? 0 : seg.pauseAfterMs);
  }

  // Gera o áudio concatenado final com os silêncios exatos usando FFmpeg
  await concatenateAudioSegmentsWithSilence({
    segments: segmentAudioFiles,
    outputPath: outputAudioPath,
    workDir
  });

  const stats = fs.statSync(outputAudioPath);
  const totalDurationSeconds = Number((accumulatedOffsetMs / 1000).toFixed(2));

  return {
    audioPath: outputAudioPath,
    fileSizeBytes: stats.size,
    durationMs: accumulatedOffsetMs,
    durationSeconds: totalDurationSeconds,
    wordBoundaries: combinedWordBoundaries
  };
}

/**
 * Concatena trechos de áudio inserindo pausas de silêncio exatas entre eles
 */
function concatenateAudioSegmentsWithSilence({ segments, outputPath, workDir }) {
  return new Promise((resolve, reject) => {
    // Cria arquivos de silêncio de 250ms e 400ms se necessários
    const silence250 = path.join(workDir, 'silence_250ms.mp3');
    const silence400 = path.join(workDir, 'silence_400ms.mp3');

    const ensureSilence = (silencePath, durationSec) => {
      if (fs.existsSync(silencePath)) return Promise.resolve();
      return new Promise((res, rej) => {
        ffmpeg()
          .input('anullsrc=r=24000:cl=mono')
          .inputFormat('lavfi')
          .outputOptions([`-t ${durationSec}`, '-c:a libmp3lame', '-b:a 96k'])
          .output(silencePath)
          .on('end', () => res())
          .on('error', err => rej(err))
          .run();
      });
    };

    Promise.all([
      ensureSilence(silence250, 0.25),
      ensureSilence(silence400, 0.40)
    ]).then(() => {
      // Monta concat list para o demuxer concat do FFmpeg
      const concatListLines = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        concatListLines.push(`file '${seg.path.replace(/\\/g, '/')}'`);
        if (seg.pauseAfterMs >= 350) {
          concatListLines.push(`file '${silence400.replace(/\\/g, '/')}'`);
        } else if (seg.pauseAfterMs > 0) {
          concatListLines.push(`file '${silence250.replace(/\\/g, '/')}'`);
        }
      }

      const concatListPath = path.join(workDir, 'tts_concat_list.txt');
      fs.writeFileSync(concatListPath, concatListLines.join('\n'), 'utf8');

      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', err => {
          // Se falhar o "-c copy", tenta reencodando
          ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c:a libmp3lame', '-b:a 96k'])
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .run();
        })
        .run();
    }).catch(reject);
  });
}
