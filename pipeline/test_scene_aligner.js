/**
 * AutoPublisher Pro - Scene Aligner Verification Suite
 * Testa os algoritmos de sincronização fonética, cortes em L-cut,
 * ancoragem em pausas de fala e garantia matemática de invariantes de duração.
 */

import {
  normalizeWord,
  tokenizePhrase,
  findWordSequenceIndex,
  calculateSceneCutTimestamp,
  findOptimalPauseCut,
  alignScenesWithWordBoundaries
} from './src/scene_aligner.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('===============================================================');
console.log('        TEST SUITE: AutoPublisher Pro Scene Aligner           ');
console.log('===============================================================');

// -------------------------------------------------------------
// Test 1: Normalização de Palavras e Tokenização
// -------------------------------------------------------------
console.log('\n[1/5] Testando Normalização e Tokenização Fonética:');
assert(normalizeWord('VocÊ!') === 'voce', 'Normalização remove acentos e pontuação em "VocÊ!"');
assert(normalizeWord('amígdala,') === 'amigdala', 'Normalização de "amígdala," para "amigdala"');
assert(normalizeWord('"silêncio..."') === 'silencio', 'Normalização de aspas e reticências');
assert(normalizeWord('') === '', 'String vazia retorna vazio');
assert(normalizeWord(null) === '', 'Null retorna vazio');

const tokens = tokenizePhrase('Se você desconfia, nunca confronte a pessoa!');
assert(tokens.length === 7, `Tokenização produziu 7 palavras normalizadas (recebeu: ${tokens.length})`);
assert(tokens[0] === 'se' && tokens[1] === 'voce' && tokens[2] === 'desconfia', 'Tokens iniciais corretos');

// -------------------------------------------------------------
// Test 2: Localização de Sequência de Palavras nos WordBoundaries
// -------------------------------------------------------------
console.log('\n[2/5] Testando Janela Deslizante de Busca nos WordBoundaries:');
const mockBoundaries = [
  { word: 'Se', startMs: 50, endMs: 200 },
  { word: 'você', startMs: 220, endMs: 480 },
  { word: 'desconfia', startMs: 500, endMs: 950 },
  { word: 'de', startMs: 980, endMs: 1100 },
  { word: 'alguém.', startMs: 1150, endMs: 1550 },
  // Pausa de 650ms
  { word: 'Existe', startMs: 2200, endMs: 2550 },
  { word: 'um', startMs: 2580, endMs: 2700 },
  { word: 'truque', startMs: 2720, endMs: 3100 },
  { word: 'poderoso.', startMs: 3150, endMs: 3600 },
  // Pausa de 800ms
  { word: 'O', startMs: 4400, endMs: 4520 },
  { word: 'silêncio', startMs: 4550, endMs: 5100 },
  { word: 'absoluto.', startMs: 5150, endMs: 5650 }
];

const matchExiste = findWordSequenceIndex(mockBoundaries, ['existe', 'um', 'truque'], 0);
assert(matchExiste !== null, 'Encontrou sequência "existe um truque"');
assert(matchExiste.boundaryIndex === 5, `Índice correto para "Existe" (esperado: 5, obteve: ${matchExiste?.boundaryIndex})`);
assert(matchExiste.matchedWord === 'Existe', 'Palavra casada é "Existe"');

// Teste de busca com cursor avançado (não deve encontrar palavras antes do cursor)
const matchSeIgnored = findWordSequenceIndex(mockBoundaries, ['se', 'voce'], 3);
assert(matchSeIgnored === null, 'Cursor respeitado: não encontra "se você" antes do índice 3');

// -------------------------------------------------------------
// Test 3: L-Cut e Cálculo de Timestamps de Transição
// -------------------------------------------------------------
console.log('\n[3/5] Testando L-Cut Cinematográfico e Pausas de Fala:');
// Transição no índice 5 ("Existe", após pausa de 650ms entre 1550ms e 2200ms)
const cutExiste = calculateSceneCutTimestamp(mockBoundaries, 5);
// Deve cortar 100ms antes de 2200ms = 2100ms, preservando > 1550ms
assert(cutExiste >= 1550, `Corte (${cutExiste}ms) não corta cauda da palavra anterior (1550ms)`);
assert(cutExiste <= 2200, `Corte (${cutExiste}ms) antecede o início da nova fala (2200ms)`);
assert(cutExiste === 2100, `L-Cut cinematográfico exato a 2100ms (100ms pré-roll)`);

// Teste de Pausa Natural (Speech Pause Snap)
const pauseCut = findOptimalPauseCut(mockBoundaries, 2000, 1000, 3000);
assert(pauseCut >= 1550 && pauseCut <= 2200, `Pausa detectada com precisão no gap de fala: ${pauseCut}ms`);

