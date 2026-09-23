import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  getGoogleAccessToken,
  uploadFileToDrive,
  uploadPostAssetsToDrive
} from './src/drive_uploader.js';

test('Drive Uploader - getGoogleAccessToken retorna null sem credenciais', async () => {
  const token = await getGoogleAccessToken({
    clientId: '',
    clientSecret: '',
    refreshToken: ''
  });
  assert.equal(token, null, 'Sem credenciais deve retornar null');
});

test('Drive Uploader - uploadFileToDrive opera em modo local offline gracioso sem token', async () => {
  const scratchDir = path.resolve('pipeline/scratch/test_drive');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const tempFile = path.join(scratchDir, 'sample_video.mp4');
  fs.writeFileSync(tempFile, 'dummy content 12345');

  const result = await uploadFileToDrive({
    filePath: tempFile,
    mimeType: 'video/mp4',
    accessToken: null
  });

  assert.equal(result.offline, true, 'Deve sinalizar offline');
  assert.ok(result.id.startsWith('local_'), 'ID deve ter prefixo local_');
  assert.equal(result.name, 'sample_video.mp4');

  try {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  } catch (ignored) {}
});

test('Drive Uploader - uploadFileToDrive falha para arquivo inexistente', async () => {
  await assert.rejects(
    async () => {
      await uploadFileToDrive({
        filePath: 'pipeline/scratch/non_existent_file_xyz.mp4',
        mimeType: 'video/mp4'
      });
    },
    /não encontrado/
  );
});

test('Drive Uploader - uploadPostAssetsToDrive orquestra video e thumbnail com integridade', async () => {
  const scratchDir = path.resolve('pipeline/scratch/test_drive_post');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const vFile = path.join(scratchDir, 'test_render.mp4');
  const tFile = path.join(scratchDir, 'test_thumb.png');
  fs.writeFileSync(vFile, 'video bytes');
  fs.writeFileSync(tFile, 'thumb bytes');

  const res = await uploadPostAssetsToDrive({
    videoPath: vFile,
    thumbnailPath: tFile,
    channelConfig: {
      publishing_profile: {
        drive_folder_videos: 'folder_v_123',
        drive_folder_thumbnails: 'folder_t_456'
      }
    }
  });

  assert.ok(res.videoDriveId, 'Deve conter videoDriveId');
  assert.ok(res.thumbnailDriveId, 'Deve conter thumbnailDriveId');

  try {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  } catch (ignored) {}
});
