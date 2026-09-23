import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toAssInlineColor,
  groupWordsIntoChunks,
  generateAssSubtitles,
  SUBTITLE_THEMES
} from './src/subtitle_generator.js';
import {
  buildSmartContextualQueries,
  searchPexelsPhoto,
  fetchAndPrepareStockPhoto,
  translateStockQueryToEnglish
} from './src/stock_video_connector.js';
import fs from 'fs';
import path from 'path';

test('Subtitle Generator - toAssInlineColor formata cores corretamente para tags inline ASS', () => {
  // 8 dígitos (&HAABBGGRR) deve remover Alpha (AA) e manter 6 dígitos BBGGRR com ampersand final
  assert.equal(toAssInlineColor('&H0000D7FF'), '&H00D7FF&');
  assert.equal(toAssInlineColor('&H00FFFF00'), '&HFFFF00&');
  assert.equal(toAssInlineColor('&H0000FFFF'), '&H00FFFF&');
  assert.equal(toAssInlineColor('&H00FFFFFF'), '&HFFFFFF&');
  // 6 dígitos direto
  assert.equal(toAssInlineColor('&H00D7FF&'), '&H00D7FF&');
  assert.equal(toAssInlineColor('00FFFF'), '&H00FFFF&');
  // Valor nulo retorna branco
  assert.equal(toAssInlineColor(null), '&HFFFFFF&');
});

test('Subtitle Generator - groupWordsIntoChunks agrupa em blocos curtos de 3 palavras para retenção vertical', () => {
  const boundaries = [
    { word: 'Você', startMs: 0, endMs: 300 },
    { word: 'não', startMs: 300, endMs: 600 },
    { word: 'é', startMs: 600, endMs: 750 },
    { word: 'preguiçoso,', startMs: 750, endMs: 1400 },
    { word: 'seu', startMs: 1500, endMs: 1800 },
    { word: 'cérebro', startMs: 1800, endMs: 2200 },
    { word: 'apenas', startMs: 2200, endMs: 2500 }
  ];

  const chunks = groupWordsIntoChunks(boundaries, 3);
  assert.ok(chunks.length >= 2, 'Deve gerar pelo menos 2 chunks');
  assert.equal(chunks[0].words.length, 3, 'Primeiro chunk deve ter 3 palavras');
  assert.equal(chunks[0].words[0].word, 'Você');
  assert.equal(chunks[0].words[2].word, 'é');
});

test('Subtitle Generator - generateAssSubtitles gera tags ASS com ampersand e cores vibrantes', () => {
  const boundaries = [
    { word: 'Atenção', startMs: 100, endMs: 400 },
    { word: 'ao', startMs: 400, endMs: 450 },
    { word: 'detalhe', startMs: 550, endMs: 1100 }
  ];

  const outAss = path.resolve('pipeline/output/test_ass_output.ass');
  generateAssSubtitles({
    wordBoundaries: boundaries,
    outputAssPath: outAss,
    theme: 'GOLD_PUNCH',
    popAnimation: true
  });

  assert.ok(fs.existsSync(outAss), 'Arquivo .ass deve ser gerado');
  const content = fs.readFileSync(outAss, 'utf8');

  // Verifica que a cor ativa possui o ampersand obrigatório \1c&H00FFFF&
  assert.ok(content.includes('\\1c&H00FFFF&'), 'Deve conter tag da palavra ativa com ampersand');
  // Verifica que palavras inativas contêm \1c&HFFFFFF&
  assert.ok(content.includes('\\1c&HFFFFFF&'), 'Deve conter tag de palavra inativa');
  // Verifica a presença das linhas de diálogo
  assert.ok(content.includes('Dialogue: 0,'), 'Deve conter linhas de evento Dialogue');

  try { fs.unlinkSync(outAss); } catch (ignored) {}
});

test('Stock Connector - buildSmartContextualQueries gera termos contextuais com base na diretriz e frase', () => {
  // Teste 1: Diretriz de Guerreiros Persas
  const queriesPersa = buildSmartContextualQueries({
    phrase: 'Você não é preguiçoso, force o primeiro movimento.',
    visualDirective: 'Guerreiros Persas'
  });
  assert.ok(queriesPersa.some(q => q.includes('persian') || q.includes('warrior')), 'Deve conter query de guerreiro persa');

  // Teste 2: Tema de Procrastinação e Dopamina
  const queriesDopamina = buildSmartContextualQueries({
    phrase: 'A dopamina não é o neurotransmissor do prazer, mas sim da antecipação.',
    visualDirective: ''
  });
  assert.ok(queriesDopamina.some(q => q.includes('brain') || q.includes('dopamine')), 'Deve conter query de cérebro ou dopamina');

  // Teste 3: Tema de Estoicismo
  const queriesEstoico = buildSmartContextualQueries({
    phrase: 'Marco Aurélio escreveu que você tem poder sobre a sua mente.',
    visualDirective: ''
  });
  assert.ok(queriesEstoico.some(q => q.includes('stoic') || q.includes('statue')), 'Deve conter query de estoicismo/estátua');
});

test('Stock Connector - searchPexelsPhoto e fetchAndPrepareStockPhoto lidam com chave ausente graciosamente', async () => {
  const res = await searchPexelsPhoto({ query: 'calm', apiKey: '' });
  assert.equal(res.success, false);
  assert.ok(res.error.includes('PEXELS_API_KEY'));

  const fetchRes = await fetchAndPrepareStockPhoto({
    query: 'calm',
    candidateQueries: ['calm'],
    outputPath: '/tmp/test_nonexistent.jpg',
    pexelsApiKey: '',
    pixabayApiKey: ''
  });
  assert.equal(fetchRes.success, false);
});

test('Stock Connector - buildSmartContextualQueries mapeia disciplinas, ansiedade, tecnologia e rotina com precisão', () => {
  const queriesHabitos = buildSmartContextualQueries({
    phrase: 'A constância e a disciplina diária vencem o talento sem rotina.',
    visualDirective: ''
  });
  assert.ok(queriesHabitos.some(q => q.includes('athlete') || q.includes('routine') || q.includes('focused')), 'Deve conter query de disciplina ou rotina');

  const queriesAnsiedade = buildSmartContextualQueries({
    phrase: 'Respire fundo, acalme o seu medo e encontre a paz interior.',
    visualDirective: ''
  });
  assert.ok(queriesAnsiedade.some(q => q.includes('breathing') || q.includes('peaceful') || q.includes('calm')), 'Deve conter query de respiração/calma');

  const queriesTech = buildSmartContextualQueries({
    phrase: 'A inteligência artificial e a tecnologia mudaram as regras do jogo.',
    visualDirective: ''
  });
  assert.ok(queriesTech.some(q => q.includes('code') || q.includes('artificial') || q.includes('hacker')), 'Deve conter query de tecnologia/IA');

  const queriesSono = buildSmartContextualQueries({
    phrase: 'Acordar cedo na madrugada enquanto o mundo dorme.',
    visualDirective: ''
  });
  assert.ok(queriesSono.some(q => q.includes('waking') || q.includes('sleep') || q.includes('sunrise')), 'Deve conter query de despertar/madrugada');
});
