import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';
import ffmpeg from './ffmpeg_env.js';

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

    const safeReject = (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutTimer);
        try { tts.close(); } catch (ignored) {}
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
 * Sintetizador de voz neural Edge-TTS com extração de word boundaries e retentativas automáticas.
 * Custo R$ 0,00 e resiliência a oscilações temporárias de WebSocket.
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

  throw lastError;
}
