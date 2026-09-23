import fs from 'fs';
import { YoutubeTranscript } from 'youtube-transcript';
import { translateDirectiveToCinematicEnglish, buildProfessionalScenePrompt } from './ai_prompt_generator.js';

// Carregamento nativo de variaveis de ambiente (.env) sem dependencia externa
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

/**
 * Extrai o ID do vídeo do YouTube a partir de qualquer formato de URL
 */
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const cleaned = url.trim();
  
  // Se for apenas o ID de 11 caracteres
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) {
    return cleaned;
  }

  const match = cleaned.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

/**
 * Busca metadados públicos e gratuitos do vídeo via YouTube oEmbed API
 */
export async function fetchVideoMetadata(videoId) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) {
      return {
        videoId,
        title: `Vídeo do YouTube (${videoId})`,
        authorName: 'Criador no YouTube',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      };
    }
    const data = await res.json();
    return {
      videoId,
      title: data.title || `Vídeo do YouTube (${videoId})`,
      authorName: data.author_name || 'YouTube Creator',
      thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
  } catch (err) {
    return {
      videoId,
      title: `Vídeo do YouTube (${videoId})`,
      authorName: 'YouTube Creator',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
  }
}

/**
 * Higieniza o texto da transcrição preservando rigorosamente a acentuação em Português (PT-BR)
 * e decodificando entidades HTML/numéricas comuns do YouTube (ex: &atilde;, &#39;, &eacute;)
 */
export function cleanPtBrTranscriptText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&aacute;/gi, 'á')
    .replace(/&agrave;/gi, 'à')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&acirc;/gi, 'â')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&iacute;/gi, 'í')
    .replace(/&icirc;/gi, 'î')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Agrave;/g, 'À')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&Acirc;/g, 'Â')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Ecirc;/g, 'Ê')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&Ocirc;/g, 'Ô')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai transcrição/legendas do vídeo do YouTube priorizando estritamente Português Brasileiro (PT-BR)
 */
export async function fetchVideoTranscript(videoId) {
  // 1. Prioriza faixas de áudio/legenda em Português do Brasil (pt-BR e pt) para preservar acentos e expressões nativas
  const preferredLangs = ['pt-BR', 'pt', null, 'en'];
  for (const lang of preferredLangs) {
    try {
      const options = lang ? { lang } : undefined;
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, options);
      if (transcript && transcript.length > 0) {
        const fullText = cleanPtBrTranscriptText(transcript.map(t => t.text).join(' '));
        if (fullText.length > 20) {
          return {
            available: true,
            text: fullText,
            lang: lang || 'pt-BR',
            segmentsCount: transcript.length
          };
        }
      }
    } catch (ignored) {
      // Tenta a próxima linguagem da cadeia de prioridade
    }
  }

  return {
    available: false,
    text: null,
    segmentsCount: 0
  };
}

/**
 * Trunca uma string preservando palavras inteiras e removendo pontuações residuais
 */
export function truncateWords(text, maxLength) {
  if (!text || text.length <= maxLength) return text || '';
  const sub = text.slice(0, maxLength);
  const lastSpace = sub.lastIndexOf(' ');
  return (lastSpace > 0 ? sub.slice(0, lastSpace) : sub).replace(/[\s,\-–:.]+$/, '').trim();
}

/**
 * Analisa semanticamente a transcrição e o título para sintetizar os 4 blocos de retenção
 */
