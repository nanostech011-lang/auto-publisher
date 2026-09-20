/**
 * AutoPublisher Pro - Stock Video Connector (Pexels & Pixabay)
 * 
 * Conector de B-Roll vertical (9:16) de alta qualidade para canais de alta retenção.
 * Integração gratuita com Pexels Video API (20.000 req/mês) e Pixabay Video API,
 * garantindo vídeos reais cinematográficos com corte exato para a duração da cena.
 */

import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const ffmpegBinary = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegInstaller.path);
const ffprobeBinary = process.env.FFPROBE_PATH || (fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegBinary);
ffmpeg.setFfprobePath(ffprobeBinary);

// Carregamento de variáveis de ambiente
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

const PT_TO_EN_KEYWORDS = {
  'homem': 'man',
  'mulher': 'woman',
  'pessoa': 'person',
  'pessoas': 'people',
  'olhando': 'looking',
  'olhar': 'looking gaze',
  'olhos': 'eyes close up',
  'pensativo': 'thoughtful contemplative',
  'pensando': 'thinking',
  'mente': 'mind brain',
  'cerebro': 'brain',
  'cérebro': 'brain',
  'caminhando': 'walking',
  'andando': 'walking',
  'estudando': 'studying',
  'estudar': 'studying desk',
  'livro': 'reading book',
  'ler': 'reading book',
  'trabalho': 'working business',
  'trabalhando': 'working desk',
  'escritorio': 'modern office',
  'escritório': 'modern office',
  'dinheiro': 'money finance',
  'celular': 'smartphone typing',
  'cidade': 'city night lights',
  'noite': 'night dark moody',
  'chuva': 'rain city dark',
  'escuro': 'dark moody cinematic',
  'estátua': 'stoic ancient statue',
  'estatua': 'stoic ancient statue',
  'filosofia': 'philosophy reflection',
  'meditação': 'meditation calm',
  'meditacao': 'meditation calm',
  'sucesso': 'success luxury focus',
  'disciplina': 'discipline workout focus',
  'foco': 'focus concentration',
  'ansiedade': 'anxiety tension dark',
  'medo': 'fear dramatic shadows',
  'preguiçoso': 'tired lazy person',
  'preguicoso': 'tired lazy person',
  'preguiça': 'procrastination exhausted',
  'preguica': 'procrastination exhausted',
  'procrastinação': 'procrastination dark room',
  'procrastinacao': 'procrastination dark room',
  'ânimo': 'motivation energy',
  'animo': 'motivation energy',
  'dopamina': 'brain dopamine synapses',
  'neurociência': 'neuroscience brain',
  'neurociencia': 'neuroscience brain',
  'química': 'chemistry molecular abstract',
  'quimica': 'chemistry molecular abstract',
  'hábito': 'routine habit focus',
  'habito': 'routine habit focus',
  'rotina': 'daily routine discipline',
  'tempo': 'hourglass time clock',
  'ampulheta': 'hourglass dark sand',
  'relógio': 'clock ticking dark',
  'relogio': 'clock ticking dark',
  'silêncio': 'silence dark stare',
  'silencio': 'silence dark stare',
  'mentira': 'lies deception shadows',
  'mentindo': 'deception shadow face',
  'verdade': 'truth revelation light',
  'guerreiro': 'ancient warrior armor',
  'guerreiros': 'warriors golden armor',
  'espada': 'sword blade steel',
  'escudo': 'bronze shield battle',
  'armadura': 'golden battle armor',
  'persa': 'ancient Persian warrior',
  'persas': 'Persian warriors battle',
  'samurai': 'samurai katana night',
  'sol': 'golden sunrise horizon',
  'montanha': 'mountain cliff summit',
  'floresta': 'mystic forest green',
  'vitória': 'victory triumph horizon',
  'vitoria': 'victory triumph horizon',
  'líder': 'leader silhouette standing',
  'lider': 'leader silhouette standing',
  'flow': 'deep focus laser working',
  'concentração': 'intense concentration mind',
  'concentracao': 'intense concentration mind'
};

/**
 * Traduz termos comuns em português para inglês, ampliando drasticamente o catálogo de busca no Pexels e Pixabay.
 */
