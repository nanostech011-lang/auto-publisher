/**
 * AutoPublisher Pro - AI Storyboarder & Shot-List Generator
 * 
 * Orquestrador cinematográfico de tomadas (shots) e diretrizes visuais por take.
 * Converte cada batida (beat/frase) de áudio em uma especificação visual concreta:
 * - visualIntent: Ação física literal a ser retratada (em PT-BR)
 * - framing: Enquadramento de câmera (extreme_close_up, close_up, medium_shot, wide_shot, over_the_shoulder)
 * - cameraMotion: Movimento cinematográfico (push_in, pull_out, pan_left, pan_right, static_focus, orbit)
 * - stockQueries: 2 a 4 termos concretos em inglês para busca no Pexels/Pixabay
 * - aiPrompt: Prompt em 2 camadas (Layer A: Universo/Estilo + Layer B: Ação Física/Sujeito)
 * - cinemagraphFX: Efeito micro-animado de atmosfera (fire_embers, fireflies, twinkling_stars, sunbeams_dust, anime_aura_sparks, none)
 * - subjectType: Tipo de foco (human_action, macro_object, environment_setting, reaction_metaphor)
 */

import fs from 'fs';
import { detectAestheticStyle } from './ai_prompt_generator.js';

// Carregamento de variáveis de ambiente
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

/**
 * Catálogo Semântico com 50+ Arquétipos Físicos Concretos
 * Garante aterramento em objetos tangíveis, ações humanas e cenários reais,
 * eliminando metáforas abstratas repetitivas (como cérebros ou estátuas estáticas).
 */
