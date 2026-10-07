import path from 'path';
import fs from 'fs';

// Carregamento nativo de variaveis de ambiente (.env) sem dependencia externa
try {
  if (typeof process.loadEnvFile === 'function') {
    if (fs.existsSync('.env')) {
      process.loadEnvFile('.env');
    } else if (fs.existsSync('../.env')) {
      process.loadEnvFile('../.env');
    }
  }
} catch (ignored) {}

import { generateScript, loadChannelProfile } from './script_generator.js';
import { resolveChannelConfig } from './config_resolver.js';
import { synthesizeVoiceWithTimestamps } from './voice_synthesizer.js';
import { enhancePtBrProsody, clampRate, synthesizeSegmentedVoiceWithTimestamps } from './ptbr_prosody_enhancer.js';
import { generateAssSubtitles, generateSrtSubtitles } from './subtitle_generator.js';
import { alignScenesWithWordBoundaries } from './scene_aligner.js';
import { planBeatsAndSubTakes } from './beat_planner.js';
import { generateDynamicStoryboard } from './ai_storyboarder.js';
import { harvestVisualScenes, createProceduralThumbnail } from './visuals_harvester.js';
import { composeFinalVideo } from './video_compositor.js';
import { ingestGeneratedPost } from './publisher_ingestor.js';
import { runQualityControlGate } from './qc_gate.js';
import { uploadPostAssetsToDrive } from './drive_uploader.js';
import { getMediaLedger } from './media_ledger.js';
import { estimateWordBoundaries, estimateVisualDuration } from './timing_estimator.js';
import { extractSourceAudio } from './source_audio_extractor.js';

// Parser simples de argumentos CLI
function parseArgs() {
  const args = process.argv.slice(2);
  let options = {
    channel: 'custom',
    scriptIndex: 0,
    topic: null,
    platform: 'YOUTUBE_SHORTS',
    geminiKey: null,
    pexelsKey: null,
    visualMode: 'hybrid', // 'hybrid' | 'video' | 'image'
    audioMode: 'tts', // 'tts' | 'none' | 'source_audio'
    targetDurationSec: null,
    batch: 1,
    enableSubtitles: true,
    channelName: null,
    niche: null,
    voiceId: null,
    affiliateUrl: null,
    subtitlesTheme: null,
    subtitlesLayout: 'full_sentences',
    title: null,
    narrationText: null,
    firstComment: null
  };

  // 1. Se foi passado arquivo de configuração (--config-file)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config-file' && args[i + 1]) {
      const cfgPath = path.resolve(args[i + 1]);
      if (fs.existsSync(cfgPath)) {
        try {
          const fileConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          options = { ...options, ...fileConfig };
        } catch (e) {
          console.warn('[Pipeline] Aviso: Falha ao carregar config file:', e.message);
        }
      }
    }
  }

  // 2. Flags de linha de comando
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
    } else if ((args[i] === '--pexels-key' || args[i] === '--pexels-api-key') && args[i + 1]) {
      options.pexelsKey = args[i + 1];
      i++;
    } else if (args[i] === '--no-subtitles' || args[i] === '--sem-legenda') {
      options.enableSubtitles = false;
    } else if (args[i] === '--subtitles' || args[i] === '--com-legenda') {
      options.enableSubtitles = true;
    } else if (args[i] === '--subtitles-layout' && args[i + 1]) {
      options.subtitlesLayout = args[i + 1].toLowerCase();
      i++;
    } else if ((args[i] === '--flow-clips-dir' || args[i] === '--clips-dir') && args[i + 1]) {
      options.flowClipsDir = path.resolve(args[i + 1]);
      i++;
    } else if ((args[i] === '--channel-name' || args[i] === '--name') && args[i + 1]) {
      options.channelName = args[i + 1];
      i++;
    } else if ((args[i] === '--niche') && args[i + 1]) {
      options.niche = args[i + 1];
      i++;
    } else if ((args[i] === '--voice' || args[i] === '--voice-id') && args[i + 1]) {
      options.voiceId = args[i + 1];
      i++;
    } else if ((args[i] === '--affiliate-url' || args[i] === '--cta-url') && args[i + 1]) {
      options.affiliateUrl = args[i + 1];
      i++;
    } else if ((args[i] === '--subtitles-theme' || args[i] === '--sub-theme') && args[i + 1]) {
      options.subtitlesTheme = args[i + 1];
      i++;
    } else if (args[i] === '--title' && args[i + 1]) {
      options.title = args[i + 1];
      i++;
    } else if ((args[i] === '--narration-text' || args[i] === '--script-text') && args[i + 1]) {
      options.narrationText = args[i + 1];
      i++;
    } else if (args[i] === '--first-comment' && args[i + 1]) {
      options.firstComment = args[i + 1];
      i++;
    } else if (args[i] === '--audio-mode' && args[i + 1]) {
      options.audioMode = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--no-voice' || args[i] === '--sem-voz') {
      options.audioMode = 'none';
    } else if ((args[i] === '--duration' || args[i] === '--target-duration') && args[i + 1]) {
      options.targetDurationSec = parseFloat(args[i + 1]);
      i++;
    }
  }

  return options;
}

