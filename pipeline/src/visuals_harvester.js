import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import ffmpeg, { ffmpegBinary, ffprobeBinary } from './ffmpeg_env.js';
import { generateHighQualitySceneImage } from './ai_image_connector.js';
import { generateCinematicTake } from './ai_video_connector.js';
import {
  fetchAndPrepareStockBroll,
  fetchAndPrepareStockPhoto,
  buildSmartContextualQueries
} from './stock_video_connector.js';
import { validateAssetQuality } from './asset_quality_gate.js';
import { globalAssetCache } from './asset_cache.js';

/**
 * Cria uma cena de vídeo 9:16 procedural com estética dark chiaroscuro usando filtros avançados do FFmpeg.
 * Garante autonomia total sem depender de APIs externas, com qualidade visual broadcast.
 */
export function createProceduralDarkScene({
  durationSeconds,
  outputPath,
  colorSchemeIndex = 0
}) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Esquemas de cores Dark Chiaroscuro (Preto profundo + Destaques em Ciano, Ouro, Roxo)
  const schemes = [
    { base: '0x070B19', glow: '0x00E5FF', name: 'Cyan Brain Synapse' },
    { base: '0x140F07', glow: '0xFFD700', name: 'Golden Amygdala' },
    { base: '0x11071F', glow: '0xBD00FF', name: 'Neon Purple Mind' },
    { base: '0x0A0A0A', glow: '0x2979FF', name: 'Dark Blue Silhouette' },
    { base: '0x120A05', glow: '0xFFA000', name: 'Golden Key Radiance' }
  ];

  const scheme = schemes[colorSchemeIndex % schemes.length];

  return new Promise((resolve, reject) => {
    const filterComplex = [
      `color=c=${scheme.base}:s=1080x1920:d=${durationSeconds}:r=30[bg]`,
      `color=c=${scheme.glow}:s=1080x1920:d=${durationSeconds}:r=30[glow]`,
      `[glow]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*exp(-((X-540)*(X-540)+(Y-960)*(Y-960))/(1080*450))*(0.4+0.2*sin(2*PI*T/3))'[radial]`,
      `[bg][radial]overlay=0:0[scene]`,
      `[scene]noise=alls=10:allf=t+u,curves=vintage[final]`
    ].join(';');

    const args = [
      '-f', 'lavfi',
      '-i', `color=c=black:s=1080x1920:d=${durationSeconds}:r=30`,
      '-filter_complex', filterComplex,
      '-map', '[final]',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-t', String(durationSeconds),
      '-y',
      outputPath
    ];

    execFile(ffmpegBinary, args, (err, stdout, stderr) => {
      if (err) {
        console.error('[FFmpeg procedural scene error]:', err.message);
        if (stderr) console.error(stderr);
        return reject(err);
      }
      resolve(outputPath);
    });
  });
}

/**
 * Constrói filtros procedurais de alta fidelidade para micro-animações estilo Cinemagraph / GIF vivo.
 * Transforma imagens estáticas em tomadas dinâmicas com labaredas, faíscas, vagalumes, estrelas e poeira solar.
 */
