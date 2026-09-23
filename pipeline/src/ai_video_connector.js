/**
 * AutoPublisher Pro - AI Video Generation Connector
 * 
 * Conector de alta performance para geração de vídeos e pequenos clipes cinematográficos 9:16.
 * Integração oficial com Google Veo 2 (DeepMind / Vertex AI / Google AI Studio)
 * com fallback inteligente em cascata (Vídeo Generativo -> Imagem Ultra HD 1080x1920 + Motion Engine).
 */

import fs from 'fs';
import path from 'path';

// Carregamento nativo de variáveis de ambiente (.env)
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

let isVeoDisabledForSession = false;

/**
 * Conector oficial para Google Veo 2/3.1
 * Gera clipes de vídeo dinâmicos 9:16 de 5 segundos com física consistente e cinematografia avançada.
 * Suporta Text-to-Video e Image-to-Video (adicionando movimento a uma imagem gerada pela Imagen 3).
 *
 * @param {Object} params
 * @param {string} params.prompt Prompt descritivo da cena
 * @param {string} [params.inputImagePath] Imagem base para animação Image-to-Video
 * @param {number} [params.durationSeconds=5] Duração do clipe em segundos (padrão 5s)
 * @param {string} [params.aspectRatio='9:16'] Formato vertical para Shorts/Reels/TikTok
 * @param {string} params.outputPath Caminho de saída para o arquivo .mp4
 * @param {string} [params.apiKey] Chave de API Google (Gemini/Vertex AI)
 * @returns {Promise<{ success: boolean, provider?: string, outputPath?: string, latencyMs?: number, error?: string }>}
 */
export async function generateVideoWithVeo({
  prompt,
  inputImagePath = null,
  durationSeconds = 5,
  aspectRatio = '9:16',
  outputPath,
  apiKey = null
}) {
  if (isVeoDisabledForSession) {
    return { success: false, error: 'Google Veo indisponível para esta sessão (cota excedida ou acesso prévio restrito)' };
  }

  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: 'GEMINI_API_KEY não configurada para o Google Veo' };
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Endpoint do Google Veo via Vertex AI / Google AI Studio Long-Running Operations
  const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning?key=${effectiveKey}`;

  const instance = { prompt };

  // Se houver uma imagem de entrada, envia para animação Image-to-Video
  if (inputImagePath && fs.existsSync(inputImagePath)) {
    try {
      const imgBuffer = fs.readFileSync(inputImagePath);
      instance.image = {
        bytesBase64Encoded: imgBuffer.toString('base64')
      };
    } catch (e) {
      console.warn('[Google Veo] Falha ao ler imagem para image-to-video, prosseguindo com text-to-video:', e.message);
    }
  }

  // Google Veo 3.1 / 2.0 aceita estritamente 4, 6 ou 8 segundos para durationSeconds
  const rawSec = Math.round(durationSeconds || 5);
  const veoDuration = rawSec <= 4 ? 4 : (rawSec <= 6 ? 6 : 8);

  const payload = {
    instances: [instance],
    parameters: {
      aspectRatio: aspectRatio,
      durationSeconds: veoDuration,
      sampleCount: 1
    }
  };

  const startTime = Date.now();
  console.log(`[Google Veo 2] Disparando requisição de geração de vídeo 9:16 (${payload.parameters.durationSeconds}s)...`);

  try {
    const initRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': effectiveKey
      },
      body: JSON.stringify(payload)
    });

    if (!initRes.ok) {
      if (initRes.status === 429 || initRes.status === 404 || initRes.status === 400) {
        isVeoDisabledForSession = true;
      }
      let errDetail = `HTTP ${initRes.status} ${initRes.statusText}`;
      try {
        const errJson = await initRes.json();
        if (errJson.error?.message) errDetail = `${errDetail}: ${errJson.error.message}`;
      } catch (ignored) {}
      return { success: false, error: `Google Veo indisponível: ${errDetail}` };
    }

    const initData = await initRes.json();
    const operationName = initData.name;

    // Se o resultado foi síncrono imediato (raro para vídeo, mas suportado pela especificação)
    const directBytes = initData.response?.generatedVideos?.[0]?.video?.bytesBase64Encoded ||
                        initData.predictions?.[0]?.bytesBase64Encoded;
    if (directBytes) {
      const videoBuffer = Buffer.from(directBytes, 'base64');
      fs.writeFileSync(outputPath, videoBuffer);
      return {
        success: true,
        provider: 'Google Veo 2 (veo-2.0-generate-001)',
        outputPath,
        latencyMs: Date.now() - startTime
      };
    }

    if (!operationName) {
      return { success: false, error: 'Google Veo não retornou operationName para monitoramento' };
    }

    // Polling da Operação de Longa Duração (Long-Running Operation)
    console.log(`[Google Veo 2] Vídeo em renderização no cluster do Google (op: ${operationName.slice(-16)})...`);
    const maxWaitMs = 75000; // Limite de 75s para não travar o fluxo
    const pollIntervalMs = 4000;
    const pollStart = Date.now();

    while (Date.now() - pollStart < maxWaitMs) {
      await new Promise(r => setTimeout(r, pollIntervalMs));

      const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${effectiveKey}`;
      const pollRes = await fetch(pollUrl, {
        headers: { 'x-goog-api-key': effectiveKey }
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();

      if (pollData.done) {
        if (pollData.error) {
          return { success: false, error: `Falha na renderização do Veo: ${pollData.error.message}` };
        }

        const videoBytes = pollData.response?.generatedVideos?.[0]?.video?.bytesBase64Encoded ||
                           pollData.response?.predictions?.[0]?.bytesBase64Encoded;

        if (videoBytes) {
          const videoBuffer = Buffer.from(videoBytes, 'base64');
          fs.writeFileSync(outputPath, videoBuffer);
          return {
            success: true,
            provider: 'Google Veo 2 (veo-2.0-generate-001)',
            outputPath,
            latencyMs: Date.now() - startTime
          };
        }

        // Se retornou uma URI de download do vídeo
        const videoUri = pollData.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUri) {
          const dlRes = await fetch(videoUri);
          if (dlRes.ok) {
            const dlBuffer = Buffer.from(await dlRes.arrayBuffer());
            fs.writeFileSync(outputPath, dlBuffer);
            return {
              success: true,
              provider: 'Google Veo 2 (veo-2.0-generate-001)',
              outputPath,
              latencyMs: Date.now() - startTime
            };
          }
        }

        return { success: false, error: 'Operação do Veo concluída sem dados binários de vídeo' };
      }
    }

    return { success: false, error: 'Timeout de espera na renderização do Google Veo (> 75s)' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}



