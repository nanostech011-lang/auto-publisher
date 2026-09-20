import fs from 'fs';

// Carregamento nativo de variaveis de ambiente (.env) sem dependencia externa
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch (ignored) {}

/**
 * Dicionário semântico e ontologia visual para tradução e enriquecimento
 * de termos em português para cinematografia profissional em inglês.
 */
const VISUAL_SEMANTIC_DICTIONARY = [
  // Arquétipos históricos e temas visuais
  { regex: /guerreiros?\s+persas?/gi, en: 'ancient Persian Immortal warriors in ornate gold-embossed armor, Achaemenid royal guards' },
  { regex: /persas?/gi, en: 'ancient Persian historical setting, gilded bronze motifs, Persepolis architecture' },
  { regex: /guerreir[oa]s?/gi, en: 'elite armored warrior with resolute expression' },
  { regex: /armaduras?\s+douradas?/gi, en: 'ornate gilded scale armor, polished gold and bronze reflections' },
  { regex: /armaduras?/gi, en: 'battle-worn tactical armor with intricate metallic engravings' },
  { regex: /escudos?/gi, en: 'heavy embossed bronze shield with intricate relief patterns' },
  { regex: /espadas?/gi, en: 'forged Damascus steel curved blade reflecting rim light' },
  { regex: /ouro\s+e\s+bronze/gi, en: 'burnished gold and oxidized bronze accents' },
  { regex: /estoicismo|est[oó]ic[oa]s?/gi, en: 'stoic philosopher classical marble statue, Marcus Aurelius serenity amid chaos' },
  { regex: /est[aá]tuas?\s+(de\s+)?m[aá]rmore/gi, en: 'carved classical marble bust with subtle chisel textures in museum chiaroscuro lighting' },
  { regex: /romanos?/gi, en: 'ancient Roman legionary commander in crimson mantle and brass cuirass' },
  { regex: /batalha|combate/gi, en: 'dramatic ancient battlefield, swirling dust, sparks and atmospheric smoke' },
  { regex: /cidadela|fortaleza/gi, en: 'ancient stone citadel high upon a cliff in misty dawn' },

  // Neurociência, mente e psicologia
  { regex: /am[ií]gdala(\s+cerebral)?/gi, en: 'macro photograph of anatomical human brain amygdala center with subtle crimson luminescence' },
  { regex: /c[eé]rebro(\s+humano)?/gi, en: 'photograph of an illuminated anatomical human brain model in dark laboratory, subtle glowing amber and cyan synapses, documentary style, 35mm film' },
  { regex: /sinapses?|neur[oô]nios?/gi, en: 'macro photograph of glowing fiber-optic neural network model, electric cyan and gold axons' },
  { regex: /dopamina/gi, en: 'illuminated physical molecular model of dopamine with subtle warm glow on dark laboratory table' },
  { regex: /mente|consci[eê]ncia/gi, en: 'documentary photograph of thoughtful mature human in deep concentration, dramatic side lighting, natural skin pores' },
  { regex: /pensamentos?|reflex[aã]o/gi, en: 'deep intellectual concentration, heavy shadows, focused introspection' },
  { regex: /sil[eê]ncio(\s+absoluto)?/gi, en: 'tense psychological standoff in absolute silence, two imposing figures across a shadowy room' },
  { regex: /olhar|olhos|contato\s+visual/gi, en: 'macro photograph of intense focused human eye iris with vivid amber catchlight, natural skin pores, piercing gaze, 35mm film' },
  { regex: /mentira|falsidade|engano/gi, en: 'subtle psychological micro-expression in half-shadows, unveiling hidden deceit' },
  { regex: /ansiedade|inseguran[cç]a/gi, en: 'visceral psychological tension, dramatic shadows enclosing figure, cinematic pulse' },
  { regex: /foco|disciplina/gi, en: 'unyielding warrior focus, stoic calm breath before action, side rim light' },

  // Finanças, negócios e tecnologia
  { regex: /dinheiro|riqueza|milion[aá]ri[oa]s?/gi, en: 'macro photograph of weathered mature hands holding gold coins and banknotes on dark rustic mahogany desk' },
  { regex: /arranha-c[eé]us?|cidade/gi, en: 'soaring skyscraper skyline at blue hour with glowing emerald and cyan financial data lines' },
  { regex: /cyberpunk|tecnologia|futurista/gi, en: 'futuristic cyberpunk aesthetic, rain-slicked dark streets, neon reflections in cyan and magenta' },
  { regex: /holograma/gi, en: 'translucent 3D holographic data interface hovering in dimly lit room' },

  // Anime, mangá, shonen e estética motivacional épica
  { regex: /anime\s+dark|dark\s+anime/gi, en: 'dark shonen anime key visual, dramatic anime art' },
  { regex: /shonen|shounen/gi, en: 'epic shonen anime battle aesthetic, intense aura' },
  { regex: /ufotable|mappa|wit\s+studio/gi, en: 'Ufotable studio visual style, breathtaking volumetric anime lighting, glowing particle effects' },
  { regex: /mang[aá]|tra[cç]o\s+mang[aá]/gi, en: 'high-contrast manga ink linework, dynamic anime illustration' },
  { regex: /aura\s+(dourada|brilhante|de\s+energia)/gi, en: 'radiant golden energy aura crackling with luminous sparks' },
  { regex: /superando\s+limites|supera[cç][aã]o/gi, en: 'warrior pushing beyond mortal limits, intense determination, explosive power burst' },
  { regex: /guerreiro\s+anime/gi, en: 'fierce anime warrior with intense glowing eyes, spiky hair, battle scars' },
  { regex: /samurai|katana/gi, en: 'legendary master samurai with hand on forged katana hilt, wind-whipped cloak, cherry blossom petals drifting' },

  // Atmosfera e iluminação
  { regex: /chiaroscuro\s+dram[aá]tico|chiaroscuro/gi, en: 'dramatic Caravaggio chiaroscuro lighting, deep obsidian shadows with sharp golden rim light' },
  { regex: /alta\s+resolu[cç][aã]o\s+8k|fotorrealista/gi, en: 'documentary photography, 35mm film photograph, authentic texture, Kodak Portra 400' }
];