/**
 * Tenta renderizar o vídeo final. Se falhar com legenda habilitada,
 * tenta automaticamente sem legenda como fallback de resiliência.
 */
async function renderWithFallback({
  videoClips,
  audioPath,
  subtitlesPath,
  finalVideoPath,
  targetDurationSeconds,
  bgMusicPath,
  enableSubtitles,
  audioProfile = {}
}) {
  let renderResult = null;
  let usedSubtitles = enableSubtitles;

  // Tentativa 1: com as configurações solicitadas (com ou sem legenda)
  try {
    renderResult = await composeFinalVideo({
      videoClips,
      audioPath,
      subtitlesAssPath: subtitlesPath,
      outputVideoPath: finalVideoPath,
      totalDurationSeconds: targetDurationSeconds,
      bgMusicPath,
      enableSubtitles,
      audioProfile
    });

    // Validação de tamanho mínimo (500 KB = 512000 bytes)
    if (!renderResult || !renderResult.videoPath || !fs.existsSync(renderResult.videoPath)) {
      throw new Error('Arquivo de saída não encontrado após render');
    }
    const stat = fs.statSync(renderResult.videoPath);
    if (stat.size < 512000) {
      throw new Error(`Arquivo de saída muito pequeno: ${stat.size} bytes (mínimo esperado: 512000)`);
    }

    return renderResult;

  } catch (primaryErr) {
    console.error(`\n[Pipeline] ❌ Erro na renderização primária: ${primaryErr.message}`);

    // Fallback automático: se falhou COM legenda, tenta SEM legenda
    if (enableSubtitles) {
      console.warn('[Pipeline] ↳ Acionando fallback automático SEM legendas queimadas...');
      usedSubtitles = false;

      // Limpa arquivo de saída corrompido se existir
      if (fs.existsSync(finalVideoPath)) {
        fs.unlinkSync(finalVideoPath);
      }

      try {
        renderResult = await composeFinalVideo({
          videoClips,
          audioPath,
          subtitlesAssPath: subtitlesPath,
          outputVideoPath: finalVideoPath,
          totalDurationSeconds: targetDurationSeconds,
          bgMusicPath,
          enableSubtitles: false,
          audioProfile
        });

        const stat = fs.statSync(renderResult.videoPath);
        if (stat.size < 512000) {
          throw new Error(`Fallback também produziu arquivo pequeno: ${stat.size} bytes`);
        }

        console.log('[Pipeline] ✅ Vídeo renderizado com sucesso (sem legendas queimadas).');
        console.warn('[Pipeline] ⚠️  ATENÇÃO: As legendas foram geradas nos arquivos .ass e .srt, mas NÃO estão queimadas no vídeo. Verifique o escape do path no video_compositor.js.');
        return { ...renderResult, subtitlesBurned: false, fallbackUsed: true };

      } catch (fallbackErr) {
        throw new Error(`Falha na renderização primária E no fallback: ${primaryErr.message} | Fallback: ${fallbackErr.message}`);
      }
    }

    throw primaryErr;
  }
}

