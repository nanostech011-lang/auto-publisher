import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';
import https from 'https';
import ffmpeg from './ffmpeg_env.js';
import { estimateWordBoundaries } from './timing_estimator.js';

function sanitizeTtsText(str) {
  if (!str) return '';
  return String(str)
    // Remove caracteres de controle que quebram o parser SSML XML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Fallback resiliente: síntese direta em arquivo (sem metadados de boundary no WebSocket).
 * Evita que a Microsoft encerre o socket prematuramente em textos extensos.
 */
async function _synthesizeDirectToFile({ text, voice, outputAudioPath }) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const dir = path.dirname(outputAudioPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const safeText = sanitizeTtsText(text);
  const tempDir = path.join(dir, `tts_tmp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const res = await tts.toFile(tempDir, safeText);

  if (!res.audioFilePath || !fs.existsSync(res.audioFilePath)) {
    throw new Error('Falha ao gerar arquivo de áudio via Edge-TTS toFile.');
  }

  if (fs.existsSync(outputAudioPath)) {
    try { fs.unlinkSync(outputAudioPath); } catch (ignored) {}
  }
  fs.renameSync(res.audioFilePath, outputAudioPath);

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (ignored) {}

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(outputAudioPath, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
        return reject(new Error('Falha ao inspecionar áudio gerado pelo Edge-TTS: ' + (err?.message || 'duração ausente')));
      }

      const durSec = metadata.format.duration;
      const durationMs = Math.round(durSec * 1000);
      const stats = fs.statSync(outputAudioPath);

      const boundaries = estimateWordBoundaries(text, durSec).map(wb => ({
        word: wb.word,
        startMs: Math.round(wb.start * 1000),
        endMs: Math.round(wb.end * 1000),
        durationMs: Math.round((wb.end - wb.start) * 1000)
      }));

      resolve({
        audioPath: outputAudioPath,
        fileSizeBytes: stats.size,
        durationMs: durationMs,
        durationSeconds: Number(durSec.toFixed(2)),
        wordBoundaries: boundaries
      });
    });
  });
}

async function _synthesizeSingleAttempt({
  text,
  voice,
  rate,
  pitch,
  outputAudioPath
}) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    wordBoundaryEnabled: true,
    sentenceBoundaryEnabled: true
  });

  const dir = path.dirname(outputAudioPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const wordBoundaries = [];
  const safeText = sanitizeTtsText(text);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { tts.close(); } catch (ignored) {}
        try { if (fs.existsSync(outputAudioPath)) fs.unlinkSync(outputAudioPath); } catch (ignored) {}
        reject(new Error('Timeout de 35s excedido na síntese de áudio Edge-TTS.'));
      }
    }, 35000);

    const safeReject = async (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutTimer);
        try { tts.close(); } catch (ignored) {}

        // Se o WebSocket encerrou prematuramente, mas o arquivo já tem tamanho substancial (>= 8KB),
        // valida o áudio existente antes de descartar!
        if (fs.existsSync(outputAudioPath)) {
          const stats = fs.statSync(outputAudioPath);
          if (stats.size >= 8192) {
            try {
              const probeRes = await new Promise((resProbe, rejProbe) => {
                ffmpeg.ffprobe(outputAudioPath, (probeErr, meta) => {
                  if (!probeErr && meta?.format?.duration && meta.format.duration >= 3.0) {
                    resProbe(meta.format.duration);
                  } else {
                    rejProbe(probeErr || new Error('Duração insuficiente'));
                  }
                });
              });

              const durMs = Math.round(probeRes * 1000);
              const boundaries = wordBoundaries.length >= 5 ? wordBoundaries : estimateWordBoundaries(text, probeRes).map(wb => ({
                word: wb.word,
                startMs: Math.round(wb.start * 1000),
                endMs: Math.round(wb.end * 1000),
                durationMs: Math.round((wb.end - wb.start) * 1000)
              }));

              return resolve({
                audioPath: outputAudioPath,
                fileSizeBytes: stats.size,
                durationMs: durMs,
                durationSeconds: Number(probeRes.toFixed(2)),
                wordBoundaries: boundaries
              });
            } catch (recoveryErr) {
              // segue para rejeição e fallback para toFile
            }
          }
        }

        try { if (fs.existsSync(outputAudioPath)) fs.unlinkSync(outputAudioPath); } catch (ignored) {}
        reject(err);
      }
    };

    const safeResolve = (val) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutTimer);
        resolve(val);
      }
    };

    let audioStream;
    let metadataStream;

    try {
      const streams = tts.toStream(safeText, {
        rate: rate,
        pitch: pitch
      });
      audioStream = streams.audioStream;
      metadataStream = streams.metadataStream;
    } catch (err) {
      return safeReject(err);
    }

    const fileWriteStream = fs.createWriteStream(outputAudioPath);

    audioStream.pipe(fileWriteStream);

    if (metadataStream) {
      metadataStream.on('data', chunk => {
        try {
          const str = chunk.toString('utf8');
          const lines = str.split('\r\n');
          for (const line of lines) {
            if (line.startsWith('{') && line.endsWith('}')) {
              const parsed = JSON.parse(line);
              if (parsed.Metadata) {
                for (const meta of parsed.Metadata) {
                  if (meta.Type === 'WordBoundary') {
                    const offsetTicks = meta.Data.Offset;
                    const durationTicks = meta.Data.Duration;
                    const textWord = meta.Data.text ? meta.Data.text.Text : '';

                    const startMs = Math.round(offsetTicks / 10000);
                    const durationMs = Math.round(durationTicks / 10000);

                    wordBoundaries.push({
                      word: textWord,
                      startMs: startMs,
                      endMs: startMs + durationMs,
                      durationMs: durationMs
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          // parse silencioso de chunks intermediários
        }
      });
    }

    fileWriteStream.on('finish', () => {
      try { tts.close(); } catch (ignored) {}
      if (!fs.existsSync(outputAudioPath)) {
        return safeReject(new Error('Arquivo de áudio não foi gerado pelo Edge-TTS.'));
      }
      const stats = fs.statSync(outputAudioPath);

      if (stats.size < 2048) {
        return safeReject(new Error(`Arquivo de áudio Edge-TTS gerado com tamanho anômalo (${stats.size} bytes).`));
      }

      ffmpeg.ffprobe(outputAudioPath, (err, metadata) => {
        let durationMs = 0;
        if (!err && metadata?.format?.duration) {
          durationMs = Math.round(metadata.format.duration * 1000);
        } else if (wordBoundaries.length > 0) {
          durationMs = wordBoundaries[wordBoundaries.length - 1].endMs + 300;
        } else {
          durationMs = Math.round((stats.size / 12000) * 1000);
        }

        safeResolve({
          audioPath: outputAudioPath,
          fileSizeBytes: stats.size,
          durationMs: durationMs,
          durationSeconds: Number((durationMs / 1000).toFixed(2)),
          wordBoundaries: wordBoundaries
        });
      });
    });

    audioStream.on('error', safeReject);
    fileWriteStream.on('error', safeReject);
  });
}

/**
 * Fallback de contingência absoluta (Tier 4): síntese via Google Translate TTS (HTTPS direto).
 * Custo R$ 0,00, sem WebSocket, sem chave, imune a desconexões e throttling do Edge-TTS.
 */
async function _synthesizeWithGoogleTtsFallback({ text, outputAudioPath }) {
  console.log('[Voice Synthesizer] 🌐 Acionando motor de voz de contingência HTTPS (Google TTS)...');
  const dir = path.dirname(outputAudioPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Divide o texto em fragmentos <= 140 caracteres respeitando pontuação
  const sentences = text.match(/[^.!?;\n]+[.!?;\n]+|[^.!?;\n]+$/g) || [text];
  const chunks = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length <= 140) {
      chunks.push(trimmed);
    } else {
      const parts = trimmed.match(/.{1,135}(\s|$)/g) || [trimmed];
      for (const p of parts) {
        if (p.trim()) chunks.push(p.trim());
      }
    }
  }

  const outStream = fs.createWriteStream(outputAudioPath);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=' + encodeURIComponent(chunk);
    await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Google TTS retornou status HTTP ${res.statusCode}`));
        }
        res.pipe(outStream, { end: false });
        res.on('end', resolve);
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  outStream.end();
  await new Promise((resolve) => outStream.on('finish', resolve));

  const stats = fs.statSync(outputAudioPath);
  if (stats.size < 2048) {
    throw new Error(`Áudio gerado pelo Google TTS muito pequeno: ${stats.size} bytes`);
  }

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(outputAudioPath, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
        return reject(new Error('Falha ao inspecionar áudio gerado pelo Google TTS: ' + (err?.message || 'duração ausente')));
      }

      const durSec = metadata.format.duration;
      const durationMs = Math.round(durSec * 1000);

      const boundaries = estimateWordBoundaries(text, durSec).map(wb => ({
        word: wb.word,
        startMs: Math.round(wb.start * 1000),
        endMs: Math.round(wb.end * 1000),
        durationMs: Math.round((wb.end - wb.start) * 1000)
      }));

      console.log(`[Voice Synthesizer] ✅ Áudio gerado com sucesso via motor de contingência (${durSec.toFixed(2)}s, ${boundaries.length} palavras mapeadas)!`);

      resolve({
        audioPath: outputAudioPath,
        fileSizeBytes: stats.size,
        durationMs: durationMs,
        durationSeconds: Number(durSec.toFixed(2)),
        wordBoundaries: boundaries
      });
    });
  });
}

