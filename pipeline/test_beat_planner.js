import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCutsInterval, splitPhraseForSubTakes, planBeatsAndSubTakes, quantizeMsToFrame, MOTION_VARIATIONS } from './src/beat_planner.js';

test('Beat Planner - parseCutsInterval extrai min, max e média corretamente', () => {
  assert.deepEqual(parseCutsInterval('2-4'), { min: 2.0, max: 4.0, avg: 3.0 });
  assert.deepEqual(parseCutsInterval('1.8-3.5'), { min: 1.8, max: 3.5, avg: 2.65 });
  assert.deepEqual(parseCutsInterval(null), { min: 2.0, max: 4.0, avg: 3.0 });
});

test('Beat Planner - splitPhraseForSubTakes divide frases por pontuação e conjunções', () => {
  const phrase = 'Se você desconfia de alguém, nunca confronte diretamente; observe o silêncio.';
  const parts = splitPhraseForSubTakes(phrase, 2);
  assert.equal(parts.length, 2);
  assert.ok(parts[0].length > 0);
  assert.ok(parts[1].length > 0);
});

test('Beat Planner - planBeatsAndSubTakes subdivide cenas longas (> 4.5s) em sub-takes dinâmicos', () => {
  const rawScenes = [
    { id: 1, duration: 2.5, phrase: 'Gancho rápido e direto.', motionType: 'push_in' },
    { id: 2, duration: 8.0, phrase: 'Uma cena muito longa que precisa ser dividida em múltiplos takes com movimentos alternados.' },
    { id: 3, duration: 3.0, phrase: 'Conclusão impactante.' }
  ];

  const planned = planBeatsAndSubTakes({
    scenes: rawScenes,
    totalDurationSeconds: 13.5,
    cutsIntervalStr: '2-4'
  });

  // A cena 2 (8s) deve ter sido dividida em sub-takes
  assert.ok(planned.length > 3, `Esperado > 3 takes, recebeu ${planned.length}`);
  
  // Todos os takes planejados devem ter duração entre 1.8 e 4.5 segundos
  for (const take of planned) {
    assert.ok(take.duration >= 1.8, `Duração muito curta: ${take.duration}`);
    assert.ok(take.duration <= 4.5, `Duração muito longa: ${take.duration}`);
    assert.ok(take.motionType, 'Motion type deve estar definido');
  }

  // Verifica que sub-takes herdam o parentSceneIndex
  const subTakes = planned.filter(p => p.parentSceneIndex === 1);
  assert.ok(subTakes.length >= 2, 'Sub-takes da cena 2 devem ser ao menos 2');
});

test('Beat Planner - quantizeMsToFrame quantiza com precisão para framerate', () => {
  const q30 = quantizeMsToFrame(100, 30); // ~33.33ms per frame -> 99.99ms ~ 100ms
  assert.equal(Math.abs(q30 - 100) < 5, true);
});

test('Beat Planner - MOTION_VARIATIONS contém as variações canônicas de movimento', () => {
  assert.ok(Array.isArray(MOTION_VARIATIONS));
  assert.ok(MOTION_VARIATIONS.length >= 5);
  const expected = ['push_in', 'reveal_zoom_out', 'pan_left_right', 'pan_right_left', 'atmospheric_drift'];
  for (const m of expected) {
    assert.ok(MOTION_VARIATIONS.includes(m), `Falta movimento canônico: ${m}`);
  }
});

