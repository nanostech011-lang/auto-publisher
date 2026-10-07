import { translateStockQueryToEnglish } from './stock_video_connector.js';

/**
 * Lista canônica de objetos metafóricos secundários desconectados que devem ser
 * estritamente bloqueados quando o usuário define uma diretriz visual soberana.
 */
export const BLOCKED_GENERIC_OBJECTS = [
  'shoelace',
  'shoelaces',
  'tying running shoes',
  'running shoes',
  'stopwatch',
  'alarm clock',
  'hourglass',
  'empty hallway',
  'steering wheel',
  'cadarço',
  'cadarcos',
  'cronômetro',
  'cronometro',
  'despertador',
  'ampulheta',
  'corredor vazio',
  'volante'
];

/**
 * Dicionário heurístico de alta precisão para extração de âncoras temáticas nucleares em inglês
 */
const DOMAIN_ANCHOR_PATTERNS = [
  {
    regex: /pol[ií]c|agente.*seguran[çc]|swat|bope|choque|t[aá]tic|soldad|combate|guerra|militar|caveira/i,
    anchors: [
      'police tactical operation',
      'swat urban combat',
      'tactical soldiers armed',
      'special forces team',
      'military combat squad',
      'law enforcement tactical'
    ],
    archetypeId: 'tactical_police_combat',
    archetypeName: 'Tático / Policiais em Ação',
    cameraStyles: ['tactical medium tracking shot', 'low angle hero shot', 'close up helmet visor']
  },
  {
    regex: /persa|persian|esparta|gladiador|romano|imp[eé]rio/i,
    anchors: [
      'persian golden immortals warrior',
      'ancient warrior golden armor',
      'persian empire ruins desert',
      'spartan bronze warrior battle'
    ],
    archetypeId: 'persian_golden_immortals',
    archetypeName: 'Guerreiros Persas / Imortais',
    cameraStyles: ['wide cinematic desert', 'hero low angle sword', 'intense gaze golden mask']
  },
  {
    regex: /samurai|katana|ninja|jap[aã]o|bushido/i,
    anchors: [
      'samurai katana blade warrior',
      'ancient samurai armor night',
      'japanese warrior silhouette',
      'samurai battle stance rain'
    ],
    archetypeId: 'samurai_katana_blade',
    archetypeName: 'Samurais / Mestres da Katana',
    cameraStyles: ['extreme close up katana edge', 'wide misty bamboo forest', 'dramatic low angle stance']
  },
  {
    regex: /medieval|cavaleiro|castelo|espada|viking/i,
    anchors: [
      'medieval knight steel armor',
      'knight sword battlefield',
      'ancient stone fortress smoke',
      'viking warrior battle'
    ],
    archetypeId: 'medieval_knights',
    archetypeName: 'Cavaleiros Medievais',
    cameraStyles: ['tracking shot battlefield', 'close up steel gauntlet', 'dramatic torchlight castle']
  },
  {
    regex: /cyberpunk|futurista|hacker|neon|sci-fi|fic[çc][aã]o/i,
    anchors: [
      'cyberpunk tactical operative neon',
      'futuristic soldier rain city',
      'cyberpunk neon street night',
      'dark sci fi operative gear'
    ],
    archetypeId: 'cyberpunk_operative',
    archetypeName: 'Operativo Cyberpunk',
    cameraStyles: ['neon reflections puddle', 'aerial drone dark city', 'dramatic side profile visor']
  },
  {
    regex: /investidor|wall\s*street|milion[aá]rio|luxo|mercado\s*financeiro/i,
    anchors: [
      'wall street executive office',
      'modern luxury boardroom night',
      'financial district skyscrapers',
      'wealthy entrepreneur skyscraper'
    ],
    archetypeId: 'finance_executive',
    archetypeName: 'Executivo de Finanças / Investimentos',
    cameraStyles: ['slow motion glass window', 'low angle glass tower', 'focused trading screen']
  }
];

/**
 * Deriva âncoras temáticas estruturadas e termos para APIs de estoque a partir da diretriz visual
 */
