import path from 'path';
import fs from 'fs';

// Carregamento nativo de variaveis de ambiente (.env) sem dependencia externa
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

import { generateScript, loadChannelProfile } from './script_generator.js';
import { synthesizeVoiceWithTimestamps } from './voice_synthesizer.js';
import { generateAssSubtitles, generateSrtSubtitles } from './subtitle_generator.js';
import { alignScenesWithWordBoundaries } from './scene_aligner.js';
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
    platform: 'YOUTUBE_SHORTS',
    geminiKey: null,
    visualMode: 'hybrid', // 'hybrid' (Vídeo no gancho + Imagens HD) | 'video' (Vídeo em tudo) | 'image' (Apenas Imagens)
    batch: 1
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
    } else if ((args[i] === '--batch' || args[i] === '--count') && args[i + 1]) {
      options.batch = Math.max(1, parseInt(args[i + 1], 10) || 1);
      i++;
    } else if ((args[i] === '--url' || args[i] === '--source-url') && args[i + 1]) {
      options.sourceUrl = args[i + 1];
      i++;
    } else if ((args[i] === '--visual-directive' || args[i] === '--image-desc' || args[i] === '--visual' || args[i] === '--style') && args[i + 1]) {
      options.visualDirective = args[i + 1];
      i++;
    } else if ((args[i] === '--visual-mode' || args[i] === '--mode') && args[i + 1]) {
      options.visualMode = args[i + 1].toLowerCase();
      i++;
    } else if ((args[i] === '--gemini-key' || args[i] === '--api-key' || args[i] === '--ai-key') && args[i + 1]) {
      options.geminiKey = args[i + 1];
      i++;
    }
  }

  return options;
}

