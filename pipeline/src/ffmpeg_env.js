import fs from 'fs';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';

export const ffmpegBinary = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegInstaller.path);
export const ffprobeBinary = process.env.FFPROBE_PATH || (fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegBinary);
ffmpeg.setFfprobePath(ffprobeBinary);

/**
 * Perfil de baixo consumo de memória para FFmpeg/libx264.
 *
 * Sem limite explícito, o libx264 cria ~1.5 threads por núcleo (24 em uma máquina de 16 núcleos),
 * cada uma com buffers de lookahead 1080x1920. Medição no contêiner (cgroup 512MB):
 *   - threads auto (padrão):                   pico de 478MB por take -> SIGKILL (OOM killer)
 *   - threads=2 + rc-lookahead=5 + filter=1:   pico de ~209MB por take
 *
 * Ajustável via env FFMPEG_THREADS (padrão 2).
 */
export const FFMPEG_THREADS = Math.max(1, parseInt(process.env.FFMPEG_THREADS || '2', 10) || 2);

/** Opções de entrada (decoder) para clipes de vídeo — limita threads de decodificação de fontes 4K. */
export const LOW_MEMORY_DECODE_OPTS = [`-threads ${FFMPEG_THREADS}`];

/** Opções de saída para encodes libx264 via fluent-ffmpeg (.outputOptions). */
export const LOW_MEMORY_X264_OPTS = [
  `-threads ${FFMPEG_THREADS}`,
  '-filter_threads 1',
  '-filter_complex_threads 1',
  '-x264-params rc-lookahead=5:sync-lookahead=0'
];

/** Mesmas opções em formato de argv para chamadas diretas via execFile. */
export const LOW_MEMORY_X264_ARGS = [
  '-threads', String(FFMPEG_THREADS),
  '-filter_threads', '1',
  '-filter_complex_threads', '1',
  '-x264-params', 'rc-lookahead=5:sync-lookahead=0'
];

export default ffmpeg;