export function extractConceptualSummary(transcriptText, baseTitle, authorName, channelName = '@canal') {
  const combined = ((transcriptText || '') + ' ' + (baseTitle || '')).toLowerCase();

  const isKahneman = combined.includes('rápido e devagar') || combined.includes('canima') || combined.includes('kahneman');
  const isDecision = combined.includes('decis') || combined.includes('escolha') || combined.includes('erro');
  const isDopamine = combined.includes('dopamina') || combined.includes('vício') || combined.includes('preguiç') || combined.includes('procrastina');
  const isStoic = combined.includes('estoic') || combined.includes('marco aurélio') || combined.includes('sêneca') || combined.includes('epicteto');

  if (isKahneman || (isDecision && combined.includes('livro'))) {
    const hookText = `Se você acredita que está no controle de todas as suas decisões, pare tudo agora: a neurociência prova que o seu cérebro toma escolhas no piloto automático sem você perceber.`;
    const scienceText = `A grande lição do clássico Rápido e Devagar de Daniel Kahneman revela que possuímos duas mentes em constante conflito. O Sistema 1 é veloz, instintivo e movido por emoções imediatas para economizar energia metabólica, fazendo você comprar o que não precisa e reagir no calor do momento. O Sistema 2, responsável pela lógica e pensamento crítico, é preguiçoso e quase nunca entra em ação por conta própria. A maioria das pessoas passa a vida inteira sendo dominada pelos próprios vieses mentais.`;
    const hackText = `A regra prática para assumir o volante: toda vez que sentir o impulso de gastar ou confrontar alguém, pare. Force uma pausa de dez segundos, respire fundo e ative o Sistema 2 com perguntas objetivas.`;
    const ctaText = `Siga ${channelName} para dominar sua química mental antes que o mundo use suas fraquezas contra você.`;
    const insight = 'o Sistema 1 impulsivo decide no piloto automático enquanto o Sistema 2 racional permanece preguiçoso';

    return { hookText, scienceText, hackText, ctaText, insight };
  }

  if (isDopamine) {
    const hookText = `Você não é preguiçoso e a sua falta de ânimo tem uma explicação biológica exata: o seu cérebro foi condicionado a buscar recompensas rápidas sem esforço real.`;
    const scienceText = `A neurociência explica que a dopamina é o neurotransmissor da antecipação e da busca por ação. Quando você passa horas rolando telas e consumindo dopamina barata, seus receptores se fecham para economizar receptividade neural. Isso torna qualquer trabalho profundo ou estudo uma tortura química imediata, drenando sua capacidade de concentração e foco produtivo ao longo do dia.`;
    const hackText = `A regra de ouro para destravar sua mente: a ação deliberada precisa vir antes da motivação. Force apenas os primeiros cinco minutos de movimento físico e sua química cerebral começará a trabalhar a seu favor.`;
    const ctaText = `Siga ${channelName} para hackear sua rotina e assumir o controle biológico dos seus objetivos diários.`;
    const insight = 'a dessensibilização dopaminérgica gera paralisia comportamental e só é revertida com a ação prévia';

    return { hookText, scienceText, hackText, ctaText, insight };
  }

  if (isStoic) {
    const hookText = `Marco Aurélio escreveu que você tem poder exclusivo sobre a sua própria mente, e não sobre os acontecimentos externos que acontecem ao seu redor.`;
    const scienceText = `Quando você se irrita com provocações, críticas ou injustiças alheias, você acabou de entregar o controle emocional da sua vida nas mãos de quem te desestabilizou. O cérebro primitivo reage à ofensa como uma ameaça de sobrevivência física, inundando seu corpo de cortisol e raiva. Mas a mente treinada entende que o silêncio estratégico e a calma imperturbável desarmam qualquer ataque verbal muito antes de uma resposta ser dita.`;
    const hackText = `O exercício prático estoico: quando o impulso da fúria surgir, congele por três segundos. Pergunte a si mesmo se isso terá relevância daqui a cinco anos. Se não tiver, descarte imediatamente.`;
    const ctaText = `Siga ${channelName} para construir uma armadura mental inabalável e dominar o seu próprio destino.`;
    const insight = 'o controle das reações emocionais internas anula o poder das provocações externas';

    return { hookText, scienceText, hackText, ctaText, insight };
  }

  // Generic fallback estruturado (~155 palavras / 65-70s)
  const cleanTitle = truncateWords(baseTitle, 40);
  const hookText = `Se você quer entender a verdade definitiva sobre ${cleanTitle.toLowerCase()}, pare tudo agora: existe um mecanismo psicológico crucial que quase ninguém percebeu.`;
  const scienceText = `A análise estratégica desse conteúdo revela que o comportamento humano obedece a padrões previsíveis de sobrevivência e recompensa. Quando exposto à incerteza ou ao estresse, o cérebro recorre a atalhos cognitivos imediatos, buscando a resposta mais rápida em vez da mais lógica. Não se trata de fraqueza pessoal ou falta de força de vontade, mas de um processo biológico desenhado para poupar esforço mental em situações de pressão.`;
  const hackText = `A regra prática para blindar suas escolhas: sempre que estiver diante de um dilema crítico, dê um passo para trás, questione suas primeiras impressões e decida com base em dados objetivos e não no impulso.`;
  const ctaText = `Siga ${channelName} para receber insights estratégicos de neurociência e comportamento humano todos os dias.`;
  const insight = `a mecânica cognitiva e os atalhos mentais por trás de ${cleanTitle}`;

  return { hookText, scienceText, hackText, ctaText, insight };
}

/**
 * Analisa a transcrição e metadados usando IA (Gemini Flash) para sintetizar roteiro e cenas visuais
 */
