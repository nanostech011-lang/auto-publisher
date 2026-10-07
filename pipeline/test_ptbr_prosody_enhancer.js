import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanPtBrTranscriptText,
  repairMojibake,
  expandPtBrAbbreviations,
  insertProsodicPunctuation,
  clampRate,
  getBlockRate,
  enhancePtBrProsody,
  segmentForSynthesis
} from './src/ptbr_prosody_enhancer.js';

test('PT-BR Prosody - cleanPtBrTranscriptText decodifica HTML e preserva acentos', () => {
  const dirty = 'Voc&ecirc; n&atilde;o est&aacute; prestando aten&ccedil;&atilde;o &#39;amigo&#39; &amp; &eacute; crucial.';
  const cleaned = cleanPtBrTranscriptText(dirty);
  assert.equal(cleaned, "Você não está prestando atenção 'amigo' & é crucial.");
});

test('PT-BR Prosody - repairMojibake corrige corrupções comuns de UTF-8', () => {
  const mojibake = 'Voc\u00c3\u00aa tem sua pr\u00c3\u00b3pria aten\u00c3\u00a7\u00c3\u00a3o e rea\u00c3\u00a7\u00c3\u00a3o \u00c3\u00a0s regras.';
  const fixed = repairMojibake(mojibake);
  assert.equal(fixed, 'Você tem sua própria atenção e reação às regras.');
});

test('PT-BR Prosody - expandPtBrAbbreviations expande abreviações e símbolos informais', () => {
  const text = 'Vc sabia q 10% das pessoas pensam msm nisso? Pq vc não tenta tb? Veja o nº 1 & lucre R$ 100.';
  const expanded = expandPtBrAbbreviations(text);
  assert.ok(expanded.includes('Você'));
  assert.ok(expanded.includes('10 por cento'));
  assert.ok(expanded.includes('mesmo'));
  assert.ok(expanded.includes('Porque'));
  assert.ok(expanded.includes('você'));
  assert.ok(expanded.includes('também'));
  assert.ok(expanded.includes('número 1'));
  assert.ok(expanded.includes(' e '));
  assert.ok(expanded.includes('100 reais'));
});

test('PT-BR Prosody - insertProsodicPunctuation insere vírgulas antes de conjunções preservando ? e !', () => {
  const text = 'Ele tentou mas não conseguiu porque faltou foco! Você entendeu? Claro que sim porém foi difícil.';
  const punctuated = insertProsodicPunctuation(text);
  assert.ok(punctuated.includes('tentou, mas'));
  assert.ok(punctuated.includes('conseguiu, porque'));
  assert.ok(punctuated.includes('foco!'));
  assert.ok(punctuated.includes('entendeu?'));
  assert.ok(punctuated.includes('sim, porém'));
});

test('PT-BR Prosody - clampRate limita taxa de fala a [-6%, +4%] (Decisão D6)', () => {
  assert.equal(clampRate('+12%'), '+4%');
  assert.equal(clampRate('+10%'), '+4%');
  assert.equal(clampRate('+4%'), '+4%');
  assert.equal(clampRate('+2%'), '+2%');
  assert.equal(clampRate('+0%'), '+0%');
  assert.equal(clampRate('-4%'), '-4%');
  assert.equal(clampRate('-6%'), '-6%');
  assert.equal(clampRate('-10%'), '-6%');
  assert.equal(clampRate(null), '+0%');
});

test('PT-BR Prosody - getBlockRate calcula taxas dinâmicas por bloco respeitando o teto', () => {
  // Base 0%
  assert.equal(getBlockRate('+0%', 'hook'), '+3%');
  assert.equal(getBlockRate('+0%', 'science'), '+0%');
  assert.equal(getBlockRate('+0%', 'hack'), '-2%');
  assert.equal(getBlockRate('+0%', 'cta'), '+1%');

  // Base +4%: hook fica no teto de +4%
  assert.equal(getBlockRate('+4%', 'hook'), '+4%');
  assert.equal(getBlockRate('+4%', 'hack'), '+2%');
});

test('PT-BR Prosody - enhancePtBrProsody normaliza e enriquece o texto completo', () => {
  const raw = '  &quot;Vc&quot; precisa de aten&ccedil;&atilde;o pq 50% &eacute; treino! ';
  const enhanced = enhancePtBrProsody(raw);
  assert.equal(enhanced, '"Você" precisa de atenção, porque 50 por cento é treino!');
});

test('PT-BR Prosody - segmentForSynthesis divide em blocos estruturados com metadados de pausa', () => {
  const blocks = {
    hookText: 'Você comete este erro todo dia.',
    scienceText: 'Seu cérebro busca atalhos rápidos.',
    hackText: 'Use a regra dos cinco segundos.',
    ctaText: 'Siga para mais insights.'
  };

  const segments = segmentForSynthesis('texto corrido', blocks);
  assert.equal(segments.length, 4);
  assert.equal(segments[0].blockType, 'hook');
  assert.equal(segments[0].pauseAfterMs, 400);
  assert.equal(segments[1].blockType, 'science');
  assert.equal(segments[2].blockType, 'hack');
  assert.equal(segments[3].blockType, 'cta');
});
