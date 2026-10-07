import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { MediaLedger } from './src/media_ledger.js';

test('MediaLedger - Operações básicas, reserva, commit e rollback', (t) => {
  const tmpDir = path.resolve('pipeline/scratch/test_ledger_' + Date.now());
  const ledgerFile = path.join(tmpDir, 'media_history.json');
  fs.mkdirSync(tmpDir, { recursive: true });

  t.after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const ledger = new MediaLedger(ledgerFile);
  assert.equal(ledger.getAllUsedKeys('canal1').size, 0);

  // 1. Reserva de chaves
  ledger.reserve('canal1', 'pexels:video:12345', { title: 'Soldado 1' });
  ledger.reserve('canal1', 'pixabay:photo:99999', { title: 'Caveira 1' });

  assert.equal(ledger.has('canal1', 'pexels:video:12345'), true);
  assert.equal(ledger.has('canal1', 'pixabay:photo:99999'), true);
  assert.equal(ledger.has('canal1', 'pexels:video:00000'), false);
  assert.equal(ledger.getAllUsedKeys('canal1').size, 2);

  // 2. Rollback limpa apenas pendentes
  ledger.rollback('canal1');
  assert.equal(ledger.has('canal1', 'pexels:video:12345'), false);
  assert.equal(ledger.getAllUsedKeys('canal1').size, 0);

  // 3. Reserva novamente e commita
  ledger.reserve('canal1', 'pexels:video:12345', { title: 'Soldado 1' });
  ledger.commit('canal1', 'run_001');

  // Após commit, está persistido no arquivo
  assert.equal(fs.existsSync(ledgerFile), true);
  assert.equal(ledger.has('canal1', 'pexels:video:12345'), true);

  // 4. Nova instância recarrega os dados comitados
  const ledger2 = new MediaLedger(ledgerFile);
  assert.equal(ledger2.has('canal1', 'pexels:video:12345'), true);
  assert.equal(ledger2.getAllUsedKeys('canal1').size, 1);

  // Isolamento entre canais
  assert.equal(ledger2.has('canal2', 'pexels:video:12345'), false);
});

test('MediaLedger - Poda por janela temporal e limite de itens', () => {
  const tmpDir = path.resolve('pipeline/scratch/test_ledger_prune_' + Date.now());
  const ledgerFile = path.join(tmpDir, 'media_history.json');
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const ledger = new MediaLedger(ledgerFile, { maxEntriesPerChannel: 5, retentionDays: 1 });
    
    // Simula item com 2 dias de idade (fora da retenção)
    const oldTimestamp = Date.now() - (2 * 24 * 60 * 60 * 1000);
    ledger.channels['test_ch'] = [
      { key: 'old_asset_1', usedAt: new Date(oldTimestamp).toISOString(), runId: 'run_old' }
    ];
    ledger.save();

    // Reserva novos itens
    for (let i = 1; i <= 6; i++) {
      ledger.reserve('test_ch', `new_asset_${i}`);
    }
    ledger.commit('test_ch', 'run_new');

    const used = ledger.getAllUsedKeys('test_ch');
    // old_asset_1 deve ter sido podado por data
    assert.equal(used.has('old_asset_1'), false);
    // Limite máximo é 5
    assert.ok(used.size <= 5);
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
});