export function buildCinemagraphAtmosphericFilters({ fxType, durationSeconds }) {
  if (!fxType || fxType === 'none') return [];

  const filters = [];

  switch (fxType) {
    case 'fire_embers':
      // Modulação térmica suave na luz (flicker de fogueira)
      filters.push("eq=contrast='1.0+0.04*sin(2*PI*t*2.8)':brightness='0.02*sin(2*PI*t*3.4)':gamma_r='1.04+0.04*sin(2*PI*t*2.1)'");
      // Brasas com fade-in e fade-out senoidal suave, eliminando qualquer salto ou teletransporte perceptível
      filters.push("drawtext=text='.':fontsize=48:fontcolor=0xFFA500:x='w*0.48+40*sin(t*3.8)':y='h*0.85-mod(t*110,h*0.45)':alpha='0.85*sin(PI*mod(t*110,h*0.45)/(h*0.45))':shadowcolor=0xFF4500:shadowx=0:shadowy=0");
      filters.push("drawtext=text='.':fontsize=36:fontcolor=0xFFD700:x='w*0.53-45*sin(t*4.2)':y='h*0.80-mod(t*130+120,h*0.45)':alpha='0.85*sin(PI*mod(t*130+120,h*0.45)/(h*0.45))':shadowcolor=0xFF8C00:shadowx=0:shadowy=0");
      filters.push("drawtext=text='.':fontsize=28:fontcolor=0xFFE082:x='w*0.44+60*cos(t*3.1)':y='h*0.75-mod(t*95+60,h*0.40)':alpha='0.80*sin(PI*mod(t*95+60,h*0.40)/(h*0.40))':shadowcolor=0xFF6D00:shadowx=0:shadowy=0");
      break;

    case 'fireflies':
      // Respiração suave da penumbra
      filters.push("eq=contrast='1.0+0.02*sin(2*PI*t*1.2)':brightness='0.015*sin(2*PI*t*1.5)'");
      // Vagalumes com orbes bioluminescentes verde-dourados e pulso orgânico suave
      filters.push("drawtext=text='*':fontsize=28:fontcolor=0xE0FFA0:x='w*0.35+80*sin(t*1.6)':y='h*0.55-mod(t*25,h*0.3)+40*cos(t*1.2)':alpha='0.80*sin(PI*mod(t*25,h*0.3)/(h*0.3))*(0.6+0.4*sin(t*2.2))':shadowcolor=0x80FFA0:shadowx=0:shadowy=0");
      filters.push("drawtext=text='*':fontsize=24:fontcolor=0xC8FF64:x='w*0.65-70*cos(t*1.4)':y='h*0.62-mod(t*20+80,h*0.3)+35*sin(t*1.5)':alpha='0.80*sin(PI*mod(t*20+80,h*0.3)/(h*0.3))*(0.6+0.4*sin(t*2.8+1.0))':shadowcolor=0x64DD17:shadowx=0:shadowy=0");
      filters.push("drawtext=text='*':fontsize=22:fontcolor=0xFFF59D:x='w*0.50+60*sin(t*1.1+1.5)':y='h*0.45-mod(t*30+150,h*0.3)+45*cos(t*1.4)':alpha='0.75*sin(PI*mod(t*30+150,h*0.3)/(h*0.3))*(0.6+0.4*sin(t*1.9+2.0))':shadowcolor=0xFFD54F:shadowx=0:shadowy=0");
      break;

    case 'twinkling_stars':
      // Cintilação atmosférica noturna pura
      filters.push("eq=contrast='1.02+0.02*sin(2*PI*t*1.0)'");
      filters.push("drawtext=text='*':fontsize=26:fontcolor=0xFFFFFF:x='w*0.22':y='h*0.14':alpha='0.1+0.9*pow(abs(sin(t*2.5)),2)':shadowcolor=0x80D8FF:shadowx=0:shadowy=0");
      filters.push("drawtext=text='*':fontsize=22:fontcolor=0xFFF9C4:x='w*0.78':y='h*0.11':alpha='0.15+0.85*pow(abs(sin(t*3.2+1.2)),2)':shadowcolor=0xFFD54F:shadowx=0:shadowy=0");
      filters.push("drawtext=text='*':fontsize=20:fontcolor=0xE0F7FA:x='w*0.50':y='h*0.18':alpha='0.1+0.9*pow(abs(sin(t*2.0+2.2)),2)':shadowcolor=0x40C4FF:shadowx=0:shadowy=0");
      filters.push("drawtext=text='*':fontsize=24:fontcolor=0xFFFFFF:x='w*0.36':y='h*0.24':alpha='0.2+0.8*pow(abs(sin(t*3.8+0.7)),2)':shadowcolor=0x80D8FF:shadowx=0:shadowy=0");
      break;

    case 'sunbeams_dust':
      // Tremulação de luz solar filtrada (Komorebi)
      filters.push("eq=brightness='0.015*sin(2*PI*t*1.2)':gamma='1.02+0.02*sin(2*PI*t*0.8)'");
      // Partículas de poeira solar com fade contínuo
      filters.push("drawtext=text='.':fontsize=40:fontcolor=0xFFE082:x='w*0.42+45*sin(t*1.2)':y='h*0.45-mod(t*25,h*0.35)':alpha='0.75*sin(PI*mod(t*25,h*0.35)/(h*0.35))':shadowcolor=0xFFD54F:shadowx=0:shadowy=0");
      filters.push("drawtext=text='.':fontsize=34:fontcolor=0xFFF8E1:x='w*0.62+40*cos(t*1.5+0.8)':y='h*0.52-mod(t*20+70,h*0.35)':alpha='0.70*sin(PI*mod(t*20+70,h*0.35)/(h*0.35))':shadowcolor=0xFFECB3:shadowx=0:shadowy=0");
      filters.push("drawtext=text='.':fontsize=30:fontcolor=0xFFD54F:x='w*0.50+55*sin(t*0.9+1.5)':y='h*0.58-mod(t*30+130,h*0.35)':alpha='0.65*sin(PI*mod(t*30+130,h*0.35)/(h*0.35))':shadowcolor=0xFFA000:shadowx=0:shadowy=0");
      break;

    case 'anime_aura_sparks':
      // Pulso de energia espiritual de batalha
      filters.push("eq=contrast='1.03+0.05*sin(2*PI*t*3.5)':gamma_b='1.02+0.04*sin(2*PI*t*4.0)'");
      filters.push("drawtext=text='*':fontsize=28:fontcolor=0x00E5FF:x='w*0.50+75*sin(t*5.5)':y='h*0.65-mod(t*160,h*0.40)':alpha='0.85*sin(PI*mod(t*160,h*0.40)/(h*0.40))':shadowcolor=0x00B0FF:shadowx=0:shadowy=0");
      filters.push("drawtext=text='*':fontsize=26:fontcolor=0xFFD700:x='w*0.45-65*cos(t*4.8)':y='h*0.60-mod(t*140+90,h*0.40)':alpha='0.85*sin(PI*mod(t*140+90,h*0.40)/(h*0.40))':shadowcolor=0xFFAB00:shadowx=0:shadowy=0");
      break;
  }

  return filters;
}