export async function runSinglePipeline(options, batchIndex = 0, totalBatch = 1) {
  const effectiveGeminiKey = options.geminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  console.log(`Canal: ${options.channel}`);
  console.log(`Script Index: ${options.scriptIndex}`);
  if (options.topic) console.log(`Tema: ${options.topic}`);
  if (options.visualDirective) console.log(`Diretriz Visual das Imagens: "${options.visualDirective}"`);
  console.log(`Plataforma Alvo: ${options.platform}`);
  console.log(`Modo Visual: ${options.visualMode.toUpperCase()}`);
  console.log(`Provedor de Imagens IA: ${effectiveGeminiKey ? 'Google Imagen 3 (imagen-3.0-generate-002) [Ativo]' : 'Fallback Flux HD (Alta Fidelidade Gratuita)'}\n`);

  const runId = `run_${Date.now()}_${batchIndex + 1}`;
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
  console.log('\n>>> [4/6] Calibrando sincronização fonética de cenas (WordBoundaries)...');
  // Sincronização exata da duração com o áudio real gerado (+ 0.3s de respiração natural para fade out)
  const rawAudioDuration = Number(voiceResult.durationSeconds) || 0;
  const targetDurationSeconds = rawAudioDuration > 0
    ? Number((rawAudioDuration + 0.3).toFixed(2))
    : 60.8;

  const alignedScenes = alignScenesWithWordBoundaries({
    scenes: scriptData.scenes,
    wordBoundaries: voiceResult.wordBoundaries,
    totalDurationSeconds: targetDurationSeconds,
    narrationText: scriptData.narrationText
  });

  console.log(`Cenas perfeitamente alinhadas com o áudio (${alignedScenes.length} takes):`);
  alignedScenes.forEach((s, idx) => {
    const cutInfo = s.alignmentType === 'word_boundary_phrase_match'
      ? `[Fonético: "${s.matchedWord || ''}"]`
      : `[Pausa: ${s.alignmentType}]`;
    console.log(`  -> Take ${idx + 1}: ${s.startTime.toFixed(2)}s - ${s.endTime.toFixed(2)}s (${s.duration.toFixed(2)}s) ${cutInfo}`);
  });

  console.log('\n>>> Gerando cenas visuais 9:16 e thumbnail de alto contraste...');
  const videoClips = await harvestVisualScenes({
    scenes: alignedScenes,
    scratchDir: scratchDir,
    channelId: options.channel,
    apiKey: effectiveGeminiKey,
    visualMode: options.visualMode,
    visualDirective: options.visualDirective
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
  const thumbSub = options.visualDirective
    ? options.visualDirective.split(',')[0].slice(0, 24).toUpperCase()
    : (channelProfile.channelName || 'MOTIVACIONAL').toUpperCase();

  await createProceduralThumbnail({
    title: scriptData.title,
    outputPath: thumbPath,
    baseImagePath: thumbBaseImage,
    subtitle: thumbSub
  });
  console.log(`Thumbnail gerada em: ${thumbPath}`);

  // Detecção de trilha sonora de fundo (BGM)
  let bgMusicPath = null;
  const channelMusicDir = path.resolve(`pipeline/assets/music/${options.channel}`);
  const globalMusicDir = path.resolve('pipeline/assets/music');

  if (fs.existsSync(channelMusicDir)) {
    const musicFiles = fs.readdirSync(channelMusicDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
    if (musicFiles.length > 0) bgMusicPath = path.join(channelMusicDir, musicFiles[0]);
  }
  if (!bgMusicPath && fs.existsSync(globalMusicDir)) {
    const musicFiles = fs.readdirSync(globalMusicDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
    if (musicFiles.length > 0) bgMusicPath = path.join(globalMusicDir, musicFiles[0]);
  }

  // 5. Renderização Final com FFmpeg
  console.log('\n>>> [5/6] Renderizando video final com FFmpeg...');
  const finalVideoPath = path.join(outputDir, 'video_final_9x16.mp4');

  const renderResult = await composeFinalVideo({
    videoClips: videoClips,
    audioPath: audioPath,
    subtitlesAssPath: subtitlesPath,
    outputVideoPath: finalVideoPath,
    totalDurationSeconds: targetDurationSeconds,
    bgMusicPath: bgMusicPath
  });

  // 6. Ingestão no AutoPublisher Pro com suporte a agendamento escalonado
  console.log('\n>>> [6/6] Realizando ingestao no AutoPublisher Pro...');
  const ingestResult = await ingestGeneratedPost({
    videoPath: renderResult.videoPath,
    thumbnailPath: thumbPath,
    scriptData: scriptData,
    platform: options.platform,
    batchIndex: batchIndex,
    totalBatch: totalBatch
  });

  console.log('\n===============================================================');
  console.log(`           TAKE [${batchIndex + 1}/${totalBatch}] CONCLUIDO COM SUCESSO!     `);
  console.log('===============================================================');
  console.log(`Video MP4:      ${renderResult.videoPath}`);
  console.log(`Thumbnail PNG:  ${thumbPath}`);
  console.log(`Duracao Final:  ${renderResult.durationSeconds} segundos`);
  console.log(`Elegivel TikTok Rewards: ${renderResult.durationSeconds >= 60 ? 'SIM (>= 60s)' : 'NAO'}`);
  console.log(`Status Ingestao: ${ingestResult.source}`);
  console.log('===============================================================\n');

  return { renderResult, ingestResult };
}

async function main() {
  console.log('===============================================================');
  console.log('   AutoPublisher Pro - AI Content & Faceless Video Pipeline    ');
  console.log('===============================================================\n');

  const options = parseArgs();
  const batchCount = options.batch || 1;
  const results = [];

  for (let b = 0; b < batchCount; b++) {
    if (batchCount > 1) {
      console.log(`\n===============================================================`);
      console.log(`   LOTE DE CONTEÚDO [${b + 1}/${batchCount}] - Script Index #${(options.scriptIndex || 0) + b}`);
      console.log(`===============================================================\n`);
    }

    const currentOptions = {
      ...options,
      scriptIndex: (options.scriptIndex || 0) + b
    };

    const res = await runSinglePipeline(currentOptions, b, batchCount);
    results.push(res);

    if (b < batchCount - 1) {
      console.log(`\nAguardando 1.5s antes do próximo vídeo do lote...`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (batchCount > 1) {
    console.log('\n===============================================================');
    console.log(`   LOTE DE ${batchCount} VÍDEOS CONCLUÍDO E AGENDADO COM SUCESSO!     `);
    console.log('===============================================================');
    results.forEach((r, idx) => {
      console.log(`  [${idx + 1}/${batchCount}] Post: ${r.ingestResult.payload?.id || 'OK'} • ${r.renderResult.durationSeconds}s • Agendado para: ${r.ingestResult.payload?.scheduledTime}`);
    });
    console.log('===============================================================\n');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('\n[FALHA FATAL NO PIPELINE]:', err);
  process.exit(1);
});
