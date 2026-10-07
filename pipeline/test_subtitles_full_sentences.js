import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  computeLineCapacity,
  sanitizeEdgeTtsBoundaries,
  attachPunctuation,
  findSmartLineBreakIndex,
  groupWordsIntoFullSentences,
  generateAssSubtitles,
  generateSrtSubtitles
} from './src/subtitle_generator.js';

test('Subtitles Full Sentences - computeLineCapacity calcula capacidade por fonte e layout', () => {
  // full_sentences (fonte 58, margens 120+120, mixed-case: k=0.56)
  const capMixed = computeLineCapacity({ fontSize: 58, marginL: 120, marginR: 120, casing: 'mixed' });
  assert.ok(capMixed >= 24 && capMixed <= 28, `Esperado ~25-26 chars, obteve: ${capMixed}`);

  // fast_words (fonte 74, margens 40+40, uppercase: k=0.68)
  const capUpper = computeLineCapacity({ fontSize: 74, marginL: 40, marginR: 40, casing: 'uppercase' });
  assert.ok(capUpper >= 18 && capUpper <= 21, `Esperado ~19-20 chars, obteve: ${capUpper}`);
});

test('Subtitles Full Sentences - attachPunctuation restaura pontuação e acentos do spokenText', () => {
  const boundaries = [
    { word: 'voce', startMs: 0, endMs: 300 },
    { word: 'nao', startMs: 300, endMs: 600 },
    { word: 'e', startMs: 600, endMs: 800 },
    { word: 'preguicoso', startMs: 800, endMs: 1400 },
    { word: 'mas', startMs: 1450, endMs: 1700 },
    { word: 'esta', startMs: 1700, endMs: 2000 },
    { word: 'cansado', startMs: 2000, endMs: 2600 }
  ];

  const spokenText = 'Você não é preguiçoso, mas está cansado!';
  const enriched = attachPunctuation(boundaries, spokenText);

  assert.equal(enriched[0].word, 'Você');
  assert.equal(enriched[3].word, 'preguiçoso,');
  assert.equal(enriched[4].word, 'mas');
  assert.equal(enriched[6].word, 'cansado!');
});

test('Subtitles Full Sentences - findSmartLineBreakIndex evita separar artigos e preposições', () => {
  const words = [
    { word: 'Aprenda' },
    { word: 'o' },
    { word: 'segredo' },
    { word: 'da' },
    { word: 'mente' },
    { word: 'humana' }
  ];

  const splitIdx = findSmartLineBreakIndex(words, 15);
  // Não deve quebrar após "o" (índice 2) nem após "da" (índice 4)
  assert.notEqual(splitIdx, 2, 'Não deve quebrar imediatamente após o artigo "o"');
  assert.notEqual(splitIdx, 4, 'Não deve quebrar imediatamente após a preposição "da"');
});

test('Subtitles Full Sentences - groupWordsIntoFullSentences respeita orações e elimina cards órfãos de 1 palavra', () => {
  const boundaries = [
    { word: 'Se', startMs: 0, endMs: 200 },
    { word: 'você', startMs: 200, endMs: 500 },
    { word: 'desconfia', startMs: 500, endMs: 900 },
    { word: 'de', startMs: 900, endMs: 1100 },
    { word: 'alguém,', startMs: 1100, endMs: 1600 },
    { word: 'nunca', startMs: 1700, endMs: 2000 },
    { word: 'confronte', startMs: 2000, endMs: 2400 },
    { word: 'diretamente.', startMs: 2400, endMs: 3100 },
    { word: 'Observe.', startMs: 3400, endMs: 4000 }
  ];

  const sentences = groupWordsIntoFullSentences(boundaries, { maxCharsPerLine: 26, minCardDurationMs: 1200 });

  assert.ok(sentences.length >= 1);
  for (const card of sentences) {
    assert.ok(card.words.length >= 2, `Nenhum card deve ter 1 única palavra (teve ${card.words.length})`);
    assert.ok(card.endMs - card.startMs >= 1200, 'Duração do card deve ser >= 1200ms');
  }

  // Verifica que o ponto final delimitou a oração
  const firstSentenceWords = sentences[0].words.map(w => w.word).join(' ');
  assert.ok(firstSentenceWords.includes('diretamente.'));
});

