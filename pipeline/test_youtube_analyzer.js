import test from 'node:test';
import assert from 'node:assert';
import { extractYouTubeVideoId, truncateWords, extractConceptualSummary } from './src/youtube_analyzer.js';

test('Testes unitarios do YouTube Analyzer', async (t) => {
  await t.test('extractYouTubeVideoId deve extrair ID de variados formatos de URL', () => {
    assert.strictEqual(extractYouTubeVideoId('https://www.youtube.com/watch?v=jr796x0sFfg'), 'jr796x0sFfg');
    assert.strictEqual(extractYouTubeVideoId('https://youtu.be/jr796x0sFfg'), 'jr796x0sFfg');
    assert.strictEqual(extractYouTubeVideoId('https://www.youtube.com/shorts/jr796x0sFfg'), 'jr796x0sFfg');
    assert.strictEqual(extractYouTubeVideoId('jr796x0sFfg'), 'jr796x0sFfg');
    assert.strictEqual(extractYouTubeVideoId('not-a-valid-youtube-url'), null);
    assert.strictEqual(extractYouTubeVideoId(''), null);
    assert.strictEqual(extractYouTubeVideoId(null), null);
  });

  await t.test('truncateWords deve preservar palavras inteiras sem cortar no meio', () => {
    const text = 'Esse livro explica por que você toma decisões ruins sem perceber';
    const truncated = truncateWords(text, 55);
    assert.strictEqual(truncated, 'Esse livro explica por que você toma decisões ruins');
    assert.ok(truncated.length <= 55);
    assert.strictEqual(truncateWords('Palavra', 10), 'Palavra');
  });

  await t.test('extractConceptualSummary deve detectar Rápido e Devagar e sintetizar 4 blocos de retenção', () => {
    const transcript = 'Esse livro aqui é Rápido e devagar Daniel Canima. Decisões do Sistema 1 e Sistema 2.';
    const title = 'Esse livro explica por que você toma decisões ruins sem perceber';
    const summary = extractConceptualSummary(transcript, title, 'Quem Lê Enriquece', '@psicosegredo');

    assert.ok(summary.hookText.includes('decisões'));
    assert.ok(summary.scienceText.includes('Sistema 1') && summary.scienceText.includes('Sistema 2'));
    assert.ok(summary.hackText.includes('pausa de dez segundos'));
    assert.ok(summary.ctaText.includes('@psicosegredo'));

    const fullNarration = `${summary.hookText} ${summary.scienceText} ${summary.hackText} ${summary.ctaText}`;
    const wordCount = fullNarration.trim().split(/\s+/).length;
    assert.ok(wordCount >= 145, `Contagem de palavras deve ser >= 145 para elegibilidade (obteve: ${wordCount})`);
  });

  await t.test('cleanPtBrTranscriptText deve decodificar entidades HTML e preservar acentuação completa em PT-BR', async () => {
    const { cleanPtBrTranscriptText } = await import('./src/youtube_analyzer.js');
    const dirty = 'Voc&ecirc; n&atilde;o est&aacute; prestando aten&ccedil;&atilde;o &#39;amigo&#39; &amp; &eacute; crucial.';
    const cleaned = cleanPtBrTranscriptText(dirty);
    assert.strictEqual(cleaned, "Você não está prestando atenção 'amigo' & é crucial.");
  });
});