export function translateStockQueryToEnglish(query) {
  if (!query || typeof query !== 'string') return 'cinematic moody vertical';
  const clean = query.toLowerCase().replace(/[^\w\sáéíóúâêîôûãõç]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const translated = words.map(w => PT_TO_EN_KEYWORDS[w] || w);
  const joined = translated.join(' ');
  return joined.length > 3 ? `${joined} cinematic` : 'cinematic moody vertical';
}

/**
 * Constrói lista inteligente e rica de queries contextuais em inglês ordenadas por relevância para a cena.
 */
export function buildSmartContextualQueries({ scene = {}, phrase = '', visualDirective = '', channelAesthetic = '', sceneIndex = 0 }) {
  const queries = [];
  const text = (phrase || scene.phrase || '').toLowerCase();
  const directive = (visualDirective || scene.visualDirective || '').trim();

  // 1. Prioridade máxima: Diretriz visual customizada informada pelo usuário (ex: Guerreiros Persas, Anime, Cyberpunk)
  if (directive) {
    const cleanDir = directive.toLowerCase();
    if (/persa|persian/i.test(cleanDir)) {
      queries.push('persian warrior golden armor', 'ancient warrior battle desert', 'persian empire ruins');
    } else if (/samurai|ninja|jap[aã]o/i.test(cleanDir)) {
      queries.push('samurai katana warrior night', 'japanese armor silhouette', 'ancient samurai sword');
    } else if (/anime|manga|shonen/i.test(cleanDir)) {
      queries.push('anime night sky stars', 'cinematic neon city animation', 'hero silhouette mountain');
    } else if (/ghibli|cozy|medieval|floresta\s*encantada/i.test(cleanDir)) {
      queries.push('peaceful forest stream sunbeams', 'cozy campfire night stars', 'starry night forest fantasy');
    } else if (/cyberpunk|neon|futurist/i.test(cleanDir)) {
      queries.push('cyberpunk neon city rain', 'futuristic dark street lights', 'hacker computer screen');
    } else {
      queries.push(translateStockQueryToEnglish(directive));
    }
  }

  // 2. Query ou Keywords fornecidas pelo analisador do roteiro
  if (scene.stockQuery && typeof scene.stockQuery === 'string' && scene.stockQuery.trim().length > 2) {
    queries.push(scene.stockQuery.trim());
    queries.push(translateStockQueryToEnglish(scene.stockQuery));
  }

  if (Array.isArray(scene.keywords) && scene.keywords.length > 0) {
    for (const kw of scene.keywords) {
      if (typeof kw === 'string' && kw.length > 2) {
        queries.push(translateStockQueryToEnglish(kw));
      }
    }
  }

  // 3. Heurísticas conceituais de alta precisão baseadas na frase dita pelo locutor
  if (/preguiç|preguica|ânimo|animo|cansad|procrastina/i.test(text)) {
    queries.push('tired person glowing phone dark', 'procrastination exhausted night', 'dark moody thinking');
  }
  if (/dopamina|neurotransmissor|receptores|química|quimica/i.test(text)) {
    queries.push('brain neural connections glowing', 'glowing abstract neural network', 'human mind thought dark');
  }
  if (/cérebro|cerebro|mente|amígdala|cognitiv/i.test(text)) {
    queries.push('human head silhouette glow', 'brain glowing synapses 3d', 'deep concentration thinking');
  }
  if (/estud|trabalh|projeto|livro|ler\b|escrever/i.test(text)) {
    queries.push('person studying night desk', 'reading book library shadows', 'working focused laptop');
  }
  if (/5\s*minutos|ação|acao|agir|vontade|primeiro\s*movimento/i.test(text)) {
    queries.push('person tying running shoes', 'athlete start line focus', 'stopwatch clock ticking');
  }
  if (/silêncio|silencio|mentir|mentindo|verdade|pausa/i.test(text)) {
    queries.push('intense eye contact stare', 'two people dramatic meeting shadows', 'mysterious face shadow');
  }
  if (/olho|olhar|contato\s*visual|repar/i.test(text)) {
    queries.push('intense eyes close up dark', 'piercing stare dramatic lighting', 'eye contact gaze');
  }
  if (/dinheiro|rico|riqueza|ativo|patrimônio|patrimonio|milion/i.test(text)) {
    queries.push('modern luxury skyscraper night', 'financial market graph dark', 'gold wealth success');
  }
  if (/tempo|ampulheta|horas|passando|relógio|relogio/i.test(text)) {
    queries.push('hourglass dark sand glowing', 'clock ticking dark dramatic', 'time passing cinematic');
  }
  if (/flow|concentra|foco\b|atenção|atencao/i.test(text)) {
    queries.push('deep focus worker dark', 'meditation calm sunrise', 'laser focus person');
  }
  if (/estoic|marco\s*aurélio|filosof|inabalável|inabalavel/i.test(text)) {
    queries.push('stoic philosopher marble bust', 'ancient roman statue dark', 'calm rock in storm ocean');
  }
  if (/vitória|vitoria|siga|conquista|líder|lider|horizonte/i.test(text)) {
    queries.push('silhouette standing sunrise mountain', 'victory freedom horizon', 'success sunrise cinematic');
  }

  // 4. Tradução dos termos individuais da frase
  const phraseTranslated = translateStockQueryToEnglish(text);
  if (phraseTranslated && phraseTranslated.length > 5) {
    queries.push(phraseTranslated);
  }

  // 5. Fallbacks atmosféricos cinematográficos verticais
  queries.push(channelAesthetic ? `${channelAesthetic} vertical` : 'cinematic dark vertical');
  queries.push('cinematic dark moody vertical');

  // Remove duplicatas preservando a prioridade
  const unique = [];
  const seen = new Set();
  for (const q of queries) {
    const norm = q.trim().toLowerCase();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      unique.push(q.trim());
    }
  }

  return unique;
}

