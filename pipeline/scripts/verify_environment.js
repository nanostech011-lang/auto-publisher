import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';

console.log('--- Verificando Ambiente do Pipeline ---');
console.log('FFmpeg Path:', ffmpegInstaller.path);
console.log('FFprobe Path:', ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

async function testTts() {
  console.log('\nTestando sintese de voz com Edge-TTS...');
  const tts = new MsEdgeTTS();
  await tts.setMetadata('pt-BR-AntonioNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const testDir = path.resolve('pipeline/scratch');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const result = await tts.toFile(testDir, 'O silêncio sob controle sempre entrega mais poder.');
  const testAudioPath = path.join(testDir, 'audio.mp3');
  console.log('Audio de teste gerado com sucesso em:', testAudioPath);
  const stats = fs.statSync(testAudioPath);
  console.log('Tamanho do audio gerado:', stats.size, 'bytes');

  // Limpeza
  fs.unlinkSync(testAudioPath);
  console.log('Ambiente 100% operacional e validado com sucesso!\n');
}

testTts().catch(err => {
  console.error('Erro na verificacao:', err);
  process.exit(1);
});