/**
 * Detecta inteligentemente o efeito de micro-animação Cinemagraph ideal para a cena
 * com base no texto falado, prompt gerado, estilo visual e índice sequencial da tomada.
 * Garante que o mesmo efeito NUNCA se repita de forma consecutiva.
 */
export function detectSceneCinemagraphFX({ phrase = '', prompt = '', aesthetic = '', sceneIndex = 0, totalScenes = 8, lastFX = null }) {
  const p = (phrase || '').toLowerCase();
  const pr = (prompt || '').toLowerCase();
  const idx = Math.max(0, Number(sceneIndex) || 0);

  let detected = null;

  // 1. Detecção semântica prioritária por palavras-chave na FRASE falada ou no PROMPT gerado
  if (/aura|ki|energia|rel[aâ]mpago|lightning|shonen/i.test(p) || (/anime|shonen|ufotable/i.test(aesthetic) && /aura|energia|fa[ií]sca|poder|combate/i.test(p))) {
    detected = 'anime_aura_sparks';
  } else if (/fogo|fogueira|brasa|chama|lareira|queimar|bonfire|campfire|flame|ember|hearth|torch/i.test(p) || /campfire|bonfire|hearth|fireplace|flame|ember/i.test(pr)) {
    detected = 'fire_embers';
  } else if (/vagalume|vaga-lume|pirilampo|luciola|firefl|bioluminescent/i.test(p) || /firefl|bioluminescent/i.test(pr)) {
    detected = 'fireflies';
  } else if (/estrela|star|c[eé]u\s+estrelado|constela[cç]|twilight\s+sky|night\s+sky|starlight|meia-noite/i.test(p) || /starry\s+night|twinkling\s+stars|starlight|constellation/i.test(pr)) {
    detected = 'twinkling_stars';
  } else if (/sol|sunlight|komorebi|raio|luz\s+filtrada|dust\s+motes|p[oó]len|p[oó]\s+dourad|manh[aã]|dawn/i.test(p) || /komorebi|sunbeam|golden\s+pollen|dust\s+motes/i.test(pr)) {
    detected = 'sunbeams_dust';
  }

  // 2. Rotação artística balanceada sem repetição consecutiva
  const isGhibli = /ghibli|moebius|cozy|medieval|floresta/i.test(aesthetic);
  const isAnime = /anime|shonen|ufotable|manga/i.test(aesthetic);

  const ghibliRotation = ['sunbeams_dust', 'fire_embers', 'fireflies', 'twinkling_stars', 'fire_embers', 'fireflies', 'sunbeams_dust', 'twinkling_stars'];
  const animeRotation = ['anime_aura_sparks', 'sunbeams_dust', 'fire_embers', 'anime_aura_sparks', 'twinkling_stars', 'fire_embers', 'anime_aura_sparks'];
  const defaultRotation = ['sunbeams_dust', 'fire_embers', 'fireflies', 'twinkling_stars', 'fire_embers', 'sunbeams_dust'];

  const palette = isGhibli ? ghibliRotation : (isAnime ? animeRotation : defaultRotation);

  let chosen = detected || palette[idx % palette.length];

  // 3. Regra Mandatória Anti-Repetição Consecutiva: se chosen === lastFX, muda para o próximo efeito da paleta
  if (lastFX && chosen === lastFX) {
    const nextIdx = (idx + 1) % palette.length;
    chosen = palette[nextIdx] === lastFX ? palette[(nextIdx + 1) % palette.length] : palette[nextIdx];
  }

  return chosen;
}