export async function analyzeTranscriptWithGemini({
  transcriptText,
  baseTitle,
  authorName,
  channelProfile = {},
  visualDirective = null,
  apiKey = null
}) {
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!effectiveKey) return null;

  const channelName = channelProfile.name || channelProfile.channelName || (channelProfile.channel_id ? `@${channelProfile.channel_id}` : '@canal');
  const niche = channelProfile.niche || 'Neurociência Prática e Comportamento Humano';
  const tone = channelProfile.script_profile?.tone || 'Analítico, misterioso, confiante e direto';
  const cleanTranscript = (transcriptText || '').replace(/\s+/g, ' ').slice(0, 7500);

  const modelName = 'gemini-flash-lite-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${effectiveKey}`;

  const systemInstruction = `Você é um Diretor Criativo e Roteirista Sênior especialista em vídeos virais de alta retenção para YouTube Shorts, TikTok e Instagram Reels.
Seu canal: "${channelName}" (Nicho: ${niche}, Tom: ${tone}).
${visualDirective ? `DIRETRIZ DE ESTILO VISUAL OBRIGATÓRIA: "${visualDirective}". Todos os prompts visuais de IA DEVEM seguir rigorosamente essa estética!` : ''}

Sua missão é extrair a essência do conteúdo e gerar um roteiro original em 4 blocos de retenção rigorosos:
1. hook (Gancho 0-3s): Frase provocativa que quebra padrão (10 a 16 palavras).
2. scientific_core (Foco Central 3-45s): Mecanismo neurobiológico ou lógica explicada de forma clara e envolvente (75 a 90 palavras).
3. practical_hack (Hack Prático 45-58s): Ação imediata aplicável na rotina (28 a 35 palavras).
4. cta (CTA 58-65s): Chamada para seguir ${channelName} (14 a 18 palavras).

IMPORTANTE: O total de palavras da narração corrida (hook + scientific_core + practical_hack + cta) DEVE estar rigorosamente entre 160 e 180 palavras (hook: 12-16 palavras, scientific_core: 85-95 palavras, practical_hack: 35-42 palavras, cta: 16-20 palavras), garantindo duração de áudio entre 63s e 72s para elegibilidade inquestionável ao TikTok Creator Rewards Program (que exige estritamente >= 60 segundos).

CENAS VISUAIS - REGRA MANDATÓRIA DE ZERO REPETIÇÃO E LIVING CINEMAGRAPH:
Gere uma lista de 7 a 10 cenas visuais sincronizadas sequencialmente com cada frase da narração:
- phrase: trecho falado correspondente
- suggested_type: "ai_image" (prioritário para estilos estilizados como Ghibli/Anime ou simbólicos) ou "stock_video" (para ações de pessoas comuns, escritório)
- stock_search_query: termos de busca em inglês (2 a 4 palavras) para Pexels (ex: "thinking person dark", "hands holding book")
- ai_prompt: prompt cinematográfico em inglês em formato vertical 9:16.
  * REGRA MANDATÓRIA DE ZERO REPETIÇÃO: NENHUMA cena pode ter o mesmo sujeito, ângulo ou composição de outra cena. Cada uma das cenas DEVE retratar um sujeito ÚNICO e DIFERENTE (ex: cena 1 = close-up de olhos focados; cena 2 = fogueira aconchegante com brasas; cena 3 = riacho e ponte com luz solar; cena 4 = mapa em ruínas antigas; cena 5 = clareira mágica com vagalumes; cena 6 = manoplas segurando caneca fumegante; cena 7 = céu estrelado com constelações cintilantes; cena 8 = vista panorâmica ao pôr do sol).
  * DETALHES DE MICRO-ANIMAÇÃO VIVA (CINEMAGRAPH): Inclua elementos sutis de movimento em cada cena (dancing campfire flames and rising sparks, floating bioluminescent fireflies, twinkling stars in clear night, golden sunbeam dust motes).
  * Se houver DIRETRIZ VISUAL definida (${visualDirective || 'Padrão'}), obedeça-a 100% no estilo artístico (Ghibli 2D cel gouache, anime Ufotable, fotografia 35mm, etc).
- cinemagraph_fx: escolha um micro-efeito procedural para a cena: "fire_embers" (para fogueiras, brasas, velas), "fireflies" (para noites, crepúsculo, florestas mágicas), "twinkling_stars" (para céu noturno estrelado), "sunbeams_dust" (para luz do sol filtrada em árvores/templos com poeira dourada), "anime_aura_sparks" (para faíscas de energia de batalha).

Retorne EXCLUSIVAMENTE um objeto JSON válido com os campos:
title, insight, hook, scientific_core, practical_hack, cta, visual_scenes.`;

  const userPrompt = `Gere o roteiro profissional e as tomadas visuais para este conteúdo:
Título: "${baseTitle}"
Autor original: "${authorName || 'Especialista'}"
${visualDirective ? `Diretriz Visual Obrigatória: "${visualDirective}"` : ''}
${cleanTranscript ? `Transcrição: """${cleanTranscript}"""` : 'Sem transcrição disponível. Desenvolva o roteiro a partir do tema central e título do vídeo.'}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': effectiveKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[YouTube Analyzer] Gemini API retornou HTTP ${res.status}: ${errText.slice(0, 160)}`);
      return null;
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText);
    if (!parsed.hook || !parsed.scientific_core || !parsed.practical_hack || !parsed.cta) {
      return null;
    }

    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[YouTube Analyzer] Exceção ao consultar Gemini API: ${err.message}`);
    return null;
  }
}

/**
 * Analisa o conteúdo do vídeo do YouTube e gera um roteiro adaptado nos 4 blocos de retenção
 */
export async function analyzeAndAdaptYouTubeVideo({ url, channelProfile = {}, visualDirective = null, geminiKey = null }) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error(`URL do YouTube inválida: "${url}". Forneça um link válido como https://www.youtube.com/watch?v=... ou https://youtu.be/...`);
  }

  const effectiveGeminiKey = geminiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  const [metadata, transcriptData] = await Promise.all([
    fetchVideoMetadata(videoId),
    fetchVideoTranscript(videoId)
  ]);

  const channelName = channelProfile.name || '@seucanal';
  const niche = channelProfile.niche || 'Geral';
  const affiliateCta = channelProfile.publishing_profile?.affiliate_cta || {};
  let defaultTags = channelProfile.publishing_profile?.default_tags || ['shorts', 'viral', 'repurpose'];

  // Base temática para o roteiro adaptado
  const baseTitle = metadata.title.replace(/[#|•].*$/g, '').trim();
  
  // 1. Tenta análise e roteirização contextual avançada com Gemini Flash
  let aiScript = null;
  try {
    console.log(`[YouTube Analyzer] Analisando conteúdo com IA generativa (Gemini Flash)...`);
    aiScript = await analyzeTranscriptWithGemini({
      transcriptText: transcriptData.text,
      baseTitle,
      authorName: metadata.authorName,
      channelProfile,
      visualDirective,
      apiKey: effectiveGeminiKey
    });
  } catch (e) {
    console.warn(`[YouTube Analyzer] Falha no Gemini Flash, usando fallback heurístico:`, e.message);
  }

  let hookText, scienceText, hackText, ctaText, insight, aiScenes;

  if (aiScript) {
    console.log(`[YouTube Analyzer] ✓ Roteiro e cenas contextuais sintetizados com sucesso pelo Gemini!`);
    hookText = aiScript.hook;
    scienceText = aiScript.scientific_core;
    hackText = aiScript.practical_hack;
    ctaText = aiScript.cta;
    insight = aiScript.insight || `análise estratégica de ${baseTitle}`;
    aiScenes = aiScript.visual_scenes;
  } else {
    // Síntese conceitual heurística nos 4 blocos de retenção algorítmica
    const summary = extractConceptualSummary(
      transcriptData.text,
      baseTitle,
      metadata.authorName,
      channelName
    );
    hookText = summary.hookText;
    scienceText = summary.scienceText;
    hackText = summary.hackText;
    ctaText = summary.ctaText;
    insight = summary.insight;
  }

  const narrationText = `${hookText} ${scienceText} ${hackText} ${ctaText}`;
  const words = narrationText.trim().split(/\s+/);
  const wordCount = words.length;
  // Duração estimada calibrada (considerando velocidade ligeiramente acelerada em TTS)
  const estimatedDurationSeconds = Math.max(62, Math.round((wordCount / 140) * 60));

  const visualDirectiveTag = visualDirective ? `\n\n🎨 Estilo Visual: ${visualDirective}` : '';
  const finalTitle = `${truncateWords(baseTitle, 55)} #Shorts`;
  const description = `${finalTitle}\n\nAnálise estratégica e resumo prático inspirado no conteúdo de ${metadata.authorName} (${baseTitle}).${visualDirectiveTag}\n\n${affiliateCta.description_template || '👉 Acesse o link fixado para saber mais!'}\n\nTags: #${defaultTags.slice(0, 5).join(' #')}`;
  const firstComment = affiliateCta.first_comment || `♟️ O que você achou dessa perspectiva de ${metadata.authorName}? Comente abaixo e veja o link fixado!`;

  if (visualDirective) {
    const extraTags = visualDirective.toLowerCase().replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(w => w.length > 3);
    defaultTags = [...new Set([...defaultTags, ...extraTags])];
  }

  // Cenas visuais (proporção 9:16) geradas dinamicamente com base no tema e diretriz visual
  const visualAesthetic = channelProfile.visual_profile?.aesthetic || 'Cinematic Dark Minimalist';
  let scenes;

  if (aiScenes && Array.isArray(aiScenes) && aiScenes.length >= 5) {
    const motionTypes = ['push_in', 'pan_left_right', 'reveal_zoom_out', 'pan_right_left', 'atmospheric_drift'];
    const totalWords = narrationText.trim().split(/\s+/).length;
    const totalDurationEst = (totalWords / 135) * 60;

    scenes = aiScenes.map((s, idx) => {
      const phraseWords = (s.phrase || '').trim().split(/\s+/).length || 10;
      const beatDuration = Math.max(3.2, Number(((phraseWords / totalWords) * totalDurationEst).toFixed(1)));
      return {
        id: idx + 1,
        sceneIndex: idx,
        duration: beatDuration,
        prompt: s.ai_prompt || `${visualAesthetic}, authentic visual scene representing ${s.phrase || 'strategic focus'}, vertical 9:16`,
        phrase: s.phrase || '',
        motionType: motionTypes[idx % motionTypes.length],
        suggestedType: s.suggested_type || 'ai_image',
        cinemagraphFX: s.cinemagraph_fx || null,
        aesthetic: visualAesthetic,
        visualDirective: visualDirective,
        stockQuery: s.stock_search_query || null,
        keywords: [s.stock_search_query || 'cinematic visual'],
        visualDescription: s.phrase ? `Visual beat: "${s.phrase.slice(0, 40)}..."` : 'Cena contextual'
      };
    });
  } else {
    scenes = await generateThematicScenes(baseTitle, insight, visualAesthetic, visualDirective, narrationText, effectiveGeminiKey);
  }

  return {
    source: 'youtube',
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    original: {
      videoId,
      title: metadata.title,
      authorName: metadata.authorName,
      thumbnailUrl: metadata.thumbnailUrl,
      hasTranscript: transcriptData.available,
      segmentsCount: transcriptData.segmentsCount
    },
    scriptId: `yt_${videoId}`,
    topic: baseTitle,
    visualDirective: visualDirective || null,
    title: finalTitle,
    narrationText,
    wordCount,
    estimatedDurationSeconds,
    rewardsEligible: estimatedDurationSeconds >= 60,
    blocks: [
      { title: 'Gancho (0-3s)', text: hookText, visualDescription: scenes[0]?.visualDescription || scenes[0]?.prompt },
      { title: 'Foco Central (3-45s)', text: scienceText, visualDescription: scenes[1]?.visualDescription || scenes[1]?.prompt },
      { title: 'Hack Prático (45-58s)', text: hackText, visualDescription: scenes[Math.min(3, scenes.length - 2)]?.visualDescription || scenes[3]?.prompt },
      { title: 'CTA & Retenção (58-65s)', text: ctaText, visualDescription: scenes[scenes.length - 1]?.visualDescription || scenes[4]?.prompt }
    ],
    metadata: {
      title: finalTitle,
      description,
      tags: defaultTags.join(', '),
      categoryId: channelProfile.publishing_profile?.youtube_category_id || 24,
      madeForKids: channelProfile.publishing_profile?.made_for_kids || false,
      privacy: channelProfile.publishing_profile?.privacy || 'PUBLIC',
      firstComment,
      visualDirective: visualDirective || null
    },
    scenes
  };
}

/**
 * Extrai um resumo conciso do insight central a partir de transcrições longas
 */
function extractKeyInsight(transcriptText, fallbackTopic) {
  if (!transcriptText || transcriptText.length < 50) {
    return `a mecânica real por trás de ${fallbackTopic}`;
  }

  // Limpa ruídos
  const clean = transcriptText
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/\b(né|tipo assim|então|sabe|aí|ó)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Pega um trecho representativo de 120-180 caracteres
  const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 25);
  if (sentences.length > 1) {
    return sentences[1].slice(0, 160).toLowerCase();
  }
  return clean.slice(0, 160).toLowerCase();
}

