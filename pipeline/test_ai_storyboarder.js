import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHYSICAL_ARCHETYPES,
  buildLayerAWorldProfile,
  buildTwoLayerPrompt,
  matchPhysicalArchetype,
  getSubTakeFramingVariation,
  generateStoryboardHeuristic,
  generateDynamicStoryboard
} from './src/ai_storyboarder.js';

test('AI Storyboarder - Catálogo Semântico possui mais de 40 arquétipos físicos completos', () => {
  assert.ok(PHYSICAL_ARCHETYPES.length >= 40, `Esperado >= 40 arquétipos, encontrou: ${PHYSICAL_ARCHETYPES.length}`);

  for (const arch of PHYSICAL_ARCHETYPES) {
    assert.ok(arch.id, 'Arquétipo deve ter ID');
    assert.ok(Array.isArray(arch.keywords) && arch.keywords.length > 0, `Arquétipo ${arch.id} deve ter palavras-chave`);
    assert.ok(arch.visualIntent, `Arquétipo ${arch.id} deve ter visualIntent`);
    assert.ok(arch.framing, `Arquétipo ${arch.id} deve ter framing`);
    assert.ok(arch.cameraMotion, `Arquétipo ${arch.id} deve ter cameraMotion`);
    assert.ok(Array.isArray(arch.stockQueries) && arch.stockQueries.length >= 2, `Arquétipo ${arch.id} deve ter ao menos 2 stockQueries`);
    assert.ok(arch.actionSubject, `Arquétipo ${arch.id} deve ter actionSubject`);
    assert.ok(arch.subjectType, `Arquétipo ${arch.id} deve ter subjectType`);
  }
});

test('AI Storyboarder - buildLayerAWorldProfile gera perfis cinematográficos consistentes', () => {
  const profileDark = buildLayerAWorldProfile({ visual_profile: { aesthetic: 'Dark Minimalist Chiaroscuro' } });
  assert.equal(profileDark.styleName, 'REALISTIC_DOCUMENTARY');
  assert.ok(profileDark.cleanRules.includes('no text'));
  assert.ok(profileDark.cleanRules.includes('9:16'));

  const profileAnime = buildLayerAWorldProfile({}, 'Dark Shonen Anime Ufotable');
  assert.equal(profileAnime.styleName, 'ANIME_SHONEN');

  const profileGhibli = buildLayerAWorldProfile({}, 'Studio Ghibli Cozy Fantasy');
  assert.equal(profileGhibli.styleName, 'GHIBLI_COZY_FANTASY');

  const profileStoic = buildLayerAWorldProfile({}, 'Marcus Aurelius Estoicismo');
  assert.equal(profileStoic.styleName, 'STOIC_STATUE');
});

test('AI Storyboarder - buildTwoLayerPrompt monta composição sem texto e 9:16', () => {
  const layerA = buildLayerAWorldProfile();
  const layerB = {
    actionSubject: 'tired person lying in dark room scrolling glowing smartphone screen',
    framing: 'close_up',
    visualIntent: 'Pessoa rolando feed no escuro'
  };

  const prompt = buildTwoLayerPrompt({ layerA, layerB });
  assert.ok(prompt.includes('tired person lying in dark room'));
  assert.ok(prompt.includes('close up composition'));
  assert.ok(prompt.includes('vertical 9:16'));
  assert.ok(prompt.includes('no text'));
  assert.ok(prompt.includes('no watermark'));
});

test('AI Storyboarder - matchPhysicalArchetype conecta termos em português com ações físicas tangíveis', () => {
  const used = new Set();
  
  const p1 = matchPhysicalArchetype('Você já percebeu como é fácil perder horas rolando o feed do celular?', '', 0, used);
  assert.ok(p1.id === 'phone_doomscrolling' || p1.id === 'phone_notifications', `Esperado celular, obteve: ${p1.id}`);

  const p2 = matchPhysicalArchetype('O tempo está escorrendo pelos seus dedos como grãos de areia.', '', 1, used);
  assert.ok(p2.id === 'hourglass_flowing' || p2.id === 'clock_ticking_shadows', `Esperado ampulheta/relógio, obteve: ${p2.id}`);

  const p3 = matchPhysicalArchetype('Amarre o tênis e dê o primeiro passo mesmo sem vontade.', '', 2, used);
  assert.equal(p3.id, 'tying_running_shoes');

  const p4 = matchPhysicalArchetype('A cafeína daquela xícara quente desperta sua atenção.', '', 3, used);
  assert.equal(p4.id, 'pouring_black_coffee');
});

test('AI Storyboarder - getSubTakeFramingVariation alterna ângulos de câmera', () => {
  assert.equal(getSubTakeFramingVariation(0, 'medium_shot'), 'medium_shot');
  assert.equal(getSubTakeFramingVariation(1, 'medium_shot'), 'close_up');
  assert.equal(getSubTakeFramingVariation(2, 'medium_shot'), 'extreme_close_up');
});

test('AI Storyboarder - generateStoryboardHeuristic enriquece tomadas com anti-repetição', () => {
  const mockTakes = [
    { id: '1_take_1', phrase: 'Você passa horas no celular à noite.', duration: 3.0, isSubTake: false, subTakeIndex: 0 },
    { id: '1_take_2', phrase: 'e as notificações não param de apitar.', duration: 2.8, isSubTake: true, subTakeIndex: 1 },
    { id: '2_take_1', phrase: 'A ampulheta do seu tempo está se esgotando.', duration: 3.2, isSubTake: false, subTakeIndex: 0 },
    { id: '3_take_1', phrase: 'O segredo é amarrar o tênis e começar pelos primeiros 5 minutos.', duration: 3.5, isSubTake: false, subTakeIndex: 0 }
  ];

  const storyboard = generateStoryboardHeuristic({
    takes: mockTakes,
    channelProfile: { visual_profile: { aesthetic: 'Dark Minimalist Chiaroscuro' } },
    topic: 'Como Vencer o Vício em Telas'
  });

  assert.equal(storyboard.length, mockTakes.length);

  // Sub-take 2 deve ter framing diferente do sub-take 1
  assert.notEqual(storyboard[0].framing, storyboard[1].framing, 'Sub-takes devem variar enquadramento');

  // Cada take deve possuir stockQueries preenchidas
  for (const take of storyboard) {
    assert.ok(Array.isArray(take.stockQueries) && take.stockQueries.length >= 2, 'Take deve ter stockQueries');
    assert.ok(take.aiPrompt.length > 50, 'aiPrompt deve ter tamanho descritivo');
    assert.ok(take.visualIntent.length > 10, 'visualIntent deve ser descritivo');
    assert.ok(take.subjectType, 'subjectType deve estar preenchido');
  }

  // Verifica que não repetiu o mesmo arquétipo entre tomadas distintas
  const archetypeIds = storyboard.map(s => s.archetypeId);
  const uniqueArchetypeIds = new Set(archetypeIds);
  assert.equal(uniqueArchetypeIds.size, archetypeIds.length, 'Arquétipos não devem se repetir');
});

test('AI Storyboarder - generateDynamicStoryboard opera graciosamente sem credenciais externas', async () => {
  const mockTakes = [
    { id: '1', phrase: 'Primeira frase de teste de foco.', duration: 2.5 }
  ];

  const result = await generateDynamicStoryboard({
    takes: mockTakes,
    channelProfile: {},
    geminiKey: null,
    topic: 'Foco e Autodomínio'
  });

  assert.equal(result.length, 1);
  assert.ok(result[0].visualIntent);
  assert.ok(result[0].stockQueries.length > 0);
  assert.ok(result[0].aiPrompt);
});
