import fs from 'fs';
import path from 'path';

/**
 * Conector de ingestao que registra o video gerado no AutoPublisher Pro
 */
export async function ingestGeneratedPost({
  videoPath,
  thumbnailPath,
  scriptData,
  apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080',
  apiKey = process.env.API_KEY || process.env.AUTO_PUBLISHER_API_KEY || 'dev-local-api-key',
  scheduledTime = null,
  platform = 'YOUTUBE_SHORTS',
  driveVideoId = null,
  driveThumbnailId = null,
  batchIndex = 0,
  totalBatch = 1
}) {
  const metadata = scriptData.metadata || {};

  // Se nao houver ID de drive especificado, utiliza o caminho ou nome de arquivo local
  const finalVideoId = driveVideoId || path.basename(videoPath);
  const finalThumbId = driveThumbnailId || (thumbnailPath ? path.basename(thumbnailPath) : null);

  const postId = `POST-AUTO-${Date.now()}`;

  // Se nao especificado, calcula data escalonada:
  // Se batchIndex === 0: daqui a 45 minutos. Se batchIndex > 0: nos dias seguintes às 18:00 (horário nobre)
  let finalScheduleTime = scheduledTime;
  if (!finalScheduleTime) {
    const targetDate = new Date();
    if (batchIndex === 0) {
      targetDate.setTime(targetDate.getTime() + 45 * 60 * 1000);
    } else {
      targetDate.setDate(targetDate.getDate() + batchIndex);
      targetDate.setHours(18, 0, 0, 0);
    }
    const pad = (n) => String(n).padStart(2, '0');
    finalScheduleTime = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())} ${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}:${pad(targetDate.getSeconds())}`;
  }

  const payload = {
    id: postId,
    scheduledTime: finalScheduleTime,
    platform: platform,
    videoDriveId: finalVideoId,
    thumbnailDriveId: finalThumbId,
    title: metadata.title || scriptData.title,
    description: metadata.description || '',
    tags: metadata.tags || '',
    categoryId: metadata.categoryId || 28,
    madeForKids: Boolean(metadata.madeForKids),
    privacy: metadata.privacy || 'PUBLIC',
    firstComment: metadata.firstComment || ''
  };

  console.log(`\n--- Preparando Ingestao no AutoPublisher Pro ---`);
  console.log(`Post ID: ${postId}`);
  console.log(`Plataforma: ${platform}`);
  console.log(`Data de Agendamento: ${finalScheduleTime}`);
  console.log(`Titulo: ${payload.title}`);

  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['X-API-KEY'] = apiKey;
    }

    console.log(`Enviando POST para ${apiBaseUrl}/api/v1/dashboard/posts...`);
    const response = await fetch(`${apiBaseUrl}/api/v1/dashboard/posts`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[SUCESSO] Post agendado com sucesso no AutoPublisher Pro!`);
      return {
        success: true,
        source: 'api',
        post: result
      };
    } else {
      const errText = await response.text();
      console.warn(`[AVISO] Servidor respondeu status ${response.status}: ${errText}`);
      console.log(`Salvando manifesto de ingestao localmente para sincronizacao posterior...`);
      const manifestPath = path.join(path.dirname(videoPath), `${postId}_manifest.json`);
      fs.writeFileSync(manifestPath, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`Manifesto de ingestao salvo em: ${manifestPath}`);
      return {
        success: false,
        source: 'manifest_rejected',
        error: `Servidor respondeu HTTP ${response.status}: ${errText}`,
        manifestPath: manifestPath,
        payload: payload
      };
    }
  } catch (err) {
    console.warn(`[INFO] Servidor backend nao acessivel no momento (${err.message}).`);
    console.log(`Gerando manifesto de ingestao pronto para execucao.`);
    const manifestPath = path.join(path.dirname(videoPath), `${postId}_manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Manifesto de ingestao salvo em: ${manifestPath}`);
    return {
      success: false,
      source: 'manifest_offline',
      error: `Servidor indisponível: ${err.message}`,
      manifestPath: manifestPath,
      payload: payload
    };
  }
}
