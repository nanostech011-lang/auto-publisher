import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { translateDirectiveToCinematicEnglish, buildProfessionalScenePrompt, deriveVisualSubjectFromPhrase } from './src/ai_prompt_generator.js';
import { generateHighQualitySceneImage } from './src/ai_image_connector.js';

test('translateDirectiveToCinematicEnglish deve traduzir e enriquecer termos em portugues', () => {
  const result = translateDirectiveToCinematicEnglish('guerreiros persas com armaduras douradas');
  assert.ok(result.toLowerCase().includes('persian'), 'Deve conter termo persa em ingles');
  assert.ok(result.toLowerCase().includes('armor'), 'Deve conter armor em ingles');
  assert.ok(result.toLowerCase().includes('with'), 'Deve traduzir preposição "com" para "with"');
});

test('translateDirectiveToCinematicEnglish deve traduzir termos de neurociencia', () => {
  const result = translateDirectiveToCinematicEnglish('amígdala cerebral com sinapses elétricas');
  assert.ok(result.toLowerCase().includes('amygdala'), 'Deve conter amygdala em ingles');
  assert.ok(result.toLowerCase().includes('synapses') || result.toLowerCase().includes('neural'), 'Deve conter termos de sinapses');
});

test('buildProfessionalScenePrompt deve estruturar prompt em 5 camadas cinematograficas 9:16', async () => {
  const prompt = await buildProfessionalScenePrompt({
    spokenPhrase: 'O silêncio sob controle sempre entrega mais poder',
    visualDirective: 'guerreiros persas com armaduras douradas',
    channelAesthetic: 'Cinematic Dark Minimalist',
    blockType: 'hook',
    forceHeuristic: true
  });

  assert.ok(prompt.includes('9:16'), 'Prompt deve especificar formato vertical 9:16');
  assert.ok(prompt.toLowerCase().includes('chiaroscuro'), 'Prompt deve especificar iluminação chiaroscuro');
  assert.ok(prompt.toLowerCase().includes('arri alexa') || prompt.toLowerCase().includes('lens'), 'Prompt deve conter especificações de câmera/lente');
  assert.ok(prompt.toLowerCase().includes('no text') && prompt.toLowerCase().includes('no watermark'), 'Prompt deve conter negative prompt tags');
});

test('buildProfessionalScenePrompt deve gerar prompt no estilo Anime Shonen quando diretriz solicitar', async () => {
  const prompt = await buildProfessionalScenePrompt({
    spokenPhrase: 'Os limites só existem se você os deixar existir',
    visualDirective: 'Anime dark motivacional estilo Ufotable, guerreiro superando limites, traço mangá épico',
    channelAesthetic: 'Dark Shonen Motivation',
    blockType: 'hook',
    forceHeuristic: true
  });

  assert.ok(prompt.includes('9:16'), 'Prompt deve especificar formato vertical 9:16');
  assert.ok(prompt.toLowerCase().includes('anime') || prompt.toLowerCase().includes('manga'), 'Prompt deve conter anime/manga');
  assert.ok(prompt.toLowerCase().includes('ufotable') || prompt.toLowerCase().includes('cel-shading') || prompt.toLowerCase().includes('aura'), 'Prompt deve conter termos de anime');
  assert.ok(!prompt.toLowerCase().includes('photograph'), 'Prompt de anime nao deve conter fotografia real');
});

test('buildProfessionalScenePrompt deve gerar prompt no estilo Studio Ghibli e Medieval Lofi quando solicitado', async () => {
  const prompt = await buildProfessionalScenePrompt({
    spokenPhrase: 'Respire fundo e encontre a serenidade na floresta',
    visualDirective: 'Fantasia medieval relaxante estilo Studio Ghibli e Moebius, cavaleiro descansando na floresta',
    channelAesthetic: 'Medieval Lofi Peaceful Focus',
    blockType: 'hook',
    forceHeuristic: true
  });

  assert.ok(prompt.includes('9:16'), 'Prompt deve especificar formato vertical 9:16');
  assert.ok(prompt.toLowerCase().includes('ghibli') || prompt.toLowerCase().includes('moebius'), 'Prompt deve conter Ghibli ou Moebius');
  assert.ok(prompt.toLowerCase().includes('gouache') || prompt.toLowerCase().includes('komorebi') || prompt.toLowerCase().includes('wildflowers'), 'Prompt deve conter termos de gouache/natureza');
  assert.ok(!prompt.toLowerCase().includes('photograph'), 'Prompt de Ghibli nao deve conter fotografia real');
});