/**
 * Traduz e otimiza uma diretriz visual em português para inglês cinematográfico.
 */
export function translateDirectiveToCinematicEnglish(directive) {
  if (!directive || typeof directive !== 'string') return '';

  let cleaned = directive.replace(/^(quero\s+gerar\s+imagens\s+de\s+|gerar\s+imagens\s+de\s+|imagens\s+de\s+)/i, '').trim();
  let translated = cleaned;

  for (const entry of VISUAL_SEMANTIC_DICTIONARY) {
    translated = translated.replace(entry.regex, entry.en);
  }

  // Tradução e limpeza de conectivos e preposições residuais
  translated = translated
    .replace(/\bcom\b/gi, 'with')
    .replace(/\be\b/gi, 'and')
    .replace(/\bem\b/gi, 'in')
    .replace(/\bde\b/gi, 'of')
    .replace(/\bna\b|\bno\b/gi, 'in the')
    .replace(/\bda\b|\bdo\b/gi, 'of the')
    .replace(/\bdas\b|\bdos\b/gi, 'of the')
    .replace(/\s+/g, ' ')
    .trim();

  // Se nenhum termo específico foi traduzido, usa um fallback cinematográfico com o texto
  if (translated === cleaned && !/^[a-zA-Z0-9\s,.-]+$/.test(cleaned)) {
    translated = `cinematic thematic subject representing "${cleaned}", atmospheric chiaroscuro`;
  }

  return translated;
}

/**
 * Gera um prompt profissional em inglês aprimorado por IA (Gemini API) se a chave estiver configurada,
 * ou recorre ao motor semântico heurístico de fotografia cinematográfica.
 */
export async function buildProfessionalScenePrompt({
  spokenPhrase = '',
  visualDirective = '',
  channelAesthetic = 'Cinematic Dark Minimalist',
  blockType = 'body', // 'hook', 'body', 'hack', 'cta'
  motionType = 'push_in',
  apiKey = null,
  forceHeuristic = false,
  sceneIndex = 0,
  totalScenes = 8
}) {
  const effectiveKey = forceHeuristic ? null : (apiKey !== null && apiKey !== undefined ? (apiKey || null) : (process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY));

  // 1. Tenta enriquecimento neural ultrarrápido com Gemini Flash se a chave estiver ativa
  if (effectiveKey) {
    try {
      const neuralPrompt = await queryGeminiPromptExpansion({
        spokenPhrase,
        visualDirective,
        channelAesthetic,
        blockType,
        apiKey: effectiveKey,
        sceneIndex,
        totalScenes
      });

      if (neuralPrompt && neuralPrompt.length > 30) {
        return neuralPrompt;
      }
    } catch (err) {
      // Fallback silencioso para o motor semântico heurístico
    }
  }

  // 2. Motor Heurístico de Alta Fidelidade (Engenharia de Prompt 9:16)
  return buildHeuristicCinematicPrompt({
    spokenPhrase,
    visualDirective,
    channelAesthetic,
    blockType,
    motionType,
    sceneIndex,
    totalScenes
  });
}

/**
 * Detecta o estilo estético predominante a partir da diretriz visual e da estética do canal.
 */