export const PHYSICAL_ARCHETYPES = [
  // --- 1. Dopamina, Telas, Vício Digital e Distração ---
  {
    id: 'phone_doomscrolling',
    keywords: ['celular', 'feed', 'rolar', 'redes sociais', 'instagram', 'tiktok', 'scroll', 'tela'],
    visualIntent: 'Pessoa deitada na penumbra da madrugada com o rosto iluminado pela luz azul da tela do smartphone rolando o feed infinito',
    framing: 'close_up',
    cameraMotion: 'slow_push_in',
    stockQueries: ['person scrolling phone dark', 'smartphone blue light face', 'tired eyes glowing screen night', 'person bed phone dark'],
    actionSubject: 'tired person lying in dark room with face intensely illuminated by glowing blue smartphone screen light, authentic skin texture',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'phone_notifications',
    keywords: ['notificação', 'notificações', 'mensagens', 'alerta', 'barulho', 'apito', 'aviso'],
    visualIntent: 'Close-up macro em tela de smartphone sobre mesa de madeira vibrando com dezenas de notificações luminosas acumuladas',
    framing: 'extreme_close_up',
    cameraMotion: 'static_focus',
    stockQueries: ['smartphone notification screen close up', 'phone vibrating desk dark', 'mobile screen icons glowing', 'smartphone table notifications'],
    actionSubject: 'extreme macro shot of sleek smartphone on dark rustic desk, glowing with vibrant notification banners and incoming alerts',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },
  {
    id: 'digital_fatigue',
    keywords: ['cansaço', 'cansado', 'exausto', 'olhos', 'sono', 'fadiga', 'dormir', 'madrugada'],
    visualIntent: 'Pessoa esfregando os olhos cansados diante de monitores luminosos em escritório escuro',
    framing: 'medium_shot',
    cameraMotion: 'pull_out',
    stockQueries: ['tired worker rubbing eyes dark office', 'exhausted person night desk', 'fatigue eyes computer screen', 'overworked night shadows'],
    actionSubject: 'exhausted professional in dimly lit room rubbing weary eyes in front of soft glowing computer monitors, authentic skin pores',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'gaming_distraction',
    keywords: ['jogo', 'game', 'videogame', 'distração', 'distrair', 'perder tempo', 'entretenimento'],
    visualIntent: 'Mãos segurando controle de videogame com iluminação refletida nos botões e dedos tensos',
    framing: 'close_up',
    cameraMotion: 'push_in',
    stockQueries: ['gamer hands controller dark room', 'gaming controller neon reflections', 'player hands video game', 'fingers joystick illuminated'],
    actionSubject: 'focused hands gripping dark gaming controller, vibrant reflections of colored screen light bouncing off thumbsticks',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },

  // --- 2. Tempo, Urgência e Procrastinação ---
  {
    id: 'hourglass_flowing',
    keywords: ['tempo', 'ampulheta', 'segundos', 'minutos', 'urgência', 'tarde', 'esgotando', 'passando'],
    visualIntent: 'Ampulheta de vidro clássica com areia escura escorrendo continuamente em contraste de chiaroscuro',
    framing: 'close_up',
    cameraMotion: 'push_in',
    stockQueries: ['hourglass falling sand dark', 'hourglass time passing cinematic', 'sand clock dark background', 'antique hourglass light'],
    actionSubject: 'macro shot of vintage brass hourglass with dark fine sand pouring steadily through narrow glass neck, warm rim lighting',
    cinemagraphFX: 'sunbeams_dust',
    subjectType: 'macro_object'
  },
  {
    id: 'alarm_clock_5am',
    keywords: ['acordar', 'despertador', '5 horas', 'manhã', 'alarme', 'cedo', 'levantar', 'cama'],
    visualIntent: 'Despertador mecânico vintage marcando cinco da manhã na mesa de cabeceira com mão decidida estendendo para desligar',
    framing: 'close_up',
    cameraMotion: 'static_focus',
    stockQueries: ['alarm clock morning dark', 'vintage clock ringing bedside', 'hand turning off alarm', 'early morning clock shadows'],
    actionSubject: 'vintage twin-bell alarm clock ringing on wooden nightstand at dawn, resolute hand reaching out to silence it',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'clock_ticking_shadows',
    keywords: ['relógio', 'ponteiro', 'tic-tac', 'hora', 'espera', 'adiar', 'demora'],
    visualIntent: 'Ponteiros de relógio de parede antigo projetando sombras longas e dramáticas em parede texturizada',
    framing: 'medium_shot',
    cameraMotion: 'pan_right',
    stockQueries: ['clock hands moving shadows', 'wall clock dark dramatic', 'time ticking shadows wall', 'vintage wall clock moody'],
    actionSubject: 'dramatic shadow of classic clock hands sweeping across a textured concrete wall, Caravaggio chiaroscuro',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },
  {
    id: 'desk_procrastination',
    keywords: ['procrastinar', 'procrastinação', 'adiando', 'preguiça', 'bloqueio', 'travado', 'começar'],
    visualIntent: 'Mesa de estudos com xícara de café frio, caderno aberto em branco e caneta largada em silêncio',
    framing: 'over_the_shoulder',
    cameraMotion: 'slow_push_in',
    stockQueries: ['procrastination messy desk night', 'open empty notebook desk shadows', 'person staring blank paper', 'coffee cup desk night'],
    actionSubject: 'solitary desk at night with an open blank notebook, unmoving fountain pen, cold coffee cup, dramatic side lamp shadows',
    cinemagraphFX: 'none',
    subjectType: 'environment_setting'
  },
  {
    id: 'calendar_deadline',
    keywords: ['prazo', 'meta', 'data', 'calendário', 'calendario', 'semana', 'mês', 'ano', 'compromisso'],
    visualIntent: 'Caneta circulando com tinta vermelha uma data crucial em calendário rústico de papel',
    framing: 'extreme_close_up',
    cameraMotion: 'push_in',
    stockQueries: ['circling date calendar red pen', 'calendar deadline close up', 'planner page marked pen', 'marking calendar date'],
    actionSubject: 'macro detail of fountain pen drawing a bold red circle around a specific date on a vintage textured paper calendar',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },

  // --- 3. Foco, Mente, Leitura e Estratégia ---
  {
    id: 'deep_book_reading',
    keywords: ['ler', 'livro', 'leitura', 'páginas', 'conhecimento', 'estudo', 'estudar', 'aprender', 'páginas'],
    visualIntent: 'Pessoa em profundo estado de foco folheando páginas de livro denso iluminado por luminária suave',
    framing: 'close_up',
    cameraMotion: 'pan_left',
    stockQueries: ['person reading heavy book desk', 'flipping book pages library', 'studying book warm light', 'reading book hands close up'],
    actionSubject: 'deliberate hands turning worn parchment pages of an open hardbound book under the warm beam of a library banker lamp',
    cinemagraphFX: 'sunbeams_dust',
    subjectType: 'human_action'
  },
  {
    id: 'chess_strategy',
    keywords: ['estratégia', 'jogada', 'xadrez', 'peça', 'xeque', 'movimento', 'planejamento', 'tática'],
    visualIntent: 'Mão deliberada movendo peça de xadrez de madeira escura em tabuleiro com sombras dramáticas',
    framing: 'close_up',
    cameraMotion: 'push_in',
    stockQueries: ['chess piece move dramatic dark', 'hand moving chess knight shadows', 'chess board dramatic lighting', 'chess game focus'],
    actionSubject: 'focused hand carefully advancing a carved wooden chess knight across a dramatic checkered board in high-contrast chiaroscuro',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'piercing_eye_focus',
    keywords: ['olhos', 'olhar', 'contato visual', 'íris', 'pupila', 'perceber', 'reparar', 'visão'],
    visualIntent: 'Macro extremo da íris humana com reflexo dourado e olhar penetrante de foco inabalável',
    framing: 'extreme_close_up',
    cameraMotion: 'static_focus',
    stockQueries: ['intense human eye macro dark', 'piercing stare iris catchlight', 'focused eye pupil dark', 'extreme close up eye looking'],
    actionSubject: 'extreme macro photograph of a piercing human eye iris with vivid golden catchlight, natural skin pores, resolute gaze',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'deep_breath_calm',
    keywords: ['respiração', 'respirar', 'calma', 'pausa', 'silêncio', 'paz', 'controle', 'autodomínio', 'mente'],
    visualIntent: 'Perfil de pessoa fechando os olhos em respiração profunda e controlada antes de tomar uma grande decisão',
    framing: 'close_up',
    cameraMotion: 'slow_push_in',
    stockQueries: ['person closing eyes deep breath', 'calm person breathing meditation', 'peaceful breath profile shadows', 'mindful breath focus'],
    actionSubject: 'cinematic side profile of a focused individual taking a deep steady breath with closed eyes, soft rim lighting against dark backdrop',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'psychological_standoff',
    keywords: ['confronto', 'duas mentes', 'verdade', 'mentira', 'engano', 'tensão', 'desconfiança', 'duelo'],
    visualIntent: 'Duas silhuetas humanas imponentes frente a frente em corredor sombrio em clima de tensão psicológica silenciosa',
    framing: 'medium_shot',
    cameraMotion: 'static_focus',
    stockQueries: ['two people standoff dark room', 'intense meeting silhouettes shadows', 'psychological confrontation cinematic', 'tense conversation dark'],
    actionSubject: 'two imposing human silhouettes in a quiet psychological standoff across a shadowed room, atmospheric volumetric haze',
    cinemagraphFX: 'none',
    subjectType: 'environment_setting'
  },
  {
    id: 'mirror_self_confrontation',
    keywords: ['espelho', 'você mesmo', 'reflexo', 'olhe para você', 'identidade', 'autoengano', 'quem você é'],
    visualIntent: 'Pessoa encarando fixamente o próprio reflexo no espelho do banheiro com meia-luz e respiração pesada',
    framing: 'close_up',
    cameraMotion: 'push_in',
    stockQueries: ['person looking in mirror dark', 'staring mirror reflection moody', 'man looking at mirror serious', 'mirror reflection shadows'],
    actionSubject: 'intense portrait of a resolute individual looking directly into a misty mirror, half-shadows defining facial contours',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'journal_writing',
    keywords: ['escrever', 'caderno', 'diário', 'anotar', 'caneta', 'papel', 'escreva', 'plano'],
    visualIntent: 'Ponta de caneta-tinteiro traçando pensamentos com tinta preta brilhante sobre papel texturizado',
    framing: 'extreme_close_up',
    cameraMotion: 'pan_left',
    stockQueries: ['fountain pen writing notebook', 'hand writing dark desk ink', 'pen writing on paper close up', 'journaling night lamp'],
    actionSubject: 'macro close-up of a vintage fountain pen nib gliding across textured cream paper, fresh wet black ink catching light',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },
  {
    id: 'neural_synapse_model',
    keywords: ['amígdala', 'córtex', 'neurônios', 'química', 'dopamina', 'neurociência', 'sinapses', 'cérebro'],
    visualIntent: 'Modelo anatômico estilizado de rede neural com filamentos de fibra óptica iluminados em âmbar e ciano sobre mesa escura de laboratório',
    framing: 'close_up',
    cameraMotion: 'orbit',
    stockQueries: ['neural network glowing fibers dark', 'brain synapse model illuminated', 'synapses glowing amber laboratory', 'neural connections dark'],
    actionSubject: 'macro photograph of illuminated physical model of human neural pathways on dark mahogany, subtle cyan and golden glow',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },
  {
    id: 'cold_water_reset',
    keywords: ['choque', 'água fria', 'banho frio', 'acordar', 'reiniciar', 'reset', 'despertar'],
    visualIntent: 'Gotas de água gelada escorrendo pelo rosto de uma pessoa após lavar o rosto na pia com iluminação de recorte',
    framing: 'close_up',
    cameraMotion: 'static_focus',
    stockQueries: ['splashing cold water face dark', 'water drops face close up', 'man washing face night', 'water droplets skin rim light'],
    actionSubject: 'close-up of focused human face with water droplets glistening on skin in sharp side rim lighting, piercing determined gaze',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },

  // --- 4. Ação Física, Disciplina e Hábitos ---
  {
    id: 'running_dawn',
    keywords: ['correr', 'corrida', 'madrugada', 'treino', 'movimento', 'começar', 'sair'],
    visualIntent: 'Silhueta de corredor solitário em estrada vazia de asfalto ao nascer do sol entre névoa matinal',
    framing: 'wide_shot',
    cameraMotion: 'pan_right',
    stockQueries: ['solitary runner empty road dawn', 'runner silhouette sunrise fog', 'athlete running morning road', 'jogging sunrise mist'],
    actionSubject: 'wide cinematic shot of a solitary athlete running along an empty asphalt road at misty dawn, golden horizon backlight',
    cinemagraphFX: 'sunbeams_dust',
    subjectType: 'human_action'
  },
  {
    id: 'tying_running_shoes',
    keywords: ['tênis', 'amarrar', 'preparação', 'calçar', 'primeiro passo', '5 minutos', 'ação imediata', 'hack'],
    visualIntent: 'Mãos firmes amarrando com força os cadarços de tênis de corrida sobre calçada de concreto',
    framing: 'close_up',
    cameraMotion: 'static_focus',
    stockQueries: ['tying running shoes concrete', 'hands tying shoe laces sport', 'athlete tying sneakers dawn', 'tying shoelaces ground'],
    actionSubject: 'macro focus on strong hands tying laces of running shoes on textured pavement, ready for immediate action',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'boxing_heavy_bag',
    keywords: ['soco', 'luta', 'boxe', 'bater', 'impacto', 'força', 'energia', 'suor', 'esforço'],
    visualIntent: 'Atleta com luvas de boxe desferindo golpe firme em saco de pancadas com poeira e partículas iluminadas no ar',
    framing: 'medium_shot',
    cameraMotion: 'push_in',
    stockQueries: ['boxer hitting heavy bag gym', 'boxing glove striking bag dark', 'athlete workout boxing shadows', 'heavy bag punch sweat'],
    actionSubject: 'boxer striking heavy leather punching bag in a shadowed warehouse gym, chalk and sweat particles flying in side spotlight',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'pouring_black_coffee',
    keywords: ['café', 'cafeína', 'xícara', 'energia', 'rotina', 'manhã', 'despertar'],
    visualIntent: 'Café preto quente sendo despejado em caneca rústica escura com fumaça subindo na luz suave da manhã',
    framing: 'close_up',
    cameraMotion: 'push_in',
    stockQueries: ['pouring black coffee mug steam', 'hot coffee dark cup steam', 'coffee pouring morning kitchen', 'espresso pouring dark'],
    actionSubject: 'macro close-up of steaming rich black coffee pouring into a dark ceramic mug, delicate steam rising in morning rim light',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },
  {
    id: 'throwing_distractions_trash',
    keywords: ['lixo', 'eliminar', 'jogar fora', 'cortar', 'livrar', 'limpar', 'descartar', 'remover'],
    visualIntent: 'Mãos jogando distrações e junk food na lixeira com gesto firme e resoluto de corte definitivo',
    framing: 'medium_shot',
    cameraMotion: 'tilt_down',
    stockQueries: ['throwing trash waste bin dark', 'clearing clutter hands desk', 'discarding items trash bin', 'hands throwing away clutter'],
    actionSubject: 'deliberate hands tossing clutter and distractions into a waste bin, reclaiming order in dramatic directional lighting',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'chalk_hands_workout',
    keywords: ['peso', 'academia', 'barra', 'ferro', 'musculação', 'repetição', 'treino'],
    visualIntent: 'Atleta batendo as palmas das mãos cheias de magnésio branco criando nuvem de pó no ar antes de levantar a barra',
    framing: 'medium_shot',
    cameraMotion: 'push_in',
    stockQueries: ['chalk hands clapping gym dust', 'weightlifter chalk hands dark', 'athlete clapping hands chalk', 'gym barbell chalk cloud'],
    actionSubject: 'athletic hands clapping white chalk in a dark industrial gym, dramatic cloud of dust particles suspended in side spotlight',
    cinemagraphFX: 'sunbeams_dust',
    subjectType: 'human_action'
  },
  {
    id: 'climbing_stairs',
    keywords: ['escada', 'degrau', 'subir', 'evoluir', 'passo a passo', 'progresso', 'altura'],
    visualIntent: 'Pés subindo degraus de pedra imponentes com determinação em ângulo baixo',
    framing: 'low_angle',
    cameraMotion: 'tilt_up',
    stockQueries: ['feet climbing stone stairs', 'walking up stairs low angle', 'person climbing granite steps', 'walking upstairs dark'],
    actionSubject: 'low-angle shot of boots climbing worn granite steps with unhesitating purpose, shadows stretching across stone risers',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'heavy_door_opening',
    keywords: ['porta', 'abrir', 'chave', 'novo', 'oportunidade', 'liberdade', 'sair'],
    visualIntent: 'Mão empurrando pesada porta de madeira maciça abrindo fresta de luz dourada intensa no escuro',
    framing: 'medium_shot',
    cameraMotion: 'push_in',
    stockQueries: ['opening heavy wooden door light', 'door opening bright light beams', 'hand pushing door sunlight', 'dark room door opening'],
    actionSubject: 'weathered hands pushing open a heavy rustic oak door, blinding shaft of golden sunlight flooding into the shadowed room',
    cinemagraphFX: 'sunbeams_dust',
    subjectType: 'environment_setting'
  },
  {
    id: 'mountain_summit_sunrise',
    keywords: ['topo', 'montanha', 'cume', 'conquista', 'vitória', 'horizonte', 'vencer', 'triunfo', 'sucesso'],
    visualIntent: 'Silhueta de pessoa no topo de penhasco rochoso contemplando o mar de nuvens douradas no nascer do sol',
    framing: 'wide_shot',
    cameraMotion: 'pull_out',
    stockQueries: ['person mountain peak sunrise clouds', 'summit cliff silhouette triumph', 'standing mountain top golden dawn', 'horizon victory sunrise'],
    actionSubject: 'majestic panoramic wide shot of a resolute silhouette standing on a rugged mountain peak overlooking endless sea of clouds at sunrise',
    cinemagraphFX: 'sunbeams_dust',
    subjectType: 'environment_setting'
  },
  {
    id: 'striking_match_spark',
    keywords: ['fogo', 'faísca', 'fósforo', 'acender', 'chama', 'começo', 'ignição', 'início'],
    visualIntent: 'Fósforo de madeira sendo riscado na lixa gerando explosão de faíscas douradas e labareda inicial no escuro',
    framing: 'extreme_close_up',
    cameraMotion: 'static_focus',
    stockQueries: ['striking match fire sparks dark', 'match ignition slow motion', 'match flame lighting dark', 'macro striking match sparks'],
    actionSubject: 'extreme macro of a wooden match head igniting against striker, explosive burst of amber sparks and clean golden flame in pitch black',
    cinemagraphFX: 'fire_embers',
    subjectType: 'macro_object'
  },

  // --- 5. Filosofia Estoica, Resiliência e Autodomínio ---
  {
    id: 'marcus_aurelius_bust',
    keywords: ['marco aurélio', 'marcus aurelius', 'sêneca', 'epicteto', 'filosofia', 'filósofo', 'mármore', 'busto'],
    visualIntent: 'Busto clássico esculpido em mármore antigo com iluminação de museu e partículas sutis de poeira dourada flutuando',
    framing: 'medium_shot',
    cameraMotion: 'orbit',
    stockQueries: ['marcus aurelius marble bust museum', 'ancient roman sculpture shadows', 'classical marble statue chiaroscuro', 'stoic philosopher statue'],
    actionSubject: 'museum photograph of classical carved marble bust of Marcus Aurelius in deep serene contemplation, Caravaggio chiaroscuro',
    cinemagraphFX: 'sunbeams_dust',
    subjectType: 'macro_object'
  },
  {
    id: 'tree_storm_resilience',
    keywords: ['tempestade', 'vento', 'firme', 'inabalável', 'resistir', 'suportar', 'força'],
    visualIntent: 'Carvalho centenário resistindo firme a vendaval e chuva intensa sem quebrar seus galhos fortes',
    framing: 'wide_shot',
    cameraMotion: 'static_focus',
    stockQueries: ['tree resisting storm heavy wind', 'ancient oak storm dark sky', 'tree in tempest rain dark', 'resilient tree stormy weather'],
    actionSubject: 'wide cinematic shot of an ancient solitary oak tree standing firm against a violent tempest, heavy wind and dark rain clouds',
    cinemagraphFX: 'none',
    subjectType: 'environment_setting'
  },
  {
    id: 'ocean_rock_waves',
    keywords: ['rocha', 'mar', 'onda', 'ondas', 'inabalavel', 'imutável', 'costa', 'pedra'],
    visualIntent: 'Ondas escuras e revoltas colidindo com força contra rocha de granito sólida que permanece imóvel',
    framing: 'medium_shot',
    cameraMotion: 'push_in',
    stockQueries: ['ocean waves crashing dark rock', 'waves breaking against cliff', 'sea storm rocks cinematic', 'water splashing dark cliff'],
    actionSubject: 'dramatic shot of foaming dark ocean waves violently crashing against an immovable black basalt cliff rock, ocean spray in air',
    cinemagraphFX: 'none',
    subjectType: 'environment_setting'
  },
  {
    id: 'compass_and_map',
    keywords: ['bússola', 'mapa', 'direção', 'norte', 'caminho', 'escolha', 'rumo', 'orientação'],
    visualIntent: 'Bússola de latão dourado sobre mapa náutico envelhecido iluminada pela luz de uma vela',
    framing: 'close_up',
    cameraMotion: 'push_in',
    stockQueries: ['vintage brass compass old map', 'nautical compass candlelight dark', 'compass on parchment shadows', 'antique navigational compass'],
    actionSubject: 'antique brass magnetic compass resting on aged parchment map, needle settling north under the warm glow of candlelight',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },
  {
    id: 'candle_in_wind',
    keywords: ['vela', 'chama', 'vento', 'apagar', 'luz no escuro', 'esperança', 'clareza'],
    visualIntent: 'Chama de vela única tremulando com o vento em quarto escuro, mas mantendo-se acesa',
    framing: 'close_up',
    cameraMotion: 'static_focus',
    stockQueries: ['candle flame flickering wind dark', 'solitary candle flame burning', 'candle light shadows dark room', 'single candle flame cinematic'],
    actionSubject: 'macro photograph of a solitary wax candle flame dancing against a slight draft in pitch darkness, warm amber glow on wooden table',
    cinemagraphFX: 'fire_embers',
    subjectType: 'macro_object'
  },
  {
    id: 'stone_labyrinth',
    keywords: ['labirinto', 'caminho difícil', 'saída', 'confusão', 'busca', 'perdido', 'jornada'],
    visualIntent: 'Vista em ângulo plongée de labirinto antigo de pedra com caminhos sombreados e saída iluminada',
    framing: 'high_angle',
    cameraMotion: 'push_in',
    stockQueries: ['stone labyrinth maze aerial dark', 'ancient maze paths stone', 'labyrinth overhead cinematic', 'stone maze puzzle misty'],
    actionSubject: 'high-angle atmospheric view of an ancient weathered stone labyrinth at twilight, misty paths leading toward central sanctuary',
    cinemagraphFX: 'none',
    subjectType: 'environment_setting'
  },
  {
    id: 'starry_night_sky',
    keywords: ['estrelas', 'céu estrelado', 'universo', 'infinito', 'perspectiva', 'noite', 'imensidão'],
    visualIntent: 'Céu noturno límpido e profundo repleto de estrelas brilhantes e via láctea sobre silhueta de cordilheira',
    framing: 'wide_shot',
    cameraMotion: 'pan_right',
    stockQueries: ['milky way night sky stars mountain', 'clear starry sky night cinematic', 'constellations twinkling dark sky', 'night sky horizon stars'],
    actionSubject: 'breathtaking documentary wide view of the crystal clear night sky ablaze with the Milky Way and twinkling stars above dark mountain ridge',
    cinemagraphFX: 'twinkling_stars',
    subjectType: 'environment_setting'
  },

  // --- 6. Finanças, Riqueza e Negócios ---
  {
    id: 'counting_cash',
    keywords: ['dinheiro', 'notas', 'contar', 'capital', 'lucro', 'grana', 'pagamento', 'ganhos'],
    visualIntent: 'Mãos firmes contando maço de cédulas de dinheiro sobre mesa rústica de mogno escuro',
    framing: 'close_up',
    cameraMotion: 'static_focus',
    stockQueries: ['counting paper money hands desk', 'hands counting banknotes dark', 'counting cash mahogany table', 'banknotes fingers close up'],
    actionSubject: 'deliberate hands methodically counting crisp banknotes over a dark polished wooden table, textured paper details',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'credit_card_wallet',
    keywords: ['carteira', 'cartão', 'compras', 'gastar', 'dívida', 'economia', 'poupar', 'investir'],
    visualIntent: 'Mão guardando cartão de crédito em carteira de couro desgastada com fecho firme',
    framing: 'close_up',
    cameraMotion: 'push_in',
    stockQueries: ['credit card leather wallet dark', 'hand putting card in wallet', 'leather wallet credit card desk', 'wallet close up hands'],
    actionSubject: 'macro shot of hands sliding a dark metal credit card into a handcrafted brown leather wallet, tangible leather stitching',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'financial_skyscrapers',
    keywords: ['cidade', 'prédios', 'arranha-céu', 'escritório', 'mercado', 'negócios', 'empresas', 'corporativo'],
    visualIntent: 'Arranha-céus espelhados do centro financeiro ao anoitecer com luzes acendendo e tráfego luminoso embaixo',
    framing: 'wide_shot',
    cameraMotion: 'tilt_up',
    stockQueries: ['financial district skyscrapers dusk', 'modern glass towers night city', 'corporate skyscrapers lights sunset', 'city financial district evening'],
    actionSubject: 'soaring glass skyscrapers of a modern financial center at blue hour, glowing office windows reflecting sunset clouds',
    cinemagraphFX: 'none',
    subjectType: 'environment_setting'
  },
  {
    id: 'stock_market_candlesticks',
    keywords: ['ações', 'gráfico', 'mercado financeiro', 'bolsa', 'alta', 'queda', 'investimento', 'números'],
    visualIntent: 'Monitores escuros exibindo gráficos de velas financeiras verdes e vermelhas com reflexo nos óculos de analista',
    framing: 'close_up',
    cameraMotion: 'slow_push_in',
    stockQueries: ['stock market charts screen dark', 'financial candlestick graph monitors', 'trading chart glowing screen night', 'stock trading dark room'],
    actionSubject: 'close-up of glowing multi-screen workstation displaying financial candlestick charts, emerald and crimson data lines in dark room',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },
  {
    id: 'gold_bullion_bars',
    keywords: ['ouro', 'barra de ouro', 'riqueza', 'patrimônio', 'milhões', 'reserva', 'valor'],
    visualIntent: 'Barras empilhadas de ouro puro reluzindo sob iluminação dourada e reflexos elegantes',
    framing: 'close_up',
    cameraMotion: 'pan_left',
    stockQueries: ['gold bullion bars stacked dark', 'pure gold ingots glowing light', 'gold bars vault reflection', 'gold wealth financial luxury'],
    actionSubject: 'macro photograph of stacked polished 999 pure gold bullion bars with sharp warm specular highlights on obsidian stone',
    cinemagraphFX: 'none',
    subjectType: 'macro_object'
  },

  // --- 7. Histórico, Guerreiros e Mitologia ---
  {
    id: 'persian_golden_immortals',
    keywords: ['persa', 'persas', 'guerreiro', 'guerreiros', 'imortais', 'armadura dourada', 'império persa', 'xerxes'],
    visualIntent: 'Guerreiro de elite persa em armadura de escamas douradas ornamentadas e elmo de bronze em Persepolis',
    framing: 'medium_shot',
    cameraMotion: 'push_in',
    stockQueries: ['persian warrior golden armor', 'ancient warrior gold bronze battle', 'persian soldier ancient armor', 'historical warrior golden shield'],
    actionSubject: 'elite ancient Persian Immortal warrior in ornate gilded scale armor, embossed bronze shield, warm desert rim lighting',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  },
  {
    id: 'samurai_katana_blade',
    keywords: ['samurai', 'katana', 'espada', 'lâmina', 'honra', 'japão', 'mestre'],
    visualIntent: 'Samurai veterano sacando katana de aço damasco polido com faísca de luz refletida no fio da espada',
    framing: 'close_up',
    cameraMotion: 'pan_right',
    stockQueries: ['samurai drawing katana sword', 'japanese katana blade reflection', 'samurai armor warrior dark', 'forged katana steel shadows'],
    actionSubject: 'disciplined samurai warrior drawing forged Damascus steel katana, razor-sharp edge gleaming in moonlight, autumn leaves drifting',
    cinemagraphFX: 'none',
    subjectType: 'human_action'
  }
];