// -------------------------------------------------------------
// Test 4: Alinhamento Completo de Cenas com Frases
// -------------------------------------------------------------
console.log('\n[4/5] Testando Alinhamento Completo de Roteiro (alignScenesWithWordBoundaries):');
const testScenes = [
  {
    id: 1,
    duration: 5,
    phrase: 'Se você desconfia de alguém.',
    prompt: 'Prompt Cena 1'
  },
  {
    id: 2,
    duration: 10,
    phrase: 'Existe um truque poderoso.',
    prompt: 'Prompt Cena 2'
  },
  {
    id: 3,
    duration: 10,
    phrase: 'O silêncio absoluto.',
    prompt: 'Prompt Cena 3'
  }
];

const totalAudioSec = 6.0; // 6.00 segundos total
const aligned = alignScenesWithWordBoundaries({
  scenes: testScenes,
  wordBoundaries: mockBoundaries,
  totalDurationSeconds: totalAudioSec,
  narrationText: 'Se você desconfia de alguém. Existe um truque poderoso. O silêncio absoluto.'
});

assert(aligned.length === 3, `Retornou 3 cenas (recebeu: ${aligned.length})`);
assert(aligned[0].startTime === 0.0, `Invariante 1: Primeira cena inicia exatamente em 0.00s (obteve: ${aligned[0].startTime})`);
assert(aligned[2].endTime === totalAudioSec, `Invariante 2: Última cena termina exatamente em ${totalAudioSec}s (obteve: ${aligned[2].endTime})`);

const sumDurations = Number(aligned.reduce((acc, s) => acc + s.duration, 0).toFixed(2));
assert(sumDurations === totalAudioSec, `Invariante 3: Soma das durações (${sumDurations}s) é matematicamente igual a ${totalAudioSec}s`);

assert(aligned[0].alignmentType === 'audio_start', 'Cena 1 marcada como audio_start');
assert(aligned[1].alignmentType === 'word_boundary_phrase_match', `Cena 2 alinhada por correspondência fonética ("${aligned[1].matchedWord}")`);
assert(aligned[2].alignmentType === 'word_boundary_phrase_match', `Cena 3 alinhada por correspondência fonética ("${aligned[2].matchedWord}")`);

// Continuidade perfeita entre as cenas (sem gaps ou sobreposições)
assert(aligned[0].endTime === aligned[1].startTime, `Continuidade C1->C2 perfeita: ${aligned[0].endTime}s === ${aligned[1].startTime}s`);
assert(aligned[1].endTime === aligned[2].startTime, `Continuidade C2->C3 perfeita: ${aligned[1].endTime}s === ${aligned[2].startTime}s`);

// -------------------------------------------------------------
// Test 5: Casos Limites e Resiliência (Fallbacks)
// -------------------------------------------------------------
console.log('\n[5/5] Testando Resiliência e Casos Limite:');

// Fallback sem wordBoundaries
const fallbackNoBoundaries = alignScenesWithWordBoundaries({
  scenes: testScenes,
  wordBoundaries: [],
  totalDurationSeconds: 15.0
});
const sumFallback = Number(fallbackNoBoundaries.reduce((acc, s) => acc + s.duration, 0).toFixed(2));
assert(fallbackNoBoundaries.length === 3, 'Fallback sem boundaries processa 3 cenas');
assert(sumFallback === 15.0, `Soma no fallback (${sumFallback}s) fecha exatamente em 15.0s`);

// Cenas sem propriedade phrase (snapping para pausas naturais)
const scenesWithoutPhrase = [
  { id: 1, duration: 2, prompt: 'Sem frase 1' },
  { id: 2, duration: 4, prompt: 'Sem frase 2' }
];
const pauseSnapped = alignScenesWithWordBoundaries({
  scenes: scenesWithoutPhrase,
  wordBoundaries: mockBoundaries,
  totalDurationSeconds: totalAudioSec
});
assert(pauseSnapped.length === 2, 'Processou cenas sem frase');
assert(pauseSnapped[1].alignmentType === 'speech_pause_snap', 'Cena sem frase utilizou speech_pause_snap');
assert(Number((pauseSnapped[0].duration + pauseSnapped[1].duration).toFixed(2)) === totalAudioSec, 'Soma fecha com perfeição');

// Caso de 1 única cena
const singleScene = alignScenesWithWordBoundaries({
  scenes: [{ id: 1, duration: 5 }],
  wordBoundaries: mockBoundaries,
  totalDurationSeconds: 7.5
});
assert(singleScene[0].duration === 7.5, 'Cena única assume duração total');
assert(singleScene[0].startTime === 0 && singleScene[0].endTime === 7.5, 'Cena única cobre 0 a 7.5s');

console.log('\n===============================================================');
console.log(`RESULTADO DOS TESTES: ${passed} passaram, ${failed} falharam.`);
console.log('===============================================================');

if (failed > 0) {
  process.exit(1);
}
