import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveDirectiveAnchors,
  buildAnchorQuery,
  isBlockedObject,
  filterBlockedObjects,
  BLOCKED_GENERIC_OBJECTS
} from './src/visual_directive.js';
import { buildSmartContextualQueries } from './src/stock_video_connector.js';

test('Visual Directive - deriveDirectiveAnchors extrai âncoras temáticas e lista de bloqueio', () => {
  const directive = 'Policiais em ação, Agentes de Segurança em ação, combate urbano, guerra, caveiras, soldados';
  const anchors = deriveDirectiveAnchors(directive);

  assert.equal(anchors.hasDirective, true);
  assert.ok(anchors.stockAnchorsEn.length >= 3);
  assert.ok(anchors.stockAnchorsEn.some(a => a.includes('police') || a.includes('swat') || a.includes('tactical')));
  assert.ok(anchors.blockedObjects.includes('shoelace'));
  assert.ok(anchors.blockedObjects.includes('hourglass'));
  assert.ok(anchors.blockedObjects.includes('stopwatch'));
});

test('Visual Directive - deriveDirectiveAnchors lida com diretriz vazia graciosamente', () => {
  const anchors = deriveDirectiveAnchors('');
  assert.equal(anchors.hasDirective, false);
  assert.equal(anchors.stockAnchorsEn.length, 0);
  assert.equal(anchors.blockedObjects.length, 0);
});

test('Visual Directive - buildAnchorQuery monta query curta (<= 5 palavras) em rodízio com enquadramento', () => {
  const anchors = deriveDirectiveAnchors('Swat police tactical operation');
  const queryTake0 = buildAnchorQuery({ directiveAnchors: anchors, framing: 'close_up', sceneIndex: 0 });
  const queryTake1 = buildAnchorQuery({ directiveAnchors: anchors, framing: 'wide', sceneIndex: 1 });

  assert.ok(queryTake0.split(/\s+/).length <= 5, `Query muito longa: ${queryTake0}`);
  assert.ok(queryTake1.split(/\s+/).length <= 5, `Query muito longa: ${queryTake1}`);
  assert.ok(queryTake0.includes('close up'));
  assert.ok(queryTake1.includes('wide'));
});

test('Visual Directive - isBlockedObject e filterBlockedObjects detectam e higienizam metáforas desconectadas', () => {
  assert.equal(isBlockedObject('person tying running shoes on pavement', BLOCKED_GENERIC_OBJECTS), true);
  assert.equal(isBlockedObject('vintage hourglass with sand', BLOCKED_GENERIC_OBJECTS), true);
  assert.equal(isBlockedObject('tactical swat team entering building', BLOCKED_GENERIC_OBJECTS), false);

  const dirty = 'swat officer with stopwatch clock ticking';
  const cleaned = filterBlockedObjects(dirty, BLOCKED_GENERIC_OBJECTS);
  assert.ok(!cleaned.includes('stopwatch'));
});

test('Visual Directive - buildSmartContextualQueries prioriza âncora da diretriz e bloqueia cadarços/ampulhetas', () => {
  const scene = {
    phrase: 'Para você entrar em ação e mudar de vida agora.',
    framing: 'medium_shot'
  };

  const queries = buildSmartContextualQueries({
    scene,
    visualDirective: 'Policiais em ação, combate urbano, forças táticas',
    sceneIndex: 0
  });

  // A primeira query DEVE ser derivada da diretriz (policiais/tático), NUNCA cadarço de tênis!
  assert.ok(queries.length > 0);
  const firstQuery = queries[0].toLowerCase();
  assert.ok(firstQuery.includes('police') || firstQuery.includes('swat') || firstQuery.includes('tactical'), `Primeira query deve ser tática: ${firstQuery}`);

  // Nenhuma query deve conter 'tying running shoes' ou 'stopwatch'
  for (const q of queries) {
    assert.equal(isBlockedObject(q, BLOCKED_GENERIC_OBJECTS), false, `Query contém objeto bloqueado: ${q}`);
  }
});
