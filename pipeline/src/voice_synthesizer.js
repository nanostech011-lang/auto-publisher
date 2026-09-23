import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';
import ffmpeg from './ffmpeg_env.js';

function xmlEscape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sintetizador de voz neural Edge-TTS com extracao de word boundaries (timestamps por palavra).
 * Custo R$ 0,00 e qualidade humana para portugues do Brasil.
 */
export async function synthesizeVoiceWithTimestamps({
  text,
  voice = 'pt-BR-AntonioNeural',
  rate = '+5%',
  pitch = '-2Hz',
  outputAudioPath
}) {
  if (!text || !text.trim()) {
    throw new Error('Texto para sintese de voz nao pode ser vazio.');
  }

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
  const safeText = xmlEscape(text);

  return new Promise((resolve, reject) => {
    const { audioStream, metadataStream } = tts.toStream(safeText, {
      rate: rate,
      pitch: pitch
    });

    const fileWriteStream = fs.createWriteStream(outputAudioPath);

    audioStream.pipe(fileWriteStream);

    if (metadataStream) {
      metadataStream.on('data', chunk => {
        try {
          const str = chunk.toString('utf8');
          // Formato do metadata do Edge TTS contem JSON em linhas ou blocos
          const lines = str.split('\r\n');
          for (const line of lines) {
            if (line.startsWith('{') && line.endsWith('}')) {
              const parsed = JSON.parse(line);
              if (parsed.Metadata) {
                for (const meta of parsed.Metadata) {
                  if (meta.Type === 'WordBoundary') {
                    // Data.Offset e Data.Duration estao em centenas de nanosegundos (ticks de 100ns)
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
          // parse silencioso de chunks intermediarios
        }
      });
    }

    fileWriteStream.on('finish', () => {
      tts.close();
      const stats = fs.statSync(outputAudioPath);

      // Medição exata da duração através de ffprobe, evitando desvio de sincronia
      ffmpeg.ffprobe(outputAudioPath, (err, metadata) => {
        let durationMs = 0;
        if (!err && metadata?.format?.duration) {
          durationMs = Math.round(metadata.format.duration * 1000);
        } else if (wordBoundaries.length > 0) {
          durationMs = wordBoundaries[wordBoundaries.length - 1].endMs + 300;
        } else {
          durationMs = Math.round((stats.size / 12000) * 1000);
        }

        resolve({
          audioPath: outputAudioPath,
          fileSizeBytes: stats.size,
          durationMs: durationMs,
          durationSeconds: Number((durationMs / 1000).toFixed(2)),
          wordBoundaries: wordBoundaries
        });
      });
    });

    audioStream.on('error', err => {
      tts.close();
      reject(err);
    });

    fileWriteStream.on('error', err => {
      tts.close();
      reject(err);
    });
  });
}