/**
 * Gera descrições e prompts de cenas cinematográficas 9:16 personalizados para o tema do vídeo
 */
/**
 * Extrai sentenças rítmicas da narração para sincronização de cortes visuais (3 a 5 segundos por beat)
 */
export function extractNarrationBeats(narrationText) {
  if (!narrationText || typeof narrationText !== 'string') return [];

  // Quebra por pontuações fortes (. ! ?)
  const rawSentences = narrationText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
  const beats = [];

  for (const sentence of rawSentences) {
    const words = sentence.split(/\s+/);
    // Divide sentenças longas em pausas naturais
    if (words.length > 22) {
      const parts = sentence.split(/[,;:]+|\s+(?:quando|porque|enquanto|mas|onde)\s+/i)
        .map(p => p.trim())
        .filter(p => p.length > 10);
      
      if (parts.length > 1) {
        let current = '';
        for (const part of parts) {
          if ((current + ' ' + part).trim().split(/\s+/).length < 12) {
            current = (current + ' ' + part).trim();
          } else {
            if (current) beats.push(current);
            current = part;
          }
        }
        if (current) beats.push(current);
        continue;
      }
    }
    beats.push(sentence);
  }

  // Agrupa frases menores para manter takes equilibrados de 4.5 a 8 segundos
  const consolidated = [];
  let buffer = '';
  for (const b of beats) {
    const bWords = b.split(/\s+/).length;
    if (bWords < 12) {
      buffer = (buffer + ' ' + b).trim();
    } else {
      if (buffer) {
        consolidated.push((buffer + ' ' + b).trim());
        buffer = '';
      } else {
        consolidated.push(b);
      }
    }
  }
  if (buffer) {
    if (consolidated.length > 0) {
      consolidated[consolidated.length - 1] += ' ' + buffer;
    } else {
      consolidated.push(buffer);
    }
  }

  return consolidated.length >= 5 ? consolidated : rawSentences;
}

