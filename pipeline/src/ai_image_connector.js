import fs from 'fs';
import path from 'path';

// Carregamento nativo de variaveis de ambiente (.env) sem dependencia externa
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}
import { buildProfessionalScenePrompt } from './ai_prompt_generator.js';
import { globalCircuitBreaker } from './circuit_breaker.js';
import { globalAssetCache } from './asset_cache.js';



export function getNegativePromptForDirective(visualDirective = '', prompt = '') {
  const combined = `${visualDirective || ''} ${prompt || ''}`.toLowerCase();
  const isGhibli = /ghibli|moebius|lofi|lo-fi|cozy\s*fantasy|floresta\s*encantada|gouache|aquarela/i.test(combined);
  const isAnime = /anime|manga|mangá|shonen|otaku|animad|samurai|ufotable/i.test(combined);
  const isCyberpunk = /cyberpunk|neon|néon|futurist/i.test(combined);

  if (isGhibli) {
    // Estilo Ghibli / Fantasia Medieval Relaxante: proíbe fotorrealismo, CGI 3D, violência e escuridão
    return 'dark, horror, scary, violent, bloody, 3d render, cgi, photorealistic, photograph, 35mm film, ugly, deformed, modern, urban, low quality, blurry, text, watermark, split screen';
  }

  if (isAnime) {
    // Se o usuário quer estilo anime/shonen: NUNCA proíbe anime! Proíbe fotografia real, 3D mal feito e deformações
    return 'photorealistic, 35mm film photograph, real person, real skin pores, ugly, deformed anatomy, bad hands, extra limbs, blurry, low quality, watermark, signature, borders';
  }

  if (isCyberpunk) {
    return 'vintage, historical, medieval, low quality, blurry, bad anatomy, deformed, watermark, signature';
  }

  // Padrão realista documental
  return 'anime, cartoon, illustration, drawing, 3d render, doll, plastic, smooth skin, cgi, fake, painting, blurry, doll-like, oversaturated, artificial, deformed, bad anatomy, bad hands, digital art, videogame, render, airbrushed';
}

export const REALISTIC_NEGATIVE_PROMPT = getNegativePromptForDirective();

/**
 * Extrai um prompt compacto e de altíssimo foco visual para motores de contingência,
 * garantindo que o sujeito e o estilo estético escolhido pelo usuário sejam honrados.
 */
export function makeCompactFallbackPrompt(prompt, visualDirective = '') {
  if (!prompt || typeof prompt !== 'string') {
    return 'Masterpiece dramatic artwork, high contrast chiaroscuro, vertical 9:16';
  }

  const combined = `${visualDirective || ''} ${prompt}`.toLowerCase();
  const isGhibli = /ghibli|moebius|lofi|lo-fi|cozy\s*fantasy|floresta\s*encantada|gouache|aquarela/i.test(combined);
  const isAnime = !isGhibli && /anime|manga|mangá|shonen|samurai|ufotable/i.test(combined);

  // Remove prefixos genéricos
  let clean = prompt
    .replace(/^cinematic\s+vertical\s+9:16\s+(portrait\s+)?photography\s+of\s+/i, '')
    .replace(/^authentic\s+documentary\s+photograph\s+of\s+/i, '')
    .replace(/^masterpiece\s+dark\s+anime\s+illustration\s+of\s+/i, '')
    .replace(/^2d\s+hand-drawn\s+animation\s+cel,\s+ligne\s+claire,\s+studio\s+ghibli\s+and\s+moebius\s+art\s+style\s+of\s+/i, '')
    .replace(/^a\s+vertical\s+9:16\s+(portrait\s+)?(composition|photograph|illustration)\s+(of\s+|capturing\s+)/i, '')
    .replace(/^photograph\s+of\s+/i, '')
    .trim();

  let compact = clean.length <= 250 ? clean : clean.slice(0, 250).replace(/,[^,]*$/, '');

  if (isGhibli) {
    if (!compact.toLowerCase().includes('ghibli')) {
      compact += ', Studio Ghibli style, peaceful gouache painting, sunny enchanted forest, cozy fantasy art';
    }
  } else if (isAnime) {
    if (!compact.toLowerCase().includes('anime') && !compact.toLowerCase().includes('manga')) {
      compact += ', dark anime illustration, Ufotable anime studio lighting, dynamic manga style, vibrant cel-shading';
    }
  } else {
    // Garante tokens fotográficos de alta fidelidade e textura natural para temas realistas
    if (!compact.toLowerCase().includes('photograph') && !compact.toLowerCase().includes('35mm')) {
      compact += ', real photograph, authentic texture, 35mm film, documentary photography';
    }
  }

  return compact;
}