/**
 * Cria um clipe de video com movimento de camera de cinema (Ken Burns avancado / Motion Engine)
 * Suporta arquivos de imagem (.jpg, .png) e videoclipes reais (.mp4), aplicando Cinemagraph FX procedural.
 * Garante transições 100% contínuas e suaves sem nenhum salto, corte abrupto ou retorno ao início.
 */
export function createCinematicMotionClip({
  assetPath,
  durationSeconds,
  outputPath,
  motionType = 'push_in',
  isHookScene = false,
  isLastScene = false,
  cinemagraphFX = null
}) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const isVideo = assetPath.toLowerCase().endsWith('.mp4') || assetPath.toLowerCase().endsWith('.webm');
  const dSec = Math.max(1, Number(durationSeconds) || 3);
  const fadeOutStart = Math.max(0.2, (dSec - 0.20)).toFixed(2);
  // Match cuts ágeis para retenção mobile: fade out suave apenas no último take
  const transitionFade = isLastScene
    ? `,fade=t=out:st=${fadeOutStart}:d=0.20`
    : '';

  // Se já for um arquivo de vídeo (ex: b-roll real), recorta em 9:16 e loopa se necessário
  if (isVideo) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(assetPath)
        .inputOptions(['-stream_loop -1'])
        .outputOptions([
          `-t ${durationSeconds}`,
          `-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920${transitionFade}`,
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-preset fast'
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', err => reject(err))
        .run();
    });
  }

  // Cadeia otimizada: corta 58px de rodapé (remove marca d'água Pollinations), escala com Lanczos para 1080x1920 nativo e aplica unsharp
  const basePrep = `crop=iw:ih-58:0:0,scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,unsharp=5:5:0.9:5:5:0.0`;
  let motionFilter = '';

  switch (motionType) {
    case 'pan_left_right':
      motionFilter = `${basePrep},zoompan=z=1.12:d=1:x='(iw-iw/zoom)*min(1,on/(30*${dSec}))':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
      break;
    case 'pan_right_left':
      motionFilter = `${basePrep},zoompan=z=1.12:d=1:x='(iw-iw/zoom)*max(0,1-on/(30*${dSec}))':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
      break;
    case 'reveal_zoom_out':
      // Zoom out contínuo e suave de 1.15 até 1.03 proporcional à duração do take (SEM RESET)
      motionFilter = `${basePrep},zoompan=z='max(1.03,1.15-(0.12*on/(30*${dSec})))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
      break;
    case 'atmospheric_drift':
      // Respiração cinematográfica suave e contínua
      motionFilter = `${basePrep},zoompan=z='min(1.14,1.03+(0.09*on/(30*${dSec})))':d=1:x='iw/2-(iw/zoom/2)+(iw*0.015)*sin(2*PI*on/(30*${dSec}))':y='ih/2-(ih/zoom/2)+(ih*0.012)*cos(2*PI*on/(30*${dSec}))':s=1080x1920:fps=30`;
      break;
    case 'push_in':
    default:
      // Zoom in contínuo e suave de 1.03 até 1.16 proporcional à duração do take (SEM RESET)
      motionFilter = `${basePrep},zoompan=z='min(1.16,1.03+(0.13*on/(30*${dSec})))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
      break;
  }

  // Gera filtros procedurais de micro-animação viva estilo Cinemagraph / GIF vivo
  const fxFilters = buildCinemagraphAtmosphericFilters({
    fxType: cinemagraphFX,
    durationSeconds: dSec
  });

  const fullFilter = fxFilters.length > 0
    ? `${motionFilter},${fxFilters.join(',')}${transitionFade}`
    : `${motionFilter}${transitionFade}`;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(assetPath)
      .inputOptions(['-framerate 30', '-loop 1'])
      .outputOptions([
        `-t ${durationSeconds}`,
        `-vf ${fullFilter}`,
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', err => reject(err))
      .run();
  });
}

/**
 * Funcao legada para retrocompatibilidade
 */
export function createSceneFromImage({ imagePath, durationSeconds, outputPath, zoomDirection = 'in' }) {
  const motion = zoomDirection === 'out' ? 'reveal_zoom_out' : 'push_in';
  return createCinematicMotionClip({
    assetPath: imagePath,
    durationSeconds,
    outputPath,
    motionType: motion
  });
}

/**
 * Cria a imagem de thumbnail de alto impacto (1080x1920)
 */
