/**
 * AutoPublisher Pro - Google Flow / Veo Prompt & Script Package Generator
 *
 * Gera pacote completo para produção manual no Google Flow (flow.google.com / Veo):
 * 1. Roteiro estruturado de alta retenção (Hook 0-3s, Desenvolvimento, Hack, CTA)
 * 2. Áudio neural (Edge-TTS) sintetizado e salvo para preview ou dublagem
 * 3. Legendas dinâmicas (.ass e .srt) sincronizadas foneticamente
 * 4. Prompts em inglês calibrados especificamente para a física e cinematografia do Google Flow / Veo 9:16
 * 5. Metadados de publicação (SEO, Título, Descrição com Links de Afiliados, Tags, Primeiro Comentário)
 * 6. Linha pronta para colar na planilha Cronograma do Google Sheets (Colunas A a Q)
 * 7. Instruções para montagem automática posterior no AutoPublisher Pro
 */

import fs from 'fs';
import path from 'path';

// Carregamento nativo de variáveis de ambiente (.env)
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

import { generateScript, loadChannelProfile } from '../src/script_generator.js';
import { synthesizeVoiceWithTimestamps } from '../src/voice_synthesizer.js';
import { alignScenesWithWordBoundaries } from '../src/scene_aligner.js';
import { generateAssSubtitles, generateSrtSubtitles } from '../src/subtitle_generator.js';
import { createProceduralThumbnail } from '../src/visuals_harvester.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let options = {
    channel: 'custom',
    topic: null,
    scriptIndex: 0,
    visualDirective: null,
    outDir: null,
    channelName: null,
    niche: null,
    voiceId: null,
    affiliateUrl: null,
    subtitlesTheme: 'GOLD_PUNCH',
    platform: 'YOUTUBE_SHORTS',
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
          console.warn('[GoogleFlow] Aviso: Falha ao carregar config file:', e.message);
        }
      }
    }
  }

  // 2. Flags de linha de comando
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' && args[i + 1]) {
      options.channel = args[i + 1];
      i++;
    } else if (args[i] === '--topic' && args[i + 1]) {
      options.topic = args[i + 1];
      i++;
    } else if (args[i] === '--script' && args[i + 1]) {
      options.scriptIndex = parseInt(args[i + 1], 10);
      i++;
    } else if ((args[i] === '--visual-directive' || args[i] === '--visual' || args[i] === '--style') && args[i + 1]) {
      options.visualDirective = args[i + 1];
      i++;
    } else if ((args[i] === '--out' || args[i] === '--out-dir') && args[i + 1]) {
      options.outDir = args[i + 1];
      i++;
    } else if ((args[i] === '--channel-name' || args[i] === '--name') && args[i + 1]) {
      options.channelName = args[i + 1];
      i++;
    } else if (args[i] === '--niche' && args[i + 1]) {
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
    } else if (args[i] === '--platform' && args[i + 1]) {
      options.platform = args[i + 1];
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
    }
  }

  return options;
}

/**
 * Enriquece o prompt da cena com palavras-chave de cinematografia que o Google Flow / Veo interpreta com maestria.
 */