/**
 * Fallback Tier 1: Pollinations AI com Modelo Flux (Qualidade Ultra HD orientada à diretriz)
 */
export async function generateImageWithPollinationsFlux({ prompt, outputPath, seed = null, visualDirective = '' }) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sceneSeed = seed !== null ? seed : Math.floor(Math.random() * 1000000);
  const compact = makeCompactFallbackPrompt(prompt, visualDirective);
  const cleanPrompt = encodeURIComponent(compact);
  const negPrompt = getNegativePromptForDirective(visualDirective, prompt);
  const negParam = encodeURIComponent(negPrompt);

  // flux-realism para cenas fotorrealistas (documentário, pessoas, objetos)
  // flux para estilos artísticos (anime, ghibli, cyberpunk)
  const combined = `${visualDirective || ''} ${prompt}`.toLowerCase();
  const isArtStyle = /ghibli|anime|manga|cyberpunk|lofi|lo-fi|fantasy|illustration/i.test(combined);
  const imageModel = isArtStyle ? 'flux' : 'flux-realism';

  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1080&height=1920&nologo=true&seed=${sceneSeed}&model=${imageModel}&negative_prompt=${negParam}`;

  const startTime = Date.now();

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    // 28s timeout: o Flux-Realism processa em ~15-25s dependendo do servidor
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        console.log(`  [AI Connector] ↳ Fila cheia no Flux (429), aguardando 2s para reprocessar (tentativa ${attempt}/2)...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 5000) {
          fs.writeFileSync(outputPath, buffer);
          return {
            success: true,
            provider: 'Pollinations AI (sana 576x1024)',
            sizeBytes: buffer.length,
            latencyMs: Date.now() - startTime,
            outputPath
          };
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
    }
  }

  return { success: false, error: 'Falha ou timeout no Pollinations Flux após 2 tentativas' };
}

/**
 * Fallback Tier 2: Pollinations AI Rápido (Turbo)
 */
