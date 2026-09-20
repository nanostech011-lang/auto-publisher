import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const ffmpegBinary = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegInstaller.path);
const ffprobeBinary = process.env.FFPROBE_PATH || (fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegBinary);
ffmpeg.setFfprobePath(ffprobeBinary);

let detectedVideoCodec = null;

/**
 * Detecta o encoder de vídeo mais rápido e eficiente disponível.
 * Em contêineres Docker/Cloud Run, libx264 é o padrão universal que garante
 * estabilidade absoluta sem falhas de drivers de GPU ausentes (MFX session -9).
 */
export async function detectOptimalVideoEncoder() {
  if (detectedVideoCodec) return detectedVideoCodec;

  if (process.env.FORCE_HARDWARE_ENCODER === 'true' || process.env.ENABLE_NVENC === 'true') {
    return new Promise((resolve) => {
      ffmpeg.getAvailableEncoders((err, encoders) => {
        if (!err && encoders && encoders['h264_nvenc']) {
          console.log('[FFmpeg Compositor] Opt-in de aceleração NVIDIA NVENC ativado!');
          detectedVideoCodec = { codec: 'h264_nvenc', preset: 'p4' };
        } else {
          detectedVideoCodec = { codec: 'libx264', preset: 'medium' };
        }
        resolve(detectedVideoCodec);
      });
    });
  }

  detectedVideoCodec = { codec: 'libx264', preset: 'medium' };
  return detectedVideoCodec;
}

/**
 * Escapa corretamente o caminho do arquivo .ass para uso no filtro FFmpeg.
 *
 * No Windows, o filtro `subtitles` do FFmpeg exige um escape muito específico:
 * - A letra do drive deve ser representada como "C\:/..." (barra invertida escapada antes dos dois pontos)
 * - As barras do path devem ser barras normais "/"
 * - Qualquer espaço ou caractere especial deve ser escaped com "\"
 *
 * Exemplo: "C:\Apps\projeto\file.ass" → "C\:/Apps/projeto/file.ass"
 */