export async function runSinglePipeline(options, batchIndex = 0, totalBatch = 1) {
  try {
    const effectiveGeminiKey = options.geminiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const effectivePexelsKey = options.pexelsKey || process.env.PEXELS_API_KEY;

  console.log(`Canal: ${options.channel}`);
  console.log(`Script Index: ${options.scriptIndex}`);
  if (options.topic) console.log(`Tema: ${options.topic}`);
  if (options.visualDirective) console.log(`Diretriz Visual das Imagens: "${options.visualDirective}"`);
  console.log(`Plataforma Alvo: ${options.platform}`);
  console.log(`Modo Visual: ${options.visualMode.toUpperCase()}`);
  console.log(`Legendas Queimadas: ${options.enableSubtitles ? 'SIM (com fallback automático)' : 'NÃO'}`);
  console.log(`Provedor de Imagens IA: Pollinations AI (sana 576x1024 com upscale Lanczos 1080x1920)`);
  console.log(`Provedor de B-Roll: ${effectivePexelsKey ? 'Pexels Video API (Alta Fidelidade HD) [Ativo]' : 'Fallback Cinemagraph Procedural'}\n`);

  const runId = `run_${Date.now()}_${batchIndex + 1}`;
  const scratchDir = path.resolve(`pipeline/scratch/${runId}`);
  const outputDir = path.resolve(`pipeline/output/${runId}`);
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Carrega Perfil e Roteiro
  console.log('>>> [1/6] Carregando perfil e gerando roteiro estruturado...');
  const baseProfile = resolveChannelConfig(options.channel);
  const channelProfile = {
    ...baseProfile,
    channel_id: options.channel,
    name: options.channelName || baseProfile.name || `@${options.channel}`,
    channelName: options.channelName || baseProfile.channelName || baseProfile.name || `@${options.channel}`,
    niche: options.niche || baseProfile.niche || 'Geral',
    voice_profile: {
      ...baseProfile.voice_profile,
      voice_id: options.voiceId || baseProfile.voice_profile?.voice_id || 'pt-BR-AntonioNeural'
    },
    publishing_profile: {
      ...baseProfile.publishing_profile,
      affiliate_cta: {
        ...baseProfile.publishing_profile?.affiliate_cta,
        description_template: options.affiliateUrl 
          ? `👉 Acesse o link oficial: ${options.affiliateUrl}` 
          : baseProfile.publishing_profile?.affiliate_cta?.description_template,
        first_comment: options.firstComment 
          ? options.firstComment
          : (options.affiliateUrl 
              ? `👉 Link oficial fixado: ${options.affiliateUrl}` 
              : baseProfile.publishing_profile?.affiliate_cta?.first_comment)
      }
    }
  };

  const scriptData = await generateScript({
    channelId: options.channel,
    topic: options.topic,
    scriptIndex: options.scriptIndex,
    sourceUrl: options.sourceUrl,
    customProfile: channelProfile,
    visualDirective: options.visualDirective,
    geminiKey: effectiveGeminiKey,
    customTitle: options.title,
    customNarration: options.narrationText,
    customComment: options.firstComment
  });

  console.log(`Titulo: "${scriptData.title}"`);
  console.log(`Total de Palavras: ${scriptData.wordCount}`);
  console.log(`Cenas Previstas: ${scriptData.scenes.length}`);

  // 2. Configuração de Áudio / Síntese de Voz Neural
  const audioMode = (options.audioMode || 'tts').toLowerCase();
  let voiceResult = null;
  let audioPath = null;
  let targetDurationSeconds = 0;

  if (audioMode === 'none') {
    console.log('\n>>> [2/6] Modo de Áudio: NENHUM (Vídeo puramente visual, sem locução)...');
    
    // Determina a duração visual alvo
    const defaultVisualDuration = options.targetDurationSec || channelProfile?.format?.target_duration_seconds || 15.0;
    targetDurationSeconds = estimateVisualDuration(scriptData.scenes, scriptData.narrationText, defaultVisualDuration);
    if (options.targetDurationSec && options.targetDurationSec > 0) {
      targetDurationSeconds = Number(options.targetDurationSec.toFixed(2));
    }

    // Se o usuário tem texto narrado ou legendas habilitadas, gera wordBoundaries sintéticos proporcionais
    const enhancedNarration = scriptData.narrationText ? enhancePtBrProsody(scriptData.narrationText) : '';
    scriptData.spokenText = enhancedNarration;

    const syntheticBoundaries = enhancedNarration
      ? estimateWordBoundaries(enhancedNarration, targetDurationSeconds)
      : [];

    voiceResult = {
      audioPath: null,
      durationSeconds: targetDurationSeconds,
      wordBoundaries: syntheticBoundaries
    };

    console.log(`Duração visual planejada: ${targetDurationSeconds}s (${syntheticBoundaries.length} palavras mapeadas para legendas)`);
  } else if (audioMode === 'source_audio') {
    console.log('\n>>> [2/6] Modo de Áudio: REAPROVEITAR ÁUDIO DO VÍDEO FONTE...');
    audioPath = path.join(scratchDir, 'source_audio.mp3');
    const sourceUrl = options.sourceUrl || scriptData.sourceUrl;
    if (!sourceUrl) {
      throw new Error('Modo SOURCE_AUDIO exige a especificação de uma URL de origem (--url <link>).');
    }

    const extResult = await extractSourceAudio(sourceUrl, audioPath, {
      targetLufs: channelProfile.audio_profile?.target_lufs || -14.0
    });

    targetDurationSeconds = Number(extResult.durationSeconds.toFixed(2));
    const enhancedNarration = scriptData.narrationText ? enhancePtBrProsody(scriptData.narrationText) : '';
    scriptData.spokenText = enhancedNarration;

    const syntheticBoundaries = enhancedNarration
      ? estimateWordBoundaries(enhancedNarration, targetDurationSeconds)
      : [];

    voiceResult = {
      audioPath: extResult.audioPath,
      durationSeconds: targetDurationSeconds,
      wordBoundaries: syntheticBoundaries
    };
    console.log(`Áudio de origem extraído com sucesso (${targetDurationSeconds}s)! Status do post será REVISAO_MANUAL.`);
  } else {
    console.log('\n>>> [2/6] Sintetizando locucao neural com Edge-TTS e timestamps...');
    const voiceProfile = channelProfile.voice_profile || {};
    const voiceId = options.voiceId || voiceProfile.voice_id || 'pt-BR-AntonioNeural';
    // Taxa e tom estritamente calibrados para fala humana 100% natural, sem distorção robótica (Decisão D6: [-6%, +4%])
    const rawVoiceRate = options.voiceRate || (options.voiceId ? '+0%' : (voiceProfile.rate || '+0%'));
    const voiceRate = clampRate(rawVoiceRate, '+0%');
    const voicePitch = options.voicePitch || (options.voiceId ? '+0Hz' : (voiceProfile.pitch || '+0Hz'));
    audioPath = path.join(scratchDir, 'narration.mp3');

    // Enriquecimento prosódico PT-BR: acentos rigorosos, pausas respiratórias e expansões fonéticas
    const enhancedNarration = enhancePtBrProsody(scriptData.narrationText);
    scriptData.spokenText = enhancedNarration;

    try {
      voiceResult = await synthesizeVoiceWithTimestamps({
        text: enhancedNarration,
        voice: voiceId,
        rate: voiceRate,
        pitch: voicePitch,
        outputAudioPath: audioPath
      });
    } catch (ttsErr) {
      console.warn(`[Pipeline] ⚠️ Síntese contínua falhou (${ttsErr.message}). Acionando fallback resiliente para síntese segmentada por blocos...`);
      voiceResult = await synthesizeSegmentedVoiceWithTimestamps({
        text: enhancedNarration,
        voice: voiceId,
        baseRate: voiceRate,
        pitch: voicePitch,
        outputAudioPath: audioPath,
        scratchDir,
        blocks: scriptData.blocks
      });
    }

    console.log(`Audio sintetizado com sucesso!`);
    console.log(`Duracao exata: ${voiceResult.durationSeconds}s (${voiceResult.wordBoundaries.length} palavras mapeadas)`);

    if (voiceResult.wordBoundaries.length < 5) {
      console.warn('[Pipeline] ⚠️  Poucos wordBoundaries capturados — Edge-TTS pode ter tido falha parcial. Verifique a qualidade do áudio.');
    }

    const rawAudioDuration = Number(voiceResult.durationSeconds) || 0;
    // Duração alvo estritamente sincronizada com a locução (+ 0.15s de respiro final natural)
    targetDurationSeconds = rawAudioDuration > 0
      ? Number((rawAudioDuration + 0.15).toFixed(2))
      : (channelProfile?.format?.target_duration_seconds || 60.0);
  }

  // 3. Geração de Legendas Dinâmicas (ASS / Karaokê)
  console.log('\n>>> [3/6] Compilando legendas animadas em estilo karaokê...');
  const subtitlesPath = path.join(scratchDir, 'subtitles.ass');
  const srtPath = path.join(scratchDir, 'subtitles.srt');

  // Seleciona tema e layout de legenda: do dashboard, perfil do canal ou padrão
  const channelSubStyle = channelProfile.visual_profile?.subtitles_style;
  const channelSubTheme = options.subtitlesTheme || channelSubStyle?.theme || 'GOLD_PUNCH';
  const effectiveSubLayout = options.subtitlesLayout || channelSubStyle?.layout || 'full_sentences';

  if (options.enableSubtitles && voiceResult.wordBoundaries.length > 0) {
    console.log(`Tema de legenda aplicado: "${channelSubTheme}" (Layout: ${effectiveSubLayout.toUpperCase()})`);

    generateAssSubtitles({
      wordBoundaries: voiceResult.wordBoundaries,
      outputAssPath: subtitlesPath,
      theme: channelSubTheme,
      // Se o usuário selecionou tema no painel, as cores do tema selecionado têm precedência absoluta
      fontName: channelSubStyle?.font_name || null,
      fontSize: channelSubStyle?.font_size || null,
      primaryColor: options.subtitlesTheme ? null : (channelSubStyle?.primary_color || null),
      activeWordColor: options.subtitlesTheme ? null : (channelSubStyle?.active_word_color || null),
      outlineColor: channelSubStyle?.outline_color || null,
      outlineWidth: channelSubStyle?.outline_width || null,
      marginV: channelSubStyle?.margin_v || null,
      popAnimation: true,
      subtitlesLayout: effectiveSubLayout,
      spokenText: scriptData.spokenText || scriptData.narrationText
    });
    generateSrtSubtitles({
      wordBoundaries: voiceResult.wordBoundaries,
      outputSrtPath: srtPath,
      subtitlesLayout: effectiveSubLayout,
      spokenText: scriptData.spokenText || scriptData.narrationText
    });
    console.log(`Legendas ASS e SRT compiladas.`);
  } else {
    console.log(`Legendas não geradas (desabilitadas ou sem texto).`);
  }

  // 4. Coleta / Geração dos Cortes Visuais (9:16) e Thumbnail
  console.log('\n>>> [4/6] Calibrando sincronização fonética e densidade de cortes (Beat Planner)...');

  // 4.1 Subdivide beats longos para cumprir a densidade cinematográfica (2 a 4 segundos por take)
  const cutsInterval = channelProfile?.format?.cuts_interval_seconds || '2-4';
  const plannedScenes = planBeatsAndSubTakes({
    scenes: scriptData.scenes,
    totalDurationSeconds: targetDurationSeconds,
    cutsIntervalStr: cutsInterval
  });

  const alignedScenes = alignScenesWithWordBoundaries({
    scenes: plannedScenes,
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

  console.log('\n>>> [4.2] Storyboarder Cinematográfico: Orquestrando diretrizes visuais e shot-list...');
  const storyboardScenes = await generateDynamicStoryboard({
    takes: alignedScenes,
    channelProfile,
    visualDirective: options.visualDirective,
    geminiKey: effectiveGeminiKey,
    topic: scriptData.title || options.topic
  });

  console.log('\n>>> Gerando cenas visuais 9:16 e thumbnail de alto contraste...');
  const videoClips = await harvestVisualScenes({
    scenes: storyboardScenes,
    scratchDir: scratchDir,
    channelId: options.channel,
    apiKey: effectiveGeminiKey,
    pexelsApiKey: effectivePexelsKey,
    visualMode: options.visualMode,
    visualDirective: options.visualDirective,
    flowClipsDir: options.flowClipsDir
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
    : (channelProfile.channelName || channelProfile.name || 'MOTIVACIONAL').toUpperCase();

  await createProceduralThumbnail({
    title: scriptData.title,
    outputPath: thumbPath,
    baseImagePath: thumbBaseImage,
    subtitle: thumbSub
  });
  console.log(`Thumbnail gerada em: ${thumbPath}`);

  // Detecção de trilha sonora de fundo (BGM)
  let bgMusicPath = null;
  const configuredTrack = channelProfile.audio_profile?.bg_music_track;
  if (configuredTrack) {
    const candidatePaths = [
      path.resolve(`pipeline/assets/music/${options.channel}/${configuredTrack}`),
      path.resolve(`pipeline/assets/music/${configuredTrack}`),
      path.resolve(configuredTrack)
    ];
    for (const cp of candidatePaths) {
      if (fs.existsSync(cp)) {
        bgMusicPath = cp;
        break;
      }
    }
  }
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

  // 5. Renderização Final com FFmpeg (com fallback automático sem legenda)
  console.log('\n>>> [5/6] Renderizando video final com FFmpeg...');
  const finalVideoPath = path.join(outputDir, 'video_final_9x16.mp4');

  const renderResult = await renderWithFallback({
    videoClips,
    audioPath,
    subtitlesPath,
    finalVideoPath,
    targetDurationSeconds,
    bgMusicPath,
    enableSubtitles: options.enableSubtitles,
    audioProfile: channelProfile.audio_profile || {}
  });

  // 5.5 Quality Control Gate (13 Checagens Contratuais)
  console.log('\n>>> [QC Gate] Executando Gate de Qualidade com 13 checagens contratuais...');
  let qcReport = null;
  try {
    qcReport = await runQualityControlGate({
      videoPath: renderResult.videoPath,
      assPath: subtitlesPath,
      scriptData: scriptData,
      scenes: alignedScenes,
      outputDir: outputDir,
      channelConfig: channelProfile,
      strict: false
    });
  } catch (qcErr) {
    console.warn(`[QC Gate] Alerta durante validação de qualidade: ${qcErr.message}`);
  }

  // 5.8 Upload dos ativos para o Google Drive (com fallback offline transparente)
  console.log('\n>>> [Drive Upload] Preparando upload de ativos para Google Drive...');
  let driveAssets = { videoDriveId: null, thumbnailDriveId: null, isOffline: true };
  try {
    driveAssets = await uploadPostAssetsToDrive({
      videoPath: renderResult.videoPath,
      thumbnailPath: thumbPath,
      channelConfig: channelProfile,
      options: options
    });
  } catch (driveErr) {
    console.warn(`[Drive Upload] Alerta no upload para o Drive: ${driveErr.message}. Prosseguindo com IDs locais.`);
  }

  // 5.9 Salvamento de Manifestos Estruturados (SDD v3.0 §3.7 e §7)
  try {
    fs.writeFileSync(path.join(outputDir, 'script.json'), JSON.stringify(scriptData, null, 2), 'utf8');
    fs.writeFileSync(path.join(outputDir, 'scenes.json'), JSON.stringify(alignedScenes, null, 2), 'utf8');
    fs.writeFileSync(path.join(outputDir, 'storyboard.json'), JSON.stringify(storyboardScenes, null, 2), 'utf8');

    const promptsManifest = storyboardScenes.map((s, idx) => ({
      takeIndex: idx + 1,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      visualIntent: s.visualIntent || '',
      framing: s.framing || 'medium_shot',
      stockQueries: s.stockQueries || [],
      prompt: s.aiPrompt || s.prompt || s.phrase || '',
      visualType: s.visualType || 'image',
      source: s.source || 'ai_generated',
      motionType: s.motionType || 'zoom_in',
      cinemagraphFX: s.cinemagraphFX || 'none'
    }));
    fs.writeFileSync(path.join(outputDir, 'prompts.json'), JSON.stringify(promptsManifest, null, 2), 'utf8');

    const runManifest = {
      runId,
      startedAt: new Date().toISOString(),
      options: {
        channel: options.channel,
        platform: options.platform,
        visualMode: options.visualMode,
        enableSubtitles: options.enableSubtitles
      },
      resolvedConfig: channelProfile,
      script: {
        title: scriptData.title,
        wordCount: scriptData.wordCount,
        generator: scriptData.generator || 'gemini',
        degraded: scriptData.degraded || false
      },
      timeline: alignedScenes.map((s, idx) => ({
        takeIndex: idx + 1,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration,
        phrase: s.phrase,
        visualType: s.visualType
      })),
      stages: [
        { id: 'script', status: 'ok', durationSeconds: voiceResult.durationSeconds },
        { id: 'tts', status: 'ok', voiceId },
        { id: 'subtitles', status: 'ok', theme: channelSubTheme },
        { id: 'visuals', status: 'ok', clipsCount: videoClips.length },
        { id: 'render', status: 'ok', durationSeconds: renderResult.durationSeconds },
        { id: 'qc', status: qcReport?.approved ? 'approved' : 'evaluated' },
        { id: 'drive_upload', status: driveAssets.isOffline ? 'offline' : 'uploaded' }
      ],
      qc: qcReport ? { approved: qcReport.approved, score: qcReport.score, checks: qcReport.checks } : null,
      videoPath: renderResult.videoPath,
      thumbnailPath: thumbPath,
      driveAssets
    };
    fs.writeFileSync(path.join(outputDir, 'run.json'), JSON.stringify(runManifest, null, 2), 'utf8');
  } catch (mErr) {
    console.warn('[Pipeline] Aviso: Falha ao gravar manifestos estruturados:', mErr.message);
  }

  // 6. Ingestão no AutoPublisher Pro com suporte a agendamento escalonado
  console.log('\n>>> [6/6] Realizando ingestao no AutoPublisher Pro...');
  const ingestResult = await ingestGeneratedPost({
    videoPath: renderResult.videoPath,
    thumbnailPath: thumbPath,
    scriptData: scriptData,
    platform: options.platform,
    driveVideoId: driveAssets.videoDriveId,
    driveThumbnailId: driveAssets.thumbnailDriveId,
    batchIndex: batchIndex,
    totalBatch: totalBatch,
    audioMode: options.audioMode
  });

  // Salva report.json consolidado (SDD v3.0 §3.7 e §7)
  try {
    const reportManifest = {
      runId,
      timestamp: new Date().toISOString(),
      channel: options.channel,
      platform: options.platform,
      title: scriptData.title,
      videoDuration: renderResult.durationSeconds,
      audioDuration: voiceResult.durationSeconds,
      avSyncDriftMs: Math.round(Math.abs(renderResult.durationSeconds - voiceResult.durationSeconds) * 1000),
      takesCount: alignedScenes.length,
      subtitlesBurned: renderResult.subtitlesBurned !== false,
      qcScore: qcReport?.score || null,
      qcApproved: qcReport?.approved || false,
      driveVideoId: driveAssets.videoDriveId,
      driveThumbnailId: driveAssets.thumbnailDriveId,
      ingestStatus: ingestResult.source
    };
    fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(reportManifest, null, 2), 'utf8');
  } catch (rErr) {
    console.warn('[Pipeline] Aviso: Falha ao gravar report.json:', rErr.message);
  }

  const subtitleStatus = renderResult.subtitlesBurned === false
    ? '⚠️  SEM LEGENDA (fallback automático acionado)'
    : renderResult.subtitlesBurned
    ? '✅ Com legendas karaokê'
    : '✅ Sem legendas (solicitado)';

  console.log('\n===============================================================');
  console.log(`           TAKE [${batchIndex + 1}/${totalBatch}] CONCLUIDO COM SUCESSO!     `);
  console.log('===============================================================');
  console.log(`Video MP4:      ${renderResult.videoPath}`);
  console.log(`Thumbnail PNG:  ${thumbPath}`);
  console.log(`Duracao Final:  ${renderResult.durationSeconds} segundos`);
  console.log(`Legenda:        ${subtitleStatus}`);
  console.log(`Elegivel TikTok Rewards: ${renderResult.durationSeconds >= 60 ? 'SIM (>= 60s)' : 'NAO'}`);
  console.log(`Status Ingestao: ${ingestResult.source}`);
    // Comita reservas no MediaLedger após sucesso completo
    try {
      const ledger = getMediaLedger();
      ledger.commit(options.channel, path.basename(outputDir));
    } catch (commitErr) {
      console.warn('[Pipeline] Aviso: Falha ao comitar MediaLedger:', commitErr.message);
    }

    return { renderResult, ingestResult };
  } catch (pipelineErr) {
    try {
      const ledger = getMediaLedger();
      ledger.rollback(options.channel);
    } catch (rbErr) {
      console.warn('[Pipeline] Aviso ao reverter reservas do MediaLedger:', rbErr.message);
    }
    throw pipelineErr;
  }
}

async function main() {
  console.log('===============================================================');
  console.log('   AutoPublisher Pro - AI Content & Faceless Video Pipeline    ');
  console.log('===============================================================\n');

  const options = parseArgs();

  // Exibe ajuda rápida dos parâmetros disponíveis
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`Uso: node pipeline/src/run_pipeline.js [opções]

Opções:
  --channel <id>         Canal alvo (ex: psicosegredo, estoicismo, financas)
  --script <n>           Índice do roteiro no catálogo (0, 1, 2...)
  --topic "<tema>"       Tema personalizado para geração de roteiro
  --url <youtube-url>    URL do YouTube para análise e adaptação
  --platform <plat>      Plataforma (YOUTUBE_SHORTS, TIKTOK, INSTAGRAM_REELS)
  --visual-mode <modo>   hybrid | video | image (padrão: hybrid)
  --visual "<diretriz>"  Diretriz visual para geração de imagens
  --batch <n>            Gerar N vídeos em lote
  --subtitles            Habilitar legendas queimadas no vídeo (padrão)
  --no-subtitles         Desabilitar legendas queimadas no vídeo
  --audio-mode <modo>    tts | none | source_audio (padrão: tts)
  --no-voice             Desabilitar locução neural (gera vídeo puramente visual)
  --duration <seg>       Duração alvo em segundos (quando audio-mode for none)
  --subtitles-layout     full_sentences | fast_words | static_cards (padrão: full_sentences)
  --gemini-key <chave>   Chave Google AI Studio (Gemini/Imagen 3)
  --pexels-key <chave>   Chave Pexels para B-Roll de vídeo real
  --help                 Exibe esta ajuda

Exemplos:
  node pipeline/src/run_pipeline.js --channel psicosegredo
  node pipeline/src/run_pipeline.js --channel psicosegredo --no-subtitles
  node pipeline/src/run_pipeline.js --topic "Disciplina e Foco" --platform TIKTOK
  node pipeline/src/run_pipeline.js --batch 3 --channel estoicismo
`);
    process.exit(0);
  }

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
