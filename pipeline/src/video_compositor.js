import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const ffmpegBinary = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegInstaller.path);
const ffprobeBinary = process.env.FFPROBE_PATH || (fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegBinary);
ffmpeg.setFfprobePath(ffprobeBinary);

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

    const hasBgMusic = bgMusicPath && fs.existsSync(bgMusicPath);
    if (hasBgMusic) {
      command.input(bgMusicPath).inputOptions(['-stream_loop -1']);
      console.log(`[FFmpeg Compositor] Trilha sonora de fundo integrada: ${path.basename(bgMusicPath)}`);
    }

    // Pipeline de pós-produção cinematográfica:
    // 1. Color grading (vinheta suave + curva de contraste sutil + grão analógico 35mm)
    // 2. Queima de legendas com nitidez máxima por cima do vídeo graduado
    const complexFilters = [
      `[0:v]vignette=angle=PI/5:mode=forward,curves=r='0/0 0.2/0.18 0.5/0.49 0.8/0.82 1/1':g='0/0 0.2/0.19 0.5/0.50 0.8/0.81 1/1':b='0/0.02 0.2/0.21 0.5/0.51 0.8/0.80 1/0.98',noise=alls=4:allf=t[graded]`,
      `[graded]subtitles='${escapedAssPath}'[v_out]`
    ];

    let audioMap = '-map [a_out]';
    if (hasBgMusic) {
      const fadeOutStart = Math.max(1, (totalDurationSeconds || 60) - 2.5);
      complexFilters.push(
        `[1:a]loudnorm=I=-14:TP=-1:LRA=11,volume=1.0[a_voice]`,
        `[2:a]volume=0.12,afade=t=out:st=${fadeOutStart}:d=2.5[a_bg]`,
        `[a_voice][a_bg]amix=inputs=2:duration=first:dropout_transition=2[a_out]`
      );
    } else {
      complexFilters.push(
        `[1:a]loudnorm=I=-14:TP=-1:LRA=11[a_out]`
      );
    }

    command
      .complexFilter(complexFilters)
      .outputOptions([
        '-map [v_out]',
        audioMap,
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
