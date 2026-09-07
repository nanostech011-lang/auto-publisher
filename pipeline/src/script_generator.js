import fs from 'fs';
import path from 'path';
import { analyzeAndAdaptYouTubeVideo, generateThematicScenes } from './youtube_analyzer.js';

/**
 * Banco de roteiros validados e calibrados para nichos canônicos
 */
const VALIDATED_SCRIPTS_CATALOG = [
  {
    id: 'script-01',
    channelId: 'psicosegredo',
    topic: 'Linguagem Corporal & Silêncio',
    title: 'O Truque do Silêncio e a Dopamina da Dúvida #Shorts',
    narrationText: 'Se você desconfia que alguém está mentindo ou escondendo algo de você, nunca confronte a pessoa na hora. Existe um truque da neurociência muito mais poderoso. Quando a pessoa terminar de falar, não diga absolutamente nada. Apenas faça uma pausa e continue mantendo contato visual direto nos olhos dela. O que acontece no cérebro humano nesse momento é fascinante: o cérebro detesta o vácuo de informação. O silêncio prolongado ativa a amígdala cerebral, gerando um pico imediato de ansiedade e insegurança. A pessoa subconscientemente assume que o seu silêncio significa que você já sabe da verdade. Para tentar preencher o vazio e aliviar o desconforto mental, ela começa a falar mais do que deveria e entrega detalhes que pretendia esconder. O silêncio sob controle sempre entrega mais poder do que qualquer argumento verbal. Siga o Psicosegredo para dominar sua mente antes que usem isso contra você.',
    scenes: [
      { id: 1, duration: 5, prompt: 'Cinematic close-up of intense human eyes looking directly into the camera, extreme dark background, dramatic chiaroscuro lighting, subtle cyan and gold edge light, 8k resolution, vertical 9:16', keywords: ['eyes close up', 'dark gaze', 'man thinking'] },
      { id: 2, duration: 15, prompt: 'Dark aesthetic silhouette of two people sitting across a table, tense standoff, shadowy ambient lighting, minimalist modern room, cinematic atmospheric smoke, vertical 9:16', keywords: ['silhouette discussion', 'dark meeting', 'tense conversation'] },
      { id: 3, duration: 18, prompt: 'Glowing 3D human brain on a pure black background, neural pathways firing with rapid electric blue and gold synapses, focal point on deep brain amygdala glowing red, hyper-realistic, vertical 9:16', keywords: ['human brain glowing', 'neural network', 'synapses electric'] },
      { id: 4, duration: 14, prompt: 'Close-up shot of a person mouth and hands fidgeting with nervousness in dim lighting, subtle sweat, shadow covering the face, cinematic tension, vertical 9:16', keywords: ['nervous hands fidgeting', 'anxiety dark', 'stress shadow'] },
      { id: 5, duration: 13, prompt: 'A glowing gold key hovering inside a minimalist dark silhouette of a mind, volumetric light rays, sleek neon blue rim lighting, elegant dark psychology vibe, vertical 9:16', keywords: ['glowing golden key', 'mind silhouette', 'light rays dark'] }
    ]
  },
  {
    id: 'script-02',
    channelId: 'psicosegredo',
    topic: 'Dopamina & Procrastinação',
    title: 'A Mentira da Falta de Motivação #Shorts',
    narrationText: 'Você não é preguiçoso, e a sua falta de ânimo para mudar de vida tem uma explicação biológica exata. A neurociência explica que a dopamina não é o neurotransmissor do prazer, mas sim da antecipação e da motivação para agir. Quando você passa o dia rolando vídeos curtos, seu cérebro recebe descargas rápidas de dopamina sem nenhum esforço real. Quando você tenta sentar para estudar, treinar ou construir um projeto difícil, sua mente interpreta aquilo como sofrimento extremo, simplesmente porque a recompensa demora a chegar. O nome disso não é incapacidade; é dessensibilização dos seus receptores dopaminérgicos. A regra prática para reiniciar esse circuito: a ação precisa vir antes da vontade. A dopamina só é liberada de forma sustentável depois que os primeiros 5 minutos de uma tarefa começam. Pare de esperar a motivação cair do céu. Force o primeiro movimento. Siga o Psicosegredo e aprenda a controlar sua química mental.',
    scenes: [
      { id: 1, duration: 6, prompt: 'Cinematic silhouette of a tired person staring at a glowing phone screen in complete darkness, blue light reflecting on the face, chiaroscuro, vertical 9:16', keywords: ['tired person phone dark', 'screen glow shadow', 'dopamine screen'] },
      { id: 2, duration: 14, prompt: 'Abstract glowing 3D dopamine chemical molecular structure floating in a dark atmospheric void, golden synapses firing, vertical 9:16', keywords: ['dopamine molecule 3D', 'glowing neural network', 'brain chemistry'] },
      { id: 3, duration: 18, prompt: 'A dark hourglass with glowing electric blue sand falling into total darkness, cinematic dramatic lighting, vertical 9:16', keywords: ['hourglass dark sand', 'time passing cinematic', 'clock ticking'] },
      { id: 4, duration: 14, prompt: 'Close-up of a person taking a deep breath and clenching fist in determination, dramatic rim light, dark moody background, vertical 9:16', keywords: ['determination clenched fist', 'man focus shadow', 'discipline'] },
      { id: 5, duration: 14, prompt: 'A solitary confident silhouette walking forward into a tunnel of golden and cyan volumetric light, sleek dark minimalist aesthetic, vertical 9:16', keywords: ['silhouette walking light', 'victory dark aesthetic', 'success path'] }
    ]
  },
  {
    id: 'script-03',
    channelId: 'estoicismo',
    topic: 'Disciplina & Controle Emocional',
    title: 'O Poder de Não Reagir a Nada #Shorts',
    narrationText: 'Marco Aurélio escreveu que você tem poder sobre a sua mente, não sobre os acontecimentos externos. Perceba isso, e você encontrará uma força inabalável. Quando alguém te ofende, te fecha no trânsito ou tenta te desestabilizar, essa pessoa está te entregando um convite para você perder o seu centro. Se você reage com raiva, você acabou de se tornar escravo da opinião e da fraqueza do outro. O silêncio estoico não é covardia; é o domínio supremo da energia. Toda vez que você sentir o impulso da fúria ou da frustração, congele por três segundos. Respire fundo e pergunte a si mesmo: isso estará sob meu controle daqui a cinco anos? Se a resposta for não, deixe ir. Domine sua mente antes que o mundo a controle. Siga a Filosofia Estoica e construa uma armadura psicológica impenetrável.',
    scenes: [
      { id: 1, duration: 5, prompt: 'Dramatic close-up of a Roman marble statue in dark shadow with golden light, vertical 9:16', keywords: ['marcus aurelius statue', 'marble face dark', 'ancient philosopher'] },
      { id: 2, duration: 18, prompt: 'Tense cinematic scene of chaotic shadows and storm lights passing around a still stone figure, vertical 9:16', keywords: ['chaos storm calm', 'rock in storm', 'peace in chaos'] },
      { id: 3, duration: 17, prompt: 'Close-up of human eyes holding a calm and focused gaze in deep shadows, vertical 9:16', keywords: ['calm eyes stoic', 'focus discipline', 'deep breath'] },
      { id: 4, duration: 14, prompt: 'A lone warrior standing steadfast on an ancient cliff during twilight, vertical 9:16', keywords: ['warrior twilight cliff', 'stoic strength', 'inner citadel'] },
      { id: 5, duration: 14, prompt: 'Golden volumetric rays illuminating a marble temple entrance at sunrise, vertical 9:16', keywords: ['temple dawn gold', 'victory sunrise', 'inner peace'] }
    ]
  },
  {
    id: 'script-04',
    channelId: 'financas',
    topic: 'Renda Passiva & Riqueza',
    title: 'O Erro Silencioso que Te Mantém Pobre #Shorts',
    narrationText: 'Se o seu dinheiro fica parado na conta corrente ou na poupança, você está ficando mais pobre todos os dias sem perceber. A inflação silenciosa devora o poder de compra de quem apenas trabalha pelo dinheiro. Os ricos não trabalham pelo dinheiro; eles constroem máquinas de fluxo que colocam o dinheiro para trabalhar por eles vinte e quatro horas por dia. Enquanto você troca horas do seu dia por um salário fixo, quem entende de ativos compra tempo e liberdade. A regra de ouro dos milionários: antes de pagar qualquer conta no início do mês, pague o seu futuro primeiro. Separe pelo menos vinte por cento de tudo o que entra e invista em ativos geradores de renda. Pare de ser passageiro da sua vida financeira. Siga a Mente Milionária e tome o volante do seu patrimônio agora.',
    scenes: [
      { id: 1, duration: 5, prompt: 'Cinematic money hourglass with cash dissolving into dust in dark lighting, vertical 9:16', keywords: ['inflation cash dust', 'money ticking', 'financial trap'] },
      { id: 2, duration: 18, prompt: 'Modern skyscraper skyline glowing with emerald green and cyan financial data lines, vertical 9:16', keywords: ['modern city night data', 'financial charts', 'wealth skyscraper'] },
      { id: 3, duration: 16, prompt: 'Digital golden coins multiplying exponentially in a high-tech dark atmosphere, vertical 9:16', keywords: ['compound interest gold', 'multiplying wealth', 'financial asset'] },
      { id: 4, duration: 15, prompt: 'Close-up of hands signing an executive investment agreement with luxury fountain pen, vertical 9:16', keywords: ['executive agreement hands', 'investment luxury', 'smart money'] },
      { id: 5, duration: 14, prompt: 'A successful person looking at the sunrise over a metropolis from a penthouse terrace, vertical 9:16', keywords: ['penthouse sunrise freedom', 'wealthy freedom', 'lifestyle victory'] }
    ]
  }
];

