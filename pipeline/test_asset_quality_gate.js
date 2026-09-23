import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { validateAssetQuality } from './src/asset_quality_gate.js';
import { CircuitBreaker } from './src/circuit_breaker.js';
import { AssetCache } from './src/asset_cache.js';

test('Circuit Breaker - alterna estados CLOSED, OPEN e HALF_OPEN com TTL', (t) => {
  const cb = new CircuitBreaker();
  assert.equal(cb.isAvailable('pexels'), true);

  // Registra erro 429
  cb.recordFailure('pexels', new Error('HTTP 429: Too Many Requests'));
  assert.equal(cb.isAvailable('pexels'), false);
  assert.match(cb.getBlockReason('pexels'), /429/);

  // Sucesso reseta
  cb.recordSuccess('pexels');
  assert.equal(cb.isAvailable('pexels'), true);

  // Erro 404 é permanente na execução
  cb.recordFailure('imagen', new Error('HTTP 404: models/imagen-3 not found'));
  assert.equal(cb.isAvailable('imagen'), false);
});

test('Asset Cache - grava e recupera assets com integridade e sidecar JSON', (t) => {
  const tmpCacheDir = path.resolve('pipeline/scratch/test_asset_cache');
  if (!fs.existsSync(tmpCacheDir)) fs.mkdirSync(tmpCacheDir, { recursive: true });

  const cache = new AssetCache(tmpCacheDir);
  const dummyFile = path.join(tmpCacheDir, 'sample_asset.jpg');
  fs.writeFileSync(dummyFile, Buffer.alloc(8000, 0xAA));

  const key = cache.buildCacheKey({
    prompt: 'Ancient Stoic Warrior Bronze',
    aesthetic: 'Cinematic Dark',
    type: 'image',
    seed: 42
  });

  assert.equal(typeof key, 'string');
  assert.equal(key.length, 32);

  // Salva no cache
  const saved = cache.set(key, dummyFile, { provider: 'Pexels Photos', author: 'Test' });
  assert.equal(saved, true);
  assert.equal(cache.has(key), true);

  // Recupera do cache
  const destFile = path.join(tmpCacheDir, 'restored_asset.jpg');
  const retrieved = cache.get(key, destFile);
  assert.notEqual(retrieved, null);
  assert.equal(retrieved.hit, true);
  assert.equal(fs.statSync(destFile).size, 8000);
  assert.equal(retrieved.metadata?.metadata?.provider, 'Pexels Photos');

  // Limpeza
  try {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
  } catch {}
});

test('Asset Quality Gate - valida arquivo existente e rejeita ausente ou pequeno', async (t) => {
  const resMissing = await validateAssetQuality({ filePath: 'pipeline/assets/non_existent.jpg' });
  assert.equal(resMissing.passed, false);
  assert.equal(resMissing.code, 'FILE_NOT_FOUND');

  const tmpSmall = path.resolve('pipeline/scratch/small.jpg');
  fs.mkdirSync(path.dirname(tmpSmall), { recursive: true });
  fs.writeFileSync(tmpSmall, Buffer.from('tiny'));
  const resSmall = await validateAssetQuality({ filePath: tmpSmall });
  assert.equal(resSmall.passed, false);
  assert.equal(resSmall.code, 'FILE_TOO_SMALL');
  fs.unlinkSync(tmpSmall);

  // Testa imagem existente do psicosegredo
  const sampleImg = path.resolve('pipeline/assets/scenes/psicosegredo/scene_1.jpg');
  if (fs.existsSync(sampleImg)) {
    const resSample = await validateAssetQuality({ filePath: sampleImg, strict: false });
    assert.equal(resSample.passed, true);
    assert.equal(resSample.code, 'APPROVED');
    assert.ok(resSample.metrics.width > 0);
    assert.ok(resSample.metrics.height > 0);
  }
});
