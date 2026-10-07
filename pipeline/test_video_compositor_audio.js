import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAudioFilterGraph } from './src/video_compositor.js';

test('Video Compositor - buildAudioFilterGraph gera filtros adequados para cada combinação', () => {
  // 1. Voz + Trilha (Caso clássico com sidechain ducking)
  const g1 = buildAudioFilterGraph({
    hasVoice: true,
    hasBgMusic: true,
    voiceInputIndex: 1,
    bgMusicInputIndex: 2,
    targetLufs: -14,
    bgMusicVol: 0.18,
    fadeOutSec: 2.5,
    totalDurationSeconds: 20
  });
  assert.equal(g1.audioMap, '-map [a_out]');
  assert.ok(g1.complexFilters.some(f => f.includes('sidechaincompress')));
  assert.ok(g1.complexFilters.some(f => f.includes('loudnorm')));

  // 2. Apenas Voz (Sem trilha)
  const g2 = buildAudioFilterGraph({
    hasVoice: true,
    hasBgMusic: false,
    voiceInputIndex: 1,
    targetLufs: -14,
    totalDurationSeconds: 15
  });
  assert.equal(g2.audioMap, '-map [a_out]');
  assert.ok(g2.complexFilters.some(f => f.includes('[1:a]highpass')));
  assert.ok(!g2.complexFilters.some(f => f.includes('sidechaincompress')));

  // 3. Apenas Trilha (Modo visual sem locução com BGM)
  const g3 = buildAudioFilterGraph({
    hasVoice: false,
    hasBgMusic: true,
    bgMusicInputIndex: 1,
    targetLufs: -14,
    bgMusicVol: 0.2,
    fadeOutSec: 2.0,
    totalDurationSeconds: 15
  });
  assert.equal(g3.audioMap, '-map [a_out]');
  assert.ok(g3.complexFilters.some(f => f.includes('[1:a]aformat')));
  assert.ok(g3.complexFilters.some(f => f.includes('loudnorm')));
  assert.ok(!g3.complexFilters.some(f => f.includes('sidechaincompress')));

  // 4. Sem Voz e Sem Trilha (Silêncio sintético aevalsrc)
  const g4 = buildAudioFilterGraph({
    hasVoice: false,
    hasBgMusic: false,
    totalDurationSeconds: 10
  });
  assert.equal(g4.audioMap, '-map [a_out]');
  assert.ok(g4.complexFilters.some(f => f.includes('aevalsrc=0')));
});