/**
 * Carrega a configuracao do perfil do canal
 */
export function loadChannelProfile(channelId = 'psicosegredo') {
  const profilePath = path.resolve(`pipeline/config/channels/${channelId}.json`);
  if (fs.existsSync(profilePath)) {
    return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  }

  // Fallback padrão se perfil customizado não existir fisicamente
  return {
    channel_id: channelId,
    name: `@${channelId}`,
    niche: 'Canal Automatizado',
    voice_profile: {
      voice_id: 'pt-BR-AntonioNeural',
      rate: '+2%'
    },
    visual_profile: {
      aesthetic: 'Cinematic Dark Minimalist'
    },
    publishing_profile: {
      default_tags: ['shorts', 'viral', channelId],
      affiliate_cta: {
        description_template: '👉 Acesse o link oficial para saber mais: https://meulink.com',
        first_comment: 'Link oficial fixado no primeiro comentário!'
      }
    }
  };
}

/**
 * Gera ou recupera um roteiro estruturado calibrado (suporta YouTube, Tema ou Catálogo)
 */
export async function generateScript({
  channelId = 'psicosegredo',
  topic,
  scriptIndex = 0,
  sourceUrl = null,
  customProfile = null,
  visualDirective = null
}) {
  const channel = customProfile || loadChannelProfile(channelId);

  // 1. Se foi fornecido um Link do YouTube, aciona o analisador de conteúdo
  if (sourceUrl && (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be'))) {
    return await analyzeAndAdaptYouTubeVideo({ url: sourceUrl, channelProfile: channel, visualDirective });
  }

  // 2. Se for busca por tema livre ou catálogo
  let selectedScript = null;

  if (topic) {
    selectedScript = VALIDATED_SCRIPTS_CATALOG.find(s =>
      s.topic.toLowerCase().includes(topic.toLowerCase()) ||
      s.title.toLowerCase().includes(topic.toLowerCase())
    );
  }

  if (!selectedScript) {
    const matchingChannelScripts = VALIDATED_SCRIPTS_CATALOG.filter(s => s.channelId === channelId);
    if (matchingChannelScripts.length > 0) {
      const idx = Math.abs(scriptIndex) % matchingChannelScripts.length;
      selectedScript = matchingChannelScripts[idx];
    } else {
      const idx = Math.abs(scriptIndex) % VALIDATED_SCRIPTS_CATALOG.length;
      selectedScript = VALIDATED_SCRIPTS_CATALOG[idx];
    }
  }

  // Se o usuário digitou um tema livre personalizado sem correspondência exata no catálogo
  if (topic && (!selectedScript || !selectedScript.topic.toLowerCase().includes(topic.toLowerCase()))) {
    const customTitle = `${topic.slice(0, 50)} #Shorts`;
    const hook = `Se você quer entender ${topic.slice(0, 35)} de verdade, precisa ouvir isso agora.`;
    const body = `A maioria das pessoas falha porque tenta resolver ${topic.toLowerCase()} de forma superficial. Quando olhamos para a estrutura fundamental, percebemos que pequenos ajustes nos hábitos e nas decisões diárias criam um efeito composto extraordinário. Não existe atalho mágico, mas sim consistência com método.`;
    const hack = `Comece hoje aplicando a regra da clareza absoluta: elimine o excesso, foque no essencial e execute sem hesitação.`;
    const cta = `Siga ${channel.name || '@seucanal'} para dominar este assunto todos os dias.`;

    const fullNarration = `${hook} ${body} ${hack} ${cta}`;
    const wordCount = fullNarration.trim().split(/\s+/).length;

    const pubProfile = channel.publishing_profile || {};
    const tags = pubProfile.default_tags || ['shorts', 'desenvolvimento', 'foco'];
    const ctaProfile = pubProfile.affiliate_cta || {};

    return {
      channelId: channel.channel_id || channelId,
      channelName: channel.name || `@${channelId}`,
      scriptId: `custom_${Date.now()}`,
      topic,
      title: customTitle,
      narrationText: fullNarration,
      wordCount,
      estimatedDurationSeconds: Math.round((wordCount / 135) * 60),
      rewardsEligible: true,
      blocks: [
        { title: 'Gancho (0-3s)', text: hook },
        { title: 'Foco Central (3-45s)', text: body },
        { title: 'Hack Prático (45-58s)', text: hack },
        { title: 'CTA & Retenção (58-65s)', text: cta }
      ],
      scenes: generateThematicScenes(topic, body, channel.visual_profile?.aesthetic, visualDirective),
      metadata: {
        title: customTitle,
        description: `${customTitle}\n\n${ctaProfile.description_template || ''}\n\nTags: #${tags.slice(0, 5).join(' #')}`,
        tags: tags.join(', '),
        categoryId: pubProfile.youtube_category_id || 24,
        madeForKids: pubProfile.made_for_kids || false,
        privacy: pubProfile.privacy || 'PUBLIC',
        firstComment: ctaProfile.first_comment || 'Deixe seu comentário e siga o canal!'
      }
    };
  }

  const wordCount = selectedScript.narrationText.trim().split(/\s+/).length;
  const pubProfile = channel.publishing_profile || {};
  const tags = pubProfile.default_tags || ['shorts', 'viral', channelId];
  const cta = pubProfile.affiliate_cta || {};

  const description = `${selectedScript.title}\n\n${cta.description_template || ''}\n\nTags: #${tags.slice(0, 5).join(' #')}`;
  const firstComment = cta.first_comment || 'Siga para mais conteúdos diários.';

  return {
    channelId: channel.channel_id || channelId,
    channelName: channel.name || `@${channelId}`,
    scriptId: selectedScript.id,
    topic: selectedScript.topic,
    title: selectedScript.title,
    narrationText: selectedScript.narrationText,
    wordCount,
    estimatedDurationSeconds: Math.round((wordCount / 135) * 60),
    rewardsEligible: Math.round((wordCount / 135) * 60) >= 60,
    blocks: [
      { title: 'Gancho (0-3s)', text: selectedScript.narrationText.slice(0, 100) },
      { title: 'Foco Central (3-45s)', text: selectedScript.narrationText.slice(100, 350) },
      { title: 'Hack Prático (45-58s)', text: selectedScript.narrationText.slice(350, 500) },
      { title: 'CTA & Retenção (58-65s)', text: selectedScript.narrationText.slice(500) }
    ],
    scenes: selectedScript.scenes,
    metadata: {
      title: selectedScript.title,
      description,
      tags: tags.join(', '),
      categoryId: pubProfile.youtube_category_id || 24,
      madeForKids: pubProfile.made_for_kids || false,
      privacy: pubProfile.privacy || 'PUBLIC',
      firstComment
    }
  };
}
