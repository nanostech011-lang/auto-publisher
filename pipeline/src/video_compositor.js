import fs from 'fs';
import path from 'path';
import ffmpeg, {
  ffmpegBinary,
  ffprobeBinary,
  FFMPEG_THREADS,
  LOW_MEMORY_DECODE_OPTS,
  LOW_MEMORY_X264_OPTS
} from './ffmpeg_env.js';

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
 * Constrói o grafo de filtros de áudio para o FFmpeg com base na presença de voz e trilha.
 */
export function buildAudioFilterGraph({
  hasVoice = true,
  hasBgMusic = false,
  voiceInputIndex = 1,
  bgMusicInputIndex = 2,
  targetLufs = -14,
  bgMusicVol = 0.18,
  fadeOutSec = 2.5,
  totalDurationSeconds = 15,
  padFilter = 'apad'
} = {}) {
  const filters = [];
  const fadeOutStart = Math.max(1, (totalDurationSeconds || 15) - fadeOutSec);

  if (hasVoice && hasBgMusic) {
    filters.push(
      `[${voiceInputIndex}:a]highpass=f=80,acompressor=threshold=0.08:ratio=3:attack=15:release=150,aformat=channel_layouts=stereo:sample_rates=48000,asplit=2[voice_play][voice_key]`,
      `[${bgMusicInputIndex}:a]aformat=channel_layouts=stereo:sample_rates=48000,volume=${bgMusicVol},afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}[bg_raw]`,
      `[bg_raw][voice_key]sidechaincompress=threshold=0.04:ratio=4:attack=20:release=250[bg_ducked]`,
      `[voice_play][bg_ducked]amix=inputs=2:duration=longest:dropout_transition=2[mixed_raw]`,
      `[mixed_raw]loudnorm=I=${targetLufs}:TP=-1.5:LRA=9:linear=true,aformat=channel_layouts=stereo:sample_rates=48000,${padFilter}[a_out]`
    );
  } else if (hasVoice && !hasBgMusic) {
    filters.push(
      `[${voiceInputIndex}:a]highpass=f=80,acompressor=threshold=0.08:ratio=3:attack=15:release=150,loudnorm=I=${targetLufs}:TP=-1.5:LRA=9:linear=true,aformat=channel_layouts=stereo:sample_rates=48000,${padFilter}[a_out]`
    );
  } else if (!hasVoice && hasBgMusic) {
    const musicOnlyVol = Math.min(1.0, (bgMusicVol || 0.18) * 2.5);
    filters.push(
      `[${bgMusicInputIndex}:a]aformat=channel_layouts=stereo:sample_rates=48000,volume=${musicOnlyVol},afade=t=out:st=${fadeOutStart}:d=${fadeOutSec},loudnorm=I=${targetLufs}:TP=-1.5:LRA=9:linear=true,${padFilter}[a_out]`
    );
  } else {
    filters.push(
      `aevalsrc=0:d=${totalDurationSeconds}:s=48000:c=stereo,${padFilter}[a_out]`
    );
  }

  return {
    complexFilters: filters,
    audioMap: '-map [a_out]'
  };
}

/**
 * Monta o video final completo com cortes, audio de locucao, trilha dark e legendas dinamicas queimadas.
 *
 * @param {Object} params
 * @param {string[]} params.videoClips          Lista de caminhos dos clips de vídeo
 * @param {string}   [params.audioPath]         Caminho do áudio da locução (MP3, opcional)
 * @param {string}   [params.subtitlesAssPath]  Caminho do arquivo .ass de legendas
 * @param {string}   params.outputVideoPath     Caminho de saída do vídeo final
 * @param {number}   params.totalDurationSeconds Duração total do vídeo em segundos
 * @param {string}   [params.bgMusicPath]       Caminho da trilha sonora de fundo (opcional)
 * @param {boolean}  [params.enableSubtitles=true] Queima legendas no vídeo (false = sem legenda)
 */