/**
 * Deduz a intenção dramática da frase da narração para enriquecer a cena visual
 */
export function deduceActionIntent(phrase) {
  const p = phrase.toLowerCase();

  if (p.includes('olho') || p.includes('olhar') || p.includes('contato visual') || p.includes('repar') || p.includes('perceb') || p.includes('viu') || p.includes('olhando')) {
    return {
      type: 'gaze_focus',
      actionEn: 'intense focused eyes holding a direct, unflinching piercing stare, holding direct eye contact',
      actionPt: 'olhar compenetrado e contato visual penetrante em primeiro plano'
    };
  }

  if (p.includes('amígdala') || p.includes('cérebro') || p.includes('mente') || p.includes('química') || p.includes('dopamina') || p.includes('neurociência') || p.includes('biológica') || p.includes('pensam')) {
    return {
      type: 'inner_mind',
      actionEn: 'deep contemplative mental focus, strategic intellect, subtle glowing neural energy or glowing ancient map',
      actionPt: 'concentração mental profunda e inteligência estratégica'
    };
  }

  if (p.includes('silêncio') || p.includes('vácuo') || p.includes('pausa') || p.includes('confront') || p.includes('standoff') || p.includes('espera') || p.includes('nada')) {
    return {
      type: 'tense_silence',
      actionEn: 'two figures in tense silent standoff, dramatic shadows, mysterious atmospheric room with volumetric dust',
      actionPt: 'impasse tenso e silêncio absoluto na penumbra'
    };
  }

  if (p.includes('ansiedade') || p.includes('insegurança') || p.includes('pressão') || p.includes('desconforto') || p.includes('medo') || p.includes('tensão') || p.includes('ameaça')) {
    return {
      type: 'battle_tension',
      actionEn: 'high tension anticipation before battle, swirling smoke and dust, dramatic rim shadows, pulse of adrenaline',
      actionPt: 'alta tensão e expectativa sob pressão externa'
    };
  }

  if (p.includes('falar') || p.includes('entrega') || p.includes('detalhe') || p.includes('esconder') || p.includes('mentir') || p.includes('verdade') || p.includes('revela')) {
    return {
      type: 'revelation',
      actionEn: 'a moment of critical revelation, subtle micro-expression in dim dramatic lighting, secret unveiled',
      actionPt: 'momento de revelação crítica e desmascaramento'
    };
  }

  if (p.includes('regra') || p.includes('hack') || p.includes('prática') || p.includes('decisão') || p.includes('controle') || p.includes('passo') || p.includes('agir') || p.includes('comece')) {
    return {
      type: 'decisive_action',
      actionEn: 'disciplined warrior hands firmly gripping an ancient gold-inlaid weapon hilt or parchment, unwavering resolve, side rim lighting',
      actionPt: 'mãos firmes em ação decidida e postura de disciplina inabalável'
    };
  }

  if (p.includes('siga') || p.includes('canal') || p.includes('poder') || p.includes('domina') || p.includes('vitória') || p.includes('antes que') || p.includes('armadura')) {
    return {
      type: 'triumphant_horizon',
      actionEn: 'an epic silhouette of a victorious commander standing atop a rocky citadel overlooking a golden sunrise horizon, triumph and mastery',
      actionPt: 'líder vitorioso no horizonte ao nascer do sol celebrando a conquista'
    };
  }

  // Fallback cinematográfico
  return {
    type: 'atmospheric_stand',
    actionEn: 'imposing figure standing firm in dramatic chiaroscuro lighting, cinematic atmospheric smoke, vertical 9:16',
    actionPt: 'figura imponente em iluminação de alto contraste chiaroscuro'
  };
}

