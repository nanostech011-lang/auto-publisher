/**
 * AutoPublisher Pro - Stock Video Connector (Pexels & Pixabay)
 * 
 * Conector de B-Roll vertical (9:16) de alta qualidade para canais de alta retenção.
 * Integração gratuita com Pexels Video API (20.000 req/mês) e Pixabay Video API,
 * garantindo vídeos reais cinematográficos com corte exato para a duração da cena.
 */

import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const ffmpegBinary = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegInstaller.path);
const ffprobeBinary = process.env.FFPROBE_PATH || (fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegBinary);
ffmpeg.setFfprobePath(ffprobeBinary);

// Carregamento de variáveis de ambiente
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

/**
 * Busca vídeo vertical (9:16) na API do Pexels
 */
export async function searchPexelsVideo({ query, apiKey = null }) {
  const effectiveKey = apiKey || process.env.PEXELS_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: 'PEXELS_API_KEY não configurada' };
  }

  try {
    const cleanQuery = encodeURIComponent(query.slice(0, 80));
    const url = `https://api.pexels.com/videos/search?query=${cleanQuery}&orientation=portrait&size=medium&per_page=5`;
    const res = await fetch(url, {
      headers: {
        Authorization: effectiveKey
      }
    });

    if (!res.ok) {
      return { success: false, error: `Pexels API retornou HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data.videos || data.videos.length === 0) {
      return { success: false, error: `Nenhum vídeo vertical encontrado no Pexels para: "${query}"` };
    }

    // Escolhe o vídeo mais adequado
    for (const video of data.videos) {
      // Procura arquivos de vídeo com orientação vertical
      const files = video.video_files || [];
      // Prioriza HD vertical (1080x1920 ou 720x1280)
      const idealFile = files.find(f => (f.width && f.height && f.height > f.width && f.width >= 720)) ||
                        files.find(f => f.quality === 'hd') ||
                        files[0];

      if (idealFile && idealFile.link) {
        return {
          success: true,
          provider: 'Pexels Video API',
          videoUrl: idealFile.link,
          width: idealFile.width,
          height: idealFile.height,
          duration: video.duration
        };
      }
    }

    return { success: false, error: 'Arquivos de vídeo incompatíveis no Pexels' };
  } catch (err) {
    return { success: false, error: `Erro na consulta ao Pexels: ${err.message}` };
  }
}

/**
 * Busca vídeo na API do Pixabay como fallback secundário
 */
export async function searchPixabayVideo({ query, apiKey = null }) {
  const effectiveKey = apiKey || process.env.PIXABAY_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: 'PIXABAY_API_KEY não configurada' };
  }

  try {
    const cleanQuery = encodeURIComponent(query.slice(0, 80));
    const url = `https://pixabay.com/api/videos/?key=${effectiveKey}&q=${cleanQuery}&video_type=all&per_page=5`;
    const res = await fetch(url);

    if (!res.ok) {
      return { success: false, error: `Pixabay API retornou HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data.hits || data.hits.length === 0) {
      return { success: false, error: `Nenhum vídeo encontrado no Pixabay para: "${query}"` };
    }

    const hit = data.hits[0];
    const videos = hit.videos || {};
    const candidate = videos.medium || videos.large || videos.small;

    if (candidate && candidate.url) {
      return {
        success: true,
        provider: 'Pixabay Video API',
        videoUrl: candidate.url,
        width: candidate.width,
        height: candidate.height,
        duration: hit.duration
      };
    }

    return { success: false, error: 'Estrutura de vídeo não encontrada no Pixabay' };
  } catch (err) {
    return { success: false, error: `Erro na consulta ao Pixabay: ${err.message}` };
  }
}

/**
 * Baixa um vídeo remoto para arquivo temporário local
 */
export async function downloadRemoteFile(url, tempPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha no download do vídeo: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}

/**
 * Baixa, corta em 9:16 (1080x1920) e ajusta a duração exata com micro-fade cinematográfico
 */
export function formatStockClipToExactDuration({
  rawVideoPath,
  durationSeconds,
  outputPath,
  isHookScene = false
}) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const dSec = Math.max(1, Number(durationSeconds) || 3);
  const fadeOutStart = Math.max(0.2, (dSec - 0.15)).toFixed(2);
  const transitionFade = isHookScene
    ? `,fade=t=out:st=${fadeOutStart}:d=0.15`
    : `,fade=t=in:st=0:d=0.15,fade=t=out:st=${fadeOutStart}:d=0.15`;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(rawVideoPath)
      .inputOptions(['-stream_loop -1'])
      .outputOptions([
        `-t ${dSec}`,
        `-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920${transitionFade}`,
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-r 30',
        '-preset fast'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', err => reject(err))
      .run();
  });
}

/**
 * Orquestrador central de B-Roll de Stock Video
 * Tenta obter um clipe real 9:16 para a cena indicada
 */
export async function fetchAndPrepareStockBroll({
  query,
  outputPath,
  durationSeconds,
  isHookScene = false,
  pexelsApiKey = null,
  pixabayApiKey = null
}) {
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return { success: false, error: 'Query de busca vazia ou inválida' };
  }

  // 1. Tenta Pexels (orientação vertical nativa de alta fidelidade)
  let searchResult = await searchPexelsVideo({ query, apiKey: pexelsApiKey });

  // 2. Fallback para Pixabay se Pexels falhar
  if (!searchResult.success) {
    searchResult = await searchPixabayVideo({ query, apiKey: pixabayApiKey });
  }

  if (!searchResult.success || !searchResult.videoUrl) {
    return { success: false, error: searchResult.error || 'Nenhum stock video disponível' };
  }

  const tempRawPath = `${outputPath}.raw.mp4`;
  try {
    await downloadRemoteFile(searchResult.videoUrl, tempRawPath);
    await formatStockClipToExactDuration({
      rawVideoPath: tempRawPath,
      durationSeconds,
      outputPath,
      isHookScene
    });

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 20480) {
      return {
        success: true,
        provider: searchResult.provider,
        outputPath
      };
    }
  } catch (err) {
    return { success: false, error: `Falha ao processar vídeo de estoque: ${err.message}` };
  } finally {
    if (fs.existsSync(tempRawPath)) {
      try { fs.unlinkSync(tempRawPath); } catch (ignored) {}
    }
  }

  return { success: false, error: 'Falha desconhecida no conector de stock video' };
}