/**
 * Busca vídeo vertical (9:16) na API do Pexels com suporte a anti-repetição
 */
export async function searchPexelsVideo({ query, apiKey = null, usedVideoIds = null }) {
  const effectiveKey = (apiKey !== null && apiKey !== undefined) ? apiKey : process.env.PEXELS_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: 'PEXELS_API_KEY não configurada' };
  }

  try {
    const cleanQuery = encodeURIComponent(query.slice(0, 80));
    const url = `https://api.pexels.com/videos/search?query=${cleanQuery}&orientation=portrait&size=medium&per_page=10`;
    const res = await fetch(url, {
      headers: {
        Authorization: effectiveKey
      }
    });

    if (!res.ok) {
      return { success: false, error: `Pexels API retornou HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data.videos || data.videos.length === 0) {
      return { success: false, error: `Nenhum vídeo vertical encontrado no Pexels para: "${query}"` };
    }

    // Escolhe o vídeo mais adequado respeitando a anti-repetição
    for (const video of data.videos) {
      const vidId = String(video.id);
      if (usedVideoIds && usedVideoIds.has(vidId)) {
        continue; // Ignora clipe já utilizado em take anterior
      }

      // Procura arquivos de vídeo com orientação vertical
      const files = video.video_files || [];
      // Prioriza HD vertical (1080x1920 ou 720x1280)
      const idealFile = files.find(f => (f.width && f.height && f.height > f.width && f.width >= 720)) ||
                        files.find(f => f.quality === 'hd') ||
                        files[0];

      if (idealFile && idealFile.link) {
        if (usedVideoIds) usedVideoIds.add(vidId);
        return {
          success: true,
          videoId: vidId,
          provider: 'Pexels Video API',
          videoUrl: idealFile.link,
          width: idealFile.width,
          height: idealFile.height,
          duration: video.duration
        };
      }
    }

    return { success: false, error: 'Arquivos de vídeo incompatíveis ou repetidos no Pexels' };
  } catch (err) {
    return { success: false, error: `Erro na consulta ao Pexels: ${err.message}` };
  }
}

/**
 * Busca vídeo na API do Pixabay como fallback secundário com suporte a anti-repetição
 */
export async function searchPixabayVideo({ query, apiKey = null, usedVideoIds = null }) {
  const effectiveKey = (apiKey !== null && apiKey !== undefined) ? apiKey : process.env.PIXABAY_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: 'PIXABAY_API_KEY não configurada' };
  }

  try {
    const cleanQuery = encodeURIComponent(query.slice(0, 80));
    const url = `https://pixabay.com/api/videos/?key=${effectiveKey}&q=${cleanQuery}&video_type=all&per_page=10`;
    const res = await fetch(url);

    if (!res.ok) {
      return { success: false, error: `Pixabay API retornou HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data.hits || data.hits.length === 0) {
      return { success: false, error: `Nenhum vídeo encontrado no Pixabay para: "${query}"` };
    }

    for (const hit of data.hits) {
      const vidId = String(hit.id);
      if (usedVideoIds && usedVideoIds.has(vidId)) {
        continue;
      }

      const videos = hit.videos || {};
      const candidate = videos.medium || videos.large || videos.small;

      if (candidate && candidate.url) {
        if (usedVideoIds) usedVideoIds.add(vidId);
        return {
          success: true,
          videoId: vidId,
          provider: 'Pixabay Video API',
          videoUrl: candidate.url,
          width: candidate.width,
          height: candidate.height,
          duration: hit.duration
        };
      }
    }

    return { success: false, error: 'Estrutura de vídeo não encontrada ou repetida no Pixabay' };
  } catch (err) {
    return { success: false, error: `Erro na consulta ao Pixabay: ${err.message}` };
  }
}

/**
 * Baixa um vídeo remoto para arquivo temporário local
 */
export async function downloadRemoteFile(url, tempPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha no download do vídeo: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}

/**
 * Baixa, corta em 9:16 (1080x1920) e ajusta a duração exata com micro-fade cinematográfico
 */
export function formatStockClipToExactDuration({
  rawVideoPath,
  durationSeconds,
  outputPath,
  isHookScene = false,
  isLastScene = false
}) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const dSec = Math.max(1, Number(durationSeconds) || 3);
  const fadeOutStart = Math.max(0.2, (dSec - 0.20)).toFixed(2);
  // Match cuts rápidos e dinâmicos para retenção máxima: fade out apenas no take final do vídeo
  const transitionFade = isLastScene
    ? `,fade=t=out:st=${fadeOutStart}:d=0.20`
    : '';

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(rawVideoPath)
      .inputOptions(['-stream_loop -1'])
      .outputOptions([
        `-t ${dSec}`,
        `-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920${transitionFade}`,
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-r 30',
        '-preset fast'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', err => reject(err))
      .run();
  });
}

/**
 * Orquestrador central de B-Roll de Stock Video
 * Tenta obter um clipe real 9:16 para a cena indicada
 */
export async function fetchAndPrepareStockBroll({
  query,
  candidateQueries = null,
  outputPath,
  durationSeconds,
  isHookScene = false,
  isLastScene = false,
  pexelsApiKey = null,
  pixabayApiKey = null,
  usedVideoIds = null
}) {
  if (!candidateQueries && (!query || typeof query !== 'string' || query.trim().length < 2)) {
    return { success: false, error: 'Query de busca vazia ou inválida' };
  }

  const queries = Array.isArray(candidateQueries) && candidateQueries.length > 0
    ? candidateQueries
    : [query, translateStockQueryToEnglish(query), 'cinematic dark moody vertical'];

  let searchResult = { success: false };

  // 1. Tenta Pexels (orientação vertical nativa de alta fidelidade)
  for (const q of queries) {
    if (!q || q.length < 2) continue;
    searchResult = await searchPexelsVideo({ query: q, apiKey: pexelsApiKey, usedVideoIds });
    if (searchResult.success) break;
  }

  // 2. Fallback para Pixabay se Pexels falhar
  if (!searchResult.success) {
    for (const q of queries) {
      if (!q || q.length < 2) continue;
      searchResult = await searchPixabayVideo({ query: q, apiKey: pixabayApiKey, usedVideoIds });
      if (searchResult.success) break;
    }
  }

  if (!searchResult.success || !searchResult.videoUrl) {
    return { success: false, error: searchResult.error || 'Nenhum stock video disponível' };
  }

  const tempRawPath = `${outputPath}.raw.mp4`;
  try {
    await downloadRemoteFile(searchResult.videoUrl, tempRawPath);
    await formatStockClipToExactDuration({
      rawVideoPath: tempRawPath,
      durationSeconds,
      outputPath,
      isHookScene,
      isLastScene
    });

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 20480) {
      return {
        success: true,
        provider: searchResult.provider,
        outputPath
      };
    }
  } catch (err) {
    return { success: false, error: `Falha ao processar vídeo de estoque: ${err.message}` };
  } finally {
    if (fs.existsSync(tempRawPath)) {
      try { fs.unlinkSync(tempRawPath); } catch (ignored) {}
    }
  }

  return { success: false, error: 'Falha desconhecida no conector de stock video' };
}

/**
 * Busca imagem/foto vertical (9:16) na API de Photos do Pexels com suporte a anti-repetição
 */
export async function searchPexelsPhoto({ query, apiKey = null, usedPhotoIds = null }) {
  const effectiveKey = (apiKey !== null && apiKey !== undefined) ? apiKey : process.env.PEXELS_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: 'PEXELS_API_KEY não configurada' };
  }

  try {
    const cleanQuery = encodeURIComponent(query.slice(0, 80));
    const url = `https://api.pexels.com/v1/search?query=${cleanQuery}&orientation=portrait&size=large&per_page=12`;
    const res = await fetch(url, {
      headers: {
        Authorization: effectiveKey
      }
    });

    if (!res.ok) {
      return { success: false, error: `Pexels Photo API retornou HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data.photos || data.photos.length === 0) {
      return { success: false, error: `Nenhuma foto vertical no Pexels para: "${query}"` };
    }

    for (const photo of data.photos) {
      const pId = String(photo.id);
      if (usedPhotoIds && usedPhotoIds.has(pId)) {
        continue;
      }

      const imgUrl = photo.src?.portrait || photo.src?.large2x || photo.src?.large || photo.src?.original;
      if (imgUrl) {
        if (usedPhotoIds) usedPhotoIds.add(pId);
        return {
          success: true,
          photoId: pId,
          provider: 'Pexels Photo API',
          photoUrl: imgUrl,
          photographer: photo.photographer
        };
      }
    }

    return { success: false, error: 'Fotos repetidas no Pexels para esta cena' };
  } catch (err) {
    return { success: false, error: `Erro na consulta Pexels Photo: ${err.message}` };
  }
}

/**
 * Busca foto na API do Pixabay como fallback secundário com suporte a anti-repetição
 */
export async function searchPixabayPhoto({ query, apiKey = null, usedPhotoIds = null }) {
  const effectiveKey = (apiKey !== null && apiKey !== undefined) ? apiKey : process.env.PIXABAY_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: 'PIXABAY_API_KEY não configurada' };
  }

  try {
    const cleanQuery = encodeURIComponent(query.slice(0, 80));
    const url = `https://pixabay.com/api/?key=${effectiveKey}&q=${cleanQuery}&image_type=photo&orientation=vertical&per_page=12`;
    const res = await fetch(url);

    if (!res.ok) {
      return { success: false, error: `Pixabay Photo API retornou HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data.hits || data.hits.length === 0) {
      return { success: false, error: `Nenhuma foto no Pixabay para: "${query}"` };
    }

    for (const hit of data.hits) {
      const pId = String(hit.id);
      if (usedPhotoIds && usedPhotoIds.has(pId)) {
        continue;
      }

      const imgUrl = hit.largeImageURL || hit.webformatURL;
      if (imgUrl) {
        if (usedPhotoIds) usedPhotoIds.add(pId);
        return {
          success: true,
          photoId: pId,
          provider: 'Pixabay Photo API',
          photoUrl: imgUrl
        };
      }
    }

    return { success: false, error: 'Fotos repetidas no Pixabay' };
  } catch (err) {
    return { success: false, error: `Erro na consulta Pixabay Photo: ${err.message}` };
  }
}

/**
 * Orquestrador central de busca e download de Foto de Estoque Vertical 9:16
 * Utiliza queries contextuais semânticas e aplica download resiliente
 */
export async function fetchAndPrepareStockPhoto({
  query,
  candidateQueries = null,
  outputPath,
  pexelsApiKey = null,
  pixabayApiKey = null,
  usedPhotoIds = null
}) {
  if (!candidateQueries && (!query || typeof query !== 'string' || query.trim().length < 2)) {
    return { success: false, error: 'Query de busca vazia ou inválida' };
  }

  const queries = Array.isArray(candidateQueries) && candidateQueries.length > 0
    ? candidateQueries
    : [query, translateStockQueryToEnglish(query), 'cinematic moody vertical'];

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 1. Tenta Pexels Photo API
  for (const q of queries) {
    if (!q || q.length < 2) continue;
    const res = await searchPexelsPhoto({ query: q, apiKey: pexelsApiKey, usedPhotoIds });
    if (res.success && res.photoUrl) {
      try {
        await downloadRemoteFile(res.photoUrl, outputPath);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 5000) {
          return {
            success: true,
            provider: res.provider,
            outputPath,
            photoId: res.photoId,
            matchedQuery: q
          };
        }
      } catch (err) {
        // tenta próxima query
      }
    }
  }

  // 2. Fallback para Pixabay Photo API
  for (const q of queries) {
    if (!q || q.length < 2) continue;
    const res = await searchPixabayPhoto({ query: q, apiKey: pixabayApiKey, usedPhotoIds });
    if (res.success && res.photoUrl) {
      try {
        await downloadRemoteFile(res.photoUrl, outputPath);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 5000) {
          return {
            success: true,
            provider: res.provider,
            outputPath,
            photoId: res.photoId,
            matchedQuery: q
          };
        }
      } catch (err) {
        // tenta próxima query
      }
    }
  }

  return { success: false, error: 'Nenhuma foto vertical encontrada nas bibliotecas de estoque' };
}