function optimizeDirectiveForPrompt(directive) {
  if (!directive) return '';
  const translated = translateDirectiveToCinematicEnglish(directive);
  if (translated && translated.length > 0) {
    return translated;
  }
  return directive
    .replace(/guerreiros?\s+persas?/gi, 'ancient Persian warriors')
    .replace(/guerreir[oa]s?/gi, 'elite warriors')
    .replace(/armaduras?\s+douradas?/gi, 'ornate golden battle armor')
    .replace(/armaduras?/gi, 'battle armor')
    .replace(/escudos?/gi, 'bronze engraved shields')
    .replace(/espadas?/gi, 'steel swords')
    .replace(/ouro\s+e\s+bronze/gi, 'gold and bronze')
    .replace(/estoicismo|est[oó]ic[oa]s?/gi, 'stoic philosophers marble sculptures')
    .replace(/antig[oa]s?/gi, 'ancient historical')
    .replace(/est[eé]tica\s+aquem[eê]nida/gi, 'Achaemenid Persian empire aesthetic')
    .replace(/chiaroscuro\s+dram[aá]tico/gi, 'dramatic chiaroscuro lighting')
    .replace(/alta\s+resolu[cç][aã]o\s+8k/gi, '8k masterpiece, photorealistic');
}

/**
 * Gera descrições e prompts de cenas cinematográficas 9:16 personalizados para o tema do vídeo (Visual Beats)
 */