export function detectAestheticStyle(visualDirective = '', channelAesthetic = '') {
  const combined = `${visualDirective || ''} ${channelAesthetic || ''}`.toLowerCase();

  if (/ghibli|moebius|lofi|lo-fi|cozy\s*fantasy|fantasia\s*medieval|medieval\s*relaxante|floresta\s*encantada|gouache|aquarela|quiet\s*forest|vortalania/i.test(combined)) {
    return 'GHIBLI_COZY_FANTASY';
  }
  if (/anime|manga|mangá|shonen|shounen|ufotable|mappa|wit\s*studio|otaku|samurai\s*anime|berserk|dragon\s*ball|naruto|vegeta|tanjiro/i.test(combined)) {
    return 'ANIME_SHONEN';
  }
  if (/cyberpunk|futurist|sci-fi|neon|néon|hologram/i.test(combined)) {
    return 'CYBERPUNK';
  }
  if (/estoic|est[aá]tua|m[aá]rmore|marcus\s+aurelius|roma\s+antiga|grega|escultura/i.test(combined)) {
    return 'STOIC_STATUE';
  }
  if (/dark\s+fantasy|gothic|elden|souls/i.test(combined)) {
    return 'DARK_FANTASY';
  }
  return 'REALISTIC_PHOTO';
}

/**
 * Deriva um sujeito visual cinematográfico contextual a partir da frase falada na narração,
 * respeitando com máxima fidelidade o estilo estético escolhido pelo usuário.
 * Garante ZERO REPETIÇÃO entre cenas ao variar sistematicamente sujeitos, ângulos e composições por índice de cena.
 */