/**
 * Sintetizador de voz neural Edge-TTS com extração de word boundaries e retentativas automáticas.
 * Custo R$ 0,00 e arquitetura resiliente em 4 camadas (Tier 1: Streaming, Tier 2: toFile, Tier 3: Alt Voice, Tier 4: Google TTS).
 */
export async function synthesizeVoiceWithTimestamps({
  text,
  voice = 'pt-BR-AntonioNeural',
  rate = '+5%',
  pitch = '-2Hz',
  outputAudioPath,
  maxRetries = 3
}) {
  if (!text || !text.trim()) {
    throw new Error('Texto para síntese de voz não pode ser vazio.');
  }

  let lastError = null;

  // Tier 1: Síntese com WebSocket e captura de WordBoundaries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await _synthesizeSingleAttempt({
        text,
        voice,
        rate,
        pitch,
        outputAudioPath
      });
    } catch (err) {
      lastError = err;
      console.warn(`[Voice Synthesizer] ⚠️ Tentativa ${attempt}/${maxRetries} falhou: ${err.message}.${attempt < maxRetries ? ' Nova tentativa em ' + (attempt * 1.5) + 's...' : ''}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
  }

  // Tier 2: Síntese direta estável (toFile)
  console.log('[Voice Synthesizer] 🛡️ Acionando síntese direta estável (toFile) como fallback de resiliência...');
  try {
    return await _synthesizeDirectToFile({
      text,
      voice,
      outputAudioPath
    });
  } catch (directErr) {
    console.warn('[Voice Synthesizer] ⚠️ Falha no fallback toFile:', directErr.message);
  }

  // Tier 3: Rotação para voz neural alternativa caso a voz principal esteja temporariamente congestionada
  const altVoices = ['pt-BR-FranciscaNeural', 'pt-BR-ThalitaNeural', 'pt-BR-AntonioNeural'].filter(v => v !== voice);
  for (const altVoice of altVoices.slice(0, 1)) {
    console.log(`[Voice Synthesizer] 🔄 Alternando para voz neural de contingência: ${altVoice}...`);
    try {
      await new Promise(r => setTimeout(r, 1000));
      return await _synthesizeSingleAttempt({
        text,
        voice: altVoice,
        rate,
        pitch,
        outputAudioPath
      });
    } catch (altErr) {
      console.warn(`[Voice Synthesizer] ⚠️ Voz alternativa ${altVoice} também falhou: ${altErr.message}`);
    }
  }

  // Tier 4: Fallback de contingência absoluta via Google Translate TTS (HTTPS direto, sem WebSocket)
  try {
    return await _synthesizeWithGoogleTtsFallback({
      text,
      outputAudioPath
    });
  } catch (gTtsErr) {
    console.error('[Voice Synthesizer] ❌ Falha também no motor de contingência:', gTtsErr.message);
    throw lastError || gTtsErr;
  }
}