export async function generateImageWithPollinationsTurbo({ prompt, outputPath, seed = null, visualDirective = '' }) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sceneSeed = seed !== null ? seed : Math.floor(Math.random() * 1000000);
  const compact = makeCompactFallbackPrompt(prompt, visualDirective);
  const cleanPrompt = encodeURIComponent(compact);
  const negPrompt = getNegativePromptForDirective(visualDirective, prompt);
  const negParam = encodeURIComponent(negPrompt);

  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1080&height=1920&nologo=true&seed=${sceneSeed}&negative_prompt=${negParam}`;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= 1; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        console.log(`  [AI Connector] ↳ Fila cheia no Turbo (429)...`);
        continue;
      }

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 5000) {
          fs.writeFileSync(outputPath, buffer);
          return {
            success: true,
            provider: 'Pollinations AI (Turbo)',
            sizeBytes: buffer.length,
            latencyMs: Date.now() - startTime,
            outputPath
          };
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
    }
  }

  return { success: false, error: 'Falha ou timeout no Pollinations Turbo' };
}

/**
 * Orquestrador central de geração visual de alta qualidade com engenharia de prompts
 * e esteira resiliente de fallback em múltiplos níveis.
 */
export async function generateHighQualitySceneImage({
  prompt = null,
  spokenPhrase = '',
  visualDirective = '',
  channelAesthetic = 'Cinematic Dark Minimalist',
  blockType = 'body',
  motionType = 'push_in',
  outputPath,
  seed = null,
  apiKey = null
}) {
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  // 1. Gera prompt cinematográfico profissional em inglês se necessário
  let finalPrompt = prompt;
  if (!finalPrompt || finalPrompt.trim().length < 25) {
    finalPrompt = await buildProfessionalScenePrompt({
      spokenPhrase,
      visualDirective,
      channelAesthetic,
      blockType,
      motionType,
      apiKey: effectiveKey
    });
  }



  // 2. Cache content-addressed: verifica se este prompt/estilo já foi gerado
  const cacheKey = globalAssetCache.buildCacheKey({
    prompt: finalPrompt,
    aesthetic: channelAesthetic,
    visualDirective,
    type: 'image',
    seed
  });

  if (globalAssetCache.has(cacheKey)) {
    const cached = globalAssetCache.get(cacheKey, outputPath);
    if (cached) {
      const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(0);
      console.log(`  [AI Connector] ⚡ Cache HIT para asset de imagem (${sizeKb} KB)`);
      return {
        outputPath,
        provider: `${cached.metadata?.provider || 'Pollinations'} (Cached)`,
        prompt: finalPrompt,
        sizeKb
      };
    }
  }

  // 3. Verifica disponibilidade do provedor no Circuit Breaker
  if (!globalCircuitBreaker.isAvailable('pollinations')) {
    console.warn(`  [AI Connector] ↳ Provedor Pollinations em cooldown no Circuit Breaker (${globalCircuitBreaker.getBlockReason('pollinations')})`);
    return null;
  }

  // 4. Fallback Tier 1: Pollinations AI com Modelo Flux/Sana
  try {
    const fluxResult = await generateImageWithPollinationsFlux({
      prompt: finalPrompt,
      outputPath,
      seed,
      visualDirective
    });

    if (fluxResult.success) {
      globalCircuitBreaker.recordSuccess('pollinations');
      globalAssetCache.set(cacheKey, outputPath, { provider: fluxResult.provider });
      const sizeKb = (fluxResult.sizeBytes / 1024).toFixed(0);
      console.log(`  [AI Connector] ✓ Sucesso com Fallback Flux HD (${sizeKb} KB em ${fluxResult.latencyMs}ms)`);
      return {
        outputPath,
        provider: fluxResult.provider,
        prompt: finalPrompt,
        sizeKb
      };
    } else {
      globalCircuitBreaker.recordFailure('pollinations', fluxResult.error);
    }
  } catch (err) {
    globalCircuitBreaker.recordFailure('pollinations', err);
  }

  // 5. Fallback Tier 2: Pollinations AI Turbo
  if (globalCircuitBreaker.isAvailable('pollinations')) {
    console.log(`  [AI Connector] ↳ Tentando Fallback Secundário Turbo...`);
    try {
      const turboResult = await generateImageWithPollinationsTurbo({
        prompt: finalPrompt,
        outputPath,
        seed,
        visualDirective
      });

      if (turboResult.success) {
        globalCircuitBreaker.recordSuccess('pollinations');
        globalAssetCache.set(cacheKey, outputPath, { provider: turboResult.provider });
        const sizeKb = (turboResult.sizeBytes / 1024).toFixed(0);
        console.log(`  [AI Connector] ✓ Sucesso com Fallback Turbo (${sizeKb} KB em ${turboResult.latencyMs}ms)`);
        return {
          outputPath,
          provider: turboResult.provider,
          prompt: finalPrompt,
          sizeKb
        };
      }
    } catch (turboErr) {
      globalCircuitBreaker.recordFailure('pollinations', turboErr);
    }
  }

  // Se todas as IAs remotas oscilarem, retorna null para ativar fallback local
  console.warn(`  [AI Connector] ⚠️ Todas as APIs remotas de imagem oscilaram.`);
  return null;
}
