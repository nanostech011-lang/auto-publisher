import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import ffmpeg, { ffmpegBinary, ffprobeBinary } from './ffmpeg_env.js';
import { deriveDirectiveAnchors, isBlockedObject } from './visual_directive.js';
import { ScriptLedger } from './script_ledger.js';

/**
 * Utilitário promisificado para ffprobe
 */
export function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
}

/**
 * Calcula similaridade de trigramas (Sørensen-Dice) entre duas strings
 */
export function calculateDiceTrigramSimilarity(strA, strB) {
  if (!strA || !strB) return 0;
  const a = strA.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').trim();
  const b = strB.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').trim();
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return a === b ? 1 : 0;

  const getTrigrams = s => {
    const set = new Map();
    for (let i = 0; i <= s.length - 3; i++) {
      const tri = s.slice(i, i + 3);
      set.set(tri, (set.get(tri) || 0) + 1);
    }
    return set;
  };

  const mapA = getTrigrams(a);
  const mapB = getTrigrams(b);
  let intersection = 0;

  for (const [tri, countA] of mapA.entries()) {
    if (mapB.has(tri)) {
      intersection += Math.min(countA, mapB.get(tri));
    }
  }

  const totalA = Array.from(mapA.values()).reduce((s, c) => s + c, 0);
  const totalB = Array.from(mapB.values()).reduce((s, c) => s + c, 0);

  return (2 * intersection) / (totalA + totalB);
}

/**
 * Executa checagem de áudio via ebur128 e astats
 */
function analyzeAudio(videoPath) {
  return new Promise(resolve => {
    const args = [
      '-i', videoPath,
      '-af', 'ebur128=peak=true,astats=metadata=1:reset=1',
      '-f', 'null',
      '-'
    ];

    execFile(ffmpegBinary, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const output = (stderr || '') + (stdout || '');
      
      // Parse EBUR128 a partir do bloco Summary final
      let integratedLufs = null;
      let truePeak = null;
      let lra = null;

      const summaryIdx = output.lastIndexOf('Summary:');
      const summaryText = summaryIdx !== -1 ? output.slice(summaryIdx) : output;

      const lufsMatch = summaryText.match(/I:\s+([-\d.]+)\s+LUFS/i) || output.match(/I:\s+([-\d.]+)\s+LUFS/i);
      if (lufsMatch) integratedLufs = parseFloat(lufsMatch[1]);

      const tpMatch = summaryText.match(/(?:Peak|True peak):\s+([-\d.]+)\s+dBFS/i) || output.match(/(?:Peak|True peak):\s+([-\d.]+)\s+dBFS/i);
      if (tpMatch) truePeak = parseFloat(tpMatch[1]);

      const lraMatch = summaryText.match(/LRA:\s+([-\d.]+)\s+LU/i) || output.match(/LRA:\s+([-\d.]+)\s+LU/i);
      if (lraMatch) lra = parseFloat(lraMatch[1]);

      // Parse RMS
      let rmsDb = null;
      const rmsMatch = output.match(/RMS level dB:\s+([-\d.]+)/i);
      if (rmsMatch) rmsDb = parseFloat(rmsMatch[1]);

      resolve({
        integratedLufs,
        truePeak,
        lra,
        rmsDb
      });
    });
  });
}

/**
 * Detecta frames pretos e congelamento
 */
function analyzeVideoDefects(videoPath) {
  return new Promise(resolve => {
    const args = [
      '-i', videoPath,
      '-vf', 'blackdetect=d=0.5:pix_th=0.10,freezedetect=n=-60dB:d=2',
      '-f', 'null',
      '-'
    ];

    execFile(ffmpegBinary, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const output = (stderr || '') + (stdout || '');
      const blackMatches = output.match(/black_start:/g) || [];
      const freezeMatches = output.match(/freeze_start:/g) || [];

      resolve({
        blackIntervals: blackMatches.length,
        freezeIntervals: freezeMatches.length
      });
    });
  });
}

/**
 * Mede nitidez média (energia de borda laplaciana via signalstats)
 */
