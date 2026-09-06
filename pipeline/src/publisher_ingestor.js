import fs from 'fs';
import path from 'path';

/**
 * Conector de ingestao que registra o video gerado no AutoPublisher Pro
 */
export async function ingestGeneratedPost({
  videoPath,
  thumbnailPath,
  scriptData,
  apiBaseUrl = 'http://localhost:8080',
  apiKey = '',
  scheduledTime = null,
  platform = 'YOUTUBE_SHORTS',
  driveVideoId = null,
  driveThumbnailId = null
}) {
  const metadata = scriptData.metadata || {};

  // Se nao houver ID de drive especificado, utiliza o caminho ou nome de arquivo local
  const finalVideoId = driveVideoId || path.basename(videoPath);
  const finalThumbId = driveThumbnailId || (thumbnailPath ? path.basename(thumbnailPath) : null);

  const postId = `POST-AUTO-${Date.now()}`;

  // Se nao especificado, agenda para daqui a 30 minutos
  const finalScheduleTime = scheduledTime || new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

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
    }
  } catch (err) {
    console.warn(`[INFO] Servidor backend nao acessivel no momento (${err.message}).`);
    console.log(`Gerando manifesto de ingestao pronto para execucao.`);
  }

  // Fallback: Salva o manifesto de ingestao em JSON para consumo posterior
  const manifestPath = path.join(path.dirname(videoPath), `${postId}_manifest.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Manifesto de ingestao salvo em: ${manifestPath}`);

  return {
    success: true,
    source: 'manifest',
    manifestPath: manifestPath,
    payload: payload
  };
}