test('generateHighQualitySceneImage deve estar definido como função exportada', async () => {
  assert.equal(typeof generateHighQualitySceneImage, 'function');
});

test('generateHighQualitySceneImage deve lidar com chave invalida sem lancar excecao', async () => {
  const result = await generateHighQualitySceneImage({
    prompt: 'Short test prompt',
    outputPath: 'pipeline/scratch/test_invalid_key.jpg',
    apiKey: 'invalid_key_mock_123',
    seed: 99
  });

  // Nao deve lancar erro nao tratado: deve retornar objeto de fallback ou null de contingencia
  assert.ok(result === null || typeof result === 'object');
});

test('fetchAndPrepareStockBroll deve lidar com queries vazias ou chave ausente sem lancar excecao', async () => {
  const { fetchAndPrepareStockBroll } = await import('./src/stock_video_connector.js');
  const result = await fetchAndPrepareStockBroll({
    query: '',
    outputPath: 'pipeline/scratch/test_stock.mp4',
    durationSeconds: 3
  });

  assert.equal(result.success, false);
  assert.ok(result.error.includes('inválida') || result.error.includes('vazia'));
});

test('analyzeTranscriptWithGemini deve retornar null de forma graciosa sem chave valida', async () => {
  const { analyzeTranscriptWithGemini } = await import('./src/youtube_analyzer.js');
  const result = await analyzeTranscriptWithGemini({
    transcriptText: 'Teste de transcrição simples',
    baseTitle: 'Vídeo Teste',
    authorName: 'Autor Teste',
    apiKey: 'invalid_mock_gemini_key'
  });

  // Deve falhar graciosamente e retornar null para permitir o fallback
  assert.equal(result, null);
});

test('deriveVisualSubjectFromPhrase deve garantir zero repeticao de sujeitos entre cenas', () => {
  const subjectsGhibli = new Set();
  const subjectsAnime = new Set();
  const total = 8;

  for (let i = 0; i < total; i++) {
    const sGhibli = deriveVisualSubjectFromPhrase('Se tem que ganhar é agora', 'GHIBLI_COZY_FANTASY', null, i, total);
    const sAnime = deriveVisualSubjectFromPhrase('Superando todos os limites', 'ANIME_SHONEN', null, i, total);
    
    assert.ok(!subjectsGhibli.has(sGhibli), `Cena ${i} em Ghibli nao deve repetir sujeito anterior`);
    assert.ok(!subjectsAnime.has(sAnime), `Cena ${i} em Anime nao deve repetir sujeito anterior`);
    
    subjectsGhibli.add(sGhibli);
    subjectsAnime.add(sAnime);
  }

  assert.equal(subjectsGhibli.size, total, 'Todas as 8 cenas Ghibli devem ser estritamente unicas');
  assert.equal(subjectsAnime.size, total, 'Todas as 8 cenas Anime devem ser estritamente unicas');
});

test('detectSceneCinemagraphFX deve identificar micro-efeitos cinemagraph com precisao semantica', async () => {
  const { detectSceneCinemagraphFX } = await import('./src/visuals_harvester.js');

  assert.equal(detectSceneCinemagraphFX({ phrase: 'Ao redor da fogueira quente à noite' }), 'fire_embers');
  assert.equal(detectSceneCinemagraphFX({ phrase: 'Pequenos vagalumes flutuando no bosque' }), 'fireflies');
  assert.equal(detectSceneCinemagraphFX({ phrase: 'Olhando o céu estrelado e as constelações' }), 'twinkling_stars');
  assert.equal(detectSceneCinemagraphFX({ phrase: 'Raios de sol filtrados pelas árvores e pólen dourado' }), 'sunbeams_dust');
  assert.equal(detectSceneCinemagraphFX({ phrase: 'Aura de energia brilhante e faíscas de ki', aesthetic: 'ANIME_SHONEN' }), 'anime_aura_sparks');
});

test('detectSceneCinemagraphFX deve garantir alternancia e zero repeticao consecutiva', async () => {
  const { detectSceneCinemagraphFX } = await import('./src/visuals_harvester.js');

  let lastFX = null;
  const effectsSequence = [];

  for (let i = 0; i < 8; i++) {
    const fx = detectSceneCinemagraphFX({
      aesthetic: 'GHIBLI_COZY_FANTASY',
      sceneIndex: i,
      totalScenes: 8,
      lastFX
    });

    if (lastFX !== null) {
      assert.notEqual(fx, lastFX, `Cena ${i} (${fx}) nao deve ser identica a cena anterior (${lastFX})`);
    }

    effectsSequence.push(fx);
    lastFX = fx;
  }

  assert.equal(effectsSequence.length, 8);
  const uniqueFX = new Set(effectsSequence);
  assert.ok(uniqueFX.size >= 3, 'Deve conter pelo menos 3 tipos distintos de efeitos ao longo do vídeo');
});