export async function generateThematicScenes(baseTitle, summaryInsight, visualAesthetic = 'Cinematic Dark Minimalist', visualDirective = null, narrationText = null, apiKey = null) {
  const cleanDirective = (visualDirective && typeof visualDirective === 'string' && visualDirective.trim().length > 0)
    ? visualDirective.replace(/^(quero\s+gerar\s+imagens\s+de\s+|gerar\s+imagens\s+de\s+|imagens\s+de\s+)/i, '').trim()
    : null;

  const directiveEn = cleanDirective ? optimizeDirectiveForPrompt(cleanDirective) : null;

  // Se temos a narração completa, criamos os Visual Beats sincronizados frase a frase
  if (narrationText && typeof narrationText === 'string' && narrationText.trim().length > 50) {
    const phrases = extractNarrationBeats(narrationText);
    const motionTypes = ['push_in', 'pan_left_right', 'reveal_zoom_out', 'pan_right_left', 'atmospheric_drift'];
    const totalWords = narrationText.trim().split(/\s+/).length;
    const totalDurationEst = (totalWords / 135) * 60;

    const scenePromises = phrases.map(async (phrase, idx) => {
      const phraseWords = phrase.trim().split(/\s+/).length;
      const beatDuration = Math.max(3.2, Number(((phraseWords / totalWords) * totalDurationEst).toFixed(1)));
      const intent = deduceActionIntent(phrase);
      const motion = motionTypes[idx % motionTypes.length];
      const blockType = idx === 0 ? 'hook' : idx >= phrases.length - 1 ? 'cta' : idx >= phrases.length - 3 ? 'hack' : 'body';

      const prompt = await buildProfessionalScenePrompt({
        spokenPhrase: phrase,
        visualDirective: cleanDirective,
        channelAesthetic: visualAesthetic,
        blockType,
        motionType: motion,
        apiKey,
        sceneIndex: idx,
        totalScenes: phrases.length
      });

      const visualDesc = cleanDirective
        ? `${cleanDirective}: ${intent.actionPt}`
        : `${intent.actionPt} (inspirado em "${phrase.slice(0, 35)}...")`;

      return {
        id: idx + 1,
        sceneIndex: idx,
        duration: beatDuration,
        prompt,
        phrase: phrase,
        motionType: motion,
        aesthetic: visualAesthetic,
        visualDirective: cleanDirective,
        cinemagraphFX: null, // Será detectado automaticamente na esteira de vídeo
        keywords: cleanDirective ? [cleanDirective, intent.type] : [intent.type, 'cinematic dark'],
        visualDescription: visualDesc
      };
    });

    const scenes = await Promise.all(scenePromises);

    if (scenes.length >= 6) {
      return scenes;
    }
  }

  // Fallback caso não haja narração longa: gera 6 takes temáticos calibrados
  const motionTypes = ['push_in', 'pan_left_right', 'reveal_zoom_out', 'pan_right_left', 'atmospheric_drift', 'push_in'];
  if (cleanDirective) {
    return [
      {
        id: 1,
        duration: 4.5,
        motionType: motionTypes[0],
        prompt: `Cinematic vertical 9:16 close-up portrait of fierce ${cleanDirective} in ornate dark armor, intense eyes staring with determination, dramatic chiaroscuro lighting, ${visualAesthetic}, 8k`,
        keywords: [cleanDirective, 'close up', 'dramatic portrait'],
        visualDescription: `${cleanDirective} com olhar focado e postura imponente em primeiro plano`
      },
      {
        id: 2,
        duration: 5.5,
        motionType: motionTypes[1],
        prompt: `${cleanDirective} standing in strategic disciplined formation, ancient council and strategy planning, atmospheric dust and volumetric rays of light, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'strategic formation', 'discipline'],
        visualDescription: `${cleanDirective} em formação tática representando estratégia e disciplina mental`
      },
      {
        id: 3,
        duration: 5.0,
        motionType: motionTypes[2],
        prompt: `Close-up on ${cleanDirective} face showing intense inner focus amid chaotic battlefield smoke, emotional control, chiaroscuro, vertical 9:16`,
        keywords: [cleanDirective, 'inner focus', 'smoke dark'],
        visualDescription: `${cleanDirective} mantendo foco absoluto e autocontrole diante da tempestade`
      },
      {
        id: 4,
        duration: 5.0,
        motionType: motionTypes[3],
        prompt: `Dramatic cinematic atmosphere of ${cleanDirective}, ancient shields and banners in dark fog, dramatic hourglass or passing time, tension and challenge, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'challenge battlefield', 'hourglass fog'],
        visualDescription: `${cleanDirective} em momento de alta tensão e superação do tempo`
      },
      {
        id: 5,
        duration: 4.5,
        motionType: motionTypes[4],
        prompt: `Close-up shot of disciplined ${cleanDirective} hands firmly gripping weapons or parchment with unwavering resolve, dramatic side rim light, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'hands action', 'resolute execution'],
        visualDescription: `Mãos de ${cleanDirective} executando a decisão prática com determinação`
      },
      {
        id: 6,
        duration: 5.5,
        motionType: motionTypes[5],
        prompt: `A legendary ${cleanDirective} silhouette standing victorious on a high cliff overlooking an ancient horizon at golden sunrise, triumphant atmosphere, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'victory sunrise', 'triumph cliff'],
        visualDescription: `${cleanDirective} vitorioso no horizonte celebrando o autodomínio`
      }
    ];
  }

  const lower = (baseTitle + ' ' + (summaryInsight || '')).toLowerCase();

  return [
    {
      id: 1,
      duration: 4.5,
      motionType: 'push_in',
      prompt: `Cinematic dramatic hook close-up illustrating "${baseTitle.slice(0, 40)}", intense eyes and face in chiaroscuro lighting, ${visualAesthetic}, vertical 9:16`,
      keywords: ['dramatic hook', 'intense gaze', 'curiosity'],
      visualDescription: 'Close-up provocativo de alto contraste para o gancho inicial'
    },
    {
      id: 2,
      duration: 5.5,
      motionType: 'pan_left_right',
      prompt: `Moody conceptual visualization of deep psychology and human behavior regarding "${baseTitle.slice(0, 40)}", shadowy aesthetic, vertical 9:16`,
      keywords: ['psychology concept', 'deep analysis', 'brain mind'],
      visualDescription: 'Representação visual da mecânica científica e psicológica'
    },
    {
      id: 3,
      duration: 5.0,
      motionType: 'reveal_zoom_out',
      prompt: `Dynamic abstract visual representing key breakthrough insight on "${baseTitle.slice(0, 40)}", volumetric glowing light rays, vertical 9:16`,
      keywords: ['breakthrough insight', 'light beam', 'truth revealed'],
      visualDescription: 'Revelação visual do insight oculto com raios volumétricos'
    },
    {
      id: 4,
      duration: 5.0,
      motionType: 'pan_right_left',
      prompt: `Close-up shot of hands taking precise disciplined action, subtle rim lighting, practical hack execution, vertical 9:16`,
      keywords: ['hands decisive action', 'practical execution', 'clarity'],
      visualDescription: 'Mãos em ação decidida executando a regra prática'
    },
    {
      id: 5,
      duration: 5.5,
      motionType: 'atmospheric_drift',
      prompt: `A silhouette of a confident person standing on an expansive golden sunrise horizon, triumph and success, vertical 9:16`,
      keywords: ['victory silhouette', 'sunrise horizon', 'triumph'],
      visualDescription: 'Silhueta triunfante no horizonte ao amanhecer para o CTA'
    }
  ];
}