/**
 * Monta o Perfil de Universo / Estilo Global (Camada A)
 */
export function buildLayerAWorldProfile(channelProfile = {}, visualDirective = '') {
  const aesthetic = channelProfile.visual_profile?.aesthetic || 'Cinematic Dark Minimalist';
  const lighting = channelProfile.visual_profile?.lighting || 'Dramatic chiaroscuro with subtle cyan and gold edge light';
  const directive = (visualDirective || '').trim();
  const detectedStyle = detectAestheticStyle(directive, aesthetic);

  if (detectedStyle === 'GHIBLI_COZY_FANTASY') {
    return {
      styleName: 'GHIBLI_COZY_FANTASY',
      universe: 'Nostalgic Cozy Medieval Fantasy in Studio Ghibli & Moebius Style',
      lighting: 'warm dappled golden sunlight (komorebi) or soft tranquil twilight',
      cameraLens: '2D hand-drawn animation cel, gouache and watercolor textures, clean ink outlines',
      atmosphere: 'gentle breeze, floating pollen motes or fireflies, peaceful living cinemagraph mood',
      cleanRules: 'vertical 9:16 framing, no text, no watermark, no captions, no split screen, no blur'
    };
  }

  if (detectedStyle === 'ANIME_SHONEN') {
    return {
      styleName: 'ANIME_SHONEN',
      universe: 'High-End Dark Shonen Anime Key Visual (Ufotable / MAPPA style)',
      lighting: 'volumetric anime chiaroscuro with glowing energy aura highlights',
      cameraLens: 'dynamic cel-shading, sharp manga ink lines, vivid color grading, 8k anime wallpaper',
      atmosphere: 'floating battle embers, electrical sparks, intense spiritual pressure',
      cleanRules: 'vertical 9:16 framing, no text, no watermark, no captions, no split screen, no blur'
    };
  }

  if (detectedStyle === 'STOIC_STATUE') {
    return {
      styleName: 'STOIC_STATUE',
      universe: 'Ancient Roman Classical Stoicism & Philosophical Chiaroscuro',
      lighting: 'dramatic Caravaggio chiaroscuro, deep obsidian shadows with sharp golden rim light',
      cameraLens: 'shot on 35mm film, Kodak Portra 400, 85mm prime lens, authentic marble and bronze textures',
      atmosphere: 'subtle museum dust motes suspended in light shafts, timeless silence',
      cleanRules: 'vertical 9:16 framing, cinema color grading, no text, no watermark, no captions, no split screen'
    };
  }

  if (detectedStyle === 'CYBERPUNK') {
    return {
      styleName: 'CYBERPUNK',
      universe: 'Gritty Futuristic Cyberpunk Metropolis',
      lighting: 'vibrant neon rim lighting in cyan, electric blue and magenta against wet asphalt',
      cameraLens: '35mm anamorphic prime lens, Kodak Vision3 film grain, cinematic reflections',
      atmosphere: 'atmospheric rain fog, rising street steam, neon reflections in puddles',
      cleanRules: 'vertical 9:16 framing, cinema color grading, no text, no watermark, no captions, no split screen'
    };
  }

  // Padrão: Realismo Documental 35mm (Dark Psychology / Comportamento)
  return {
    styleName: 'REALISTIC_DOCUMENTARY',
    universe: 'Authentic 35mm Documentary Cinematography & Psychological Realism',
    lighting: lighting || 'dramatic chiaroscuro lighting, deep natural shadows, subtle warm and cyan edge light',
    cameraLens: 'shot on 35mm film, Kodak Portra 400, 50mm and 85mm prime lenses, shallow depth of field, natural skin pores and realistic tactile textures',
    atmosphere: 'atmospheric volumetric haze, floating dust motes or subtle smoke, cinematic pulse',
    cleanRules: 'vertical 9:16 framing, cinema color grading, no text, no watermark, no captions, no split screen, no blur, no CGI, no 3D render'
  };
}

