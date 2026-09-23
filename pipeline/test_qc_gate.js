import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  calculateDiceTrigramSimilarity,
  checkSubtitleSafeArea,
  runQualityControlGate
} from './src/qc_gate.js';

test('QC Gate - calculateDiceTrigramSimilarity calcula similaridade correta', () => {
  const simIdentical = calculateDiceTrigramSimilarity('Neurociência e dopamina', 'Neurociência e dopamina');
  assert.equal(simIdentical, 1.0, 'Strings idênticas devem ter similaridade 1.0');

  const simDifferent = calculateDiceTrigramSimilarity('Guerreiro medieval', 'Astronauta no espaço sideral');
  assert.ok(simDifferent < 0.2, 'Strings completamente diferentes devem ter similaridade baixa');

  const simPartial = calculateDiceTrigramSimilarity(
    'O cérebro controla a atenção',
    'O cérebro controla a disciplina e foco'
  );
  assert.ok(simPartial > 0.4 && simPartial < 0.9, 'Strings com sobreposição parcial devem ter similaridade intermediária');
});

test('QC Gate - checkSubtitleSafeArea detecta posições válidas e invasão de UI', () => {
  const scratchDir = path.resolve('pipeline/scratch/test_qc');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const safeAssPath = path.join(scratchDir, 'safe.ass');
  fs.writeFileSync(safeAssPath, `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,65,&H00FFFFFF,&H0000D7FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,560,1
[Events]
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Teste
`, 'utf8');

  const unsafeAssPath = path.join(scratchDir, 'unsafe.ass');
  fs.writeFileSync(unsafeAssPath, `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,65,&H00FFFFFF,&H0000D7FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,160,1
[Events]
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Teste
`, 'utf8');

  const safeResult = checkSubtitleSafeArea(safeAssPath);
  assert.equal(safeResult.passed, true, 'MarginV 560 deve ser aceito');
  assert.equal(safeResult.marginV, 560);

  const unsafeResult = checkSubtitleSafeArea(unsafeAssPath);
  assert.equal(unsafeResult.passed, false, 'MarginV 160 deve ser rejeitado');
  assert.equal(unsafeResult.marginV, 160);

  try {
    fs.unlinkSync(safeAssPath);
    fs.unlinkSync(unsafeAssPath);
  } catch (ignored) {}
});

test('QC Gate - runQualityControlGate avalia video real e emite relatorio qc.json', async () => {
  const sampleVideo = path.resolve('pipeline/output/run_1790120121033_1/video_final_9x16.mp4');
  if (!fs.existsSync(sampleVideo)) {
    // Se o vídeo de amostra não existir no runner, pula o teste
    return;
  }

  const outputDir = path.resolve('pipeline/scratch/test_qc_eval');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const report = await runQualityControlGate({
    videoPath: sampleVideo,
    outputDir,
    strict: false,
    channelConfig: {
      format: { target_duration_seconds: 64, resolution: '1080x1920', target_fps: 30 }
    }
  });

  assert.ok(report, 'Deve retornar objeto de relatório');
  assert.ok(report.totalChecks >= 10, 'Deve ter pelo menos 10 checagens');
  assert.ok(fs.existsSync(path.join(outputDir, 'qc.json')), 'Arquivo qc.json deve ter sido gravado');
  assert.equal(report.checks['QC-2_ResolutionAndFps'].passed, true, 'Resolução deve ser 1080x1920');

  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
  } catch (ignored) {}
});