export async function composeFinalVideo({
  videoClips,
  audioPath = null,
  subtitlesAssPath,
  outputVideoPath,
  totalDurationSeconds,
  bgMusicPath = null,
  enableSubtitles = true,
  audioProfile = {}
}) {
  const encoderConfig = await detectOptimalVideoEncoder();
  const dir = path.dirname(outputVideoPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Parâmetros de áudio cinematográfico do canal
  const targetLufs = audioProfile.target_lufs ?? -14;
  const bgMusicVol = audioProfile.bg_music_volume ?? 0.18;
  const fadeOutSec = audioProfile.fade_out_seconds ?? 2.5;

  // Cria arquivo de lista de concatenacao para o FFmpeg
  const scratchDir = (audioPath && fs.existsSync(path.dirname(audioPath)))
    ? path.dirname(audioPath)
    : dir;
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
    // Configura inputs do FFmpeg de acordo com a presenca de voz e musica
    const hasVoice = Boolean(audioPath && fs.existsSync(audioPath));
    const hasBgMusic = Boolean(bgMusicPath && fs.existsSync(bgMusicPath));

    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0', ...LOW_MEMORY_DECODE_OPTS]);

    let voiceInputIndex = -1;
    let bgMusicInputIndex = -1;

    if (hasVoice) {
      command.input(audioPath);
      voiceInputIndex = 1;
      if (hasBgMusic) {
        command.input(bgMusicPath).inputOptions(['-stream_loop -1']);
        bgMusicInputIndex = 2;
        console.log(`[FFmpeg Compositor] Trilha sonora de fundo integrada: ${path.basename(bgMusicPath)}`);
      }
    } else if (hasBgMusic) {
      command.input(bgMusicPath).inputOptions(['-stream_loop -1']);
      bgMusicInputIndex = 1;
      console.log(`[FFmpeg Compositor] Modo sem voz: Trilha sonora principal integrada: ${path.basename(bgMusicPath)}`);
    } else {
      console.log('[FFmpeg Compositor] Modo sem voz e sem trilha: gerando áudio estéreo silencioso de conformidade.');
    }

    // Perfil de baixo consumo de memória (evita SIGKILL do OOM killer no cgroup de 512MB)
    const memoryOpts = encoderConfig.codec === 'libx264'
      ? LOW_MEMORY_X264_OPTS
      : [`-threads ${FFMPEG_THREADS}`, '-filter_complex_threads 1'];

    const complexFilters = [];

    // Filtro base de color grading cinematográfico
    const colorGrade = `[0:v]vignette=angle=PI/5:mode=forward,curves=r='0/0 0.2/0.18 0.5/0.49 0.8/0.82 1/1':g='0/0 0.2/0.19 0.5/0.50 0.8/0.81 1/1':b='0/0.02 0.2/0.21 0.5/0.51 0.8/0.80 1/0.98'`;

    if (shouldBurnSubtitles) {
      const fontsDir = path.resolve('pipeline/assets/fonts').replace(/\\/g, '/').replace(/:/g, '\\:');
      complexFilters.push(`${colorGrade}[graded]`);
      complexFilters.push(`[graded]ass=filename='${escapedAssPath}':fontsdir='${fontsDir}'[v_out]`);
    } else {
      complexFilters.push(`${colorGrade}[v_out]`);
    }

    const targetSamples = totalDurationSeconds > 0 ? Math.ceil(totalDurationSeconds * 48000) : null;
    const padFilter = targetSamples ? `apad=whole_len=${targetSamples}` : 'apad';

    const audioGraph = buildAudioFilterGraph({
      hasVoice,
      hasBgMusic,
      voiceInputIndex,
      bgMusicInputIndex,
      targetLufs,
      bgMusicVol,
      fadeOutSec,
      totalDurationSeconds,
      padFilter
    });

    complexFilters.push(...audioGraph.complexFilters);
    const audioMap = audioGraph.audioMap;

    command
      .complexFilter(complexFilters)
      .outputOptions([
        '-map [v_out]',
        audioMap,
        `-c:v ${encoderConfig.codec}`,
        ...memoryOpts,
        '-pix_fmt yuv420p',
        `-preset ${encoderConfig.preset || 'slow'}`,
        '-crf 20',
        '-color_primaries bt709',
        '-color_trc bt709',
        '-colorspace bt709',
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
        const stats = fs.statSync(outputVideoPath);
        if (stats.size < 102400) {
          const errMsg = `Arquivo de saída suspeito: apenas ${stats.size} bytes. Possível falha silenciosa do FFmpeg.`;
          console.error(`[FFmpeg Compositor] ❌ ${errMsg}`);
          return reject(new Error(errMsg));
        }

        // P6.4: ffprobe obrigatório para devolver a duração medida real
        ffmpeg.ffprobe(outputVideoPath, (probeErr, metadata) => {
          const measuredDuration = (!probeErr && metadata?.format?.duration)
            ? Number(metadata.format.duration.toFixed(2))
            : totalDurationSeconds;

          console.log(`Renderizacao concluida! Video gerado: ${outputVideoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${measuredDuration}s medidos)`);
          resolve({
            videoPath: outputVideoPath,
            sizeBytes: stats.size,
            durationSeconds: measuredDuration,
            subtitlesBurned: shouldBurnSubtitles
          });
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