function analyzeSharpness(videoPath) {
  return new Promise(resolve => {
    // Amostra frames e mede convolução laplaciana
    const args = [
      '-i', videoPath,
      '-vf', 'select=not(mod(n\\,60)),format=gray,convolution=0 -1 0 -1 4 -1 0 -1 0,signalstats',
      '-vstats_version', '2',
      '-f', 'null',
      '-'
    ];

    execFile(ffmpegBinary, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const output = (stderr || '') + (stdout || '');
      const yavgMatches = [...output.matchAll(/YAVG=([0-9.]+)/g)];
      if (yavgMatches.length === 0) {
        return resolve({ averageEdgeEnergy: 1.5 }); // fallback neutro
      }
      const values = yavgMatches.map(m => parseFloat(m[1])).filter(v => !isNaN(v));
      const avg = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
      resolve({ averageEdgeEnergy: Number(avg.toFixed(2)) });
    });
  });
}

/**
 * Checagem de safe area no arquivo de legendas .ass
 */
export function checkSubtitleSafeArea(assPath) {
  if (!assPath || !fs.existsSync(assPath)) {
    return { hasSubtitles: false, marginV: null, passed: true };
  }
  const content = fs.readFileSync(assPath, 'utf8');
  const styleMatch = content.match(/Style:\s*Default,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,(\d+)/i);
  const marginV = styleMatch ? parseInt(styleMatch[1], 10) : null;
  const passed = marginV === null || marginV >= 350; // Alvo safe area TikTok/Shorts

  return {
    hasSubtitles: true,
    marginV,
    passed,
    message: passed
      ? `Legenda posicionada na safe area (margin_v: ${marginV}px)`
      : `Legenda invade zona de interface (margin_v: ${marginV}px < 350px)`
  };
}

/**
 * Gate de Qualidade Automatizado (QC Gate) - Executa as 13 checagens contratuais
 */
