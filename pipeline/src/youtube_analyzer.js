import { YoutubeTranscript } from 'youtube-transcript';

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
 * Extrai transcrição/legendas do vídeo do YouTube
 */
export async function fetchVideoTranscript(videoId) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcript && transcript.length > 0) {
      const fullText = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
      return {
        available: true,
        text: fullText,
        segmentsCount: transcript.length
      };
    }
  } catch (e) {
    // Legendas desativadas ou indisponíveis
  }

  return {
    available: false,
    text: null,
    segmentsCount: 0
  };
}

/**
 * Analisa o conteúdo do vídeo do YouTube e gera um roteiro adaptado nos 4 blocos de retenção
 */
export async function analyzeAndAdaptYouTubeVideo({ url, channelProfile = {}, visualDirective = null }) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error(`URL do YouTube inválida: "${url}". Forneça um link válido como https://www.youtube.com/watch?v=... ou https://youtu.be/...`);
  }

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
  const summaryInsight = transcriptData.available && transcriptData.text
    ? extractKeyInsight(transcriptData.text, baseTitle)
    : `a análise essencial extraída de "${baseTitle}" por ${metadata.authorName}`;

  // Estruturação dos 4 Blocos de Retenção Algorítmica (~150 palavras / 65-70s)
  const hookText = `Se você viu o vídeo sobre ${baseTitle.slice(0, 40)}, pare tudo agora: existe um detalhe crucial que quase ninguém percebeu.`;
  const scienceText = `A verdade por trás desse conteúdo revela que ${summaryInsight}. Quando observamos o padrão do comportamento humano em profundidade, nosso cérebro reage de forma imediata à expectativa e à pressão do ambiente. Não se trata de sorte ou coincidência, mas de um processo psicológico direto.`;
  const hackText = `A regra prática para aplicar isso na sua vida agora: em vez de reagir no calor do momento, dê um passo para trás, filtre as intenções reais e mantenha o controle absoluto das suas decisões.`;
  const ctaText = `Siga ${channelName} para ter acesso diário a análises estratégicas como essa antes de todo mundo.`;

  const narrationText = `${hookText} ${scienceText} ${hackText} ${ctaText}`;
  const words = narrationText.trim().split(/\s+/);
  const wordCount = words.length;
  const estimatedDurationSeconds = Math.round((wordCount / 135) * 60);

  const visualDirectiveTag = visualDirective ? `\n\n🎨 Estilo Visual: ${visualDirective}` : '';
  const finalTitle = `${baseTitle.slice(0, 60)}: A Verdade Revelada #Shorts`;
  const description = `${finalTitle}\n\nAnálise estratégica e resumo prático inspirado no conteúdo de ${metadata.authorName} (${baseTitle}).${visualDirectiveTag}\n\n${affiliateCta.description_template || '👉 Acesse o link fixado para saber mais!'}\n\nTags: #${defaultTags.slice(0, 5).join(' #')}`;
  const firstComment = affiliateCta.first_comment || `♟️ O que você achou dessa perspectiva de ${metadata.authorName}? Comente abaixo e veja o link fixado!`;

  if (visualDirective) {
    const extraTags = visualDirective.toLowerCase().replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(w => w.length > 3);
    defaultTags = [...new Set([...defaultTags, ...extraTags])];
  }

  // 5 Cenas visuais (proporção 9:16) geradas dinamicamente com base no tema e diretriz visual
  const visualAesthetic = channelProfile.visual_profile?.aesthetic || 'Cinematic Dark Minimalist';
  const scenes = generateThematicScenes(baseTitle, summaryInsight, visualAesthetic, visualDirective, narrationText);

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
      { title: 'Hack Prático (45-58s)', text: hackText, visualDescription: scenes[3]?.visualDescription || scenes[3]?.prompt },
      { title: 'CTA & Retenção (58-65s)', text: ctaText, visualDescription: scenes[4]?.visualDescription || scenes[4]?.prompt }
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
    if (words.length > 15) {
      const parts = sentence.split(/[,;:]+|\s+(?:quando|porque|enquanto|mas|onde)\s+/i)
        .map(p => p.trim())
        .filter(p => p.length > 10);
      
      if (parts.length > 1) {
        let current = '';
        for (const part of parts) {
          if ((current + ' ' + part).trim().split(/\s+/).length < 7) {
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

  // Agrupa frases muito pequenas com a vizinha para evitar takes de menos de 5 palavras
  const consolidated = [];
  let buffer = '';
  for (const b of beats) {
    const bWords = b.split(/\s+/).length;
    if (bWords < 5) {
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

  return consolidated.length >= 6 ? consolidated : rawSentences;
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
export function generateThematicScenes(baseTitle, summaryInsight, visualAesthetic = 'Cinematic Dark Minimalist', visualDirective = null, narrationText = null) {
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

    const scenes = phrases.map((phrase, idx) => {
      const phraseWords = phrase.trim().split(/\s+/).length;
      const beatDuration = Math.max(3.2, Number(((phraseWords / totalWords) * totalDurationEst).toFixed(1)));
      const intent = deduceActionIntent(phrase);
      const motion = motionTypes[idx % motionTypes.length];

      let prompt = '';
      let visualDesc = '';

      if (cleanDirective) {
        prompt = `Cinematic vertical 9:16 photography of ${directiveEn}, ${intent.actionEn}, highly detailed, ${visualAesthetic}, dramatic chiaroscuro lighting, volumetric dust particles, 85mm lens, photorealistic 8k`;
        visualDesc = `${cleanDirective}: ${intent.actionPt}`;
      } else {
        prompt = `Cinematic vertical 9:16 photography representing "${phrase.slice(0, 45)}", ${intent.actionEn}, highly detailed, ${visualAesthetic}, dramatic chiaroscuro lighting, 85mm lens, photorealistic 8k`;
        visualDesc = `${intent.actionPt} (inspirado em "${phrase.slice(0, 35)}...")`;
      }

      return {
        id: idx + 1,
        duration: beatDuration,
        prompt,
        phrase: phrase,
        motionType: motion,
        keywords: cleanDirective ? [cleanDirective, intent.type] : [intent.type, 'cinematic dark'],
        visualDescription: visualDesc
      };
    });

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