export function escapeAssPathForFFmpeg(assPath) {
  if (!assPath) return '';

  // Normaliza para barras normais
  let normalized = assPath.replace(/\\/g, '/');

  // No Windows: converte "C:/" para "C\:/" (escape do dois pontos da letra de drive)
  if (process.platform === 'win32') {
    normalized = normalized.replace(/^([A-Za-z]):\//, '$1\\:/');
  }

  // Escapa espaços e outros caracteres especiais do FFmpeg filter
  normalized = normalized.replace(/ /g, '\\ ');

  return normalized;
}

/**
 * Monta o video final completo com cortes, audio de locucao, trilha dark e legendas dinamicas queimadas.
 *
 * @param {Object} params
 * @param {string[]} params.videoClips          Lista de caminhos dos clips de vídeo
 * @param {string}   params.audioPath           Caminho do áudio da locução (MP3)
 * @param {string}   params.subtitlesAssPath    Caminho do arquivo .ass de legendas
 * @param {string}   params.outputVideoPath     Caminho de saída do vídeo final
 * @param {number}   params.totalDurationSeconds Duração total do vídeo em segundos
 * @param {string}   [params.bgMusicPath]       Caminho da trilha sonora de fundo (opcional)
 * @param {boolean}  [params.enableSubtitles=true] Queima legendas no vídeo (false = sem legenda)
 */
export async function composeFinalVideo({
  videoClips,
  audioPath,
  subtitlesAssPath,
  outputVideoPath,
  totalDurationSeconds,
  bgMusicPath = null,
  enableSubtitles = true
}) {
  const encoderConfig = await detectOptimalVideoEncoder();
  const dir = path.dirname(outputVideoPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Cria arquivo de lista de concatenacao para o FFmpeg
  const scratchDir = path.dirname(audioPath);
  const concatListPath = path.join(scratchDir, 'concat_list.txt');

  // Normaliza paths para barras normais no concat list (FFmpeg aceita ambos nos demais inputs)
  const concatContent = videoClips.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent, 'utf8');

  // Verifica se as legendas devem e podem ser queimadas
  const shouldBurnSubtitles = enableSubtitles
    && subtitlesAssPath
    && fs.existsSync(subtitlesAssPath)
    && fs.statSync(subtitlesAssPath).size > 100;

  const escapedAssPath = shouldBurnSubtitles ? escapeAssPathForFFmpeg(subtitlesAssPath) : null;

  if (enableSubtitles && !shouldBurnSubtitles) {
    console.warn('[FFmpeg Compositor] ⚠️  Arquivo .ass não encontrado ou inválido — renderizando sem legendas.');
  }

  if (shouldBurnSubtitles) {
    console.log(`[FFmpeg Compositor] Legendas habilitadas: ${path.basename(subtitlesAssPath)}`);
    console.log(`[FFmpeg Compositor] Path escapado para FFmpeg: "${escapedAssPath}"`);
  } else {
    console.log('[FFmpeg Compositor] Renderizando sem legendas queimadas.');
  }

  return new Promise((resolve, reject) => {
    // Comando FFmpeg:
    // Input 0: Concatenacao dos clips de video
    // Input 1: Audio da locucao
    // Filtro de video: color grading cinematografico + queima condicional de legenda .ass
    // Audio: locucao normalizada + mixagem opcional de trilha de fundo

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
    // 1. Color grading (vinheta suave + curva de contraste sutil cinematográfica)
    // 2. Queima condicional de legendas com nitidez máxima por cima do vídeo graduado
    const complexFilters = [];

    // Filtro base de color grading cinematográfico
    const colorGrade = `[0:v]vignette=angle=PI/5:mode=forward,curves=r='0/0 0.2/0.18 0.5/0.49 0.8/0.82 1/1':g='0/0 0.2/0.19 0.5/0.50 0.8/0.81 1/1':b='0/0.02 0.2/0.21 0.5/0.51 0.8/0.80 1/0.98'`;

    if (shouldBurnSubtitles) {
      complexFilters.push(`${colorGrade}[graded]`);
      complexFilters.push(`[graded]ass='${escapedAssPath}'[v_out]`);
    } else {
      complexFilters.push(`${colorGrade}[v_out]`);
    }

    let audioMap = '-map [a_out]';
    if (hasBgMusic) {
      const fadeOutStart = Math.max(1, (totalDurationSeconds || 60) - 2.5);
      complexFilters.push(
        `[1:a]loudnorm=I=-14:TP=-1:LRA=11:linear=true,volume=1.0[a_voice]`,
        `[2:a]volume=0.12,afade=t=out:st=${fadeOutStart}:d=2.5[a_bg]`,
        `[a_voice][a_bg]amix=inputs=2:duration=first:dropout_transition=2[a_out]`
      );
    } else {
      complexFilters.push(
        `[1:a]loudnorm=I=-14:TP=-1:LRA=11:linear=true[a_out]`
      );
    }

    command
      .complexFilter(complexFilters)
      .outputOptions([
        '-map [v_out]',
        audioMap,
        `-c:v ${encoderConfig.codec}`,
        '-pix_fmt yuv420p',
        `-preset ${encoderConfig.preset}`,
        '-profile:v high',
        '-level:v 4.2',
        '-b:v 6000k',
        '-maxrate 8000k',
        '-bufsize 12000k',
        '-c:a aac',
        '-b:a 192k',
        `-t ${totalDurationSeconds}`,
        '-movflags +faststart'
      ])
      .output(outputVideoPath)
      .on('start', cmdLine => {
        console.log('Iniciando renderizacao com FFmpeg...');
        console.log(`[FFmpeg CMD] ${cmdLine.slice(0, 200)}...`);
      })
      .on('end', () => {
        // Valida que o arquivo gerado tem tamanho mínimo aceitável (> 100KB)
        const stats = fs.statSync(outputVideoPath);
        if (stats.size < 102400) {
          const errMsg = `Arquivo de saída suspeito: apenas ${stats.size} bytes. Possível falha silenciosa do FFmpeg.`;
          console.error(`[FFmpeg Compositor] ❌ ${errMsg}`);
          return reject(new Error(errMsg));
        }
        console.log(`Renderizacao concluida! Video gerado: ${outputVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve({
          videoPath: outputVideoPath,
          sizeBytes: stats.size,
          durationSeconds: totalDurationSeconds,
          subtitlesBurned: shouldBurnSubtitles
        });
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Erro no FFmpeg compositor:', err.message);
        if (stderr) {
          // Extrai as últimas 20 linhas de stderr para diagnóstico
          const stderrLines = (stderr || '').split('\n');
          const relevantLines = stderrLines.slice(-20).join('\n');
          console.error('FFmpeg stderr (últimas linhas):\n', relevantLines);
        }
        reject(err);
      });

    command.run();
  });
}
