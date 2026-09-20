/**
 * AutoPublisher Pro — Gerador de Roteiros Virais com Gemini AI
 *
 * Utiliza o Gemini Flash para criar roteiros de alta conversão para vídeos
 * faceless de 60-65 segundos, otimizados para retenção e viralização em
 * YouTube Shorts, TikTok e Instagram Reels.
 *
 * Frameworks de copywriting aplicados:
 * - HOOK: Pattern Interrupt + Afirmação Contraintuitiva (primeiros 3s)
 * - BODY: Mecanismo / Revelação Científica / Storytelling Emocional
 * - HACK: Ação prática aplicável imediatamente
 * - CTA: Urgência + Ancoragem Social + Link de afiliado
 */

import fs from 'fs';

// Carregamento nativo de variáveis de ambiente
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

/**
 * Seleciona aleatoriamente uma das fórmulas de gancho de alta conversão
 * para garantir variedade entre os vídeos do canal.
 */
function selectHookFormula(channelNiche = '') {
  const formulas = [
    {
      id: 'contraintuitivo',
      description: 'Afirmação que contradiz o senso comum + Promessa de revelação',
      example: 'A maioria das pessoas faz exatamente o OPOSTO do que deveria. E você provavelmente é uma delas.'
    },
    {
      id: 'pergunta_perturbadora',
      description: 'Pergunta que gera insegurança imediata + Gancho de curiosidade',
      example: 'E se eu te dissesse que seu cérebro está ativamente sabotando seu sucesso agora mesmo?'
    },
    {
      id: 'segredo_revelado',
      description: 'Promessa de revelar algo que poucos sabem + Urgência',
      example: 'Existe uma técnica usada por psicólogos do FBI que ninguém te ensinou na escola.'
    },
    {
      id: 'pattern_interrupt',
      description: 'Declaração chocante ou provocativa que para o scroll',
      example: 'PARE. Antes de continuar rolando, você precisa ouvir isso por 60 segundos.'
    },
    {
      id: 'confissao',
      description: 'Confissão vulnerável + Virada de perspectiva',
      example: 'Por anos eu acreditei que disciplina era a chave. Eu estava completamente errado.'
    }
  ];

  // Seleciona fórmula baseado no índice do dia para consistência mas variação diária
  const idx = new Date().getDate() % formulas.length;
  return formulas[idx];
}

/**
 * Constrói o prompt de instrução para o Gemini Flash gerar o roteiro viral.
 */
function buildGeminiScriptPrompt(topic, channelProfile, hookFormula) {
  const channel = channelProfile || {};
  const niche = channel.niche || 'Desenvolvimento Pessoal e Psicologia';
  const tone = channel.script_profile?.tone || 'Analítico, misterioso, confiante e direto';
  const targetWords = channel.script_profile?.target_words_max || 160;
  const aesthetic = channel.visual_profile?.aesthetic || 'Dark Minimalist Chiaroscuro';
  const channelName = channel.name || '@canal';
  const cta = channel.publishing_profile?.affiliate_cta?.description_template || '';

  return `Você é um especialista em copywriting viral para vídeos faceless de redes sociais.

Crie um roteiro COMPLETO de locução para um vídeo Short/Reels/TikTok sobre o tema: "${topic}"

CANAL: ${channelName}
NICHO: ${niche}
TOM: ${tone}
ESTÉTICA VISUAL: ${aesthetic}
META DE PALAVRAS: ${targetWords} palavras (para ~65 segundos de locução a 140 WPM)

FÓRMULA DE GANCHO OBRIGATÓRIA: ${hookFormula.id.toUpperCase()}
Descrição: ${hookFormula.description}
Exemplo de referência: "${hookFormula.example}"

ESTRUTURA OBRIGATÓRIA DO ROTEIRO:
1. GANCHO (0-3s | ~15 palavras): Pattern Interrupt com a fórmula "${hookFormula.id}". Deve parar o scroll imediatamente.
2. DESENVOLVIMENTO (3-45s | ~100 palavras): Revela o mecanismo/segredo com linguagem acessível. Use dados científicos, exemplos concretos ou storytelling. Construa tensão crescente.
3. HACK PRÁTICO (45-58s | ~25 palavras): Uma ação específica e imediata que o espectador pode aplicar HOJE. Simples, direta.
4. CTA (58-65s | ~20 palavras): Chamada para seguir + comentar + link no perfil. Use urgência e ancoragem social.

REGRAS DE OURO:
- Escreva APENAS o texto falado (narração). Sem títulos, sem marcadores, sem metadados.
- Use linguagem coloquial mas inteligente — como se fosse um amigo especialista.
- Cada frase deve criar curiosidade pela próxima (open loop).
- Mencione ${channelName} apenas uma vez, no CTA final.
- NÃO use clichês: "incrível", "épico", "simplesmente", "literalmente".
- O texto deve soar natural em locução de voz neural.
- Total: entre 140 e ${targetWords} palavras.

TAMBÉM FORNEÇA, após o roteiro, em formato JSON separado por "---JSON---":
{
  "title": "Título impactante com no máximo 80 caracteres + #Shorts",
  "hook_phrase": "A frase exata do gancho (primeiras 2-3 palavras)",
  "scenes": [
    {
      "id": 1,
      "duration": 5,
      "phrase": "Trecho exato da narração desta cena",
      "prompt": "Visual cinematográfico em inglês para geração de imagem AI, 9:16, ${aesthetic.toLowerCase()}",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

As "scenes" devem ter 5 a 7 entradas, cobrindo do início ao fim do roteiro.
As durações devem somar ~65 segundos.
Os "prompts" das scenes devem ser em inglês cinematográfico e incluir estilo visual ${aesthetic}.`;
}

