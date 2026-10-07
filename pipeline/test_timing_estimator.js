import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateWordBoundaries, estimateVisualDuration } from './src/timing_estimator.js';

test('Timing Estimator - estimateWordBoundaries distribui palavras dentro da duração disponível', () => {
  const text = 'A disciplina é a mãe do sucesso.';
  const duration = 10.0;
  const boundaries = estimateWordBoundaries(text, duration, { startPaddingSec: 0.5, endPaddingSec: 0.5 });

  assert.equal(boundaries.length, 7);
  // Primeira palavra inicia no padding
  assert.ok(boundaries[0].start >= 0.5);
  // Última palavra termina antes ou no limite
  assert.ok(boundaries[boundaries.length - 1].end <= 10.0);

  // Ordem temporal estritamente crescente
  for (let i = 0; i < boundaries.length - 1; i++) {
    assert.ok(boundaries[i].start <= boundaries[i].end);
    assert.ok(boundaries[i].end <= boundaries[i + 1].start || boundaries[i].start < boundaries[i + 1].start);
  }
});

test('Timing Estimator - estimateWordBoundaries lida com texto vazio ou nulo', () => {
  assert.deepEqual(estimateWordBoundaries('', 10.0), []);
  assert.deepEqual(estimateWordBoundaries(null, 10.0), []);
});

test('Timing Estimator - estimateVisualDuration calcula baseado em cenas ou texto', () => {
  // Com cenas
  const scenes = [{ duration: 4.0 }, { duration: 3.5 }, { duration: 5.0 }];
  assert.equal(estimateVisualDuration(scenes, '', 15.0), 12.5);

  // Sem cenas mas com texto (cadência de ~2.5 palavras/segundo)
  const narration = 'Uma duas três quatro cinco seis sete oito nove dez.'; // 10 palavras -> ~10s mínimo
  const dur = estimateVisualDuration([], narration, 15.0);
  assert.ok(dur >= 10.0 && dur <= 60.0);

  // Fallback quando não há nada
  assert.equal(estimateVisualDuration([], '', 20.0), 20.0);
});
