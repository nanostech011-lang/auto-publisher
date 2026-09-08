import path from 'path';
import fs from 'fs';
import { generateScript, loadChannelProfile } from './script_generator.js';
import { synthesizeVoiceWithTimestamps } from './voice_synthesizer.js';
import { generateAssSubtitles, generateSrtSubtitles } from './subtitle_generator.js';
import { harvestVisualScenes, createProceduralThumbnail } from './visuals_harvester.js';
import { composeFinalVideo } from './video_compositor.js';
import { ingestGeneratedPost } from './publisher_ingestor.js';

// Parser simples de argumentos CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    channel: 'psicosegredo',
    scriptIndex: 0,
    topic: null,
    platform: 'YOUTUBE_SHORTS'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' && args[i + 1]) {
      options.channel = args[i + 1];
      i++;
    } else if (args[i] === '--script' && args[i + 1]) {
      options.scriptIndex = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--topic' && args[i + 1]) {
      options.topic = args[i + 1];
      i++;
    } else if (args[i] === '--platform' && args[i + 1]) {
      options.platform = args[i + 1];
      i++;
    } else if ((args[i] === '--url' || args[i] === '--source-url') && args[i + 1]) {
      options.sourceUrl = args[i + 1];
      i++;
    } else if ((args[i] === '--visual-directive' || args[i] === '--image-desc' || args[i] === '--visual' || args[i] === '--style') && args[i + 1]) {
      options.visualDirective = args[i + 1];
      i++;
    }
  }

  return options;
}

