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

    ffmpeg()
      .input(`color=c=black:s=1080x1920:d=${durationSeconds}:r=30`)
      .inputFormat('lavfi')
      .complexFilter(filterComplex, 'final')
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset ultrafast',
        `-t ${durationSeconds}`
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', err => reject(err))
      .run();
  });
}

/**
 * Cria um clipe de video com movimento de camera de cinema (Ken Burns avancado / Motion Engine)
 * Suporta arquivos de imagem (.jpg, .png) e videoclipes reais (.mp4).
 */
export function createCinematicMotionClip({
  assetPath,
  durationSeconds,
  outputPath,
  motionType = 'push_in'
}) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const isVideo = assetPath.toLowerCase().endsWith('.mp4') || assetPath.toLowerCase().endsWith('.webm');

  // Se já for um arquivo de vídeo (ex: b-roll real), recorta em 9:16 e loopa se necessário
  if (isVideo) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(assetPath)
        .inputOptions(['-stream_loop -1'])
        .outputOptions([
          `-t ${durationSeconds}`,
          '-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
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

  // Motores de movimento cinematográfico diferenciados por tipo
  let motionFilter = '';
  const dSec = Math.max(1, Math.round(durationSeconds));

  switch (motionType) {
    case 'pan_left_right':
      motionFilter = `scale=1240:2204:force_original_aspect_ratio=increase,crop=1240:2204,zoompan=z=1.14:d=1:x='(iw-iw/zoom)*(on/(30*${dSec}))':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
      break;
    case 'pan_right_left':
      motionFilter = `scale=1240:2204:force_original_aspect_ratio=increase,crop=1240:2204,zoompan=z=1.14:d=1:x='(iw-iw/zoom)*(1-on/(30*${dSec}))':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
      break;
    case 'reveal_zoom_out':
      motionFilter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='if(lte(pzoom,1.04),1.22,max(1.04,pzoom-0.0022))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30";
      break;
    case 'atmospheric_drift':
      motionFilter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(pzoom+0.0016,1.18)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30";
      break;
    case 'push_in':
    default:
      motionFilter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(pzoom+0.0022,1.22)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30";
      break;
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(assetPath)
      .inputOptions(['-loop 1'])
      .outputOptions([
        `-t ${durationSeconds}`,
        `-vf ${motionFilter}`,
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
  baseImagePath = null
}) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const cleanTitle = title.replace(/[#]/g, '').replace(/"/g, '').slice(0, 45).toUpperCase();

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    if (baseImagePath && fs.existsSync(baseImagePath)) {
      command
        .input(baseImagePath)
        .complexFilter([
          `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`,
          `[bg]drawbox=y=ih*0.36:color=black@0.70:width=iw:height=ih*0.26:t=fill[box]`,
          `[box]drawtext=text='${cleanTitle}':fontsize=46:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-40:borderw=4:bordercolor=black[v1]`,
          `[v1]drawtext=text='NEUROCIENCIA PRATICA':fontsize=34:fontcolor=0x00E5FF:x=(w-text_w)/2:y=(h-text_h)/2+50:borderw=3:bordercolor=black[final]`
        ], 'final');
    } else {
      command
        .input('color=c=0x080A12:s=1080x1920:d=1:r=1')
        .inputFormat('lavfi')
        .complexFilter([
          `color=c=0xFFD700:s=1080x1920:d=1[glow]`,
          `[glow]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*exp(-((X-540)*(X-540)+(Y-960)*(Y-960))/(1080*400))'[radial]`,
          `[0:v][radial]overlay=0:0[bg]`,
          `[bg]drawtext=text='${cleanTitle}':fontsize=68:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-120:borderw=5:bordercolor=black[v1]`,
          `[v1]drawtext=text='NEUROCIENCIA PRATICA':fontsize=36:fontcolor=0x00E5FF:x=(w-text_w)/2:y=(h-text_h)/2+80:borderw=3:bordercolor=black[final]`
        ], 'final');
    }

    command
      .outputOptions(['-vframes 1'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', err => reject(err))
      .run();
  });
}

/**
 * Gera imagem de IA 9:16 altamente cinematográfica usando Pollinations AI
 */
export async function generateSceneImageFromPrompt({ prompt, outputPath, seed = null, model = null }) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sceneSeed = seed !== null ? seed : Math.floor(Math.random() * 1000000);
  const cleanPrompt = encodeURIComponent(
    `${prompt}, 85mm portrait, highly detailed, dramatic chiaroscuro lighting, vertical 9:16 aspect ratio`
  );

  // 1ª Tentativa: Endpoint padrão acelerado da Pollinations (resposta em ~5-8s)
  const urlPrimary = model
    ? `https://image.pollinations.ai/prompt/${cleanPrompt}?width=768&height=1344&nologo=true&seed=${sceneSeed}&model=${model}`
    : `https://image.pollinations.ai/prompt/${cleanPrompt}?width=768&height=1344&nologo=true&seed=${sceneSeed}`;

  let controller = new AbortController();
  let timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(urlPrimary, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 5000) {
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
      }
    }
  } catch (err) {
    clearTimeout(timeout);
    // Continua para o fallback de modelo alternativo
  }

  // 2ª Tentativa (Fallback com modelo flux explícito ou sem parâmetro)
  try {
    const fallbackModelParam = model ? '' : '&model=flux';
    const urlFallback = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=768&height=1344&nologo=true&seed=${sceneSeed}${fallbackModelParam}`;
    controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(urlFallback, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 5000) {
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
      }
    }
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[Visuals IA] Aviso na geração remota: ${err.message}`);
  }

  return null;
}

