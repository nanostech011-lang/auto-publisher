/**
 * AutoPublisher Pro - AI Video Connector Verification Suite
 * Valida o conector Google Veo 2, tratamento de erros,
 * orquestrador visual híbrido e fallbacks para Motion Engine.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  generateVideoWithVeo,
  generateVideoWithPollinations,
  generateCinematicTake
} from './src/ai_video_connector.js';

test('generateVideoWithVeo deve retornar erro amigavel quando chave nao fornecida', async () => {
  const origKey = process.env.GEMINI_API_KEY;
  const origGoogleKey = process.env.GOOGLE_AI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;

  try {
    const result = await generateVideoWithVeo({
      prompt: 'A cinematic ancient warrior in dramatic chiaroscuro lighting, vertical 9:16',
      outputPath: 'pipeline/scratch/test_veo.mp4',
      apiKey: null
    });

    assert.strictEqual(result.success, false);
    assert.match(result.error, /GEMINI_API_KEY|indisponível/i);
  } finally {
    if (origKey) process.env.GEMINI_API_KEY = origKey;
    if (origGoogleKey) process.env.GOOGLE_AI_API_KEY = origGoogleKey;
  }
});

test('generateVideoWithVeo deve lidar com chave invalida sem lancar excecao nao tratada', async () => {
  const result = await generateVideoWithVeo({
    prompt: 'A cinematic human brain with glowing synapses, vertical 9:16',
    outputPath: 'pipeline/scratch/test_veo_invalid.mp4',
    apiKey: 'fake_key_12345'
  });

  assert.strictEqual(result.success, false);
  assert.ok(typeof result.error === 'string');
});

test('generateCinematicTake com visualMode="image" deve sinalizar Motion Engine diretamente', async () => {
  const result = await generateCinematicTake({
    prompt: 'Cinematic silhouette of a person standing on a mountain at sunrise',
    durationSeconds: 4.5,
    outputPath: 'pipeline/scratch/test_take_image.mp4',
    visualMode: 'image',
    isHookScene: true,
    apiKey: null
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.isRealVideo, false);
  assert.match(result.provider, /Motion Engine/i);
});

test('generateCinematicTake com visualMode="hybrid" e cena intermediaria deve delegar para Motion Engine', async () => {
  const result = await generateCinematicTake({
    prompt: 'Hands holding golden coins multiplying, vertical 9:16',
    durationSeconds: 5.0,
    outputPath: 'pipeline/scratch/test_take_hybrid_body.mp4',
    visualMode: 'hybrid',
    isHookScene: false,
    apiKey: null
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.isRealVideo, false);
  assert.match(result.provider, /Motion Engine/i);
});
