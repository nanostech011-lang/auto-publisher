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
export async function analyzeAndAdaptYouTubeVideo({ url, channelProfile = {} }) {
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
  const defaultTags = channelProfile.publishing_profile?.default_tags || ['shorts', 'viral', 'repurpose'];

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

  const finalTitle = `${baseTitle.slice(0, 60)}: A Verdade Revelada #Shorts`;
  const description = `${finalTitle}\n\nAnálise estratégica e resumo prático inspirado no conteúdo de ${metadata.authorName} (${baseTitle}).\n\n${affiliateCta.description_template || '👉 Acesse o link fixado para saber mais!'}\n\nTags: #${defaultTags.slice(0, 5).join(' #')}`;
  const firstComment = affiliateCta.first_comment || `♟️ O que você achou dessa perspectiva de ${metadata.authorName}? Comente abaixo e veja o link fixado!`;

  // 5 Cenas visuais (proporção 9:16)
  const visualAesthetic = channelProfile.visual_profile?.aesthetic || 'Cinematic Dark Minimalist';
  const scenes = [
    {
      id: 1,
      duration: 5,
      prompt: `Cinematic close-up portrait with intense dramatic lighting, ${visualAesthetic}, 8k resolution, vertical 9:16`,
      keywords: ['intense look', 'dramatic portrait', 'attention grabber']
    },
    {
      id: 2,
      duration: 18,
      prompt: `Moody conceptual visualization of thoughts and strategy, shadowy atmosphere, ${visualAesthetic}, vertical 9:16`,
      keywords: ['strategic mind', 'shadows reflection', 'deep thinking']
    },
    {
      id: 3,
      duration: 18,
      prompt: `Dynamic abstract visual representing power and insight, volumetric light rays, vertical 9:16`,
      keywords: ['abstract energy', 'light beam', 'breakthrough moment']
    },
    {
      id: 4,
      duration: 14,
      prompt: `Close-up shot of hands taking precise action with clarity, subtle rim lighting, vertical 9:16`,
      keywords: ['decisive hands', 'action focus', 'execution']
    },
    {
      id: 5,
      duration: 13,
      prompt: `A silhouette of a confident person walking into a bright glowing doorway, victorious path, vertical 9:16`,
      keywords: ['victory silhouette', 'door of light', 'triumph']
    }
  ];

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
    title: finalTitle,
    narrationText,
    wordCount,
    estimatedDurationSeconds,
    rewardsEligible: estimatedDurationSeconds >= 60,
    blocks: [
      { title: 'Gancho (0-3s)', text: hookText },
      { title: 'Foco Central (3-45s)', text: scienceText },
      { title: 'Hack Prático (45-58s)', text: hackText },
      { title: 'CTA & Retenção (58-65s)', text: ctaText }
    ],
    metadata: {
      title: finalTitle,
      description,
      tags: defaultTags.join(', '),
      categoryId: channelProfile.publishing_profile?.youtube_category_id || 24,
      madeForKids: channelProfile.publishing_profile?.made_for_kids || false,
      privacy: channelProfile.publishing_profile?.privacy || 'PUBLIC',
      firstComment
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