export function deriveVisualSubjectFromPhrase(phrase, visualDirective = null, styleOverride = null, sceneIndex = 0, totalScenes = 8) {
  const style = styleOverride || detectAestheticStyle(visualDirective);
  const p = (phrase || '').toLowerCase();
  const idx = Math.max(0, Number(sceneIndex) || 0);

  // 0. Estilo GHIBLI_COZY_FANTASY (Studio Ghibli, Moebius, Fantasia Medieval Relaxante, Quiet Forest)
  if (style === 'GHIBLI_COZY_FANTASY') {
    const ghibliScenes = [
      // 0: Descanso na árvore antiga com flores
      'medieval wandering knight wearing steel crusader helm and azure blue cloak, resting peacefully leaning against a giant moss-covered ancient oak tree in a vibrant emerald forest, yellow wildflowers in soft grass',
      // 1: Fogueira aconchegante ao crepúsculo com brasas e faíscas
      'cozy evening fantasy campfire crackling in a peaceful forest clearing, warm dancing flames with glowing orange sparks and embers floating into the dusk air, knight shield resting beside a mossy log',
      // 2: Riacho cristalino, ponte rústica e partículas de luz solar (komorebi)
      'solitary wandering knight standing beside a serene cascading forest stream and rustic mossy stone bridge, warm golden sunbeams (komorebi) illuminating soft water ripples and floating golden pollen motes',
      // 3: Estudo do mapa antigo em ruínas de pedra
      'peaceful knight seated inside ancient moss-covered stone temple ruins, intently studying an old glowing fantasy parchment map, warm afternoon sunlight illuminating carved stone archway',
      // 4: Clareira mágica com vagalumes flutuantes no anoitecer
      'magical twilight scene in an enchanted ancient woods, bioluminescent yellow-green fireflies floating softly over a tranquil glassy forest pool, giant willow tree in background',
      // 5: Close-up das manoplas com caneca rústica fumegante
      'macro close-up on knight polished steel gauntlets cradling a rustic carved wooden mug of steaming tea by the fire, gentle warm steam curls rising into cozy evening air',
      // 6: Noite estrelada com constelações cintilantes
      'wandering knight looking up at a breathtaking deep blue night sky filled with brilliant twinkling stars and glowing crescent moon over a silhouetted pine tree ridge',
      // 7: Caminhada por prado florido com pássaros brancos
      'knight walking peacefully through an expansive flowering meadow filled with blooming yellow and lavender wildflowers, gentle summer breeze rustling blue cape, white birds soaring toward fluffy clouds',
      // 8: Santuário antigo de pedra na floresta com espíritos sutis
      'ancient stone shrine deep in a sun-dappled redwood grove, soft emerald moss, gentle glowing forest spirits floating peacefully among lush green ferns',
      // 9: Vista panorâmica no topo da colina com vila ao fundo ao pôr do sol
      'majestic panoramic vista of a knight standing atop a lush grassy hill looking over a cozy distant medieval village with stone chimneys and golden sunset clouds'
    ];

    if (p.includes('fogo') || p.includes('fogueira') || p.includes('brasa') || p.includes('chama') || p.includes('queimar')) {
      return ghibliScenes[1];
    }
    if (p.includes('vagalume') || p.includes('luciola') || p.includes('luz mágica')) {
      return ghibliScenes[4];
    }
    if (p.includes('estrela') || p.includes('céu') || p.includes('noite') || p.includes('lua')) {
      return ghibliScenes[6];
    }
    if (p.includes('volante') || p.includes('mapa') || p.includes('bússola') || p.includes('direção') || p.includes('decisão') || p.includes('escolha')) {
      return ghibliScenes[3];
    }
    if (p.includes('riacho') || p.includes('água') || p.includes('ponte') || p.includes('rio')) {
      return ghibliScenes[2];
    }
    if (p.includes('chá') || p.includes('caneca') || p.includes('mão') || p.includes('manopla')) {
      return ghibliScenes[5];
    }
    if (p.includes('siga') || p.includes('vitória') || p.includes('topo') || p.includes('horizonte')) {
      return ghibliScenes[9];
    }

    // Variação estrita por índice de cena para garantir que nunca se repita
    return ghibliScenes[idx % ghibliScenes.length];
  }

  // 1. Estilo ANIME_SHONEN (Ufotable / MAPPA / Dark Shonen / Superação e Motivação)
  if (style === 'ANIME_SHONEN') {
    const animeScenes = [
      // 0: Close-up extremo dos olhos e determinação
      'extreme close-up of intense anime warrior eyes with glowing amber irises and crackling electric energy sparks, fierce piercing gaze of absolute resolve',
      // 1: Meditação silenciosa no bambuzal com aura flutuante
      'disciplined anime warrior in quiet deep meditation under an ancient bamboo grove at dusk, faint golden spiritual aura particles and falling autumn leaves floating around silhouette',
      // 2: Desembainhar da katana com faíscas carmesim
      'intense anime warrior drawing a curved Damascus steel katana, gleaming blade reflecting sharp resolute eyes, crimson energy sparks crackling along the forged metal',
      // 3: Fogueira de campanha ou tocha noturna com brasas
      'battle-scarred anime warrior resting beside a crackling night bonfire, glowing orange embers floating into the dark wind, weapon planted in the ground',
      // 4: Clamor de combate e punhos cerrados
      'epic anime warrior clashing fists against shadowy adversary, explosive burst of electric blue and gold shockwaves, dynamic manga impact lines',
      // 5: Mãos enfaixadas cerrando com aura dourada
      'close-up of battle-worn wrapped hands clenching into determined fists, brilliant golden willpower aura radiating outward, floating embers',
      // 6: Noite estrelada cósmica com aurora e estrelas
      'surreal anime landscape of shattered floating rocks under a dramatic cosmic night sky with brilliant twinkling stars and glowing purple aurora borealis',
      // 7: Topo da montanha ao amanhecer triunfante
      'triumphant anime warrior standing atop a storm-swept mountain summit at golden sunrise, wind whipping torn cape, gazing at the dawn horizon with supreme mastery'
    ];

    if (p.includes('olhar') || p.includes('olhos') || p.includes('foco') || p.includes('perceber')) {
      return animeScenes[0];
    }
    if (p.includes('pausa') || p.includes('respire') || p.includes('calma') || p.includes('medita')) {
      return animeScenes[1];
    }
    if (p.includes('volante') || p.includes('katana') || p.includes('espada') || p.includes('arma') || p.includes('decisão')) {
      return animeScenes[2];
    }
    if (p.includes('fogo') || p.includes('fogueira') || p.includes('brasa') || p.includes('chama')) {
      return animeScenes[3];
    }
    if (p.includes('duas mentes') || p.includes('conflito') || p.includes('luta') || p.includes('duelo')) {
      return animeScenes[4];
    }
    if (p.includes('mão') || p.includes('punho') || p.includes('agir') || p.includes('hack') || p.includes('regra')) {
      return animeScenes[5];
    }
    if (p.includes('estrela') || p.includes('noite') || p.includes('céu')) {
      return animeScenes[6];
    }
    if (p.includes('siga') || p.includes('vitória') || p.includes('topo') || p.includes('montanha') || p.includes('amanhecer')) {
      return animeScenes[7];
    }

    return animeScenes[idx % animeScenes.length];
  }

  // 2. Estilo STOIC_STATUE (Filosofia Estoica, Mármore, Roma Antiga)
  if (style === 'STOIC_STATUE') {
    const stoicScenes = [
      'classical marble bust of Marcus Aurelius in deep serene meditation, museum chiaroscuro, soft dust motes in golden side light',
      'weathered Roman bronze sundial on a stone pedestal with candle flame casting dramatic long shadows, dust motes',
      'ancient stoic philosopher silhouette standing atop acropolis marble stairs overlooking dawn horizon',
      'macro shot of deliberate hands holding an antique brass navigational compass over worn nautical parchment, candlelight',
      'imposing classical marble colossus in a quiet shadowed temple hall, dramatic spotlight from high dome window',
      'night view of ancient Roman forum ruins under a clear starry sky, solitary torch burning with rising sparks',
      'weathered stone tablet inscribed with Latin stoic virtues, illuminated by golden lantern light'
    ];

    if (p.includes('pausa') || p.includes('respire') || p.includes('calma')) return stoicScenes[0];
    if (p.includes('tempo') || p.includes('relógio') || p.includes('hora')) return stoicScenes[1];
    if (p.includes('siga') || p.includes('vitória') || p.includes('topo')) return stoicScenes[2];
    if (p.includes('volante') || p.includes('bússola') || p.includes('controle')) return stoicScenes[3];
    if (p.includes('noite') || p.includes('estrela') || p.includes('fogo')) return stoicScenes[5];

    return stoicScenes[idx % stoicScenes.length];
  }

  // 3. Estilo CYBERPUNK (Néon, Alta Tecnologia, Sci-Fi)
  if (style === 'CYBERPUNK') {
    const cyberScenes = [
      'macro close-up of human eye with glowing cybernetic HUD ocular implant reflecting neon city lights',
      'cyberpunk hacker standing in rain-slicked dark alleyway, vibrant neon reflections in cyan and magenta, atmospheric steam',
      'glowing 3D holographic neural brain floating above dark metallic console in rainy neon-lit room',
      'hands with sleek cybernetic carbon-fiber gloves typing on illuminated holographic interface',
      'futuristic skyline at night with flying vehicles and soaring neon megastructures under a rainstorm',
      'cybernetic figure standing on high rooftop overlooking endless futuristic neon metropolis at twilight'
    ];

    if (p.includes('olhar') || p.includes('olhos')) return cyberScenes[0];
    if (p.includes('mente') || p.includes('cérebro')) return cyberScenes[2];
    if (p.includes('mão') || p.includes('controle')) return cyberScenes[3];
    if (p.includes('cidade') || p.includes('siga')) return cyberScenes[5];

    return cyberScenes[idx % cyberScenes.length];
  }

  // 4. Padrão REALISTIC_PHOTO (Documentário 35mm, Kodak Portra 400)
  const photoScenes = [
    // 0: Olhar focado
    'extreme macro photograph of intense focused human eye iris with vivid amber catchlight, natural skin pores, piercing gaze, 35mm film',
    // 1: Fogueira / lareira com brasas e fumaça
    'macro photograph of glowing embers and dancing flames in a rustic stone hearth, delicate orange sparks floating upward into the dark room, 35mm film',
    // 2: Cérebro / sinapses em laboratório
    'photograph of illuminated anatomical human brain model in dark laboratory, subtle glowing amber and cyan synapses, documentary style, 35mm film',
    // 3: Bússola e mapa à luz de velas
    'antique brass navigational compass resting on an authentic worn nautical chart, warm glowing candle flame casting deep shadows, dust motes',
    // 4: Silhuetas em impasse e tensão
    'two striking human silhouettes in tense psychological standoff across a shadowy room, atmospheric volumetric haze and smoke',
    // 5: Noite estrelada profunda
    'solitary figure gazing at a brilliant clear night sky filled with twinkling stars and Milky Way galaxy over a dark mountain ridge',
    // 6: Mãos em ação decidida
    'macro photograph of deliberate mature hands holding antique brass keys and ancient parchment, authentic skin texture and wrinkles',
    // 7: Horizonte ao nascer do sol
    'cinematic documentary photograph of a solitary traveler standing on a rugged mountain peak overlooking sea of clouds at golden sunrise'
  ];

  if (p.includes('olho') || p.includes('olhar') || p.includes('contato visual')) return photoScenes[0];
  if (p.includes('fogo') || p.includes('fogueira') || p.includes('brasa') || p.includes('chama')) return photoScenes[1];
  if (p.includes('cérebro') || p.includes('mente') || p.includes('amígdala') || p.includes('sinapse')) return photoScenes[2];
  if (p.includes('volante') || p.includes('bússola') || p.includes('mapa')) return photoScenes[3];
  if (p.includes('silêncio') || p.includes('duas mentes') || p.includes('confronto')) return photoScenes[4];
  if (p.includes('estrela') || p.includes('noite') || p.includes('lua')) return photoScenes[5];
  if (p.includes('mão') || p.includes('hack') || p.includes('prática') || p.includes('agir')) return photoScenes[6];
  if (p.includes('siga') || p.includes('vitória') || p.includes('topo')) return photoScenes[7];

  return photoScenes[idx % photoScenes.length];
}

