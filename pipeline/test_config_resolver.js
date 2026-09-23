import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChannelConfig, validateChannelProfile } from './src/config_resolver.js';

test('Config Resolver - resolve canal existente (psicosegredo)', () => {
  const cfg = resolveChannelConfig('psicosegredo');
  assert.equal(cfg.channel_id, 'psicosegredo');
  assert.equal(cfg.format?.resolution, '1080x1920');
  assert.equal(cfg.format?.target_fps, 30);
  assert.equal(cfg.visual_profile?.subtitles_style?.margin_v, 560);
});

test('Config Resolver - resolve canal desconhecido com template padrão seguro', () => {
  const cfg = resolveChannelConfig('canal_inexistente_xyz');
  assert.equal(cfg.channel_id, 'canal_inexistente_xyz');
  assert.equal(cfg.format?.resolution, '1080x1920');
  assert.equal(cfg.visual_profile?.subtitles_style?.margin_v, 560);
  assert.equal(cfg.publishing_profile?.made_for_kids, false);
});

test('Config Resolver - validação falha para canal_id ausente', () => {
  assert.throws(() => {
    validateChannelProfile({ name: 'Sem ID' });
  }, /channel_id/);
});

test('Config Resolver - validação falha para resolução com formato incorreto', () => {
  assert.throws(() => {
    validateChannelProfile({
      channel_id: 'test',
      format: { resolution: 'fullhd' }
    });
  }, /Resolução inválida/);
});
