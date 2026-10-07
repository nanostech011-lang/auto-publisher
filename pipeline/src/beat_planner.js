/**
 * AutoPublisher Pro - Beat Planner
 * 
 * Calcula o ritmo dinâmico de cortes cinematográficos e subdivide beats longos
 * em sub-takes ágeis (entre 1.8s e 4.5s), alternando tipos de movimento (motionType)
 * e enquadramento visual sobre o mesmo asset, sem custo adicional de geração de IA.
 */

export const MOTION_VARIATIONS = [
  'push_in',
  'reveal_zoom_out',
  'pan_left_right',
  'pan_right_left',
  'atmospheric_drift'
];

/**
 * Normaliza o intervalo de cortes a partir do perfil do canal
 * ex: "2-4" -> { min: 2.0, max: 4.0, avg: 3.0 }
 */
export function parseCutsInterval(intervalStr = '2-4') {
  if (!intervalStr || typeof intervalStr !== 'string') {
    return { min: 2.0, max: 4.0, avg: 3.0 };
  }

  const parts = intervalStr.split('-').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
  if (parts.length === 2 && parts[0] > 0 && parts[1] >= parts[0]) {
    return { min: parts[0], max: parts[1], avg: (parts[0] + parts[1]) / 2 };
  } else if (parts.length === 1 && parts[0] > 0) {
    return { min: Math.max(1.8, parts[0] - 1), max: parts[0] + 1, avg: parts[0] };
  }

  return { min: 2.0, max: 4.0, avg: 3.0 };
}

/**
 * Subdivide uma frase longa em segmentos menores nos limites de pontuação ou conjunções
 */
export function splitPhraseForSubTakes(phrase = '', count = 2) {
  if (!phrase || count <= 1) return [phrase];

  // Tenta quebrar em vírgulas, pontos ou ponto-e-vírgula
  const punctuationParts = phrase.split(/[,.;:]+/).map(p => p.trim()).filter(Boolean);
  if (punctuationParts.length >= count) {
    // Agrupa proporcionalmente
    const result = [];
    const perGroup = Math.ceil(punctuationParts.length / count);
    for (let i = 0; i < punctuationParts.length; i += perGroup) {
      result.push(punctuationParts.slice(i, i + perGroup).join(', '));
    }
    while (result.length < count) result.push('');
    return result.slice(0, count);
  }

  // Tenta quebrar em palavras
  const words = phrase.trim().split(/\s+/);
  if (words.length >= count * 2) {
    const result = [];
    const perGroup = Math.ceil(words.length / count);
    for (let i = 0; i < words.length; i += perGroup) {
      result.push(words.slice(i, i + perGroup).join(' '));
    }
    while (result.length < count) result.push('');
    return result.slice(0, count);
  }

  return [phrase, ''];
}

/**
 * Planeja e enriquece os beats de cena para cumprir a densidade de cortes (2 a 4 segundos)
 * 
 * @param {Array<Object>} scenes Cenas brutas vindas do roteirizador
 * @param {number} totalDurationSeconds Duração total medida do áudio
 * @param {string} cutsIntervalStr Formato de intervalo, ex: "2-4"
 * @param {number} fps Framerate para quantização (padrão 30)
 * @returns {Array<Object>} Cenas refinadas e subdivididas prontas para alinhamento
 */
export function planBeatsAndSubTakes({
  scenes = [],
  totalDurationSeconds = 60,
  cutsIntervalStr = '2-4',
  fps = 30
}) {
  if (!Array.isArray(scenes) || scenes.length === 0) return [];

  const { min, max, avg } = parseCutsInterval(cutsIntervalStr);
  const targetSceneCount = Math.max(scenes.length, Math.round(totalDurationSeconds / avg));

  const plannedScenes = [];
  let motionCursor = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const estimatedDuration = scene.duration || (totalDurationSeconds / scenes.length);

    // Se a cena for mais longa que o teto (4.5s), divide em sub-takes
    if (estimatedDuration > 4.5) {
      const subTakeCount = Math.min(3, Math.max(2, Math.round(estimatedDuration / avg)));
      const subDuration = estimatedDuration / subTakeCount;
      const phraseParts = splitPhraseForSubTakes(scene.phrase || scene.spokenPhrase || '', subTakeCount);

      for (let s = 0; s < subTakeCount; s++) {
        const nextMotion = MOTION_VARIATIONS[(motionCursor++) % MOTION_VARIATIONS.length];
        const subFraming = s === 0 ? 'medium_shot' : (s === 1 ? 'close_up' : 'extreme_close_up');
        const subAngle = s === 0 ? 'straight_on' : (s === 1 ? 'side_profile' : 'dynamic_angle');
        plannedScenes.push({
          ...scene,
          id: `${scene.id || i + 1}_take_${s + 1}`,
          subTakeIndex: s,
          totalSubTakes: subTakeCount,
          isSubTake: s > 0,
          parentSceneIndex: i,
          phrase: phraseParts[s] || scene.phrase || '',
          duration: Number(subDuration.toFixed(2)),
          motionType: nextMotion,
          framing: subFraming,
          angleVariation: subAngle,
          visualZoom: s === 0 ? 1.0 : (s === 1 ? 1.15 : 1.08),
          cropVariation: s % 2 === 0 ? 'center' : 'slight_pan'
        });
      }
    } else {
      const nextMotion = scene.motionType || MOTION_VARIATIONS[(motionCursor++) % MOTION_VARIATIONS.length];
      plannedScenes.push({
        ...scene,
        id: scene.id || `${i + 1}`,
        subTakeIndex: 0,
        totalSubTakes: 1,
        isSubTake: false,
        parentSceneIndex: i,
        duration: Number(Math.max(min, Math.min(max, estimatedDuration)).toFixed(2)),
        motionType: nextMotion
      });
    }
  }

  return plannedScenes;
}

/**
 * Quantiza um timestamp em milissegundos para a fronteira exata de frame
 */
export function quantizeMsToFrame(timeMs, fps = 30) {
  const frameDurationMs = 1000 / fps;
  const frameIndex = Math.round(timeMs / frameDurationMs);
  return Math.round(frameIndex * frameDurationMs);
}
