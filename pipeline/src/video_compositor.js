import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Monta o video final completo com cortes, audio de locucao, trilha dark e legendas dinamicas queimadas
 */
export async function composeFinalVideo({
  videoClips,
  audioPath,
  subtitlesAssPath,
  outputVideoPath,
  totalDurationSeconds,
  bgMusicPath = null
}) {
  const dir = path.dirname(outputVideoPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Cria arquivo de lista de concatenacao para o FFmpeg
  const scratchDir = path.dirname(audioPath);
  const concatListPath = path.join(scratchDir, 'concat_list.txt');
  const concatContent = videoClips.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent, 'utf8');

  // Ajusta o caminho do arquivo .ass para formato compativel com filtro FFmpeg no Windows
  // No Windows, filtros do FFmpeg exigem barras invertidas escapadas ou barras normais com dois pontos escapados
  const escapedAssPath = subtitlesAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');

  return new Promise((resolve, reject) => {
    // Comando FFmpeg:
    // Input 0: Concatenacao dos clips de video
    // Input 1: Audio da locucao
    // Filtro de video: queima a legenda .ass
    // Audio: locucao + mixagem ou repasse direto em AAC

    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0'])
      .input(audioPath);

    const complexFilters = [
      `[0:v]subtitles='${escapedAssPath}'[v_out]`
    ];

    command
      .complexFilter(complexFilters)
      .outputOptions([
        '-map [v_out]',
        '-map 1:a',
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast',
        '-b:v 4500k',
        '-c:a aac',
        '-b:a 192k',
        `-t ${totalDurationSeconds}`,
        '-movflags +faststart'
      ])
      .output(outputVideoPath)
      .on('start', cmdLine => {
        console.log('Iniciando renderizacao com FFmpeg...');
      })
      .on('end', () => {
        const stats = fs.statSync(outputVideoPath);
        console.log(`Renderizacao concluida! Video gerado: ${outputVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve({
          videoPath: outputVideoPath,
          sizeBytes: stats.size,
          durationSeconds: totalDurationSeconds
        });
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Erro no FFmpeg compositor:', err.message);
        if (stderr) console.error('FFmpeg stderr:', stderr);
        reject(err);
      });

    command.run();
  });
}