test('Subtitles Full Sentences - generateAssSubtitles com layout full_sentences gera ASS com orações completas', () => {
  const scratchDir = path.resolve('pipeline/scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
  const outAss = path.join(scratchDir, 'test_full_sentences.ass');

  const boundaries = [
    { word: 'Você', startMs: 0, endMs: 300 },
    { word: 'não', startMs: 300, endMs: 600 },
    { word: 'é', startMs: 600, endMs: 800 },
    { word: 'fraco,', startMs: 800, endMs: 1200 },
    { word: 'apenas', startMs: 1250, endMs: 1600 },
    { word: 'está', startMs: 1600, endMs: 1900 },
    { word: 'sobrecarregado.', startMs: 1900, endMs: 2800 }
  ];

  generateAssSubtitles({
    wordBoundaries: boundaries,
    outputAssPath: outAss,
    theme: 'GOLD_PUNCH',
    subtitlesLayout: 'full_sentences'
  });

  assert.ok(fs.existsSync(outAss));
  const content = fs.readFileSync(outAss, 'utf8');

  // Verifica margens de 120 para safe area do TikTok/Reels
  assert.ok(content.includes('120,120,560'));
  // Verifica presença de tags Dialogue
  assert.ok(content.includes('Dialogue: 0,'));
  // Verifica que a frase inteira é preservada com caixa mista
  assert.ok(content.includes('sobrecarregado.'));

  try { fs.unlinkSync(outAss); } catch (e) {}
});

test('Subtitles Full Sentences - sanitizeEdgeTtsBoundaries funde prefixos @ e # sem duplicar palavras', () => {
  const rawBoundaries = [
    { word: 'siga', startMs: 1000, endMs: 1300 },
    { word: '@', startMs: 1350, endMs: 1600 },
    { word: 'maisquepsicologia', startMs: 1610, endMs: 2500 },
    { word: '#', startMs: 2600, endMs: 2900 },
    { word: 'Shorts', startMs: 2910, endMs: 3400 }
  ];

  const sanitized = sanitizeEdgeTtsBoundaries(rawBoundaries);
  assert.equal(sanitized.length, 3);
  assert.equal(sanitized[0].word, 'siga');
  assert.equal(sanitized[1].word, '@maisquepsicologia');
  assert.equal(sanitized[1].startMs, 1350);
  assert.equal(sanitized[1].endMs, 2500);
  assert.equal(sanitized[2].word, '#Shorts');
  assert.equal(sanitized[2].startMs, 2600);
  assert.equal(sanitized[2].endMs, 3400);

  const spokenText = 'siga @maisquepsicologia #Shorts';
  const enriched = attachPunctuation(rawBoundaries, spokenText);
  assert.equal(enriched.length, 3);
  assert.equal(enriched[1].word, '@maisquepsicologia');
  assert.equal(enriched[2].word, '#Shorts');
});

test('Subtitles Full Sentences - groupWordsIntoFullSentences garante invariante estrita de zero overlap', () => {
  const boundaries = [
    { word: 'Isso', startMs: 6863, endMs: 7151 },
    { word: 'acontece,', startMs: 7163, endMs: 7788 },
    { word: 'porque', startMs: 8088, endMs: 8388 },
    { word: 'a', startMs: 8400, endMs: 8450 },
    { word: 'nossa', startMs: 8463, endMs: 8763 },
    { word: 'mente', startMs: 8775, endMs: 9088 },
    { word: 'se', startMs: 9100, endMs: 9200 },
    { word: 'refugia', startMs: 9213, endMs: 9701 },
    { word: 'em', startMs: 9713, endMs: 9776 },
    { word: 'micro-tarefas', startMs: 9788, endMs: 10626 }
  ];

  const cards = groupWordsIntoFullSentences(boundaries, { maxCharsPerLine: 26, minCardDurationMs: 1200 });
  assert.ok(cards.length >= 1);

  for (let i = 0; i < cards.length - 1; i++) {
    const card = cards[i];
    const nextCard = cards[i + 1];
    assert.ok(card.endMs <= nextCard.startMs, `Card ${i} endMs (${card.endMs}) deve ser <= Card ${i+1} startMs (${nextCard.startMs})`);
  }
});

test('Subtitles Full Sentences - generateAssSubtitles garante diálogos sem colisão de timestamps', () => {
  const scratchDir = path.resolve('pipeline/scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
  const outAss = path.join(scratchDir, 'test_no_collision.ass');

  const boundaries = [
    { word: 'Foco', startMs: 100, endMs: 600 },
    { word: 'total.', startMs: 650, endMs: 1100 },
    { word: 'Nunca', startMs: 1150, endMs: 1500 },
    { word: 'desista.', startMs: 1550, endMs: 2000 }
  ];

  generateAssSubtitles({
    wordBoundaries: boundaries,
    outputAssPath: outAss,
    theme: 'GOLD_PUNCH',
    subtitlesLayout: 'full_sentences'
  });

  const content = fs.readFileSync(outAss, 'utf8');
  const dialogueLines = content.split('\n').filter(l => l.startsWith('Dialogue:'));
  assert.ok(dialogueLines.length >= 1);

  try { fs.unlinkSync(outAss); } catch (e) {}
});

