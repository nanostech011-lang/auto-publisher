import fs from 'fs';
import path from 'path';

// Carregamento nativo de variaveis de ambiente (.env) sem dependencia externa
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

import { analyzeAndAdaptYouTubeVideo, generateThematicScenes } from './youtube_analyzer.js';
import { generateViralScriptWithGemini } from './gemini_script_generator.js';

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
      { id: 1, duration: 5, phrase: 'Se você desconfia que alguém está mentindo ou escondendo algo de você, nunca confronte a pessoa na hora.', prompt: 'Cinematic close-up of intense human eyes looking directly into the camera, extreme dark background, dramatic chiaroscuro lighting, subtle cyan and gold edge light, 8k resolution, vertical 9:16', keywords: ['eyes close up', 'dark gaze', 'man thinking'] },
      { id: 2, duration: 15, phrase: 'Existe um truque da neurociência muito mais poderoso. Quando a pessoa terminar de falar, não diga absolutamente nada. Apenas faça uma pausa e continue mantendo contato visual direto nos olhos dela.', prompt: 'Dark aesthetic silhouette of two people sitting across a table, tense standoff, shadowy ambient lighting, minimalist modern room, cinematic atmospheric smoke, vertical 9:16', keywords: ['silhouette discussion', 'dark meeting', 'tense conversation'] },
      { id: 3, duration: 18, phrase: 'O que acontece no cérebro humano nesse momento é fascinante: o cérebro detesta o vácuo de informação. O silêncio prolongado ativa a amígdala cerebral, gerando um pico imediato de ansiedade e insegurança.', prompt: 'Glowing 3D human brain on a pure black background, neural pathways firing with rapid electric blue and gold synapses, focal point on deep brain amygdala glowing red, hyper-realistic, vertical 9:16', keywords: ['human brain glowing', 'neural network', 'synapses electric'] },
      { id: 4, duration: 14, phrase: 'A pessoa subconscientemente assume que o seu silêncio significa que você já sabe da verdade. Para tentar preencher o vazio e aliviar o desconforto mental, ela começa a falar mais do que deveria e entrega detalhes que pretendia esconder.', prompt: 'Close-up shot of a person mouth and hands fidgeting with nervousness in dim lighting, subtle sweat, shadow covering the face, cinematic tension, vertical 9:16', keywords: ['nervous hands fidgeting', 'anxiety dark', 'stress shadow'] },
      { id: 5, duration: 13, phrase: 'O silêncio sob controle sempre entrega mais poder do que qualquer argumento verbal. Siga o Psicosegredo para dominar sua mente antes que usem isso contra você.', prompt: 'A glowing gold key hovering inside a minimalist dark silhouette of a mind, volumetric light rays, sleek neon blue rim lighting, elegant dark psychology vibe, vertical 9:16', keywords: ['glowing golden key', 'mind silhouette', 'light rays dark'] }
    ]
  },
  {
    id: 'script-02',
    channelId: 'psicosegredo',
    topic: 'Dopamina & Procrastinação',
    title: 'A Mentira da Falta de Motivação #Shorts',
    narrationText: 'Você não é preguiçoso, e a sua falta de ânimo para mudar de vida tem uma explicação biológica exata. A neurociência explica que a dopamina não é o neurotransmissor do prazer, mas sim da antecipação e da motivação para agir. Quando você passa o dia rolando vídeos curtos, seu cérebro recebe descargas rápidas de dopamina sem nenhum esforço real. Quando você tenta sentar para estudar, treinar ou construir um projeto difícil, sua mente interpreta aquilo como sofrimento extremo, simplesmente porque a recompensa demora a chegar. O nome disso não é incapacidade; é dessensibilização dos seus receptores dopaminérgicos. A regra prática para reiniciar esse circuito: a ação precisa vir antes da vontade. A dopamina só é liberada de forma sustentável depois que os primeiros 5 minutos de uma tarefa começam. Pare de esperar a motivação cair do céu. Force o primeiro movimento. Siga o Psicosegredo e aprenda a controlar sua química mental.',
    scenes: [
      { id: 1, duration: 6, phrase: 'Você não é preguiçoso, e a sua falta de ânimo para mudar de vida tem uma explicação biológica exata.', prompt: 'Cinematic silhouette of a tired person staring at a glowing phone screen in complete darkness, blue light reflecting on the face, chiaroscuro, vertical 9:16', keywords: ['tired person phone dark', 'screen glow shadow', 'dopamine screen'] },
      { id: 2, duration: 14, phrase: 'A neurociência explica que a dopamina não é o neurotransmissor do prazer, mas sim da antecipação e da motivação para agir. Quando você passa o dia rolando vídeos curtos, seu cérebro recebe descargas rápidas de dopamina sem nenhum esforço real.', prompt: 'Abstract glowing 3D dopamine chemical molecular structure floating in a dark atmospheric void, golden synapses firing, vertical 9:16', keywords: ['dopamine molecule 3D', 'glowing neural network', 'brain chemistry'] },
      { id: 3, duration: 18, phrase: 'Quando você tenta sentar para estudar, treinar ou construir um projeto difícil, sua mente interpreta aquilo como sofrimento extremo, simplesmente porque a recompensa demora a chegar. O nome disso não é incapacidade; é dessensibilização dos seus receptores dopaminérgicos.', prompt: 'A dark hourglass with glowing electric blue sand falling into total darkness, cinematic dramatic lighting, vertical 9:16', keywords: ['hourglass dark sand', 'time passing cinematic', 'clock ticking'] },
      { id: 4, duration: 14, phrase: 'A regra prática para reiniciar esse circuito: a ação precisa vir antes da vontade. A dopamina só é liberada de forma sustentável depois que os primeiros 5 minutos de uma tarefa começam.', prompt: 'Close-up of a person taking a deep breath and clenching fist in determination, dramatic rim light, dark moody background, vertical 9:16', keywords: ['determination clenched fist', 'man focus shadow', 'discipline'] },
      { id: 5, duration: 14, phrase: 'Pare de esperar a motivação cair do céu. Force o primeiro movimento. Siga o Psicosegredo e aprenda a controlar sua química mental.', prompt: 'A solitary confident silhouette walking forward into a tunnel of golden and cyan volumetric light, sleek dark minimalist aesthetic, vertical 9:16', keywords: ['silhouette walking light', 'victory dark aesthetic', 'success path'] }
    ]
  },
  {
    id: 'script-03',
    channelId: 'estoicismo',
    topic: 'Disciplina & Controle Emocional',
    title: 'O Poder de Não Reagir a Nada #Shorts',
    narrationText: 'Marco Aurélio escreveu que você tem poder sobre a sua mente, não sobre os acontecimentos externos. Perceba isso, e você encontrará uma força inabalável. Quando alguém te ofende, te fecha no trânsito ou tenta te desestabilizar, essa pessoa está te entregando um convite para você perder o seu centro. Se você reage com raiva, você acabou de se tornar escravo da opinião e da fraqueza do outro. O silêncio estoico não é covardia; é o domínio supremo da energia. Toda vez que você sentir o impulso da fúria ou da frustração, congele por três segundos. Respire fundo e pergunte a si mesmo: isso estará sob meu controle daqui a cinco anos? Se a resposta for não, deixe ir. Domine sua mente antes que o mundo a controle. Siga a Filosofia Estoica e construa uma armadura psicológica impenetrável.',
    scenes: [
      { id: 1, duration: 5, phrase: 'Marco Aurélio escreveu que você tem poder sobre a sua mente, não sobre os acontecimentos externos. Perceba isso, e você encontrará uma força inabalável.', prompt: 'Dramatic close-up of a Roman marble statue in dark shadow with golden light, vertical 9:16', keywords: ['marcus aurelius statue', 'marble face dark', 'ancient philosopher'] },
      { id: 2, duration: 18, phrase: 'Quando alguém te ofende, te fecha no trânsito ou tenta te desestabilizar, essa pessoa está te entregando um convite para você perder o seu centro. Se você reage com raiva, você acabou de se tornar escravo da opinião e da fraqueza do outro.', prompt: 'Tense cinematic scene of chaotic shadows and storm lights passing around a still stone figure, vertical 9:16', keywords: ['chaos storm calm', 'rock in storm', 'peace in chaos'] },
      { id: 3, duration: 17, phrase: 'O silêncio estoico não é covardia; é o domínio supremo da energia. Toda vez que você sentir o impulso da fúria ou da frustração, congele por três segundos.', prompt: 'Close-up of human eyes holding a calm and focused gaze in deep shadows, vertical 9:16', keywords: ['calm eyes stoic', 'focus discipline', 'deep breath'] },
      { id: 4, duration: 14, phrase: 'Respire fundo e pergunte a si mesmo: isso estará sob meu controle daqui a cinco anos? Se a resposta for não, deixe ir.', prompt: 'A lone warrior standing steadfast on an ancient cliff during twilight, vertical 9:16', keywords: ['warrior twilight cliff', 'stoic strength', 'inner citadel'] },
      { id: 5, duration: 14, phrase: 'Domine sua mente antes que o mundo a controle. Siga a Filosofia Estoica e construa uma armadura psicológica impenetrável.', prompt: 'Golden volumetric rays illuminating a marble temple entrance at sunrise, vertical 9:16', keywords: ['temple dawn gold', 'victory sunrise', 'inner peace'] }
    ]
  },
  {
    id: 'script-04',
    channelId: 'financas',
    topic: 'Renda Passiva & Riqueza',
    title: 'O Erro Silencioso que Te Mantém Pobre #Shorts',
    narrationText: 'Se o seu dinheiro fica parado na conta corrente ou na poupança, você está ficando mais pobre todos os dias sem perceber. A inflação silenciosa devora o poder de compra de quem apenas trabalha pelo dinheiro. Os ricos não trabalham pelo dinheiro; eles constroem máquinas de fluxo que colocam o dinheiro para trabalhar por eles vinte e quatro horas por dia. Enquanto você troca horas do seu dia por um salário fixo, quem entende de ativos compra tempo e liberdade. A regra de ouro dos milionários: antes de pagar qualquer conta no início do mês, pague o seu futuro primeiro. Separe pelo menos vinte por cento de tudo o que entra e invista em ativos geradores de renda. Pare de ser passageiro da sua vida financeira. Siga a Mente Milionária e tome o volante do seu patrimônio agora.',
    scenes: [
      { id: 1, duration: 5, phrase: 'Se o seu dinheiro fica parado na conta corrente ou na poupança, você está ficando mais pobre todos os dias sem perceber.', prompt: 'Cinematic money hourglass with cash dissolving into dust in dark lighting, vertical 9:16', keywords: ['inflation cash dust', 'money ticking', 'financial trap'] },
      { id: 2, duration: 18, phrase: 'A inflação silenciosa devora o poder de compra de quem apenas trabalha pelo dinheiro. Os ricos não trabalham pelo dinheiro; eles constroem máquinas de fluxo que colocam o dinheiro para trabalhar por eles vinte e quatro horas por dia.', prompt: 'Modern skyscraper skyline glowing with emerald green and cyan financial data lines, vertical 9:16', keywords: ['modern city night data', 'financial charts', 'wealth skyscraper'] },
      { id: 3, duration: 16, phrase: 'Enquanto você troca horas do seu dia por um salário fixo, quem entende de ativos compra tempo e liberdade.', prompt: 'Digital golden coins multiplying exponentially in a high-tech dark atmosphere, vertical 9:16', keywords: ['compound interest gold', 'multiplying wealth', 'financial asset'] },
      { id: 4, duration: 15, phrase: 'A regra de ouro dos milionários: antes de pagar qualquer conta no início do mês, pague o seu futuro primeiro. Separe pelo menos vinte por cento de tudo o que entra e invista em ativos geradores de renda.', prompt: 'Close-up of hands signing an executive investment agreement with luxury fountain pen, vertical 9:16', keywords: ['executive agreement hands', 'investment luxury', 'smart money'] },
      { id: 5, duration: 14, phrase: 'Pare de ser passageiro da sua vida financeira. Siga a Mente Milionária e tome o volante do seu patrimônio agora.', prompt: 'A successful person looking at the sunrise over a metropolis from a penthouse terrace, vertical 9:16', keywords: ['penthouse sunrise freedom', 'wealthy freedom', 'lifestyle victory'] }
    ]
  },
  {
    id: 'script-05',
    channelId: 'psicosegredo',
    topic: 'Ansiedade \u0026 Sistema Nervoso',
    title: 'Seu Cérebro Viciou em Alerta. Veja Como Sair. #Shorts',
    narrationText: 'O que chamamos de ansiedade não é fraqueza. É um sistema de alarme que ficou preso no modo ligado. Toda vez que você percebe uma ameaça, real ou imaginária, o eixo hipotalâmico hipofisário libera cortisol e adrenalina em até cento e oitenta milissegundos. O problema não é o alarme; é que nos humanos modernos o alarme toca para e-mails, notícias e julgamentos sociais com a mesma intensidade que tocava para predadores. Pesquisadores da Universidade de Harvard descobriram que oitenta e cinco por cento das preocupações que antecipamos nunca chegam a acontecer. E dentre as que acontecem, setenta e nove por cento são gerenciáveis. A saída científica mais eficaz é simples: quando sentir o gatilho, faça uma expiração longa de seis segundos. Ativa o nervo vago e desliga o modo de luta ou fuga instantaneamente. Siga o Psicosegredo e reconquiste o controle da sua mente.',
    scenes: [
      { id: 1, duration: 5, phrase: 'O que chamamos de ansiedade não é fraqueza. É um sistema de alarme que ficou preso no modo ligado.', prompt: 'Macro cinematic close-up of stressed anxious human eye with dilated pupil, dramatic chiaroscuro, extreme dark background, documentary photography style, vertical 9:16', keywords: ['anxious eye closeup', 'stress dark', 'fear dilated pupil'] },
      { id: 2, duration: 18, phrase: 'Toda vez que você percebe uma ameaça, real ou imaginária, o eixo hipotalâmico hipofisário libera cortisol e adrenalina em até cento e oitenta milissegundos.', prompt: 'Abstract glowing human brain scan showing amygdala activating in pulsing red-orange, dark neuroscience laboratory environment, documentary photography, vertical 9:16', keywords: ['brain amygdala red alert', 'cortisol neuro scan', 'fight or flight brain'] },
      { id: 3, duration: 17, phrase: 'Pesquisadores descobriram que oitenta e cinco por cento das preocupações que antecipamos nunca chegam a acontecer.', prompt: 'Dark minimalist hourglass with red anxious sand particles dissolving into nothing, cinematic dramatic side lighting, vertical 9:16', keywords: ['anxiety dissolving dark', 'hourglass stress', 'worry fades away'] },
      { id: 4, duration: 14, phrase: 'A saída científica mais eficaz: faça uma expiração longa de seis segundos. Ativa o nervo vago e desliga o modo de luta ou fuga.', prompt: 'Cinematic close-up of a person breathing deeply, calm eyes closed, soft golden light touching serene face, dark background, vertical 9:16', keywords: ['deep breath calm', 'vagus nerve relaxation', 'meditation dark'] },
      { id: 5, duration: 12, phrase: 'Siga o Psicosegredo e reconquiste o controle da sua mente.', prompt: 'Silhouette of a strong person standing calm above stormy clouds, golden sunrays breaking through, dark cinematic aesthetic, vertical 9:16', keywords: ['calm above storm', 'mental strength dark', 'anxiety overcome'] }
    ]
  },
  {
    id: 'script-06',
    channelId: 'psicosegredo',
    topic: 'Manipulação \u0026 Influência',
    title: 'As 3 Frases que Manipuladores Usam Sempre #Shorts',
    narrationText: 'Há padrões verbais que manipuladores repetem independentemente da cultura, da idade ou do contexto. Quando alguém diz você é sensível demais ou está exagerando, estão usando uma técnica chamada gaslighting, que consiste em invalidar a percepção da realidade de outra pessoa para que ela perca a confiança nos próprios instintos. Quando ouvir depois de tudo que fiz por você, cuidado: essa frase ativa a culpa para criar uma dívida emocional impagável. E por fim, eu só estou dizendo isso por seu próprio bem é a cobertura perfeita para críticas que na verdade servem apenas a quem as dispara. Ao identificar esses três padrões, o mecanismo perde todo o poder sobre você. Siga o Psicosegredo e aprenda a reconhecer cada jogada antes que ela chegue até você.',
    scenes: [
      { id: 1, duration: 4, phrase: 'Há padrões verbais que manipuladores repetem independentemente da cultura, da idade ou do contexto.', prompt: 'Cinematic dark silhouette of a hand pulling invisible puppet strings above shadow figures, chiaroscuro dramatic lighting, vertical 9:16', keywords: ['puppet master manipulation', 'shadow control dark', 'influence strings'] },
      { id: 2, duration: 18, phrase: 'Quando alguém diz você é sensível demais, estão usando gaslighting para invalidar sua percepção da realidade.', prompt: 'Dark atmospheric image of a distorted mirror reflecting a warped reality, dramatic chiaroscuro, cinematic moody shadows, vertical 9:16', keywords: ['warped mirror reality', 'gaslighting dark mirror', 'manipulation perception'] },
      { id: 3, duration: 16, phrase: 'Depois de tudo que fiz por você ativa culpa. Eu só estou dizendo por seu bem cobre críticas que servem apenas a quem as dispara.', prompt: 'Close-up of two people in a psychological power dynamic conversation in deep shadow, one figure dominant in the dark, vertical 9:16', keywords: ['power dynamic dark', 'guilt trip shadow', 'manipulation conversation'] },
      { id: 4, duration: 13, phrase: 'Ao identificar esses padrões, o mecanismo perde todo o poder sobre você.', prompt: 'Dark cinematic image of broken chains dissolving into golden light particles, freedom from manipulation, dramatic vertical 9:16', keywords: ['broken chains golden light', 'freedom dark aesthetic', 'liberation manipulation'] },
      { id: 5, duration: 12, phrase: 'Siga o Psicosegredo e aprenda a reconhecer cada jogada antes que ela chegue até você.', prompt: 'Sharp focused eye surrounded by darkness, knowing gaze, intelligent awareness, cinematic documentary photography, vertical 9:16', keywords: ['awareness watchful eye', 'sharp gaze dark', 'psychology knowledge'] }
    ]
  },
  {
    id: 'script-07',
    channelId: 'estoicismo',
    topic: 'Gratidão \u0026 Perspectiva Estoica',
    title: 'A Técnica Romana que Elimina a Comparação #Shorts',
    narrationText: 'Marco Aurélio praticava diariamente uma meditação que os romanos chamavam de Memento Mori: a contemplação da própria mortalidade. Não como fonte de medo, mas de clareza absoluta. Quando você imagina, de forma plena e honetária, que poderia perder tudo o que tem hoje, algo surpreendente acontece na sua neurobiologia: os circuitos de comparação social desativam temporariamente, e os circuitos de gratidão são ativados com intensidade incomum. A ciência moderna confirma que pessoas que praticam a visualização da perda têm quarenta por cento mais satisfação reportada com suas próprias vidas do que quem constantemente almeja o que não tem. O exercício é simples: mentalize que perdeu sua saúde, sua liberdade ou seus entes queridos. Sinta o peso por três segundos. Depois perceba o que ainda permanece. Siga a Filosofia Estoica e construa uma mente que não precisa de mais para sentir-se completa.',
    scenes: [
      { id: 1, duration: 5, phrase: 'Marco Aurélio praticava diariamente uma meditação que os romanos chamavam de Memento Mori: a contemplação da própria mortalidade.', prompt: 'Ancient Roman marble bust of Marcus Aurelius emperor in dramatic dark museum lighting, chiaroscuro, dust particles floating, vertical 9:16', keywords: ['marcus aurelius bust marble', 'ancient roman emperor dark', 'stoic philosopher'] },
      { id: 2, duration: 18, phrase: 'Quando você imagina que poderia perder tudo o que tem hoje, os circuitos de comparação social desativam e os de gratidão são ativados.', prompt: 'Cinematic moody hourglass with golden sand slowly falling, memento mori concept, dark atmospheric background, philosophy aesthetics, vertical 9:16', keywords: ['hourglass gold memento mori', 'mortality time dark', 'stoic meditation'] },
      { id: 3, duration: 18, phrase: 'A ciência confirma que pessoas que praticam a visualização da perda têm quarenta por cento mais satisfação com suas vidas.', prompt: 'Side profile of a person in deep contemplative meditation, dramatic golden side light, dark philosophical atmosphere, cinematic documentary, vertical 9:16', keywords: ['meditation contemplation dark', 'gratitude golden light', 'stoic practice'] },
      { id: 4, duration: 13, phrase: 'Mentalize que perdeu sua saúde, sua liberdade ou seus entes queridos. Sinta o peso por três segundos. Depois perceba o que ainda permanece.', prompt: 'Empty hands open in acceptance and gratitude, dramatic chiaroscuro light beam illuminating from above, dark cinematic background, vertical 9:16', keywords: ['open hands acceptance', 'gratitude dark light', 'stoic acceptance'] },
      { id: 5, duration: 12, phrase: 'Siga a Filosofia Estoica e construa uma mente que não precisa de mais para sentir-se completa.', prompt: 'A lone ancient warrior in meditation posture on a hilltop at twilight, golden horizon, stoic silhouette against dramatic sky, vertical 9:16', keywords: ['stoic warrior meditation', 'twilight silhouette', 'inner peace philosophy'] }
    ]
  },
  {
    id: 'script-08',
    channelId: 'psicosegredo',
    topic: 'Narcisismo \u0026 Relações Tóxicas',
    title: 'Por Que Você Não Consegue Sair de Relações Tóxicas #Shorts',
    narrationText: 'Se você já ficou preso em um relacionamento onde a pessoa alternava entre te tratar como especial e te fazer sentir uma nulidade, não é por fraqueza. É química cerebral pura. Esse padrão tem nome: ciclo de reforço intermitente. É a mesma técnica que os cassinos usam para criar dependentes: você nunca sabe quando vem a recompensa, então o cérebro permanece em alerta constante. A validação intermitente de um narcisista libera mais dopamina do que qualquer relacionamento estável porque o cérebro interpreta a incerteza como recompensa potencial. Quando você finalmente entende o mecanismo, a attração perde o misticismo e ganha o nome certo: condicionamento. O primeiro passo para sair é nomear o que sente. Viciàdo. Não apaixonado. Siga o Psicosegredo e decodifique os padrões que tentam te prender.',
    scenes: [
      { id: 1, duration: 4, phrase: 'Se você já ficou preso em um relacionamento onde a pessoa alternava entre te tratar como especial e te fazer sentir uma nulidade, não é fraqueza.', prompt: 'Two shadows, one dominant over the other, psychological power imbalance, dark chiaroscuro cinematic atmosphere, dramatic side lighting, vertical 9:16', keywords: ['shadow dominance relationship', 'power imbalance dark', 'toxic relationship cinematic'] },
      { id: 2, duration: 18, phrase: 'Esse padrão tem nome: ciclo de reforço intermitente. A mesma técnica que os cassinos usam para criar dependentes.', prompt: 'Dark atmospheric neon casino roulette wheel spinning in cinematic slow motion, dopamine trap concept, vertical 9:16', keywords: ['casino roulette dark neon', 'intermittent reinforcement', 'addiction dopamine loop'] },
      { id: 3, duration: 18, phrase: 'A validação intermitente libera mais dopamina do que qualquer relacionamento estável porque o cérebro interpreta a incerteza como recompensa potencial.', prompt: 'Glowing dopamine reward pathway in human brain, neural circuits illuminated in gold and red, documentary neuroscience visualization, dark background, vertical 9:16', keywords: ['dopamine reward circuit brain', 'neural pathway gold', 'toxic bond neuroscience'] },
      { id: 4, duration: 13, phrase: 'Quando você entende o mecanismo, a atração perde o misticismo e ganha o nome certo: condicionamento.', prompt: 'Person in cinematic realization moment, dramatic shaft of golden light breaking through darkness, liberation concept, vertical 9:16', keywords: ['realization awakening dark', 'truth revelation light', 'pattern recognition'] },
      { id: 5, duration: 11, phrase: 'O primeiro passo é nomear o que sente. Viciado. Não apaixonado. Siga o Psicosegredo.', prompt: 'Broken golden chain falling against dark cinematic background, freedom from conditioning, liberation concept, vertical 9:16', keywords: ['broken chain golden freedom', 'liberation toxic pattern', 'psychology awareness'] }
    ]
  }
];