/**
 * Construtor Heurístico de Prompts Cinematográficos Estruturados (5 Camadas)
 */
export function buildHeuristicCinematicPrompt({
  spokenPhrase = '',
  visualDirective = '',
  channelAesthetic = 'Cinematic Dark Minimalist',
  blockType = 'body',
  motionType = 'push_in',
  sceneIndex = 0,
  totalScenes = 8
}) {
  const style = detectAestheticStyle(visualDirective, channelAesthetic);
  const subject = deriveVisualSubjectFromPhrase(spokenPhrase, visualDirective, style, sceneIndex, totalScenes);

  // Camada de encenação por bloco de retenção
  let stagingAction = '';
  let lensSpec = '85mm f/1.4 prime lens, shallow depth of field';

  switch (blockType) {
    case 'hook':
      stagingAction = style === 'ANIME_SHONEN'
        ? 'intense dynamic anime battle composition, extreme close focal impact, raw willpower'
        : 'intense dramatic focal framing, capturing raw realism and immediate curiosity';
      lensSpec = '85mm f/1.4 prime lens, shallow depth of field, sharp textures';
      break;
    case 'hack':
      stagingAction = style === 'ANIME_SHONEN'
        ? 'dynamic close-up of battle-worn hands gripping weapon or clenching fist with electric sparks'
        : 'macro close-up of deliberate hands taking decisive action, authentic tactile textures';
      lensSpec = '50mm prime lens, tight dynamic framing, side rim lighting';
      break;
    case 'cta':
      stagingAction = style === 'ANIME_SHONEN'
        ? 'epic panoramic anime vista overlooking breathtaking golden sunrise horizon, supreme triumph and ascended power'
        : 'epic sweeping perspective overlooking expansive golden sunrise horizon, supreme mastery and triumph';
      lensSpec = '35mm wide lens, atmospheric volumetric light rays';
      break;
    case 'body':
    default:
      stagingAction = style === 'ANIME_SHONEN'
        ? 'dramatic medium anime framing, floating embers, intense spiritual pressure, deep shadows'
        : 'dramatic medium framing, mysterious atmospheric chiaroscuro with subtle dust particles drifting';
      lensSpec = '85mm portrait cine lens, elegant bokeh, deep contrast';
      break;
  }

  // 0. Estilo Ghibli Cozy Fantasy / Medieval Lofi
  if (style === 'GHIBLI_COZY_FANTASY') {
    let lightingAtmosphere = 'warm dappled golden sunlight (komorebi) filtering through lush green canopy, field of yellow wildflowers and soft emerald grass';
    const subLower = (subject || '').toLowerCase();
    if (/campfire|fire|embers|flames|hearth/i.test(subLower)) {
      lightingAtmosphere = 'warm crackling campfire glow casting dancing amber highlights and deep twilight shadows, rising embers';
    } else if (/firefl|bioluminescent|twilight/i.test(subLower)) {
      lightingAtmosphere = 'magical twilight penumbra, glowing yellow-green bioluminescent fireflies, serene evening atmosphere';
    } else if (/star|night\s*sky|moon/i.test(subLower)) {
      lightingAtmosphere = 'deep indigo midnight sky with brilliant starlight and silver crescent moon casting subtle rim light';
    } else if (/steam|tea|mug|gauntlet/i.test(subLower)) {
      lightingAtmosphere = 'cozy warm lantern glow by the stone hearth, curling steam motes, peaceful quiet evening';
    } else if (/ruin|temple|map|parchment/i.test(subLower)) {
      lightingAtmosphere = 'soft ancient stone temple lighting, gentle sunbeam illuminating carved stonework and ancient map';
    }

    const promptParts = [
      `2D hand-drawn animation cel, ligne claire, Studio Ghibli and Moebius art style of ${subject}`,
      stagingAction,
      lightingAtmosphere,
      `flat gouache colors, soft watercolor textures, bold clean ink outlines, nostalgic cozy medieval fantasy illustration, peaceful tranquil mood, 8k art, cine lens composition`,
      `vertical 9:16 framing, cinema composition, no text, no watermark, no captions, no split screen, no blur`
    ];
    return promptParts.join(', ');
  }

  // 1. Estilo Anime Dark Shonen
  if (style === 'ANIME_SHONEN') {
    const promptParts = [
      `Masterwork dark shonen anime key visual of ${subject}`,
      stagingAction,
      `dramatic Ufotable anime lighting, intense glowing energy aura, floating embers and battle dust particles, high-contrast dark chiaroscuro`,
      `dynamic cel-shading, sharp clean manga ink lines, vivid color grading, Makoto Shinkai and Wit Studio aesthetic, highly detailed 8k anime wallpaper, trending on Pixiv, cine lens composition`,
      `vertical 9:16 framing, cinema composition, no text, no watermark, no captions, no split screen, no blur`
    ];
    return promptParts.join(', ');
  }

  // 2. Estilo Estoico / Esculturas
  if (style === 'STOIC_STATUE') {
    const promptParts = [
      `Fine art museum photograph of ${subject}`,
      stagingAction,
      `dramatic Caravaggio chiaroscuro lighting, deep obsidian shadows with sharp golden rim light`,
      `shot on 35mm film, Kodak Portra 400, ${lensSpec}, authentic marble texture, museum lighting`,
      `vertical 9:16 framing, cinema color grading, no text, no watermark, no captions, no split screen, no blur`
    ];
    return promptParts.join(', ');
  }

  // 3. Estilo Cyberpunk
  if (style === 'CYBERPUNK') {
    const promptParts = [
      `Futuristic cyberpunk photograph of ${subject}`,
      stagingAction,
      `vibrant neon rim lighting in cyan and magenta, atmospheric rain fog and steam, dark gritty shadows`,
      `shot on 35mm anamorphic prime lens, Kodak Vision3 film grain, cinematic color grade`,
      `vertical 9:16 framing, cinema color grading, no text, no watermark, no captions, no split screen, no blur`
    ];
    return promptParts.join(', ');
  }

  // 4. Padrão Realista Documental (35mm)
  const promptParts = [
    `Authentic documentary photograph of ${subject}`,
    stagingAction,
    `dramatic Caravaggio chiaroscuro lighting, deep shadows, subtle warm and cyan rim light`,
    `shot on 35mm film, Kodak Portra 400, ${lensSpec}, authentic film grain, natural textures, realistic imperfections`,
    `vertical 9:16 framing, cinema color grading, no text, no watermark, no captions, no split screen, no blur`
  ];

  return promptParts.join(', ');
}