/**
 * Chama a API do Gemini Flash para geração do roteiro viral.
 */
async function callGeminiFlash(prompt, apiKey, retries = 2) {
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!effectiveKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${effectiveKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.85,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
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

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Gemini Script] Tentativa ${attempt}/${retries} - HTTP ${res.status}: ${errText.slice(0, 200)}`);
        if (res.status === 429 && attempt < retries) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        return null;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.length > 100) return text;

    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[Gemini Script] Tentativa ${attempt}/${retries} - Erro: ${err.message}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 2000));
    }
  }

  return null;
}

/**
 * Extrai e valida o JSON de metadados da resposta do Gemini.
 */
function extractJsonFromResponse(rawText) {
  if (!rawText) return null;

  const jsonSeparator = rawText.indexOf('---JSON---');
  if (jsonSeparator === -1) return null;

  const jsonSection = rawText.slice(jsonSeparator + 10).trim();

  // Remove possíveis blocos de código markdown ```json ... ```
  const cleanJson = jsonSection
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanJson);
    // Validação mínima
    if (!parsed.title || !Array.isArray(parsed.scenes) || parsed.scenes.length < 3) {
      return null;
    }
    return parsed;
  } catch (e) {
    // Tenta extrair JSON com regex como fallback
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Extrai o texto de narração da resposta do Gemini (parte antes do JSON).
 */
function extractNarrationText(rawText) {
  if (!rawText) return null;

  const jsonSeparator = rawText.indexOf('---JSON---');
  const narration = jsonSeparator !== -1
    ? rawText.slice(0, jsonSeparator).trim()
    : rawText.trim();

  // Remove possíveis headers residuais
  const cleaned = narration
    .replace(/^#+\s+.*$/gm, '')        // Remove headers markdown
    .replace(/^\*\*.*\*\*\s*$/gm, '') // Remove linhas bold-only
    .replace(/^\s*[\d]+\.\s*/gm, '')  // Remove listas numeradas residuais
    .replace(/\n{3,}/g, '\n\n')       // Normaliza espaços duplos
    .trim();

  return cleaned.length > 50 ? cleaned : null;
}

/**
 * Gerador principal de roteiros virais com Gemini AI.
 *
 * Retorna um objeto no mesmo formato do catálogo local (compatível com o script_generator.js).
 * Se o Gemini falhar, retorna null para acionar o fallback do catálogo.
 *
 * @param {Object} params
 * @param {string} params.topic           Tema do vídeo
 * @param {Object} params.channelProfile  Perfil do canal (do JSON de configuração)
 * @param {string} [params.apiKey]        Chave Google AI Studio
 * @param {string} [params.visualDirective] Diretriz visual customizada
 * @returns {Promise<Object|null>} Dados do roteiro ou null se falhar
 */
export async function generateViralScriptWithGemini({
  topic,
  channelProfile,
  apiKey = null,
  visualDirective = null
}) {
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  if (!effectiveKey) {
    console.log('[Gemini Script] Chave de API não disponível — usando catálogo local.');
    return null;
  }

  if (!topic || topic.trim().length < 3) {
    return null;
  }

  console.log(`[Gemini Script] Gerando roteiro viral para tema: "${topic}"...`);

  const hookFormula = selectHookFormula(channelProfile?.niche || '');
  console.log(`[Gemini Script] Fórmula de gancho selecionada: ${hookFormula.id.toUpperCase()}`);

  const prompt = buildGeminiScriptPrompt(topic, channelProfile, hookFormula);
  const rawResponse = await callGeminiFlash(prompt, effectiveKey);

  if (!rawResponse) {
    console.warn('[Gemini Script] Gemini não respondeu — usando catálogo local.');
    return null;
  }

  const narrationText = extractNarrationText(rawResponse);
  const metadata = extractJsonFromResponse(rawResponse);

  if (!narrationText || narrationText.length < 100) {
    console.warn('[Gemini Script] Narração extraída muito curta — usando catálogo local.');
    return null;
  }

  // Conta palavras e valida comprimento
  const wordCount = narrationText.trim().split(/\s+/).length;
  console.log(`[Gemini Script] ✅ Roteiro gerado! ${wordCount} palavras, ${metadata?.scenes?.length || 0} cenas.`);

  if (wordCount < 100 || wordCount > 250) {
    console.warn(`[Gemini Script] ⚠️  Contagem de palavras fora do ideal: ${wordCount} (esperado: 140-165)`);
  }

  // Garante scenes válidas mesmo que o JSON parcialmente falhe
  let scenes = metadata?.scenes || [];
  if (scenes.length < 3) {
    // Gera scenes mínimas baseadas no texto da narração
    const sentences = narrationText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const aesthetic = channelProfile?.visual_profile?.aesthetic || 'Cinematic Dark Minimalist Chiaroscuro';
    scenes = sentences.slice(0, 5).map((sentence, idx) => ({
      id: idx + 1,
      duration: idx === 0 ? 5 : (idx === sentences.length - 1 ? 12 : 13),
      phrase: sentence.trim(),
      prompt: `${aesthetic}, dramatic cinematic scene representing "${sentence.trim().slice(0, 60)}", vertical 9:16`,
      keywords: ['cinematic dark', 'atmospheric', 'dramatic lighting']
    }));
  }

  // Aplica diretriz visual customizada às scenes se fornecida
  if (visualDirective && visualDirective.trim().length > 0) {
    scenes = scenes.map(scene => ({
      ...scene,
      prompt: scene.prompt.replace(/(vertical 9:16)/, `${visualDirective}, $1`),
      visualDirective
    }));
  }

  const channel = channelProfile || {};
  const pubProfile = channel.publishing_profile || {};
  const tags = metadata?.tags || pubProfile.default_tags || ['shorts', topic.toLowerCase().slice(0, 20)];
  const ctaProfile = pubProfile.affiliate_cta || {};

  const title = metadata?.title || `${topic.slice(0, 60)} #Shorts`;

  return {
    channelId: channel.channel_id || 'custom',
    channelName: channel.name || '@canal',
    scriptId: `gemini_${Date.now()}`,
    topic: topic,
    title: title.slice(0, 100), // YouTube limita a 100 caracteres
    narrationText,
    wordCount,
    estimatedDurationSeconds: Math.round((wordCount / 140) * 60),
    rewardsEligible: Math.round((wordCount / 140) * 60) >= 60,
    hookFormula: hookFormula.id,
    scenes,
    metadata: {
      title: title.slice(0, 100),
      description: `${title}\n\n${ctaProfile.description_template || ''}\n\nTags: #${tags.slice(0, 5).join(' #')}`,
      tags: tags.join(', '),
      categoryId: pubProfile.youtube_category_id || 24,
      madeForKids: pubProfile.made_for_kids || false,
      privacy: pubProfile.privacy || 'PUBLIC',
      firstComment: ctaProfile.first_comment || 'Siga para mais conteúdos diários.'
    }
  };
}