/**
 * Carrega a configuracao do perfil do canal
 */
export function loadChannelProfile(channelId = 'custom') {
  const profilePath = path.resolve(`pipeline/config/channels/${channelId}.json`);
  if (fs.existsSync(profilePath)) {
    return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  }

  // Fallback padrão se perfil customizado não existir fisicamente
  return {
    channel_id: channelId,
    name: `@${channelId}`,
    niche: 'Geral',
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
 * Gera ou recupera um roteiro estruturado calibrado (suporta YouTube, Tema, Catálogo ou Roteiro Direto do Dashboard)
 */
export async function generateScript({
  channelId = 'custom',
  topic,
  scriptIndex = 0,
  sourceUrl = null,
  customProfile = null,
  visualDirective = null,
  customNarration = null,
  customTitle = null,
  customComment = null,
  geminiKey = null
}) {
  const channel = customProfile || loadChannelProfile(channelId);
  const effectiveGeminiKey = geminiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  // 0. Se foi fornecido roteiro de locução direto do dashboard (customNarration)
  if (customNarration && customNarration.trim().length > 30) {
    const fullNarration = customNarration.trim();
    const words = fullNarration.split(/\s+/);
    const wordCount = words.length;
    const durSec = Math.max(60, Math.round((wordCount / 135) * 60));
    const finalTitle = customTitle || (topic ? `${topic} #Shorts` : `${channel.name || 'Vídeo'} #Shorts`);
    const pubProfile = channel.publishing_profile || {};
    const tags = pubProfile.default_tags || ['shorts', 'viral', channel.channel_id || 'custom'];
    const ctaProfile = pubProfile.affiliate_cta || {};

    const q1 = Math.floor(fullNarration.length * 0.15);
    const q2 = Math.floor(fullNarration.length * 0.65);
    const q3 = Math.floor(fullNarration.length * 0.85);

    const hookText = fullNarration.slice(0, q1);
    const scienceText = fullNarration.slice(q1, q2);
    const hackText = fullNarration.slice(q2, q3);
    const ctaText = fullNarration.slice(q3);

    const scenes = await generateThematicScenes(
      topic || finalTitle,
      fullNarration.slice(0, 200),
      channel.visual_profile?.aesthetic,
      visualDirective,
      fullNarration,
      effectiveGeminiKey
    );

    return {
      channelId: channel.channel_id || channelId,
      channelName: channel.name || `@${channelId}`,
      scriptId: `custom_${Date.now()}`,
      topic: topic || finalTitle,
      title: finalTitle,
      narrationText: fullNarration,
      wordCount,
      estimatedDurationSeconds: durSec,
      rewardsEligible: durSec >= 60,
      blocks: [
        { title: 'Gancho (0-3s)', text: hookText },
        { title: 'Foco Central (3-45s)', text: scienceText },
        { title: 'Hack Prático (45-58s)', text: hackText },
        { title: 'CTA & Retenção (58-65s)', text: ctaText }
      ],
      scenes,
      metadata: {
        title: finalTitle,
        description: `${finalTitle}\n\n${ctaProfile.description_template || ''}\n\nTags: #${tags.slice(0, 5).join(' #')}`,
        tags: tags.join(', '),
        categoryId: pubProfile.youtube_category_id || 24,
        madeForKids: pubProfile.made_for_kids || false,
        privacy: pubProfile.privacy || 'PUBLIC',
        firstComment: customComment || ctaProfile.first_comment || 'Siga para mais conteúdos!'
      }
    };
  }

  // 1. Se foi fornecido um Link do YouTube, aciona o analisador de conteúdo
  if (sourceUrl && (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be'))) {
    return await analyzeAndAdaptYouTubeVideo({ url: sourceUrl, channelProfile: channel, visualDirective, geminiKey: effectiveGeminiKey });
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
    // PRIORIDADE 1: Tentar gerar roteiro viral com Gemini Flash
    if (effectiveGeminiKey) {
      console.log(`[Script Generator] Solicitando roteiro viral ao Gemini Flash para: "${topic}"...`);
      const geminiScript = await generateViralScriptWithGemini({
        topic,
        channelProfile: channel,
        apiKey: effectiveGeminiKey,
        visualDirective
      });

      if (geminiScript && geminiScript.narrationText && geminiScript.narrationText.length > 100) {
        console.log(`[Script Generator] ✅ Roteiro gerado pelo Gemini: ${geminiScript.wordCount} palavras, ${geminiScript.scenes.length} cenas.`);
        return geminiScript;
      }

      console.log('[Script Generator] Gemini não retornou roteiro válido — usando template local.');
    }
    const customTitle = `${topic.slice(0, 50)} #Shorts`;
    const hook = `Se você busca dominar ${topic.slice(0, 35)} com verdadeira maestria, existe um princípio silencioso que poucos têm a coragem de praticar no dia a dia.`;
    const core1 = `A maioria das pessoas falha constantemente porque tenta buscar respostas fáceis e atalhos superficiais. Elas reagem a cada estímulo externo, esquecendo que o verdadeiro domínio nasce da calma interior e do controle rigoroso da própria atenção.`;
    const core2 = `Quando você aprende a silenciar o ruído ao seu redor e constrói seus alicerces passo a passo, cada pequena decisão ganha um peso colossal através do efeito composto. Não é sobre pressa desordenada, é sobre direção clara e disciplina constante.`;
    const hack = `A partir de hoje, aplique a regra de ouro da clareza absoluta: descarte qualquer distração irrelevante, proteja a sua serenidade como seu bem mais precioso e aja com firmeza serena.`;
    const cta = `Deixe seu like se essa reflexão fortaleceu sua mente, inscreva-se no canal para dominar sua jornada e comente abaixo qual o seu maior desafio.`;

    const fullNarration = `${hook} ${core1} ${core2} ${hack} ${cta}`;
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
        { title: 'Foco Central (3-45s)', text: `${core1} ${core2}` },
        { title: 'Hack Prático (45-58s)', text: hack },
        { title: 'CTA & Retenção (58-65s)', text: cta }
      ],
      scenes: await generateThematicScenes(topic, `${core1} ${core2}`, channel.visual_profile?.aesthetic, visualDirective, fullNarration, effectiveGeminiKey),
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

  let narrationText = selectedScript.narrationText;
  if (channel.name && channel.name !== '@psicosegredo') {
    narrationText = narrationText.replace(/Siga o Psicosegredo/gi, `Siga ${channel.name}`);
    narrationText = narrationText.replace(/o Psicosegredo/gi, channel.name);
  }

  const wordCount = narrationText.trim().split(/\s+/).length;
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
    narrationText: narrationText,
    wordCount,
    estimatedDurationSeconds: Math.round((wordCount / 135) * 60),
    rewardsEligible: Math.round((wordCount / 135) * 60) >= 60,
    blocks: [
      { title: 'Gancho (0-3s)', text: narrationText.slice(0, 100) },
      { title: 'Foco Central (3-45s)', text: narrationText.slice(100, 350) },
      { title: 'Hack Prático (45-58s)', text: narrationText.slice(350, 500) },
      { title: 'CTA & Retenção (58-65s)', text: narrationText.slice(500) }
    ],
    scenes: (visualDirective && visualDirective.trim().length > 0) ? await generateThematicScenes(selectedScript.topic, selectedScript.title, channel.visual_profile?.aesthetic, visualDirective, narrationText, effectiveGeminiKey) : selectedScript.scenes,
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
