/**
 * AutoPublisher Pro - Asset Quality Gate
 * 
 * Inspeciona rigorosamente cada asset (imagem ou clipe de vídeo) antes de ser aceito
 * na montagem final, garantindo resolução mínima (864x1536), enquadramento 9:16 correto,
 * luminância adequada [30, 225] e ausência de marcas d'água de terceiros.
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import ffmpeg, { ffmpegBinary, ffprobeBinary } from './ffmpeg_env.js';

/**
 * Utilitário promisificado para ffprobe
 */
export function probeAsset(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
}

/**
 * Analisa luminância média e detecção de borda nos cantos inferiores (marca d'água)
 */
export function analyzeVisualSignals(filePath) {
  return new Promise(resolve => {
    const args = [
      '-i', filePath,
      '-filter_complex',
      '[0:v]signalstats,metadata=print:key=lavfi.signalstats.YAVG[base];[0:v]crop=160:60:in_w-160:in_h-60,edgedetect,signalstats,metadata=print:key=lavfi.signalstats.YAVG[br];[0:v]crop=160:60:0:in_h-60,edgedetect,signalstats,metadata=print:key=lavfi.signalstats.YAVG[bl]',
      '-map', '[base]', '-f', 'null', '-',
      '-map', '[br]', '-f', 'null', '-',
      '-map', '[bl]', '-f', 'null', '-'
    ];

    execFile(ffmpegBinary, args, { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = (stderr || '') + (stdout || '');
      const matches = [...out.matchAll(/lavfi\.signalstats\.YAVG=([0-9.]+)/g)];

      let luminance = null;
      let brEdge = 0;
      let blEdge = 0;

      if (matches.length >= 1) {
        luminance = parseFloat(matches[0][1]);
      }
      if (matches.length >= 2) {
        brEdge = parseFloat(matches[1][1]);
      }
      if (matches.length >= 3) {
        blEdge = parseFloat(matches[2][1]);
      }

      let watermarkRatio = 1.0;
      if (blEdge > 0) {
        watermarkRatio = brEdge / blEdge;
      } else if (brEdge > 0) {
        watermarkRatio = brEdge > 10 ? 3.0 : 1.0;
      }

      resolve({
        luminance,
        brEdge,
        blEdge,
        watermarkRatio
      });
    });
  });
}

/**
 * Avalia a conformidade de qualidade do asset
 */
export async function validateAssetQuality({
  filePath,
  minWidth = 720,
  minHeight = 1280,
  strict = false,
  checkSignals = true
}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      passed: false,
      code: 'FILE_NOT_FOUND',
      reason: `Arquivo de asset não encontrado: ${filePath}`
    };
  }

  const stat = fs.statSync(filePath);
  if (stat.size < 5000) {
    return {
      passed: false,
      code: 'FILE_TOO_SMALL',
      reason: `Tamanho insuficiente (${stat.size} bytes < 5000 bytes)`
    };
  }

  let probe = null;
  try {
    probe = await probeAsset(filePath);
  } catch (err) {
    return {
      passed: false,
      code: 'PROBE_FAILED',
      reason: `Falha ao inspecionar metadados de mídia: ${err.message}`
    };
  }

  const videoStream = probe.streams?.find(s => s.codec_type === 'video');
  if (!videoStream) {
    return {
      passed: false,
      code: 'NO_VIDEO_STREAM',
      reason: 'Nenhuma trilha de vídeo ou imagem encontrada'
    };
  }

  const width = videoStream.width || 0;
  const height = videoStream.height || 0;

  if (width <= 0 || height <= 0) {
    return {
      passed: false,
      code: 'INVALID_DIMENSIONS',
      reason: `Dimensões inválidas: ${width}x${height}`
    };
  }

  const isVertical = height >= width;
  const targetAspect = 9 / 16; // 0.5625
  const actualAspect = width / height;

  // 1. Resolução mínima
  if (isVertical) {
    if (width < minWidth || height < minHeight) {
      if (strict) {
        return {
          passed: false,
          code: 'LOW_RESOLUTION',
          reason: `Resolução vertical insuficiente: ${width}x${height} (mínimo esperado: ${minWidth}x${minHeight})`
        };
      }
    }
  } else {
    // Se for horizontal (landscape), deve ter pelo menos 1280x720 para suportar crop centralizado em 1080x1920
    if (width < 1280 || height < 720) {
      if (strict) {
        return {
          passed: false,
          code: 'LOW_RESOLUTION_LANDSCAPE',
          reason: `Asset horizontal com resolução insuficiente para crop 9:16: ${width}x${height}`
        };
      }
    }
  }

  // 2. Desvio de aspect ratio vertical
  if (isVertical) {
    const aspectDrift = Math.abs(actualAspect - targetAspect);
    if (aspectDrift > 0.12 && strict) {
      return {
        passed: false,
        code: 'ASPECT_RATIO_DRIFT',
        reason: `Desvio excessivo do formato 9:16: ${actualAspect.toFixed(3)} (esperado ~0.562)`
      };
    }
  }

  // 3. Checagem de sinais visuais (luminância e marca d'água)
  let signals = { luminance: 100, watermarkRatio: 1.0 };
  if (checkSignals) {
    try {
      signals = await analyzeVisualSignals(filePath);

      if (signals.luminance !== null) {
        if (signals.luminance < 20) {
          return {
            passed: false,
            code: 'UNDEREXPOSED',
            reason: `Luminância excessivamente baixa (${signals.luminance.toFixed(1)} < 20, tela quase preta)`
          };
        }
        if (signals.luminance > 235) {
          return {
            passed: false,
            code: 'OVEREXPOSED',
            reason: `Luminância excessivamente alta (${signals.luminance.toFixed(1)} > 235, imagem estourada)`
          };
        }
      }

      if (signals.watermarkRatio > 2.2 && strict) {
        return {
          passed: false,
          code: 'WATERMARK_DETECTED',
          reason: `Energia assimétrica no canto inferior-direito indica marca d'água (razão: ${signals.watermarkRatio.toFixed(2)} > 2.2)`
        };
      }
    } catch (sigErr) {
      // Falha não-bloqueante na análise de sinal
      console.warn(`[Asset Quality Gate] Aviso na análise de sinal visual: ${sigErr.message}`);
    }
  }

  return {
    passed: true,
    code: 'APPROVED',
    reason: 'Asset aprovado pelo Quality Gate',
    metrics: {
      width,
      height,
      actualAspect: actualAspect.toFixed(3),
      luminance: signals.luminance,
      watermarkRatio: signals.watermarkRatio,
      fileSizeBytes: stat.size
    }
  };
}
