import fs from 'fs';
import path from 'path';

/**
 * Obtém access_token atualizado a partir do refresh_token OAuth 2.0
 */
export async function getGoogleAccessToken({
  clientId = process.env.YOUTUBE_CLIENT_ID,
  clientSecret = process.env.YOUTUBE_CLIENT_SECRET,
  refreshToken = process.env.YOUTUBE_REFRESH_TOKEN
} = {}) {
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Falha na renovação do Google OAuth token (HTTP ${res.status}): ${errText}`);
  }

  const json = await res.json();
  return json.access_token;
}

/**
 * Envia um arquivo para o Google Drive via Resumable Upload
 */
export async function uploadFileToDrive({
  filePath,
  mimeType,
  folderId = null,
  accessToken = null,
  customFileName = null
}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado para upload ao Drive: ${filePath}`);
  }

  const fileName = customFileName || path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  // Se não houver access token configurado, opera em modo local offline
  if (!accessToken) {
    console.log(`[Drive Uploader] Modo offline/local: simulando ID para "${fileName}"`);
    return {
      id: `local_${path.basename(filePath)}`,
      name: fileName,
      offline: true,
      sizeBytes: fileSize
    };
  }

  console.log(`[Drive Uploader] Iniciando upload resumable para o Google Drive: "${fileName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

  // 1. Inicia sessão resumable
  const metadata = {
    name: fileName
  };
  if (folderId && !folderId.startsWith('DRIVE_FOLDER_ID')) {
    metadata.parents = [folderId];
  }

  const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(fileSize)
    },
    body: JSON.stringify(metadata)
  });

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`Google Drive rejeitou início de upload (HTTP ${initRes.status}): ${errText}`);
  }

  const uploadLocation = initRes.headers.get('location');
  if (!uploadLocation) {
    throw new Error('Google Drive não forneceu header Location para upload resumable');
  }

  // 2. Transmite os bytes do arquivo para a URL de upload
  const fileBuffer = fs.readFileSync(filePath);
  const uploadRes = await fetch(uploadLocation, {
    method: 'PUT',
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': mimeType
    },
    body: fileBuffer
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Falha na transferência de mídia para o Google Drive (HTTP ${uploadRes.status}): ${errText}`);
  }

  const fileInfo = await uploadRes.json();
  console.log(`[Drive Uploader] ✅ Upload concluído com sucesso! Drive ID: ${fileInfo.id}`);

  return {
    id: fileInfo.id,
    name: fileInfo.name,
    mimeType: fileInfo.mimeType,
    offline: false,
    sizeBytes: fileSize
  };
}

/**
 * Orquestra o upload do vídeo e thumbnail do post para o Google Drive
 */
export async function uploadPostAssetsToDrive({
  videoPath,
  thumbnailPath = null,
  channelConfig = {},
  options = {}
}) {
  const pubProfile = channelConfig.publishing_profile || {};
  let token = null;

  try {
    token = await getGoogleAccessToken();
  } catch (err) {
    console.warn(`[Drive Uploader] Aviso ao obter token OAuth: ${err.message}. Prosseguindo em contingência local.`);
  }

  const videoRes = await uploadFileToDrive({
    filePath: videoPath,
    mimeType: 'video/mp4',
    folderId: pubProfile.drive_folder_videos,
    accessToken: token,
    customFileName: `AUTOPUB_${Date.now()}_${path.basename(videoPath)}`
  });

  let thumbRes = null;
  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    thumbRes = await uploadFileToDrive({
      filePath: thumbnailPath,
      mimeType: 'image/png',
      folderId: pubProfile.drive_folder_thumbnails,
      accessToken: token,
      customFileName: `AUTOPUB_${Date.now()}_thumb.png`
    });
  }

  return {
    videoDriveId: videoRes.id,
    thumbnailDriveId: thumbRes ? thumbRes.id : null,
    isOffline: Boolean(videoRes.offline)
  };
}