export function deriveDirectiveAnchors(visualDirective = '', { apiKey = null } = {}) {
  const dir = (visualDirective || '').trim();
  if (!dir) {
    return {
      hasDirective: false,
      rawDirective: '',
      stockAnchorsEn: [],
      blockedObjects: [],
      archetype: null
    };
  }

  // 1. Verifica correspondência no catálogo heurístico de domínios
  for (const domain of DOMAIN_ANCHOR_PATTERNS) {
    if (domain.regex.test(dir)) {
      return {
        hasDirective: true,
        rawDirective: dir,
        stockAnchorsEn: [...domain.anchors],
        blockedObjects: [...BLOCKED_GENERIC_OBJECTS],
        archetype: {
          id: domain.archetypeId,
          name: domain.archetypeName,
          cameraStyles: domain.cameraStyles
        }
      };
    }
  }

  // 2. Extrai termos nucleares traduzindo termos-chave da diretriz
  const translated = translateStockQueryToEnglish(dir);
  const words = translated.split(/\s+/).filter(w => w.length > 2);
  const anchors = [];

  if (words.length >= 2) {
    anchors.push(words.slice(0, 4).join(' '));
    anchors.push(`${words[0]} ${words[1]} action`);
    anchors.push(`cinematic ${words.slice(0, 3).join(' ')}`);
  } else if (words.length === 1) {
    anchors.push(`${words[0]} action vertical`);
    anchors.push(`cinematic ${words[0]} dramatic`);
  } else {
    anchors.push('cinematic action dynamic vertical');
  }

  return {
    hasDirective: true,
    rawDirective: dir,
    stockAnchorsEn: anchors,
    blockedObjects: [...BLOCKED_GENERIC_OBJECTS],
    archetype: null
  };
}

/**
 * Monta query de busca de estoque curta e focada (<= 5 palavras) combinando
 * a âncora soberana da diretriz com a ação da frase ou enquadramento
 */
export function buildAnchorQuery({
  directiveAnchors,
  scenePhrase = '',
  framing = '',
  sceneIndex = 0
}) {
  if (!directiveAnchors || !directiveAnchors.hasDirective || directiveAnchors.stockAnchorsEn.length === 0) {
    return null;
  }

  const anchors = directiveAnchors.stockAnchorsEn;
  // Rodízio determinístico de âncoras para garantir diversidade entre os takes
  const baseAnchor = anchors[sceneIndex % anchors.length];

  // Adiciona modificador suave de enquadramento se fornecido
  let cleanFraming = (framing || '').trim().toLowerCase();
  if (cleanFraming.includes('wide')) cleanFraming = 'wide';
  else if (cleanFraming.includes('close')) cleanFraming = 'close up';
  else if (cleanFraming.includes('tracking')) cleanFraming = 'tracking';
  else if (cleanFraming.includes('low')) cleanFraming = 'low angle';
  else cleanFraming = '';

  const candidate = cleanFraming ? `${baseAnchor} ${cleanFraming}` : baseAnchor;
  // Garante limite máximo de 5 palavras para não degradar a precisão das buscas Pexels/Pixabay
  const parts = candidate.split(/\s+/).filter(Boolean);
  return parts.slice(0, 5).join(' ');
}

/**
 * Verifica se um texto contém menções a objetos genéricos bloqueados
 */
export function isBlockedObject(text = '', blockedObjects = BLOCKED_GENERIC_OBJECTS) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return blockedObjects.some(bo => {
    const regex = new RegExp(`\\b${bo}\\b`, 'i');
    return regex.test(lower);
  });
}

/**
 * Higieniza um texto de query ou prompt removendo termos de objetos bloqueados
 */
export function filterBlockedObjects(text = '', blockedObjects = BLOCKED_GENERIC_OBJECTS) {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text;
  for (const bo of blockedObjects) {
    const regex = new RegExp(`\\b${bo}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '');
  }
  return sanitized.replace(/\s+/g, ' ').trim();
}