/**
 * Constrói o Prompt Completo em 2 Camadas (Layer A: Universo + Layer B: Ação)
 */
export function buildTwoLayerPrompt({ layerA, layerB }) {
  const parts = [
    layerB.actionSubject,
    `${layerB.framing.replace(/_/g, ' ')} composition`,
    layerA.lighting,
    layerA.cameraLens,
    layerA.atmosphere,
    layerA.cleanRules
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Seleciona o melhor arquétipo físico para a frase falada a partir do catálogo heurístico
 */
export function matchPhysicalArchetype(phrase = '', visualDirective = '', takeIndex = 0, usedArchetypeIds = new Set()) {
  const p = (phrase || '').toLowerCase();
  const dir = (visualDirective || '').toLowerCase();

  // 1. Prioridade máxima para diretriz customizada explícita (ex: Guerreiros Persas)
  if (/persa|persian/i.test(dir)) {
    const persian = PHYSICAL_ARCHETYPES.find(a => a.id === 'persian_golden_immortals');
    if (persian) return persian;
  }
  if (/samurai|katana/i.test(dir)) {
    const samurai = PHYSICAL_ARCHETYPES.find(a => a.id === 'samurai_katana_blade');
    if (samurai) return samurai;
  }

  // 2. Pontua os arquétipos por correspondência de palavras-chave na frase
  let bestMatch = null;
  let highestScore = 0;

  for (const arch of PHYSICAL_ARCHETYPES) {
    let score = 0;
    for (const kw of arch.keywords) {
      const regex = new RegExp(`\\b${kw}`, 'i');
      if (regex.test(p)) {
        score += kw.length > 5 ? 3 : 2;
      }
    }

    // Penaliza ligeiramente se já tiver sido usado recentemente para forçar variedade
    if (usedArchetypeIds.has(arch.id)) {
      score -= 2.5;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = arch;
    }
  }

  if (bestMatch && highestScore > 1) {
    return bestMatch;
  }

  // 3. Fallback inteligente rotativo por takeIndex (evita repetições cíclicas)
  const available = PHYSICAL_ARCHETYPES.filter(a => !usedArchetypeIds.has(a.id));
  const pool = available.length > 0 ? available : PHYSICAL_ARCHETYPES;
  return pool[takeIndex % pool.length];
}

/**
 * Varia enquadramento e ângulo dinamicamente por sub-take
 */
export function getSubTakeFramingVariation(subTakeIndex = 0, baseFraming = 'medium_shot') {
  if (subTakeIndex === 0) {
    return baseFraming || 'medium_shot';
  } else if (subTakeIndex === 1) {
    return baseFraming === 'close_up' ? 'extreme_close_up' : 'close_up';
  } else if (subTakeIndex === 2) {
    return baseFraming === 'extreme_close_up' ? 'medium_shot' : 'extreme_close_up';
  }
  return 'over_the_shoulder';
}

/**
 * Motor Heurístico Resiliente de Storyboard (Offline / Fallback Local)
 */
export function generateStoryboardHeuristic({
  takes = [],
  channelProfile = {},
  visualDirective = '',
  topic = ''
}) {
  const layerA = buildLayerAWorldProfile(channelProfile, visualDirective);
  const usedArchetypeIds = new Set();
  const storyboardTakes = [];

  let lastSubjectType = null;
  let lastFraming = null;

  for (let i = 0; i < takes.length; i++) {
    const take = takes[i];
    const phrase = take.phrase || take.spokenPhrase || '';
    const subIdx = take.subTakeIndex || 0;

    // Seleciona arquétipo físico
    const archetype = matchPhysicalArchetype(phrase, visualDirective, i, usedArchetypeIds);
    usedArchetypeIds.add(archetype.id);

    // Varia enquadramento para sub-takes
    let framing = archetype.framing;
    if (take.isSubTake || subIdx > 0) {
      framing = getSubTakeFramingVariation(subIdx, lastFraming || archetype.framing);
    } else if (framing === lastFraming) {
      framing = framing === 'medium_shot' ? 'close_up' : 'medium_shot';
    }
    lastFraming = framing;

    // Variação de câmera
    const cameraMotion = take.motionType || archetype.cameraMotion;

    // Layer B local
    const layerB = {
      actionSubject: archetype.actionSubject,
      framing: framing,
      visualIntent: archetype.visualIntent
    };

    // Monta o prompt de 2 camadas
    const aiPrompt = buildTwoLayerPrompt({ layerA, layerB });

    storyboardTakes.push({
      ...take,
      takeIndex: i,
      visualIntent: archetype.visualIntent,
      framing: framing,
      cameraMotion: cameraMotion,
      stockQueries: archetype.stockQueries,
      aiPrompt: aiPrompt,
      cinemagraphFX: archetype.cinemagraphFX || 'none',
      subjectType: archetype.subjectType,
      archetypeId: archetype.id
    });

    lastSubjectType = archetype.subjectType;
  }

  return storyboardTakes;
}

/**
 * Consulta a API do Gemini Flash em LOTE para gerar o Shot-List de todos os takes em uma única chamada rápida
 */
export async function generateStoryboardBatchGemini({
  takes = [],
  channelProfile = {},
  visualDirective = '',
  apiKey = null,
  topic = ''
}) {
  if (!apiKey || takes.length === 0) return null;

  const modelName = 'gemini-flash-lite-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const layerA = buildLayerAWorldProfile(channelProfile, visualDirective);

  const simplifiedTakes = takes.map((t, idx) => ({
    takeIndex: idx,
    id: t.id || `${idx + 1}`,
    duration: t.duration,
    phrase: t.phrase || t.spokenPhrase || '',
    isSubTake: !!t.isSubTake,
    subTakeIndex: t.subTakeIndex || 0
  }));

  const systemInstruction = `You are a world-class Director of Photography and Lead Storyboard Artist for high-retention vertical videos (Shorts/Reels/TikTok).
Your mission is to generate a comprehensive shot-list for all takes of a video about: "${topic}".
Visual Style Profile:
- Universe: ${layerA.universe}
- Lighting: ${layerA.lighting}
- Lens & Camera: ${layerA.cameraLens}

CRITICAL RULES:
1. STRICT ZERO REPETITION: Every single take MUST show a completely distinct physical object, human action, or environment. Never use the same visual subject twice in the same video!
2. NO ABSTRACT JARGON: Ground every take in real, physical, tangible reality (e.g. hands counting money, phone in dark room, tying running shoes, reading book under lamp, looking into bathroom mirror, hourglass sand, alarm clock).
3. VARIATION IN FRAMING: Alternate camera framing (medium_shot, close_up, extreme_close_up, over_the_shoulder, wide_shot).
4. STOCK QUERIES: For each take, provide 3 to 4 concrete, realistic English search queries suitable for Pexels/Pixabay video/photo search.
5. AI PROMPT: Provide an English 2-layer image prompt combining the channel aesthetic with the specific physical action of that take.
6. NO TEXT / WATERMARKS: Never include text, subtitles, logos, or split screens.
7. OUTPUT FORMAT: Respond ONLY with a valid JSON array of objects conforming to the schema, with NO markdown formatting, NO markdown backticks, and NO conversational text.`;

  const userPrompt = `Generate the dynamic storyboard shot-list for these ${takes.length} takes:\n${JSON.stringify(simplifiedTakes, null, 2)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length >= takes.length) {
          return takes.map((t, idx) => {
            const p = parsed[idx] || {};
            return {
              ...t,
              takeIndex: idx,
              visualIntent: p.visualIntent || t.phrase || '',
              framing: p.framing || 'medium_shot',
              cameraMotion: p.cameraMotion || t.motionType || 'push_in',
              stockQueries: Array.isArray(p.stockQueries) && p.stockQueries.length > 0 ? p.stockQueries : ['cinematic dark moody vertical'],
              aiPrompt: p.aiPrompt || `${p.visualIntent || t.phrase}, 35mm film, vertical 9:16, no text`,
              cinemagraphFX: p.cinemagraphFX || 'none',
              subjectType: p.subjectType || 'human_action'
            };
          });
        }
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[AI Storyboarder] Gemini Flash indisponível (${err.message}). Acionando motor semântico heurístico de 50 arquétipos...`);
  }

  return null;
}