/**
 * Orquestrador central de geração de takes cinematográficos de vídeo.
 * Decide inteligentemente entre vídeo gerado por IA (Google Veo 2 / Video AI)
 * ou Imagens Full HD 1080x1920 com Motion Engine dependendo do modo visual selecionado:
 * 
 * - 'hybrid' (Recomendado): Prioriza clipe de vídeo IA no Gancho inicial (Cena 1)
 *   e cenas de alto impacto, garantindo retenção imediata com tempo ágil de build.
 * - 'video': Tenta gerar vídeo IA para todos os takes da produção.
 * - 'image': Gera imagens Full HD com movimento cinematográfico de câmera.
 *
 * @param {Object} params
 * @param {string} params.prompt Prompt descritivo da cena
 * @param {string} [params.inputImagePath] Imagem de referência (se já gerada)
 * @param {number} params.durationSeconds Duração do take
 * @param {string} params.outputPath Caminho para o .mp4 resultante
 * @param {string} [params.visualMode='hybrid'] 'hybrid' | 'video' | 'image'
 * @param {boolean} [params.isHookScene=false] Indica se é o gancho inicial
 * @param {string} [params.apiKey] Chave da API Google
 * @returns {Promise<{ success: boolean, isRealVideo: boolean, provider: string, outputPath: string }>}
 */
export async function generateCinematicTake({
  prompt,
  inputImagePath = null,
  durationSeconds,
  outputPath,
  visualMode = 'hybrid',
  isHookScene = false,
  apiKey = null
}) {
  const shouldAttemptVideo = (visualMode === 'video') || (visualMode === 'hybrid' && isHookScene);

  if (shouldAttemptVideo) {
    // 1. Tentativa Principal: Google Veo 2 (DeepMind)
    const veoResult = await generateVideoWithVeo({
      prompt,
      inputImagePath,
      durationSeconds,
      aspectRatio: '9:16',
      outputPath,
      apiKey
    });

    if (veoResult.success && fs.existsSync(outputPath)) {
      return {
        success: true,
        isRealVideo: true,
        provider: veoResult.provider,
        outputPath
      };
    }

    if (veoResult.error) {
      console.log(`  [AI Video] Google Veo indisponível: ${veoResult.error}`);
    }

  }

  // Se não foi possível gerar vídeo IA direto, sinaliza para usar imagem HD + Motion Engine
  return {
    success: false,
    isRealVideo: false,
    provider: 'Motion Engine Ken Burns HD (60fps)'
  };
}