test('buildCinemagraphAtmosphericFilters deve retornar filtros com drawtext e eq funcionais', async () => {
  const { buildCinemagraphAtmosphericFilters } = await import('./src/visuals_harvester.js');

  const fireFilters = buildCinemagraphAtmosphericFilters({ fxType: 'fire_embers', durationSeconds: 4 });
  assert.ok(fireFilters.some(f => f.includes('drawtext')), 'Deve conter drawtext para faíscas/brasas');
  assert.ok(fireFilters.some(f => f.includes('eq=contrast')), 'Deve modular contraste/luz da fogueira');

  const firefliesFilters = buildCinemagraphAtmosphericFilters({ fxType: 'fireflies', durationSeconds: 4 });
  assert.ok(firefliesFilters.some(f => f.includes('drawtext')), 'Deve conter drawtext para orbes de vagalumes');

  const starsFilters = buildCinemagraphAtmosphericFilters({ fxType: 'twinkling_stars', durationSeconds: 4 });
  assert.ok(starsFilters.some(f => f.includes('drawtext')), 'Deve conter drawtext para estrelas cintilantes');
});

test('translateStockQueryToEnglish deve mapear termos comuns em portugues para ingles', async () => {
  const { translateStockQueryToEnglish } = await import('./src/stock_video_connector.js');

  const t1 = translateStockQueryToEnglish('homem pensativo no escritório');
  assert.ok(t1.includes('man') && t1.includes('thoughtful') && t1.includes('office'), 'Deve traduzir homem, pensativo e escritório');

  const t2 = translateStockQueryToEnglish('estátua antiga e filosofia');
  assert.ok(t2.includes('statue') && t2.includes('philosophy'), 'Deve traduzir estátua e filosofia');

  const t3 = translateStockQueryToEnglish('');
  assert.equal(t3, 'cinematic moody vertical');
});

test('generateAssSubtitles deve produzir tags de escala pop spring animada e temas customizaveis', async () => {
  const { generateAssSubtitles, SUBTITLE_THEMES, toAssInlineColor } = await import('./src/subtitle_generator.js');
  const tempAssPath = 'pipeline/scratch/test_subtitles_pop.ass';

  const wordBoundaries = [
    { word: 'Atenção', startMs: 0, endMs: 500 },
    { word: 'ao', startMs: 510, endMs: 700 },
    { word: 'detalhe', startMs: 710, endMs: 1200 }
  ];

  generateAssSubtitles({
    wordBoundaries,
    outputAssPath: tempAssPath,
    theme: 'GOLD_PUNCH',
    popAnimation: true
  });

  assert.ok(fs.existsSync(tempAssPath), 'Arquivo .ass deve existir');
  const content = fs.readFileSync(tempAssPath, 'utf8');

  // Verifica se o cabeçalho e estilo foram aplicados
  assert.ok(content.includes('PlayResX: 1080'), 'Resolução X 1080');
  assert.ok(content.includes('PlayResY: 1920'), 'Resolução Y 1920');

  // Verifica a presença do destaque por borda e blur (estabilidade visual sem reflow fscx)
  assert.ok(/\\bord\d+\\blur\d+/.test(content), 'Deve conter tag de borda e blur para destaque da palavra ativa');
  assert.ok(content.includes(toAssInlineColor ? toAssInlineColor(SUBTITLE_THEMES.GOLD_PUNCH.activeWordColor) : '&H00FFFF&') || content.includes(SUBTITLE_THEMES.GOLD_PUNCH.activeWordColor), 'Deve conter cor ativa do tema GOLD_PUNCH');
});

test('detectOptimalVideoEncoder deve retornar codec valido compativel', async () => {
  const { detectOptimalVideoEncoder } = await import('./src/video_compositor.js');
  const encoder = await detectOptimalVideoEncoder();

  assert.ok(encoder, 'Deve retornar objeto de encoder');
  assert.ok(typeof encoder.codec === 'string' && encoder.codec.length > 0, 'Codec deve ser string');
  assert.ok(['libx264', 'h264_nvenc', 'h264_qsv'].includes(encoder.codec), 'Codec deve ser um dos suportados');
});