function buildGoogleFlowPrompt({ basePrompt, index, totalScenes, duration, channelAesthetic, visualDirective }) {
  const cameraMotions = [
    'slow cinematic push-in toward the subject',
    'slow panning from left to right with shallow depth of field',
    'slow subtle tracking shot keeping subject in dramatic silhouette',
    'slow tilt up revealing golden volumetric lighting',
    'smooth cinematic orbital camera motion at 24fps',
    'slow tracking push-in with dramatic chiaroscuro shadows'
  ];

  const motion = cameraMotions[index % cameraMotions.length];
  const aesthetic = visualDirective || channelAesthetic || 'Dark Minimalist Chiaroscuro with cyan and gold rim light';
  
  // Limpa caracteres especiais
  const cleanBase = (basePrompt || '')
    .replace(/[#*"]/g, '')
    .replace(/vertical 9:16/gi, '')
    .trim();

  // Estrutura recomendada pelo Google DeepMind para Veo / Flow:
  // [Aspect Ratio] + [Subject Action] + [Camera Movement] + [Lighting & Style] + [Technical Quality]
  return `Vertical 9:16 video, ${cleanBase}. Camera movement: ${motion}. Aesthetic style: ${aesthetic}, intense volumetric lighting, cinematic color grading, photorealistic, 8k resolution, highly detailed textures, smooth fluid motion, 24fps.`;
}

async function main() {
  const options = parseArgs();
  const effectiveGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  console.log('================================================================');
  console.log('   AutoPublisher Pro — Gerador de Pacote Google Flow (Veo)      ');
  console.log('================================================================');
  console.log(`Canal: ${options.channel}`);
  if (options.topic) console.log(`Tema solicitado: "${options.topic}"`);
  if (options.visualDirective) console.log(`Diretriz Visual: "${options.visualDirective}"`);
  console.log('');

  const baseProfile = loadChannelProfile(options.channel);
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

  const timestamp = Date.now();
  const outDir = options.outDir 
    ? path.resolve(options.outDir) 
    : path.resolve(`pipeline/output/flow_${options.channel}_${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Gera o roteiro estruturado
  console.log('>>> [1/5] Gerando roteiro estruturado de alta conversão...');
  const scriptData = await generateScript({
    channelId: options.channel,
    topic: options.topic,
    scriptIndex: options.scriptIndex,
    visualDirective: options.visualDirective,
    customProfile: channelProfile,
    geminiKey: effectiveGeminiKey,
    customTitle: options.title,
    customNarration: options.narrationText,
    customComment: options.firstComment
  });

  console.log(`Título: "${scriptData.title}"`);
  console.log(`Total de Palavras: ${scriptData.wordCount}`);
  console.log(`Cenas Previstas: ${scriptData.scenes.length}`);

  // 2. Sintetiza áudio neural com Edge-TTS
  console.log('\n>>> [2/5] Sintetizando locução neural com Edge-TTS...');
  const voiceProfile = channelProfile.voice_profile || {};
  const voiceId = options.voiceId || voiceProfile.voice_id || 'pt-BR-AntonioNeural';
  const voiceRate = voiceProfile.rate || '+5%';
  const voicePitch = voiceProfile.pitch || '+0Hz';
  const audioPath = path.join(outDir, 'narration.mp3');

  const voiceResult = await synthesizeVoiceWithTimestamps({
    text: scriptData.narrationText,
    voice: voiceId,
    rate: voiceRate,
    pitch: voicePitch,
    outputAudioPath: audioPath
  });

  const rawAudioDuration = Number(voiceResult.durationSeconds) || 60;
  const targetDurationSeconds = Math.max(60.0, Number((rawAudioDuration + 1.2).toFixed(2)));

  console.log(`Áudio salvo: ${audioPath} (${rawAudioDuration.toFixed(2)}s)`);

  // 3. Legendas dinâmicas
  console.log('\n>>> [3/5] Gerando arquivos de legendas (.ass e .srt)...');
  const subtitlesAssPath = path.join(outDir, 'subtitles.ass');
  const subtitlesSrtPath = path.join(outDir, 'subtitles.srt');

  generateAssSubtitles({
    wordBoundaries: voiceResult.wordBoundaries,
    outputAssPath: subtitlesAssPath,
    theme: options.subtitlesTheme || 'GOLD_PUNCH'
  });
  generateSrtSubtitles({
    wordBoundaries: voiceResult.wordBoundaries,
    outputSrtPath: subtitlesSrtPath
  });

  // 4. Alinhamento fonético das cenas
  console.log('\n>>> [4/5] Calibrando duração exata de cada cena para o Google Flow...');
  const alignedScenes = alignScenesWithWordBoundaries({
    scenes: scriptData.scenes,
    wordBoundaries: voiceResult.wordBoundaries,
    totalDurationSeconds: targetDurationSeconds,
    narrationText: scriptData.narrationText
  });

  // 5. Gera Thumbnail personalizada
  console.log('\n>>> [5/5] Gerando miniatura (Thumbnail)...');
  const thumbPath = path.join(outDir, 'thumbnail.png');
  let thumbBase = path.resolve(`pipeline/assets/scenes/${options.channel}/scene_1.jpg`);
  if (!fs.existsSync(thumbBase)) {
    thumbBase = path.resolve('pipeline/assets/scenes/psicosegredo/scene_1.jpg');
  }

  const thumbSub = options.visualDirective
    ? options.visualDirective.split(',')[0].slice(0, 24).toUpperCase()
    : (channelProfile.channelName || channelProfile.name || 'MOTIVAÇÃO').toUpperCase();

  await createProceduralThumbnail({
    title: scriptData.title,
    outputPath: thumbPath,
    baseImagePath: fs.existsSync(thumbBase) ? thumbBase : null,
    subtitle: thumbSub
  });

  // 6. Constrói prompts enriquecidos para o Google Flow
  const channelAesthetic = channelProfile.visual_profile?.aesthetic || 'Cinematic Dark Chiaroscuro';
  const flowScenes = alignedScenes.map((scene, idx) => {
    const flowPrompt = buildGoogleFlowPrompt({
      basePrompt: scene.prompt,
      index: idx,
      totalScenes: alignedScenes.length,
      duration: scene.duration,
      channelAesthetic,
      visualDirective: options.visualDirective
    });

    // Duração recomendada no Flow (o Flow costuma trabalhar com blocos de 4s a 8s)
    const flowRecDuration = scene.duration <= 4.5 ? 4 : (scene.duration <= 6.5 ? 6 : 8);

    return {
      sceneNumber: idx + 1,
      startTime: scene.startTime.toFixed(2),
      endTime: scene.endTime.toFixed(2),
      durationSeconds: scene.duration.toFixed(2),
      flowRecDuration,
      phrase: scene.phrase,
      flowPrompt,
      outputFilename: `scene_${idx + 1}.mp4`
    };
  });

  // 7. Constrói a linha para a planilha Cronograma (Colunas A a Q)
  const scheduledDate = new Date(Date.now() + 45 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const scheduledTimeStr = `${scheduledDate.getFullYear()}-${pad(scheduledDate.getMonth() + 1)}-${pad(scheduledDate.getDate())} ${pad(scheduledDate.getHours())}:${pad(scheduledDate.getMinutes())}:00`;
  
  const postId = `POST-${Date.now()}`;
  const metadata = scriptData.metadata || {};
  const tagsStr = Array.isArray(metadata.tags) ? metadata.tags.join(', ') : (metadata.tags || '#Shorts, #viral, #desenvolvimento');
  const description = metadata.description || `${scriptData.title}\n\nDomine sua mente e supere seus limites.\n\n🔗 Conheça o Treinamento Completo: https://seulinkdeafiliado.com?utm_source=youtube&utm_medium=shorts\n\n#Shorts #Psicologia #Mentalidade`;
  const firstComment = metadata.firstComment || '👉 Acesse o treinamento completo com desconto exclusivo no link fixado: https://seulinkdeafiliado.com/promo';

  // Linha formatada TSV (Tab-Separated Values) para copiar e colar com 1 clique no Google Sheets
  const sheetsRowColumns = [
    postId,                                      // A: ID
    scheduledTimeStr,                            // B: Data_Agendamento
    'YOUTUBE_SHORTS',                            // C: Plataforma
    '[COLE_AQUI_O_ID_DO_VIDEO_NO_DRIVE]',        // D: Drive_Video_ID
    '',                                          // E: Drive_Thumbnail_ID (opcional)
    scriptData.title.slice(0, 100),              // F: Titulo
    description.replace(/\r?\n/g, ' '),          // G: Descricao
    tagsStr,                                     // H: Tags
    '28',                                        // I: Categoria_ID (28 = Ciência/Tecnologia ou 24 = Entretenimento)
    'FALSE',                                     // J: Made_For_Kids (Conformidade COPPA)
    'PUBLIC',                                    // K: Privacidade
    'PENDENTE',                                  // L: Status
    '',                                          // M: URL_Publicada (preenchido pós-upload)
    '',                                          // N: Data_Publicacao
    '',                                          // O: Log_Erro
    '0',                                         // P: Tentativas
    firstComment                                 // Q: Primeiro_Comentario
  ];
  const sheetsTsvLine = sheetsRowColumns.join('\t');

  // 8. Monta o Markdown do Pacote
  const mdContent = `# 🎬 Pacote de Produção — Google Flow (Veo) & AutoPublisher Pro

**Canal:** \`${options.channel}\`  
**Título do Vídeo:** **${scriptData.title}**  
**Duração da Locução:** \`${rawAudioDuration.toFixed(1)}s\` (Elegível ao TikTok Rewards & YouTube Shorts)  
**Total de Cenas:** \`${flowScenes.length} takes\`  
**Pasta com os Arquivos:** \`${outDir}\`

---

## 🎧 Arquivos Gerados Nesta Pasta

- 🔊 **Locução Neural:** \`narration.mp3\`
- 💬 **Legendas Karaokê Animadas:** \`subtitles.ass\`
- 📜 **Legendas Tradicionais:** \`subtitles.srt\`
- 🖼️ **Thumbnail 1080x1920:** \`thumbnail.png\`

---

## 📋 Roteiro de Locução Completo

> "${scriptData.narrationText}"

---

## 🎥 Prompts Prontos para o Google Flow (Veo)

Copie e cole cada prompt abaixo na interface do **Google Flow** (ou **flow.google.com** / **VideoFX**).  
*Configure a proporção para **9:16 (Vertical)** e baixe cada vídeo gerado.*

${flowScenes.map(s => `### Take ${s.sceneNumber} (${s.startTime}s - ${s.endTime}s | Duração: ~${s.durationSeconds}s)
- **Trecho falado:** *"${s.phrase}"*
- **Duração recomendada no Flow:** \`${s.flowRecDuration} segundos\`
- **Nome ao salvar:** \`${s.outputFilename}\`

\`\`\`text
${s.flowPrompt}
\`\`\`
`).join('\n')}

---

## ⚡ Como Montar o Vídeo Automaticamente com 1 Comando

Se você baixou os vídeos do Google Flow e quer que o AutoPublisher Pro coloque a voz, as legendas animadas em karaokê e a música de fundo:

1. Salve os clipes baixados na pasta:
   \`pipeline/inputs/flow/\`  
   com os nomes: \`scene_1.mp4\`, \`scene_2.mp4\`, \`scene_3.mp4\`... (ou aponte para qualquer pasta).

2. Execute o comando:
   \`\`\`bash
   node pipeline/src/run_pipeline.js --channel ${options.channel} --flow-clips-dir ./pipeline/inputs/flow
   \`\`\`

O sistema montará o vídeo final em Full HD vertical com as legendas dinâmicas e o áudio perfeitamente sincronizados!

---

## 📊 Como Publicar pelo Google Drive & Google Sheets

Se você montou o vídeo final ou quer subir diretamente:

1. Suba o vídeo final para o seu **Google Drive**.
2. Pegue o ID do arquivo no Google Drive (ex: \`1A2b3C4d5E6f...\`).
3. Abra sua planilha do Google Sheets (aba **Cronograma**).
4. Cole a linha abaixo na próxima linha vazia (substituindo pelo seu ID do Drive):

\`\`\`tsv
${sheetsTsvLine}
\`\`\`

5. O microsserviço Java do **AutoPublisher Pro** fará o envio *zero-copy* para o YouTube/TikTok com as tags, título, miniatura e o primeiro comentário com seu link de afiliado fixado!
`;

  const mdFilePath = path.join(outDir, 'GOOGLE_FLOW_GUIDE.md');
  fs.writeFileSync(mdFilePath, mdContent, 'utf8');

  // Manifesto JSON
  const jsonManifest = {
    postId,
    channel: options.channel,
    title: scriptData.title,
    durationSeconds: targetDurationSeconds,
    narrationAudio: audioPath,
    subtitlesAss: subtitlesAssPath,
    thumbnail: thumbPath,
    scenes: flowScenes,
    seo: {
      title: scriptData.title,
      description,
      tags: tagsStr,
      firstComment
    },
    sheetsRow: sheetsRowColumns
  };
  fs.writeFileSync(path.join(outDir, 'flow_manifest.json'), JSON.stringify(jsonManifest, null, 2), 'utf8');

  console.log('\n================================================================');
  console.log('🎉 PACOTE GOOGLE FLOW GERADO COM SUCESSO!');
  console.log('================================================================');
  console.log(`📁 Guia Completo: ${mdFilePath}`);
  console.log(`🔊 Áudio Neural: ${audioPath}`);
  console.log(`🖼️ Thumbnail: ${thumbPath}`);
  console.log(`💬 Legendas ASS: ${subtitlesAssPath}`);
  console.log('');
  console.log('--- PROMPTS PARA O GOOGLE FLOW ---');
  flowScenes.forEach(s => {
    console.log(`\n[Take ${s.sceneNumber}] (${s.startTime}s - ${s.endTime}s | ~${s.durationSeconds}s):`);
    console.log(`Prompt: ${s.flowPrompt}`);
  });
  console.log('\n================================================================');
  console.log('Dica: Abra o arquivo GOOGLE_FLOW_GUIDE.md gerado para copiar e colar com facilidade!');
}

main().catch(err => {
  console.error('\n[Erro ao gerar pacote Flow]:', err);
  process.exit(1);
});
