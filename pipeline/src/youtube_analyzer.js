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
  const scenes = generateThematicScenes(baseTitle, summaryInsight, visualAesthetic, visualDirective);

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
export function generateThematicScenes(baseTitle, summaryInsight, visualAesthetic = 'Cinematic Dark Minimalist', visualDirective = null) {
  // Prioridade Máxima: Se o usuário especificou uma diretriz visual customizada (ex: "guerreiros persas")
  if (visualDirective && typeof visualDirective === 'string' && visualDirective.trim().length > 0) {
    const cleanDirective = visualDirective.replace(/^(quero\s+gerar\s+imagens\s+de\s+|gerar\s+imagens\s+de\s+|imagens\s+de\s+)/i, '').trim();
    return [
      {
        id: 1,
        duration: 5,
        prompt: `Cinematic close-up portrait of fierce ${cleanDirective} in ornate dark armor, intense eyes staring with determination, dramatic chiaroscuro lighting, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'close up', 'dramatic portrait'],
        visualDescription: `${cleanDirective} com olhar focado e postura imponente em primeiro plano`
      },
      {
        id: 2,
        duration: 18,
        prompt: `${cleanDirective} standing in strategic disciplined formation, ancient council and strategy planning, atmospheric dust and volumetric rays of light, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'strategic formation', 'discipline'],
        visualDescription: `${cleanDirective} em formação tática representando estratégia e disciplina mental`
      },
      {
        id: 3,
        duration: 18,
        prompt: `Dramatic cinematic atmosphere of ${cleanDirective}, ancient shields and banners in dark fog, dramatic hourglass or passing time, tension and challenge, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'challenge battlefield', 'hourglass fog'],
        visualDescription: `${cleanDirective} em momento de alta tensão e superação do tempo`
      },
      {
        id: 4,
        duration: 14,
        prompt: `Close-up shot of disciplined ${cleanDirective} hands firmly gripping weapons or parchment with unwavering resolve, dramatic side rim light, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'hands action', 'resolute execution'],
        visualDescription: `Mãos de ${cleanDirective} executando a decisão prática com determinação`
      },
      {
        id: 5,
        duration: 13,
        prompt: `A legendary ${cleanDirective} silhouette standing victorious on a high cliff overlooking an ancient horizon at golden sunrise, triumphant atmosphere, ${visualAesthetic}, vertical 9:16`,
        keywords: [cleanDirective, 'victory sunrise', 'triumph cliff'],
        visualDescription: `${cleanDirective} vitorioso no horizonte celebrando o autodomínio`
      }
    ];
  }

  const lower = (baseTitle + ' ' + (summaryInsight || '')).toLowerCase();

  // Caso 1: Procrastinação, Foco, Dopamina, Vício em Telas
  if (lower.includes('procrastin') || lower.includes('foco') || lower.includes('dopamina') || lower.includes('preguiç') || lower.includes('motivação')) {
    return [
      {
        id: 1,
        duration: 5,
        prompt: `Cinematic close-up portrait of an exhausted person staring at a glowing smartphone screen in complete darkness, blue light reflecting on tired eyes, dark moody atmospheric lighting, vertical 9:16`,
        keywords: ['exhausted person phone dark', 'screen glow', 'dopamine scroll']
      },
      {
        id: 2,
        duration: 18,
        prompt: `Glowing 3D dopamine chemical molecular structure floating beside a glowing human brain with neural synapses firing, dark background, electric cyan and gold light, vertical 9:16`,
        keywords: ['dopamine 3D molecule', 'glowing neural network', 'brain chemistry']
      },
      {
        id: 3,
        duration: 18,
        prompt: `A dramatic dark hourglass with glowing blue and gold sand falling into darkness, atmospheric lighting, time running out, procrastination concept, vertical 9:16`,
        keywords: ['dark hourglass sand', 'time passing', 'discipline ticking']
      },
      {
        id: 4,
        duration: 14,
        prompt: `Close-up shot of determined hands firmly closing a smartphone and picking up a pen on a clean minimalist desk, dramatic rim lighting, action focus, vertical 9:16`,
        keywords: ['hands closing phone', 'action taking', 'discipline focus']
      },
      {
        id: 5,
        duration: 13,
        prompt: `A silhouette of a confident person standing tall facing a glowing golden sunrise over a modern city skyline, victorious atmosphere, mental mastery, vertical 9:16`,
        keywords: ['victorious silhouette sunrise', 'mental mastery', 'success path']
      }
    ];
  }

  // Caso 2: Silêncio, Psicologia Escura, Mentiras, Linguagem Corporal
  if (lower.includes('silêncio') || lower.includes('mentir') || lower.includes('linguagem') || lower.includes('confront')) {
    return [
      {
        id: 1,
        duration: 5,
        prompt: `Cinematic close-up of intense human eyes looking directly into the camera, extreme dark background, dramatic chiaroscuro lighting, vertical 9:16`,
        keywords: ['eyes close up', 'dark gaze', 'man thinking']
      },
      {
        id: 2,
        duration: 18,
        prompt: `Dark aesthetic silhouette of two people sitting across a table, tense standoff, shadowy ambient lighting, minimalist room, vertical 9:16`,
        keywords: ['silhouette discussion', 'dark meeting', 'tense conversation']
      },
      {
        id: 3,
        duration: 18,
        prompt: `Glowing 3D human brain on a pure black background, neural pathways firing with rapid electric blue synapses, amygdala glowing red, vertical 9:16`,
        keywords: ['human brain glowing', 'neural network', 'synapses electric']
      },
      {
        id: 4,
        duration: 14,
        prompt: `Close-up shot of hands fidgeting with nervousness in dim lighting, subtle sweat, shadow covering face, psychological tension, vertical 9:16`,
        keywords: ['nervous hands fidgeting', 'anxiety dark', 'stress shadow']
      },
      {
        id: 5,
        duration: 13,
        prompt: `A glowing golden key hovering inside a minimalist dark silhouette of a mind, volumetric light rays, sleek neon blue rim lighting, vertical 9:16`,
        keywords: ['glowing golden key', 'mind silhouette', 'light rays dark']
      }
    ];
  }

  // Caso 3: Finanças, Riqueza, Investimentos
  if (lower.includes('dinheiro') || lower.includes('riqueza') || lower.includes('invest') || lower.includes('milion') || lower.includes('pobre')) {
    return [
      {
        id: 1,
        duration: 5,
        prompt: `Cinematic money dissolving into glowing dust in dark atmospheric lighting, financial inflation concept, vertical 9:16`,
        keywords: ['cash dust', 'money ticking', 'financial trap']
      },
      {
        id: 2,
        duration: 18,
        prompt: `Modern city skyline at night with glowing emerald green financial charts and laser data lines, high-tech dark atmosphere, vertical 9:16`,
        keywords: ['modern city night data', 'financial charts', 'wealth skyscraper']
      },
      {
        id: 3,
        duration: 18,
        prompt: `Digital golden coins multiplying exponentially in a high-tech dark space, compound interest visual, vertical 9:16`,
        keywords: ['compound interest gold', 'multiplying wealth', 'financial asset']
      },
      {
        id: 4,
        duration: 14,
        prompt: `Confident hands analyzing investment graphs on a sleek dark tablet, dramatic rim lighting, wealth creation, vertical 9:16`,
        keywords: ['investor hands tablet', 'strategic wealth', 'financial mastery']
      },
      {
        id: 5,
        duration: 13,
        prompt: `A solitary visionary silhouette overlooking an expansive horizon at dawn with golden light rays, financial freedom, vertical 9:16`,
        keywords: ['visionary horizon dawn', 'financial freedom', 'wealth victory']
      }
    ];
  }

  // Caso 4: Geral / Temático Dinâmico
  return [
    {
      id: 1,
      duration: 5,
      prompt: `Cinematic dramatic hook close-up illustrating "${baseTitle.slice(0, 40)}", intense eyes and face in chiaroscuro lighting, ${visualAesthetic}, vertical 9:16`,
      keywords: ['dramatic hook', 'intense gaze', 'curiosity']
    },
    {
      id: 2,
      duration: 18,
      prompt: `Moody conceptual visualization of deep psychology and human behavior regarding "${baseTitle.slice(0, 40)}", shadowy aesthetic, vertical 9:16`,
      keywords: ['psychology concept', 'deep analysis', 'brain mind']
    },
    {
      id: 3,
      duration: 18,
      prompt: `Dynamic abstract visual representing key breakthrough insight on "${baseTitle.slice(0, 40)}", volumetric glowing light rays, vertical 9:16`,
      keywords: ['breakthrough insight', 'light beam', 'truth revealed']
    },
    {
      id: 4,
      duration: 14,
      prompt: `Close-up shot of hands taking precise disciplined action, subtle rim lighting, practical hack execution, vertical 9:16`,
      keywords: ['hands decisive action', 'practical execution', 'clarity']
    },
    {
      id: 5,
      duration: 13,
      prompt: `A silhouette of a confident person walking into a bright golden doorway, triumph and success, vertical 9:16`,
      keywords: ['victory silhouette', 'door of light', 'triumph']
    }
  ];
}