/**
 * Consulta a API do Gemini (gemini-flash-lite-latest) para sintetizar um prompt
 * de cinematografia profissional em inglês de alto impacto, adaptado ao estilo visual solicitado.
 */
async function queryGeminiPromptExpansion({
  spokenPhrase,
  visualDirective,
  channelAesthetic,
  blockType,
  apiKey,
  sceneIndex = 0,
  totalScenes = 8
}) {
  const modelName = 'gemini-flash-lite-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const style = detectAestheticStyle(visualDirective, channelAesthetic);
  const sceneNum = sceneIndex + 1;

  let systemInstruction;
  let userPrompt;

  if (style === 'GHIBLI_COZY_FANTASY') {
    systemInstruction = `You are a legendary background art director and concept artist for Studio Ghibli (Hayao Miyazaki, Kazuo Oga) and French comic master Moebius.
Your mission is to output ONE SINGLE PARAGRAPH prompt in English for a vertical 9:16 NOSTALGIC COZY FANTASY / GHIBLI-STYLE GOUACHE ILLUSTRATION.
Rules:
1. STRICT ZERO REPETITION: This is scene #${sceneNum} of ${totalScenes}. The visual subject, composition, and framing MUST be 100% UNIQUE and completely different from any other scene in the narrative.
2. The peaceful fantasy subject MUST come FIRST (e.g. relaxing by ancient mossy oak, crackling cozy campfire with floating embers, sunlit brook with wooden bridge, ancient stone ruin archway, magical twilight clearing with glowing fireflies, knight looking up at twinkling night stars).
3. The style MUST be hand-drawn 2D animation cel, ligne claire ink lines, warm gouache and watercolor textures, bright dappled golden sunlight (komorebi) or soft twilight, serene peaceful mood.
4. Integrate subtle living cinemagraph micro-details (dancing campfire flames and sparks, floating fireflies, twinkling stars, or golden pollen dust motes).
5. STRICTLY FORBIDDEN: NO dark horror, no violence, no modern elements, no photorealistic human photography, no 3D CGI renders.
6. STRICTLY FORBID: Do not write text on the image, no subtitles, no watermarks, no split screens, no borders.
7. Return ONLY the final English prompt string, without quotes or introductory commentary.`;

    userPrompt = `Generate a cozy Ghibli medieval fantasy illustration prompt for Scene Take #${sceneNum}/${totalScenes}:
- Spoken Narration Beat: "${spokenPhrase || 'Inner peace, calm and tranquil focus'}"
- Visual Theme: "${visualDirective || 'Studio Ghibli Medieval Knight Quiet Forest Cozy Fantasy'}"
- Retention Block: "${blockType}" (hook = peaceful sunlit discovery; body = serene medieval forest moment or campfire; hack = calm deliberate rest or ancient map; cta = majestic tranquil forest vista)
- Aesthetic: "${channelAesthetic}, Studio Ghibli, Moebius, warm gouache painting, komorebi sunlight, living cinemagraph atmosphere"`;
  } else if (style === 'ANIME_SHONEN') {
    systemInstruction = `You are an elite anime art director and concept artist for legendary studios such as Ufotable, MAPPA, and Wit Studio (famed for Demon Slayer, Fate/Zero, Jujutsu Kaisen, Attack on Titan).
Your mission is to output ONE SINGLE PARAGRAPH prompt in English for a vertical 9:16 HIGH-END DARK ANIME / SHONEN CONCEPT ART.
Rules:
1. STRICT ZERO REPETITION: This is scene #${sceneNum} of ${totalScenes}. The anime subject, camera framing, and action MUST be 100% UNIQUE and distinct from other scenes.
2. The anime character action or visual metaphor MUST come FIRST in the prompt (e.g. piercing glowing eyes close-up, quiet meditation in bamboo grove, drawing curved katana, crackling campfire embers, clenched fists with electric aura, cosmic starry night).
3. The style MUST be masterwork anime illustration: dynamic cel-shading, Ufotable-level volumetric lighting, cinematic chiaroscuro, glowing aura particles, crisp ink linework, 8k anime key visual.
4. Integrate subtle living cinemagraph micro-details (sparks, floating embers, electrical energy arcs, twinkling stars, or drifting leaves).
5. STRICTLY FORBIDDEN: NEVER request realistic human photography, real skin pores, 3D western cartoons, Pixar styles, or cheap doodles.
6. STRICTLY FORBID: Do not write text on the image, no subtitles, no watermarks, no split screens, no borders.
7. Return ONLY the final English prompt string, without quotes or introductory commentary.`;

    userPrompt = `Generate a high-end dark anime concept art prompt for Scene Take #${sceneNum}/${totalScenes}:
- Spoken Narration Beat: "${spokenPhrase || 'Overcoming limits through sheer willpower'}"
- Visual Theme: "${visualDirective || 'Dark Shonen Anime Motivation'}"
- Retention Block: "${blockType}" (hook = explosive intensity; body = internal struggle or intense warrior training; hack = gripping katana or clenched fists of resolve; cta = triumphant mountain summit)
- Aesthetic: "${channelAesthetic}, Ufotable lighting, dynamic cel-shading, glowing aura, high contrast chiaroscuro"`;
  } else {
    systemInstruction = `You are a world-class documentary cinematographer and master photographer for National Geographic and Time Magazine.
Your mission is to output ONE SINGLE PARAGRAPH prompt in English for a vertical 9:16 REALISTIC PHOTOGRAPH.
Rules:
1. STRICT ZERO REPETITION: This is scene #${sceneNum} of ${totalScenes}. The subject and composition MUST be 100% UNIQUE.
2. The physical, tangible subject MUST come FIRST in the prompt. Describe realistic physical textures (skin pores, wrinkles, weathered wood, aged paper, metal patina, glass, brass).
3. The style MUST be authentic 35mm documentary photography, Kodak Portra 400 film, natural lighting, dramatic Caravaggio chiaroscuro with deep shadows.
4. Integrate atmospheric living elements (dancing hearth flame embers, floating dust motes in sunbeams, twinkling night stars).
5. NEVER use words like 'portrait' unless the subject is an actual human face. If the spoken text is about a book, money, compass, brain, or decisions, describe the physical object or scene as a macro or editorial still life.
6. STRICTLY FORBIDDEN: NEVER request 3D renders, CGI, Unreal Engine, anime, digital art, illustration, video game assets, doll-like smooth plastic skin, or fantasy art.
7. STRICTLY FORBID: Do not write text on the image, no subtitles, no watermarks, no split screens, no borders.
8. Return ONLY the final English prompt string, without quotes or introductory commentary.`;

    userPrompt = `Generate a realistic documentary photography prompt for Scene Take #${sceneNum}/${totalScenes}:
- Spoken Narration Phrase: "${spokenPhrase || 'Mental clarity and focus'}"
- Visual Theme: "${visualDirective || 'Dark Psychology, Neurochemistry and Decision Making'}"
- Retention Block: "${blockType}" (hook = intense curiosity and focus; body = psychological mechanism or object; hack = hands taking action; cta = triumphant horizon)
- Aesthetic: "${channelAesthetic}, 35mm film, authentic textures, deep chiaroscuro"`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 180
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 30) {
        return text.trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    // Erros de rede ou timeout acionam fallback sem quebrar o fluxo
  }

  return null;
}
