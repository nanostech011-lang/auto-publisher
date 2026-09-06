import fs from 'fs';
import path from 'path';

/**
 * Banco de roteiros validados e calibrados para o canal piloto @psicosegredo
 */
const VALIDATED_SCRIPTS_CATALOG = [
  {
    id: 'script-01',
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
  }
];

/**
 * Carrega a configuracao do perfil do canal
 */
export function loadChannelProfile(channelId = 'psicosegredo') {
  const profilePath = path.resolve(`pipeline/config/channels/${channelId}.json`);
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Perfil do canal nao encontrado: ${profilePath}`);
  }
  return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
}

/**
 * Gera ou recupera um roteiro estruturado calibrado
 */
export async function generateScript({ channelId = 'psicosegredo', topic, scriptIndex = 0 }) {
  const channel = loadChannelProfile(channelId);

  let selectedScript = null;

  if (topic) {
    selectedScript = VALIDATED_SCRIPTS_CATALOG.find(s =>
      s.topic.toLowerCase().includes(topic.toLowerCase()) ||
      s.title.toLowerCase().includes(topic.toLowerCase())
    );
  }

  if (!selectedScript) {
    const idx = Math.abs(scriptIndex) % VALIDATED_SCRIPTS_CATALOG.length;
    selectedScript = VALIDATED_SCRIPTS_CATALOG[idx];
  }

  const wordCount = selectedScript.narrationText.trim().split(/\s+/).length;

  // Monta metadados enriquecidos com base no perfil do canal
  const pubProfile = channel.publishing_profile || {};
  const tags = pubProfile.default_tags || ['neurociencia', 'psicologia', 'shorts'];
  const cta = pubProfile.affiliate_cta || {};

  const description = `${selectedScript.title}\n\n${cta.description_template || ''}\n\nTags: #${tags.slice(0, 5).join(' #')}`;
  const firstComment = cta.first_comment || 'Siga para mais hacks mentais diários.';

  return {
    channelId: channel.channel_id,
    channelName: channel.name,
    scriptId: selectedScript.id,
    topic: selectedScript.topic,
    title: selectedScript.title,
    narrationText: selectedScript.narrationText,
    wordCount: wordCount,
    estimatedDurationSeconds: Math.round((wordCount / 135) * 60),
    scenes: selectedScript.scenes,
    metadata: {
      title: selectedScript.title,
      description: description,
      tags: tags.join(', '),
      categoryId: pubProfile.youtube_category_id || 28,
      madeForKids: pubProfile.made_for_kids || false,
      privacy: pubProfile.privacy || 'PUBLIC',
      firstComment: firstComment
    }
  };
}
