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
    // Filtro complexo: Gera fundo escuro com gradiente radial pulsante, ruído sutil de fumaça e movimento lento de zoom
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
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', err => {
        reject(err);
      })
      .run();
  });
}

/**
 * Cria uma cena com efeito Ken Burns (camera zoom dinamico) a partir de uma imagem estatica 9:16
 */
export function createSceneFromImage({
  imagePath,
  durationSeconds,
  outputPath,
  zoomDirection = 'in'
}) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Zoom lento e elegante: zoom-in ou zoom-out
  const zoomFilter = zoomDirection === 'in'
    ? "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(pzoom+0.0015,1.22)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30"
    : "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='if(lte(pzoom,1.0),1.22,max(1.001,pzoom-0.0015))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30";

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1'])
      .outputOptions([
        `-t ${durationSeconds}`,
        `-vf ${zoomFilter}`,
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
 * Gera imagem de inteligência artificial 9:16 altamente cinematográfica para o prompt da cena
 */
export async function generateSceneImageFromPrompt({ prompt, outputPath }) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const cleanPrompt = encodeURIComponent(
    `${prompt}, cinematic 8k, ultra photorealistic, dramatic chiaroscuro lighting, vertical 9:16`
  );
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=720&height=1280&nologo=true&seed=${seed}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { signal: controller.signal });
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
    console.warn(`[Visuals IA] Erro ao gerar imagem remota: ${err.message}`);
  }
  return null;
}

/**
 * Coleta ou gera todas as cenas necessárias para um roteiro
 */
export async function harvestVisualScenes({
  scenes,
  scratchDir,
  channelId = 'psicosegredo'
}) {
  const videoClips = [];
  const channelAssetsDir = path.resolve(`pipeline/assets/scenes/${channelId}`);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const clipPath = path.join(scratchDir, `scene_${i + 1}.mp4`);
    const sceneImgPath = path.join(scratchDir, `scene_${i + 1}_generated.jpg`);

    let imageAsset = null;

    // Detecta se há subpasta temática dedicada (ex: guerreiros_persas ou procrastinacao)
    const allPrompts = scenes.map(s => s.prompt || '').join(' ').toLowerCase();
    let themeSubdir = null;
    if (allPrompts.includes('persian') || allPrompts.includes('persa') || allPrompts.includes('guerreir')) {
      themeSubdir = 'guerreiros_persas';
    } else if (allPrompts.includes('procrastin') || allPrompts.includes('exhausted') || allPrompts.includes('dopamine') || allPrompts.includes('hourglass')) {
      themeSubdir = 'procrastinacao';
    }

    // 1. Prioridade A: Asset temático dedicado em alta resolução para o tópico exato
    if (themeSubdir) {
      const thematicJpg = path.join(channelAssetsDir, themeSubdir, `scene_${i + 1}.jpg`);
      const thematicPng = path.join(channelAssetsDir, themeSubdir, `scene_${i + 1}.png`);
      if (fs.existsSync(thematicJpg)) {
        imageAsset = thematicJpg;
        console.log(`Cena ${i + 1}: Usando visual temático calibrado (${themeSubdir}/scene_${i + 1}.jpg) de acordo com o roteiro!`);
      } else if (fs.existsSync(thematicPng)) {
        imageAsset = thematicPng;
        console.log(`Cena ${i + 1}: Usando visual temático calibrado (${themeSubdir}/scene_${i + 1}.png) de acordo com o roteiro!`);
      }
    }

    // 2. Prioridade B: Gerar imagem de IA sob demanda a partir da descrição do roteiro
    if (!imageAsset && scene.prompt) {
      console.log(`Cena ${i + 1}: Gerando imagem de IA exclusiva a partir da descrição do roteiro...`);
      console.log(`  -> Descrição: "${scene.prompt.slice(0, 85)}..."`);
      const generated = await generateSceneImageFromPrompt({
        prompt: scene.prompt,
        outputPath: sceneImgPath
      });
      if (generated && fs.existsSync(generated)) {
        imageAsset = generated;
        console.log(`  -> Imagem de IA gerada com sucesso (${(fs.statSync(generated).size / 1024).toFixed(0)} KB)`);
      }
    }

    // 3. Fallback de contingência caso nada acima exista
    if (!imageAsset) {
      const sceneJpg = path.join(channelAssetsDir, `scene_${i + 1}.jpg`);
      const scenePng = path.join(channelAssetsDir, `scene_${i + 1}.png`);
      imageAsset = fs.existsSync(sceneJpg) ? sceneJpg : (fs.existsSync(scenePng) ? scenePng : null);
      if (imageAsset) {
        console.log(`Cena ${i + 1}: Fallback para asset existente (${path.basename(imageAsset)})...`);
      }
    }

    if (imageAsset) {
      console.log(`Cena ${i + 1}: Renderizando clipe 9:16 com movimento de câmera Ken Burns...`);
      await createSceneFromImage({
        imagePath: imageAsset,
        durationSeconds: scene.duration,
        outputPath: clipPath,
        zoomDirection: i % 2 === 0 ? 'in' : 'out'
      });
    } else {
      console.log(`Cena ${i + 1}: Gerando cena procedural chiaroscuro...`);
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