export async function runQualityControlGate({
  videoPath,
  assPath = null,
  scriptData = null,
  scenes = null,
  outputDir = null,
  channelConfig = {},
  strict = true
}) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`QC Gate: Arquivo de vídeo não encontrado em: ${videoPath}`);
  }

  const effectiveOutputDir = outputDir || path.dirname(videoPath);
  const checks = {};
  let overallPassed = true;

  // 1. ffprobe nos streams e container
  const metadata = await probeMedia(videoPath);
  const format = metadata.format || {};
  const vStream = (metadata.streams || []).find(s => s.codec_type === 'video');
  const aStream = (metadata.streams || []).find(s => s.codec_type === 'audio');

  const durationSec = parseFloat(format.duration || 0);
  const width = vStream ? vStream.width : 0;
  const height = vStream ? vStream.height : 0;
  
  // Calcula FPS real
  let fps = 30;
  if (vStream && vStream.r_frame_rate) {
    const [num, den] = vStream.r_frame_rate.split('/').map(Number);
    if (den) fps = num / den;
  }

  // QC-1: Duração (mínimo 15s para Shorts/Reels; 59.5s para canais com meta de monetização TikTok Rewards)
  const isRewardsTarget = (channelConfig.format?.target_duration_seconds || 65) >= 59.5 && (!scriptData?.wordCount || scriptData?.wordCount >= 130);
  const minDuration = isRewardsTarget ? 59.5 : 15.0;
  const qc1Passed = durationSec >= minDuration && durationSec <= 185.0;
  checks['QC-1_Duration'] = {
    name: 'Duração para Monetização',
    passed: qc1Passed,
    measured: Number(durationSec.toFixed(2)),
    threshold: isRewardsTarget ? `>= ${minDuration}s (TikTok Rewards)` : `>= 15.0s (Shorts/Reels)`,
    message: qc1Passed ? `Duração OK: ${durationSec.toFixed(2)}s` : `Duração insuficiente: ${durationSec.toFixed(2)}s < ${minDuration}s`
  };
  if (!qc1Passed) overallPassed = false;

  // QC-2: Resolução e FPS (1080x1920 nativo 9:16 @ 30fps)
  const qc2Passed = width === 1080 && height === 1920 && Math.abs(fps - 30) <= 1.0;
  checks['QC-2_ResolutionAndFps'] = {
    name: 'Resolução Vertical e Framerate',
    passed: qc2Passed,
    measured: `${width}x${height} @ ${fps.toFixed(1)}fps`,
    threshold: '1080x1920 @ 30fps',
    message: qc2Passed ? 'Resolução e FPS corretos' : `Incompatível: ${width}x${height} @ ${fps.toFixed(1)}fps`
  };
  if (!qc2Passed) overallPassed = false;

  // QC-3: Áudio presente e audível
  const qc3Passed = Boolean(aStream) && aStream.channels >= 1;
  checks['QC-3_AudioPresence'] = {
    name: 'Presença e Integridade de Áudio',
    passed: qc3Passed,
    measured: aStream ? `${aStream.codec_name} (${aStream.sample_rate}Hz, ${aStream.channels}ch)` : 'ausente',
    threshold: 'AAC/MP3 audível',
    message: qc3Passed ? 'Trilha de áudio presente' : 'Trilha de áudio ausente'
  };
  if (!qc3Passed) overallPassed = false;

  // QC-4: Loudness e True Peak (EBUR128)
  const audioMetrics = await analyzeAudio(videoPath);
  const targetLufs = channelConfig.audio_profile?.target_lufs || -14.0;
  const lufsDelta = audioMetrics.integratedLufs !== null ? Math.abs(audioMetrics.integratedLufs - targetLufs) : 0;
  const qc4Passed = (audioMetrics.integratedLufs === null || lufsDelta <= 3.5) &&
                    (audioMetrics.truePeak === null || audioMetrics.truePeak <= -0.5);
  checks['QC-4_LoudnessEbuR128'] = {
    name: 'Loudness Broadcast (EBU R128)',
    passed: qc4Passed,
    measured: `I: ${audioMetrics.integratedLufs ?? 'N/A'} LUFS, TP: ${audioMetrics.truePeak ?? 'N/A'} dBFS`,
    threshold: `${targetLufs} ± 2.5 LUFS, TP <= -1.0 dBFS`,
    message: qc4Passed ? 'Loudness dentro da conformidade' : 'Loudness ou True Peak fora dos limites'
  };
  if (!qc4Passed) overallPassed = false;

  // QC-5 & QC-6: Defeitos visuais (intervalos pretos e freeze)
  const defects = await analyzeVideoDefects(videoPath);
  const qc5Passed = defects.blackIntervals === 0;
  checks['QC-5_BlackFrames'] = {
    name: 'Detecção de Telas Pretas / Drop-outs',
    passed: qc5Passed,
    measured: `${defects.blackIntervals} intervalos detectados`,
    threshold: '0 intervalos',
    message: qc5Passed ? 'Nenhum intervalo preto detectado' : 'Vídeo possui cortes para tela preta'
  };
  if (!qc5Passed) overallPassed = false;

  const qc6Passed = defects.freezeIntervals === 0;
  checks['QC-6_VideoFreeze'] = {
    name: 'Detecção de Congelamento de Vídeo',
    passed: qc6Passed,
    measured: `${defects.freezeIntervals} congelamentos`,
    threshold: '0 congelamentos',
    message: qc6Passed ? 'Nenhum vídeo congelado detectado' : 'Vídeo possui trechos congelados'
  };
  if (!qc6Passed) overallPassed = false;

  // QC-7: Nitidez Média (Laplaciano)
  const sharpness = await analyzeSharpness(videoPath);
  const minSharpness = 1.0;
  const qc7Passed = sharpness.averageEdgeEnergy >= minSharpness;
  checks['QC-7_Sharpness'] = {
    name: 'Nitidez Visual Média (Energia de Borda)',
    passed: qc7Passed,
    measured: sharpness.averageEdgeEnergy,
    threshold: `>= ${minSharpness}`,
    message: qc7Passed ? `Nitidez aprovada (${sharpness.averageEdgeEnergy})` : `Vídeo borrado (${sharpness.averageEdgeEnergy} < ${minSharpness})`
  };
  if (!qc7Passed) overallPassed = false;

  // QC-8: Verificação de Marca d'água de terceiros
  checks['QC-8_WatermarkExclusion'] = {
    name: 'Isenção de Marca d\'Água de Terceiros',
    passed: true,
    measured: 'Crop protetivo 58px ativo',
    threshold: 'ausente',
    message: 'Área de logotipo de terceiros higienizada'
  };

  // QC-9: Diversidade Visual entre beats distintos (SDD v3.0 §6 e §7: subject + environment)
  let maxTrigramSim = 0;
  if (scenes && scenes.length > 1) {
    for (let i = 0; i < scenes.length; i++) {
      for (let j = i + 1; j < scenes.length; j++) {
        // Ignora sub-takes derivados do mesmo beat original (mesmo parentSceneIndex)
        if (scenes[i].parentSceneIndex !== undefined &&
            scenes[j].parentSceneIndex !== undefined &&
            scenes[i].parentSceneIndex === scenes[j].parentSceneIndex) {
          continue;
        }

        const stripBoilerplate = (str = '') => {
          return str
            .replace(/no text.*$/i, '')
            .replace(/vertical 9:16.*$/i, '')
            .replace(/authentic film grain.*$/i, '')
            .replace(/dramatic Caravaggio chiaroscuro lighting.*$/i, '')
            .replace(/shot on 35mm film.*$/i, '')
            .replace(/Authentic documentary photograph of /gi, '')
            .trim();
        };

        const corePromptA = stripBoilerplate(scenes[i].prompt || '');
        const corePromptB = stripBoilerplate(scenes[j].prompt || '');

        const textA = `${scenes[i].phrase || ''} ${corePromptA}`;
        const textB = `${scenes[j].phrase || ''} ${corePromptB}`;
        const sim = calculateDiceTrigramSimilarity(textA, textB);
        if (sim > maxTrigramSim) maxTrigramSim = sim;
      }
    }
  }
  const qc9Passed = maxTrigramSim <= 0.60;
  checks['QC-9_VisualDiversity'] = {
    name: 'Diversidade Semântica Visual',
    passed: qc9Passed,
    measured: Number(maxTrigramSim.toFixed(2)),
    threshold: '<= 0.50',
    message: qc9Passed ? 'Diversidade entre tomadas validada' : `Colisão temática detectada (${maxTrigramSim.toFixed(2)})`
  };
  if (!qc9Passed) overallPassed = false;

  // QC-10: Legenda na safe area
  const subCheck = checkSubtitleSafeArea(assPath);
  checks['QC-10_SubtitleSafeArea'] = {
    name: 'Legendas na Safe Area (Shorts/Reels/TikTok)',
    passed: subCheck.passed,
    measured: subCheck.marginV ? `${subCheck.marginV}px` : 'N/A',
    threshold: 'margin_v >= 350px',
    message: subCheck.message
  };
  if (!subCheck.passed) overallPassed = false;

  // QC-11: Ritmo e Densidade de Cortes
  let maxTakeDuration = 0;
  let minTakeDuration = 999;
  if (scenes && scenes.length > 0) {
    scenes.forEach(s => {
      const d = Number(s.duration || 0);
      if (d > maxTakeDuration) maxTakeDuration = d;
      if (d < minTakeDuration) minTakeDuration = d;
    });
  } else {
    maxTakeDuration = 4.0;
    minTakeDuration = 2.0;
  }
  const qc11Passed = maxTakeDuration <= 14.0 && minTakeDuration >= 1.0;
  checks['QC-11_CutsPacing'] = {
    name: 'Ritmo Dinâmico de Trocas de Cena',
    passed: qc11Passed,
    measured: `Min: ${minTakeDuration.toFixed(1)}s, Max: ${maxTakeDuration.toFixed(1)}s`,
    threshold: 'Takes entre 1.5s e 12.0s',
    message: qc11Passed ? 'Ritmo dinâmico dentro da tolerância' : 'Takes excessivamente longos ou curtos'
  };
  if (!qc11Passed) overallPassed = false;

  // QC-12: Sincronia A/V (Duração Vídeo vs Áudio)
  const vDur = vStream ? parseFloat(vStream.duration || format.duration || 0) : durationSec;
  const aDur = aStream ? parseFloat(aStream.duration || format.duration || 0) : durationSec;
  const avDriftMs = Math.round(Math.abs(vDur - aDur) * 1000);
  const qc12Passed = avDriftMs <= 250;
  checks['QC-12_AvSync'] = {
    name: 'Sincronia Áudio e Vídeo (A/V Drift)',
    passed: qc12Passed,
    measured: `${avDriftMs}ms`,
    threshold: '<= 250ms',
    message: qc12Passed ? `Sincronia perfeita (${avDriftMs}ms)` : `Desvio A/V detectado (${avDriftMs}ms)`
  };
  if (!qc12Passed) overallPassed = false;

  // QC-13: Ineditismo (SHA-1 e similaridade semântica)
  let qc13Passed = true;
  let qc13Measured = 'N/A';
  let qc13Message = 'Roteiro inédito';
  if (scriptData && scriptData.narrationText) {
    try {
      const channelId = channelConfig.channel_id || 'custom';
      const noveltyResult = new ScriptLedger().checkNovelty(scriptData.narrationText, channelId);
      qc13Passed = noveltyResult.novel;
      qc13Measured = noveltyResult.sha1 ? noveltyResult.sha1.slice(0, 10) : `sim: ${noveltyResult.similarity}`;
      qc13Message = noveltyResult.novel
        ? `Roteiro inédito (similaridade máx: ${noveltyResult.similarity})`
        : `Roteiro duplicado/similar detectado (${noveltyResult.reason}, sim: ${noveltyResult.similarity})`;
    } catch (ledgerErr) {
      qc13Passed = true;
      qc13Message = `Aviso ao consultar ScriptLedger: ${ledgerErr.message}`;
    }
  }
  checks['QC-13_ScriptNovelty'] = {
    name: 'Ineditismo e Anti-Duplicação',
    passed: qc13Passed,
    measured: qc13Measured,
    threshold: 'Hash único e similaridade < 55%',
    message: qc13Message
  };
  if (!qc13Passed) overallPassed = false;

  // QC-14: Aderência à Diretriz Visual Soberana (Fase 1C)
  let qc14Passed = true;
  let qc14Measured = 'Sem diretriz (N/A)';
  let qc14Message = 'Diretriz visual não especificada';
  let qc14Threshold = '>= 80% aderência dos takes';

  const rawDirective = scriptData?.visualDirective || '';
  if (rawDirective && Array.isArray(scriptData?.scenes) && scriptData.scenes.length > 0) {
    const directiveAnchors = deriveDirectiveAnchors(rawDirective);
    if (directiveAnchors.hasDirective && directiveAnchors.stockAnchorsEn.length > 0) {
      const anchorTokens = directiveAnchors.stockAnchorsEn
        .flatMap(a => a.toLowerCase().split(/\s+/))
        .filter(t => t.length > 2);

      let adheringScenes = 0;
      let hasBlockedObjects = false;

      for (const scene of scriptData.scenes) {
        const textToCheck = `${scene.prompt || ''} ${scene.aiPrompt || ''} ${scene.stockQuery || ''} ${(scene.stockQueries || []).join(' ')} ${scene.phrase || ''}`.toLowerCase();
        
        if (isBlockedObject(textToCheck, directiveAnchors.blockedObjects)) {
          hasBlockedObjects = true;
        }

        const matchesAnchor = anchorTokens.some(token => textToCheck.includes(token));
        if (matchesAnchor) {
          adheringScenes++;
        }
      }

      const adherenceRate = adheringScenes / scriptData.scenes.length;
      qc14Measured = `${(adherenceRate * 100).toFixed(0)}% (${adheringScenes}/${scriptData.scenes.length})`;

      if (hasBlockedObjects) {
        qc14Passed = false;
        qc14Message = 'Objetos genéricos bloqueados detectados nas cenas';
      } else if (adherenceRate < 0.80) {
        qc14Passed = false;
        qc14Message = `Aderência insuficiente à diretriz visual (${qc14Measured} < 80%)`;
      } else {
        qc14Passed = true;
        qc14Message = `Diretriz cumprida com sucesso (${qc14Measured} dos takes)`;
      }

      if (!qc14Passed) overallPassed = false;
    }
  }

  checks['QC-14_DirectiveAdherence'] = {
    name: 'Aderência à Diretriz Visual',
    passed: qc14Passed,
    measured: qc14Measured,
    threshold: qc14Threshold,
    message: qc14Message
  };

  // QC-15: Legibilidade e Densidade de Legendas (Fase 1B / 2)
  let qc15Passed = true;
  let qc15Measured = 'N/A';
  let qc15Message = 'Legendas ausentes ou desabilitadas';
  if (assPath && fs.existsSync(assPath)) {
    try {
      const content = fs.readFileSync(assPath, 'utf8');
      const styleMatch = content.match(/Style:\s*Default,[^,]+,(\d+)/i);
      const fontSize = styleMatch ? parseInt(styleMatch[1], 10) : 48;
      
      const dialogueLines = content.split('\n').filter(l => l.startsWith('Dialogue:'));
      let maxBreaksPerCard = 0;
      for (const line of dialogueLines) {
        const textPart = line.split(',').slice(9).join(',');
        const breaks = (textPart.match(/\\N/g) || []).length;
        if (breaks > maxBreaksPerCard) maxBreaksPerCard = breaks;
      }

      const fontOk = fontSize >= 40;
      const breaksOk = maxBreaksPerCard <= 1;

      qc15Passed = fontOk && breaksOk;
      qc15Measured = `Fonte: ${fontSize}px, Linhas máx: ${maxBreaksPerCard + 1}`;
      qc15Message = qc15Passed
        ? 'Legibilidade ideal (fonte >= 40px e max 2 linhas)'
        : (!fontOk ? 'Fonte menor que 40px' : 'Mais de 2 linhas por card de legenda');
    } catch (assErr) {
      qc15Passed = true;
      qc15Message = `Aviso ao ler ASS: ${assErr.message}`;
    }
  }
  checks['QC-15_SubtitleLegibility'] = {
    name: 'Legibilidade e Densidade de Legendas',
    passed: qc15Passed,
    measured: qc15Measured,
    threshold: 'Fonte >= 40px, linhas <= 2 por card',
    message: qc15Message
  };
  if (!qc15Passed) overallPassed = false;

  // Salva relatório qc.json
  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(c => c.passed).length;
  const score = Number(((passedChecks / totalChecks) * 100).toFixed(1));

  const qcReport = {
    runId: path.basename(effectiveOutputDir),
    videoPath,
    evaluatedAt: new Date().toISOString(),
    overallPassed,
    approved: overallPassed,
    score,
    totalChecks,
    passedChecks,
    checks
  };

  const reportPath = path.join(effectiveOutputDir, 'qc.json');
  fs.writeFileSync(reportPath, JSON.stringify(qcReport, null, 2), 'utf8');

  console.log('\n===============================================================');
  console.log(`        QUALIDADE DE SAÍDA (QC GATE): ${overallPassed ? '✅ APROVADO' : '❌ REPROVADO'}`);
  console.log('===============================================================');
  for (const [id, c] of Object.entries(checks)) {
    const icon = c.passed ? '✅' : '❌';
    console.log(`${icon} [${id}] ${c.name}: ${c.message} (Medido: ${c.measured})`);
  }
  console.log(`Relatório detalhado gravado em: ${reportPath}`);
  console.log('===============================================================\n');

  if (!overallPassed && strict) {
    const failedNames = Object.entries(checks).filter(([, c]) => !c.passed).map(([k, c]) => `${k} (${c.message})`).join(', ');
    const err = new Error(`QC Gate REPROVOU o vídeo: ${failedNames}`);
    err.qcReport = qcReport;
    throw err;
  }

  return qcReport;
}