/**
 * Coleta ou gera todos os pequenos vídeos/takes necessários para o roteiro
 */
export async function harvestVisualScenes({
  scenes,
  scratchDir,
  channelId = 'psicosegredo'
}) {
  const videoClips = [];
  const channelAssetsDir = path.resolve(`pipeline/assets/scenes/${channelId}`);
  const fixedVideoSeed = Math.floor(Math.random() * 100000);

  console.log(`Iniciando renderizacao de ${scenes.length} takes visuais dinâmicos...`);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const clipPath = path.join(scratchDir, `scene_${i + 1}.mp4`);
    const sceneImgPath = path.join(scratchDir, `scene_${i + 1}_generated.jpg`);
    const motionType = scene.motionType || (i % 2 === 0 ? 'push_in' : 'reveal_zoom_out');

    let assetForClip = null;

    // 1. Gera imagem fresca e exclusiva de IA para esta cena específica com base no prompt
    if (scene.prompt) {
      console.log(`Cena ${i + 1}/${scenes.length} (${scene.duration}s) [Motion: ${motionType}]:`);
      console.log(`  -> Prompt: "${scene.prompt.slice(0, 95)}..."`);
      
      const sceneSeed = fixedVideoSeed + (i * 17); // Semente coerente por vídeo
      const generated = await generateSceneImageFromPrompt({
        prompt: scene.prompt,
        outputPath: sceneImgPath,
        seed: sceneSeed,
        model: null
      });

      if (generated && fs.existsSync(generated)) {
        assetForClip = generated;
        const sizeKb = (fs.statSync(generated).size / 1024).toFixed(0);
        console.log(`  -> Imagem de IA gerada com sucesso (${sizeKb} KB)`);
      }
      // Pequeno espaçamento para cadência estável da API gratuita
      await new Promise(r => setTimeout(r, 800));
    }

    // 2. Fallback resiliente apenas se a IA remota oscilar (nunca interrompe o fluxo)
    if (!assetForClip) {
      const sceneJpg = path.join(channelAssetsDir, `scene_${(i % 5) + 1}.jpg`);
      const scenePng = path.join(channelAssetsDir, `scene_${(i % 5) + 1}.png`);
      assetForClip = fs.existsSync(sceneJpg) ? sceneJpg : (fs.existsSync(scenePng) ? scenePng : null);
      if (assetForClip) {
        console.log(`  -> Fallback resiliente para asset local (${path.basename(assetForClip)})`);
      }
    }

    // 3. Renderiza o pequeno vídeo clip com o movimento de câmera cinematográfico
    if (assetForClip) {
      await createCinematicMotionClip({
        assetPath: assetForClip,
        durationSeconds: scene.duration,
        outputPath: clipPath,
        motionType: motionType
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