async function main() {
  console.log('===============================================================');
  console.log('   AutoPublisher Pro - AI Content & Faceless Video Pipeline    ');
  console.log('===============================================================\n');

  const options = parseArgs();
  console.log(`Canal: ${options.channel}`);
  console.log(`Script Index: ${options.scriptIndex}`);
  if (options.topic) console.log(`Tema: ${options.topic}`);
  if (options.visualDirective) console.log(`Diretriz Visual das Imagens: "${options.visualDirective}"`);
  console.log(`Plataforma Alvo: ${options.platform}\n`);

  const runId = `run_${Date.now()}`;
  const scratchDir = path.resolve(`pipeline/scratch/${runId}`);
  const outputDir = path.resolve(`pipeline/output/${runId}`);
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Carrega Perfil e Roteiro
  console.log('>>> [1/6] Carregando perfil e gerando roteiro estruturado...');
  const channelProfile = loadChannelProfile(options.channel);
  const scriptData = await generateScript({
    channelId: options.channel,
    topic: options.topic,
    scriptIndex: options.scriptIndex,
    sourceUrl: options.sourceUrl,
    visualDirective: options.visualDirective
  });

  console.log(`Titulo: "${scriptData.title}"`);
  console.log(`Total de Palavras: ${scriptData.wordCount}`);
  console.log(`Cenas Previstas: ${scriptData.scenes.length}`);

  // 2. Síntese de Voz Neural com Edge-TTS e Timestamps
  console.log('\n>>> [2/6] Sintetizando locucao neural com Edge-TTS e timestamps...');
  const voiceProfile = channelProfile.voice_profile || {};
  const voiceId = voiceProfile.voice_id || 'pt-BR-AntonioNeural';
  const voiceRate = voiceProfile.rate || '+5%';
  const audioPath = path.join(scratchDir, 'narration.mp3');

  const voiceResult = await synthesizeVoiceWithTimestamps({
    text: scriptData.narrationText,
    voice: voiceId,
    rate: voiceRate,
    outputAudioPath: audioPath
  });

  console.log(`Audio sintetizado com sucesso!`);
  console.log(`Duracao exata: ${voiceResult.durationSeconds}s (${voiceResult.wordBoundaries.length} palavras mapeadas)`);

  // 3. Geração de Legendas Dinâmicas (ASS / Karaokê)
  console.log('\n>>> [3/6] Compilando legendas animadas em estilo karaokê...');
  const subtitlesPath = path.join(scratchDir, 'subtitles.ass');
  const srtPath = path.join(scratchDir, 'subtitles.srt');

  generateAssSubtitles({
    wordBoundaries: voiceResult.wordBoundaries,
    outputAssPath: subtitlesPath
  });
  generateSrtSubtitles({
    wordBoundaries: voiceResult.wordBoundaries,
    outputSrtPath: srtPath
  });
  console.log(`Legendas ASS e SRT compiladas.`);

  // 4. Coleta / Geração dos Cortes Visuais (9:16) e Thumbnail
  console.log('\n>>> [4/6] Gerando cenas visuais 9:16 e thumbnail de alto contraste...');
  // Redimensiona as duracoes das cenas para que somem exatamente a duracao do audio
  const totalSceneBaseDuration = scriptData.scenes.reduce((acc, s) => acc + s.duration, 0);
  const durationScale = voiceResult.durationSeconds / totalSceneBaseDuration;

  const scaledScenes = scriptData.scenes.map((s, idx) => ({
    ...s,
    duration: Number((s.duration * durationScale).toFixed(1))
  }));

  const videoClips = await harvestVisualScenes({
    scenes: scaledScenes,
    scratchDir: scratchDir,
    channelId: options.channel
  });
  console.log(`${videoClips.length} takes visuais gerados.`);

  let thumbBaseImage = null;
  // Prioridade absoluta: buscar primeira imagem gerada com sucesso pela IA na run atual
  for (let i = 1; i <= (videoClips.length || 15); i++) {
    const candidate = path.join(scratchDir, `scene_${i}_generated.jpg`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 5000) {
      thumbBaseImage = candidate;
      console.log(`Usando imagem exclusiva gerada para a thumbnail: scene_${i}_generated.jpg`);
      break;
    }
  }

  if (!thumbBaseImage) {
    thumbBaseImage = path.resolve(`pipeline/assets/scenes/${options.channel}/scene_1.jpg`);
  }
  const thumbPath = path.join(outputDir, 'thumbnail.png');
  await createProceduralThumbnail({
    title: scriptData.title,
    outputPath: thumbPath,
    baseImagePath: thumbBaseImage
  });
  console.log(`Thumbnail gerada em: ${thumbPath}`);

  // 5. Renderização Final com FFmpeg
  console.log('\n>>> [5/6] Renderizando video final com FFmpeg...');
  const finalVideoPath = path.join(outputDir, 'video_final_9x16.mp4');

  const renderResult = await composeFinalVideo({
    videoClips: videoClips,
    audioPath: audioPath,
    subtitlesAssPath: subtitlesPath,
    outputVideoPath: finalVideoPath,
    totalDurationSeconds: Math.ceil(voiceResult.durationSeconds)
  });

  // 6. Ingestão no AutoPublisher Pro
  console.log('\n>>> [6/6] Realizando ingestao no AutoPublisher Pro...');
  const ingestResult = await ingestGeneratedPost({
    videoPath: renderResult.videoPath,
    thumbnailPath: thumbPath,
    scriptData: scriptData,
    platform: options.platform
  });

  console.log('\n===============================================================');
  console.log('           PIPELINE CONCLUIDO COM 100% DE SUCESSO!             ');
  console.log('===============================================================');
  console.log(`Video MP4:      ${renderResult.videoPath}`);
  console.log(`Thumbnail PNG:  ${thumbPath}`);
  console.log(`Duracao Final:  ${renderResult.durationSeconds} segundos`);
  console.log(`Elegivel TikTok Rewards: ${renderResult.durationSeconds >= 60 ? 'SIM (>= 60s)' : 'NAO'}`);
  console.log(`Status Ingestao: ${ingestResult.source}`);
  console.log('===============================================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n[FALHA FATAL NO PIPELINE]:', err);
  process.exit(1);
});
