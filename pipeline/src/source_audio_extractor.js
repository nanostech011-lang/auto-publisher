import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import ffmpeg, { ffmpegBinary } from './ffmpeg_env.js';

/**
 * Verifica se o reaproveitamento de áudio de fonte externa (YouTube/TikTok) está expressamente habilitado.
 * Por padrão, opera em FAIL-CLOSED (false) para proteção de direitos autorais e conformidade com monetização.
 */
export function isSourceAudioAllowed() {
  return process.env.ENABLE_SOURCE_AUDIO === 'true';
}

/**
 * Extrai e normaliza o áudio original de uma fonte de mídia externa.
 * 
 * @param {string} sourceUrl URL do vídeo de origem
 * @param {string} outputAudioPath Caminho de saída do arquivo MP3/WAV normalizado
 * @param {Object} [options] Opções de extração e loudness
 * @returns {Promise<{ audioPath: string, durationSeconds: number, sourceUrl: string }>}
 */
export async function extractSourceAudio(sourceUrl, outputAudioPath, options = {}) {
  if (!isSourceAudioAllowed()) {
    throw new Error(
      'Reaproveitamento de áudio original está desativado por padrão (ENABLE_SOURCE_AUDIO=false). ' +
      'Para conformidade estrita com monetização e direitos autorais, ative expressamente via .env.'
    );
  }

  if (!sourceUrl || typeof sourceUrl !== 'string' || !sourceUrl.trim()) {
    throw new Error('URL de origem inválida para extração de áudio.');
  }

  const outDir = path.dirname(outputAudioPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const targetLufs = options.targetLufs ?? -14.0;

  // Se o arquivo já for um caminho local existente
  if (fs.existsSync(sourceUrl)) {
    return new Promise((resolve, reject) => {
      ffmpeg(sourceUrl)
        .audioChannels(2)
        .audioFrequency(48000)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .audioFilters([`loudnorm=I=${targetLufs}:TP=-1.5:LRA=9:linear=true`])
        .output(outputAudioPath)
        .on('end', () => {
          ffmpeg.ffprobe(outputAudioPath, (err, meta) => {
            const dur = (!err && meta?.format?.duration) ? Number(meta.format.duration.toFixed(2)) : 0;
            resolve({ audioPath: outputAudioPath, durationSeconds: dur, sourceUrl });
          });
        })
        .on('error', reject)
        .run();
    });
  }

  // Tentativa via yt-dlp para extrair fluxo de áudio de URL web
  return new Promise((resolve, reject) => {
    const ytDlpCmd = process.env.YTDLP_PATH || 'yt-dlp';
    const tempRawAudio = `${outputAudioPath}.raw.mp3`;

    const args = [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', tempRawAudio,
      '--no-playlist',
      '--max-filesize', '50M',
      sourceUrl
    ];

    execFile(ytDlpCmd, args, { timeout: 60000 }, (ytdlErr) => {
      if (ytdlErr) {
        // Fallback: se yt-dlp não estiver no PATH, tenta passar a URL diretamente ao FFmpeg
        console.warn(`[Source Audio] yt-dlp indisponível ou falhou (${ytdlErr.message}). Tentando conexão direta FFmpeg...`);
        ffmpeg(sourceUrl)
          .audioChannels(2)
          .audioFrequency(48000)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .audioFilters([`loudnorm=I=${targetLufs}:TP=-1.5:LRA=9:linear=true`])
          .output(outputAudioPath)
          .on('end', () => {
            ffmpeg.ffprobe(outputAudioPath, (err, meta) => {
              const dur = (!err && meta?.format?.duration) ? Number(meta.format.duration.toFixed(2)) : 0;
              resolve({ audioPath: outputAudioPath, durationSeconds: dur, sourceUrl });
            });
          })
          .on('error', (ffmpegErr) => {
            reject(new Error(`Falha ao extrair áudio da URL: ${ffmpegErr.message}`));
          })
          .run();
        return;
      }

      // Normaliza o áudio baixado pelo yt-dlp com EBU R128
      ffmpeg(tempRawAudio)
        .audioChannels(2)
        .audioFrequency(48000)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .audioFilters([`loudnorm=I=${targetLufs}:TP=-1.5:LRA=9:linear=true`])
        .output(outputAudioPath)
        .on('end', () => {
          try { if (fs.existsSync(tempRawAudio)) fs.unlinkSync(tempRawAudio); } catch (e) {}
          ffmpeg.ffprobe(outputAudioPath, (err, meta) => {
            const dur = (!err && meta?.format?.duration) ? Number(meta.format.duration.toFixed(2)) : 0;
            resolve({ audioPath: outputAudioPath, durationSeconds: dur, sourceUrl });
          });
        })
        .on('error', (normErr) => {
          try { if (fs.existsSync(tempRawAudio)) fs.unlinkSync(tempRawAudio); } catch (e) {}
          reject(normErr);
        })
        .run();
    });
  });
}