export function createProceduralThumbnail({
  title,
  outputPath,
  baseImagePath = null,
  subtitle = null
}) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Sanitiza e formata o título
  const cleanTitle = (title || '')
    .replace(/[#]/g, '')
    .replace(/"/g, '')
    .replace(/'/g, '')
    .replace(/:/g, ' - ')
    .trim()
    .toUpperCase();

  // Divide em até 2 linhas inteligentes se for longo
  const words = cleanTitle.split(/\s+/).filter(Boolean);
  let line1 = '';
  let line2 = '';
  const maxLineChars = 24;

  for (const word of words) {
    if ((line1 + ' ' + word).trim().length <= maxLineChars && !line2) {
      line1 = (line1 + ' ' + word).trim();
    } else {
      line2 = (line2 + ' ' + word).trim();
    }
  }

  if (line2.length > maxLineChars + 8) {
    line2 = line2.slice(0, maxLineChars + 5) + '...';
  }

  const cleanSub = (subtitle || 'SUPERE SEUS LIMITES').replace(/'/g, '').slice(0, 32).toUpperCase();

  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    const filters = [];

    if (baseImagePath && fs.existsSync(baseImagePath)) {
      command.input(baseImagePath);
      filters.push(`scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`);
      filters.push(`[bg]drawbox=y=ih*0.34:color=black@0.78:width=iw:height=ih*0.32:t=fill[box]`);

      if (line2) {
        filters.push(`[box]drawtext=text='${line1}':fontsize=54:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-75:borderw=5:bordercolor=black[t1]`);
        filters.push(`[t1]drawtext=text='${line2}':fontsize=54:fontcolor=0xFFD700:x=(w-text_w)/2:y=(h-text_h)/2-5:borderw=5:bordercolor=black[t2]`);
        filters.push(`[t2]drawtext=text='${cleanSub}':fontsize=32:fontcolor=0x00E5FF:x=(w-text_w)/2:y=(h-text_h)/2+75:borderw=3:bordercolor=black[final]`);
      } else {
        filters.push(`[box]drawtext=text='${line1}':fontsize=58:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-40:borderw=5:bordercolor=black[t1]`);
        filters.push(`[t1]drawtext=text='${cleanSub}':fontsize=34:fontcolor=0x00E5FF:x=(w-text_w)/2:y=(h-text_h)/2+45:borderw=3:bordercolor=black[final]`);
      }

      command
        .complexFilter(filters, 'final')
        .outputOptions(['-vframes 1'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', err => reject(err))
        .run();
    } else {
      const thumbFilters = [
        `color=c=0x080A12:s=1080x1920:d=1:r=1[base]`,
        `color=c=0xFFD700:s=1080x1920:d=1[glow]`,
        `[glow]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*exp(-((X-540)*(X-540)+(Y-960)*(Y-960))/(1080*400))'[radial]`,
        `[base][radial]overlay=0:0[bg]`
      ];

      if (line2) {
        thumbFilters.push(`[bg]drawtext=text='${line1}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-110:borderw=5:bordercolor=black[t1]`);
        thumbFilters.push(`[t1]drawtext=text='${line2}':fontsize=64:fontcolor=0xFFD700:x=(w-text_w)/2:y=(h-text_h)/2-35:borderw=5:bordercolor=black[t2]`);
        thumbFilters.push(`[t2]drawtext=text='${cleanSub}':fontsize=36:fontcolor=0x00E5FF:x=(w-text_w)/2:y=(h-text_h)/2+60:borderw=3:bordercolor=black[final]`);
      } else {
        thumbFilters.push(`[bg]drawtext=text='${line1}':fontsize=70:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-70:borderw=5:bordercolor=black[t1]`);
        thumbFilters.push(`[t1]drawtext=text='${cleanSub}':fontsize=36:fontcolor=0x00E5FF:x=(w-text_w)/2:y=(h-text_h)/2+40:borderw=3:bordercolor=black[final]`);
      }

      const args = [
        '-f', 'lavfi',
        '-i', 'color=c=0x080A12:s=1080x1920:d=1:r=1',
        '-filter_complex', thumbFilters.join(';'),
        '-map', '[final]',
        '-vframes', '1',
        '-y',
        outputPath
      ];

      execFile(ffmpegBinary, args, (err, stdout, stderr) => {
        if (err) {
          console.error('[FFmpeg procedural thumbnail error]:', err.message);
          return reject(err);
        }
        resolve(outputPath);
      });
    }
  });
}

/**
 * Gera imagem de IA 9:16 altamente cinematográfica usando conector profissional (Google Imagen 3 / Fallback Flux)
 */
export async function generateSceneImageFromPrompt({
  prompt,
  outputPath,
  seed = null,
  spokenPhrase = '',
  visualDirective = '',
  channelAesthetic = 'Cinematic Dark Minimalist',
  blockType = 'body',
  motionType = 'push_in',
  apiKey = null
}) {
  const res = await generateHighQualitySceneImage({
    prompt,
    spokenPhrase,
    visualDirective,
    channelAesthetic,
    blockType,
    motionType,
    outputPath,
    seed,
    apiKey
  });
  return res ? res.outputPath : null;
}

/**
 * Adapta um clipe de vídeo fornecido externamente (ex: gerado no Google Flow)
 * para a resolução exata 1080x1920 (9:16), duração da cena e sem áudio.
 */
export function adaptExternalVideoClip({ inputPath, durationSeconds, outputPath }) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .inputOptions(['-stream_loop -1']) // Permite loop suave caso o clipe do Flow seja mais curto
      .outputOptions([
        `-t ${durationSeconds}`,
        '-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-an',
        '-preset fast'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', err => reject(err))
      .run();
  });
}

/**
 * Coleta ou gera todos os pequenos vídeos/takes necessários para o roteiro
 */
export async function harvestVisualScenes({
  scenes,
  scratchDir,
  channelId = 'psicosegredo',
  apiKey = null,
  pexelsApiKey = null,
  visualMode = 'hybrid', // 'hybrid' | 'video' | 'image'
  visualDirective = null,
  flowClipsDir = null
}) {
  const videoClips = [];
  const channelAssetsDir = path.resolve(`pipeline/assets/scenes/${channelId}`);
  const defaultFlowDir = path.resolve('pipeline/inputs/flow');
  const effectiveFlowDir = flowClipsDir || (fs.existsSync(defaultFlowDir) ? defaultFlowDir : null);
  const fixedVideoSeed = Math.floor(Math.random() * 100000);
  const usedPrompts = new Set();
  const usedStockVideoIds = new Set();
  const usedStockPhotoIds = new Set();
  let lastCinemagraphFX = null;

  console.log(`Iniciando renderizacao de ${scenes.length} takes visuais dinâmicos (Modo: ${visualMode.toUpperCase()})...`);
  if (effectiveFlowDir) {
    console.log(`[Google Flow] Diretório de clipes externos ativo: ${effectiveFlowDir}`);
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const clipPath = path.join(scratchDir, `scene_${i + 1}.mp4`);
    const sceneImgPath = path.join(scratchDir, `scene_${i + 1}_generated.jpg`);
    const motionType = scene.motionType || (i % 2 === 0 ? 'push_in' : 'reveal_zoom_out');
    const isHook = (i === 0);
    const isLast = (i === scenes.length - 1);

    let assetForClip = null;

    // Garantia estrita de não-repetição de prompts
    let scenePrompt = scene.prompt;
    if (scenePrompt && usedPrompts.has(scenePrompt)) {
      scenePrompt = `${scenePrompt}, unique composition variation angle #${i + 1}, distinct perspective`;
    }
    if (scenePrompt) usedPrompts.add(scenePrompt);

    const effectiveAesthetic = scene.aesthetic || visualDirective || 'Cinematic Dark Minimalist';
    const effectiveDirective = visualDirective || scene.visualDirective || '';
    const effectivePexelsKey = pexelsApiKey || process.env.PEXELS_API_KEY;

    // Constrói queries contextuais semânticas em inglês para busca no acervo de estoque
    const contextualQueries = buildSmartContextualQueries({
      scene,
      phrase: scene.phrase || '',
      visualDirective: effectiveDirective,
      channelAesthetic: effectiveAesthetic,
      sceneIndex: i
    });

    // Detecção inteligente de micro-animação Cinemagraph (living GIF)
    const cinemagraphFX = scene.cinemagraphFX || detectSceneCinemagraphFX({
      phrase: scene.phrase || '',
      prompt: scenePrompt || '',
      aesthetic: effectiveAesthetic,
      sceneIndex: i,
      totalScenes: scenes.length,
      lastFX: lastCinemagraphFX
    });
    lastCinemagraphFX = cinemagraphFX;

    console.log(`Cena ${i + 1}/${scenes.length} (${scene.duration}s) [Motion: ${motionType} | Cinemagraph: ${cinemagraphFX}]:`);
    if (scenePrompt) {
      console.log(`  -> Prompt Base: "${scenePrompt.slice(0, 85)}..."`);
    }
    // 0. Verifica se há clipe de vídeo do Google Flow ou personalizado fornecido
    if (effectiveFlowDir && fs.existsSync(effectiveFlowDir)) {
      const candidates = [
        path.join(effectiveFlowDir, `scene_${i + 1}.mp4`),
        path.join(effectiveFlowDir, `scene_${i + 1}.webm`),
        path.join(effectiveFlowDir, `scene_${i + 1}.mov`),
        path.join(effectiveFlowDir, `take_${i + 1}.mp4`),
        path.join(effectiveFlowDir, `take_${i + 1}.webm`),
        path.join(effectiveFlowDir, `flow_${i + 1}.mp4`),
        path.join(effectiveFlowDir, `flow_${i + 1}.webm`)
      ];

      let matchedCustomClip = candidates.find(c => fs.existsSync(c));
      if (!matchedCustomClip) {
        const dirFiles = fs.readdirSync(effectiveFlowDir)
          .filter(f => /\.(mp4|mov|webm|mkv)$/i.test(f))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        if (dirFiles[i]) {
          matchedCustomClip = path.join(effectiveFlowDir, dirFiles[i]);
        }
      }

      if (matchedCustomClip) {
        console.log(`  -> [Google Flow] Incorporando clipe de vídeo: ${path.basename(matchedCustomClip)}`);
        try {
          await adaptExternalVideoClip({
            inputPath: matchedCustomClip,
            durationSeconds: scene.duration,
            outputPath: clipPath
          });
          if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 20000) {
            console.log(`  -> [Google Flow] Clipe renderizado e adaptado (1080x1920, ${scene.duration}s)!`);
            videoClips.push(clipPath);
            continue;
          }
        } catch (clipErr) {
          console.warn(`  -> [Google Flow] Falha ao adaptar clipe: ${clipErr.message}, acionando fallback...`);
        }
      }
    }

    // 1. Tenta geração de clipe de vídeo direto via IA (Google Veo 2 / Video AI) se aplicável
    if (visualMode === 'video' || (visualMode === 'hybrid' && isHook)) {
      console.log(`  -> Tentando geração de clipe dinâmico de vídeo IA (Google Veo 2)...`);
      const videoTake = await generateCinematicTake({
        prompt: scenePrompt,
        durationSeconds: scene.duration,
        outputPath: clipPath,
        visualMode: visualMode,
        isHookScene: isHook,
        apiKey: apiKey
      });

      if (videoTake.success && videoTake.isRealVideo && fs.existsSync(clipPath) && fs.statSync(clipPath).size > 20000) {
        console.log(`  -> Clipes de vídeo gerado com sucesso via ${videoTake.provider}!`);
        videoClips.push(clipPath);
        continue;
      }
    }

    // 2. Priorização Inteligente de Stock (Pexels / Pixabay) para Ação Concreta e 1080x1920 Nativo
    const isConcreteSubject = /man|woman|person|people|hands|desk|office|phone|working|walking|running|gym|student|worker|city|crowd|money|finance/i.test(contextualQueries[0] || '');
    const shouldPrioritizeStock = effectivePexelsKey && (scene.suggestedType === 'stock_video' || isConcreteSubject || visualMode === 'video');

    if (shouldPrioritizeStock) {
      console.log(`  -> [Stock Priority] Priorizando acervo de estoque 1080x1920 para sujeito concreto: "${contextualQueries[0]}"`);

      // 2.1 Tenta B-Roll de vídeo real primeiro
      if (visualMode === 'video' || visualMode === 'hybrid') {
        const stockResult = await fetchAndPrepareStockBroll({
          query: contextualQueries[0],
          candidateQueries: contextualQueries,
          outputPath: clipPath,
          durationSeconds: scene.duration,
          isHookScene: isHook,
          isLastScene: isLast,
          pexelsApiKey: effectivePexelsKey,
          usedVideoIds: usedStockVideoIds
        });

        if (stockResult.success && fs.existsSync(clipPath)) {
          const gate = await validateAssetQuality({ filePath: clipPath, strict: false });
          if (gate.passed) {
            console.log(`  -> B-Roll real aprovado pelo Quality Gate via ${stockResult.provider}!`);
            videoClips.push(clipPath);
            continue;
          } else {
            console.warn(`  -> B-Roll rejeitado pelo Quality Gate (${gate.code}): ${gate.reason}. Acionando foto stock...`);
          }
        }
      }

      // 2.2 Tenta Foto Stock de alta resolução se o vídeo não estiver disponível
      if (!assetForClip) {
        const photoResult = await fetchAndPrepareStockPhoto({
          query: contextualQueries[0],
          candidateQueries: contextualQueries,
          outputPath: sceneImgPath,
          pexelsApiKey: effectivePexelsKey,
          usedPhotoIds: usedStockPhotoIds
        });

        if (photoResult.success && fs.existsSync(photoResult.outputPath)) {
          const gate = await validateAssetQuality({ filePath: photoResult.outputPath, strict: false });
          if (gate.passed) {
            assetForClip = photoResult.outputPath;
            console.log(`  -> Foto contextual 1080x1920 aprovada pelo Quality Gate via ${photoResult.provider}`);
          }
        }
      }
    }

    // 3. Geração de Imagem IA (Pollinations / Imagen) com Cache e Circuit Breaker
    const sceneSeed = fixedVideoSeed + (i * 1039) + 77; // Semente estritamente única por take
    const blockType = i === 0 ? 'hook' : (i >= scenes.length - 2 ? 'cta' : (i >= Math.floor(scenes.length * 0.65) ? 'hack' : 'body'));

    if (!assetForClip && apiKey) {
      const generated = await generateHighQualitySceneImage({
        prompt: scenePrompt,
        spokenPhrase: scene.phrase || '',
        visualDirective: effectiveDirective,
        channelAesthetic: effectiveAesthetic,
        blockType: scene.blockType || blockType,
        motionType: motionType,
        outputPath: sceneImgPath,
        seed: sceneSeed,
        apiKey: apiKey
      });

      if (generated && fs.existsSync(generated.outputPath)) {
        const gate = await validateAssetQuality({ filePath: generated.outputPath, strict: false });
        if (gate.passed) {
          assetForClip = generated.outputPath;
          console.log(`  -> Imagem IA pronta e validada via ${generated.provider} (${generated.sizeKb} KB)`);
        } else {
          console.warn(`  -> Imagem IA rejeitada pelo Quality Gate (${gate.code}): ${gate.reason}`);
        }
      }
    }

    // 4. Fallback Secundário de Stock Photo (caso a IA tenha oscilado ou sido reprovada)
    if (!assetForClip && effectivePexelsKey) {
      console.log(`  -> Consultando acervo fotográfico contextual 9:16 (Pexels / Pixabay)...`);
      const photoResult = await fetchAndPrepareStockPhoto({
        query: contextualQueries[0],
        candidateQueries: contextualQueries,
        outputPath: sceneImgPath,
        pexelsApiKey: effectivePexelsKey,
        usedPhotoIds: usedStockPhotoIds
      });

      if (photoResult.success && fs.existsSync(photoResult.outputPath)) {
        const gate = await validateAssetQuality({ filePath: photoResult.outputPath, strict: false });
        if (gate.passed) {
          assetForClip = photoResult.outputPath;
          console.log(`  -> Foto contextual integrada via ${photoResult.provider} (termo: "${photoResult.matchedQuery}")`);
        }
      }
    }

    // 5. Fallback Temático Inteligente (Verifica diretório específico da diretriz ou nicho)
    if (!assetForClip) {
      const idx = (i % 5) + 1;
      const themeSubdir = (effectiveDirective && /persa/i.test(effectiveDirective))
        ? 'guerreiros_persas'
        : (/procrastin/i.test(scene.phrase || '') ? 'procrastinacao' : null);

      const candidates = [];
      if (themeSubdir) {
        candidates.push(path.join(channelAssetsDir, themeSubdir, `scene_${idx}.jpg`));
        candidates.push(path.join('pipeline/assets/scenes/psicosegredo', themeSubdir, `scene_${idx}.jpg`));
        candidates.push(path.join('/app/pipeline/assets/scenes/psicosegredo', themeSubdir, `scene_${idx}.jpg`));
      }
      candidates.push(
        path.join(channelAssetsDir, `scene_${idx}.jpg`),
        path.join(channelAssetsDir, `scene_${idx}.png`),
        path.join('pipeline/assets/scenes/psicosegredo', `scene_${idx}.jpg`),
        path.join('pipeline/assets/scenes/psicosegredo', `scene_${idx}.png`),
        path.join('/app/pipeline/assets/scenes/psicosegredo', `scene_${idx}.jpg`),
        path.join('/app/pipeline/assets/scenes/psicosegredo', `scene_${idx}.png`)
      );

      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          assetForClip = cand;
          break;
        }
      }
      if (assetForClip) {
        console.log(`  -> Fallback resiliente para asset temático (${path.basename(path.dirname(assetForClip))}/${path.basename(assetForClip)})`);
      }
    }

    // 6. Renderiza o pequeno vídeo clip com o movimento de câmera cinematográfico e Cinemagraph FX
    if (assetForClip) {
      await createCinematicMotionClip({
        assetPath: assetForClip,
        durationSeconds: scene.duration,
        outputPath: clipPath,
        motionType: motionType,
        isHookScene: isHook,
        isLastScene: isLast,
        cinemagraphFX: cinemagraphFX
      });
    } else {
      console.log(`  -> Gerando cena procedural Chiaroscuro de contingência...`);
      await createProceduralDarkScene({
        durationSeconds: scene.duration,
        outputPath: clipPath,
        colorSchemeIndex: i
      });
    }

    videoClips.push(clipPath);
  }

  return videoClips;
}
