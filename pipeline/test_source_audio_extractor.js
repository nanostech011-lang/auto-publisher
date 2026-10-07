import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSourceAudioAllowed, extractSourceAudio } from './src/source_audio_extractor.js';

test('Source Audio Extractor - isSourceAudioAllowed opera em fail-closed por padrão', () => {
  const oldVal = process.env.ENABLE_SOURCE_AUDIO;
  try {
    delete process.env.ENABLE_SOURCE_AUDIO;
    assert.equal(isSourceAudioAllowed(), false);

    process.env.ENABLE_SOURCE_AUDIO = 'false';
    assert.equal(isSourceAudioAllowed(), false);

    process.env.ENABLE_SOURCE_AUDIO = 'true';
    assert.equal(isSourceAudioAllowed(), true);
  } finally {
    if (oldVal !== undefined) process.env.ENABLE_SOURCE_AUDIO = oldVal;
    else delete process.env.ENABLE_SOURCE_AUDIO;
  }
});

test('Source Audio Extractor - extractSourceAudio bloqueia execução quando desabilitado', async () => {
  const oldVal = process.env.ENABLE_SOURCE_AUDIO;
  try {
    delete process.env.ENABLE_SOURCE_AUDIO;
    await assert.rejects(
      async () => {
        await extractSourceAudio('https://www.youtube.com/watch?v=sample', 'pipeline/scratch/test.mp3');
      },
      {
        message: /Reaproveitamento de áudio original está desativado por padrão/
      }
    );
  } finally {
    if (oldVal !== undefined) process.env.ENABLE_SOURCE_AUDIO = oldVal;
    else delete process.env.ENABLE_SOURCE_AUDIO;
  }
});
