import fs from 'fs';
import path from 'path';

// Carregamento nativo de variaveis de ambiente (.env) sem dependencia externa
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}
import { buildProfessionalScenePrompt } from './ai_prompt_generator.js';

let imagenDisabledForSession = false;

/**
 * Conector oficial da Google Imagen 3 (Vertex AI / Google AI Studio API)
 * Utiliza o modelo de ponta 'imagen-3.0-generate-002' com resolução 9:16 nativa.
 */
export async function generateImageWithImagen3({ prompt, outputPath, apiKey }) {
  if (imagenDisabledForSession) {
    return { success: false, error: 'Google Imagen 3 indisponível na cota da chave para esta sessão' };
  }

  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: 'GEMINI_API_KEY não configurada' };
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${effectiveKey}`;

  const payload = {
    instances: [
      { prompt: prompt }
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: '9:16',
      outputMimeType: 'image/jpeg',
      personGeneration: 'ALLOW_ADULT',
      safetySetting: 'block_only_high'
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const startTime = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': effectiveKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      if (res.status === 404 || res.status === 403 || res.status === 429) {
        imagenDisabledForSession = true;
      }
      let errorMsg = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson.error && errorJson.error.message) {
          errorMsg = `${errorMsg}: ${errorJson.error.message}`;
        }
      } catch (ignored) {}
      return { success: false, error: errorMsg };
    }

    const json = await res.json();
    const base64Data = json?.predictions?.[0]?.bytesBase64Encoded;

    if (!base64Data || typeof base64Data !== 'string') {
      return { success: false, error: 'Resposta da Imagen 3 não conteve bytesBase64Encoded válidos' };
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length < 5000) {
      return { success: false, error: `Imagem recebida corrompida ou muito pequena (${buffer.length} bytes)` };
    }

    fs.writeFileSync(outputPath, buffer);
    return {
      success: true,
      provider: 'Google Imagen 3 (imagen-3.0-generate-002)',
      sizeBytes: buffer.length,
      latencyMs,
      outputPath
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, error: err.message };
  }
}

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

  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1080&height=1920&nologo=true&seed=${sceneSeed}&model=flux&negative_prompt=${negParam}`;

  const startTime = Date.now();

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        console.log(`  [AI Connector] ↳ Fila cheia no Flux (429), aguardando 4.5s para reprocessar (tentativa ${attempt}/3)...`);
        await new Promise(r => setTimeout(r, 4500));
        continue;
      }

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 5000) {
          fs.writeFileSync(outputPath, buffer);
          return {
            success: true,
            provider: 'Pollinations AI (Flux HD 1080p)',
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

  return { success: false, error: 'Falha ou timeout no Pollinations Flux após 3 tentativas' };
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

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        console.log(`  [AI Connector] ↳ Fila cheia no Turbo (429), aguardando 3.5s para reprocessar (tentativa ${attempt}/2)...`);
        await new Promise(r => setTimeout(r, 3500));
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
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

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

  // 2. Tentativa Primária: Google Imagen 3 (se a chave do Google AI estiver configurada)
  if (effectiveKey) {
    console.log(`  [AI Connector] Disparando Google Imagen 3 (imagen-3.0-generate-002)...`);
    const imagenResult = await generateImageWithImagen3({
      prompt: finalPrompt,
      outputPath,
      apiKey: effectiveKey
    });

    if (imagenResult.success) {
      const sizeKb = (imagenResult.sizeBytes / 1024).toFixed(0);
      console.log(`  [AI Connector] ✓ Sucesso com Google Imagen 3 (${sizeKb} KB em ${imagenResult.latencyMs}ms)`);
      return {
        outputPath,
        provider: imagenResult.provider,
        prompt: finalPrompt,
        sizeKb
      };
    } else {
      console.warn(`  [AI Connector] ⚠️ Google Imagen 3 indisponível: ${imagenResult.error}`);
      console.log(`  [AI Connector] ↳ Acionando fallback automático de alta fidelidade (Flux HD)...`);
    }
  }

  // 3. Fallback Tier 1: Pollinations AI com Modelo Flux (Gratuito, sem chave, alta fidelidade orientada ao estilo)
  const fluxResult = await generateImageWithPollinationsFlux({
    prompt: finalPrompt,
    outputPath,
    seed,
    visualDirective
  });

  if (fluxResult.success) {
    const sizeKb = (fluxResult.sizeBytes / 1024).toFixed(0);
    console.log(`  [AI Connector] ✓ Sucesso com Fallback Flux HD (${sizeKb} KB em ${fluxResult.latencyMs}ms)`);
    return {
      outputPath,
      provider: fluxResult.provider,
      prompt: finalPrompt,
      sizeKb
    };
  }

  // 4. Fallback Tier 2: Pollinations AI Turbo
  console.log(`  [AI Connector] ↳ Tentando Fallback Secundário Turbo...`);
  const turboResult = await generateImageWithPollinationsTurbo({
    prompt: finalPrompt,
    outputPath,
    seed,
    visualDirective
  });

  if (turboResult.success) {
    const sizeKb = (turboResult.sizeBytes / 1024).toFixed(0);
    console.log(`  [AI Connector] ✓ Sucesso com Fallback Turbo (${sizeKb} KB em ${turboResult.latencyMs}ms)`);
    return {
      outputPath,
      provider: turboResult.provider,
      prompt: finalPrompt,
      sizeKb
    };
  }

  // Se todas as IAs remotas oscilarem, retorna null para ativar fallback local
  console.warn(`  [AI Connector] ⚠️ Todas as APIs remotas de imagem oscilaram.`);
  return null;
}