/**
 * Orquestrador Central de Storyboard: Executa a geração de diretrizes visuais para todos os takes
 */
export async function generateDynamicStoryboard({
  takes = [],
  channelProfile = {},
  visualDirective = '',
  geminiKey = null,
  topic = ''
}) {
  if (!Array.isArray(takes) || takes.length === 0) return [];

  const effectiveKey = geminiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  // 1. Tenta enriquecimento neural batch com Gemini Flash
  if (effectiveKey) {
    try {
      const neuralShots = await generateStoryboardBatchGemini({
        takes,
        channelProfile,
        visualDirective,
        apiKey: effectiveKey,
        topic
      });

      if (neuralShots && neuralShots.length === takes.length) {
        console.log(`[AI Storyboarder] ✅ Shot-List neural gerado com sucesso pelo Gemini Flash (${neuralShots.length} takes orquestrados)!`);
        return neuralShots;
      }
    } catch (e) {
      console.warn(`[AI Storyboarder] Falha na orquestração neural: ${e.message}`);
    }
  }

  // 2. Motor Heurístico Resiliente (50 arquétipos concretos com alternância anti-repetição)
  console.log(`[AI Storyboarder] ⚙️  Orquestrando Shot-List via Motor Semântico Heurístico (${PHYSICAL_ARCHETYPES.length} arquétipos físicos)...`);
  const heuristicShots = generateStoryboardHeuristic({
    takes,
    channelProfile,
    visualDirective,
    topic
  });

  console.log(`[AI Storyboarder] ✅ ${heuristicShots.length} takes enriquecidos com enquadramentos, queries de estoque e prompts 2-camadas.`);
  return heuristicShots;
}
