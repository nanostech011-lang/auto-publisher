/**
 * AutoPublisher Pro - Content-Addressed Asset Cache
 * 
 * Cache content-addressed local de imagens e clipes de vídeo em pipeline/.cache/assets
 * com sidecar de metadados JSON, evitando requisições redundantes e latência desnecessária.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class AssetCache {
  constructor(cacheDir = path.resolve('pipeline/.cache/assets')) {
    this.cacheDir = cacheDir;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Constrói uma chave canônica determinística a partir dos parâmetros de busca ou geração
   */
  buildCacheKey({ prompt = '', aesthetic = '', visualDirective = '', type = 'image', seed = null }) {
    const raw = [
      String(type).toLowerCase().trim(),
      String(prompt).toLowerCase().trim(),
      String(aesthetic).toLowerCase().trim(),
      String(visualDirective).toLowerCase().trim(),
      seed !== null ? String(seed) : 'noseed'
    ].join('||');

    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  /**
   * Verifica se o item existe no cache e é válido
   */
  has(cacheKey, extension = 'jpg') {
    const filePath = path.join(this.cacheDir, `${cacheKey}.${extension}`);
    const metaPath = path.join(this.cacheDir, `${cacheKey}.json`);

    if (fs.existsSync(filePath) && fs.existsSync(metaPath)) {
      try {
        const stat = fs.statSync(filePath);
        return stat.size > 5000;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Recupera o arquivo do cache copiando para o destino informado
   */
  get(cacheKey, targetPath, extension = 'jpg') {
    const filePath = path.join(this.cacheDir, `${cacheKey}.${extension}`);
    const metaPath = path.join(this.cacheDir, `${cacheKey}.json`);

    if (!fs.existsSync(filePath)) return null;

    try {
      fs.copyFileSync(filePath, targetPath);
      let metadata = {};
      if (fs.existsSync(metaPath)) {
        metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
      return {
        hit: true,
        path: targetPath,
        metadata
      };
    } catch (err) {
      console.warn(`[Asset Cache] Falha ao recuperar cache para ${cacheKey}: ${err.message}`);
      return null;
    }
  }

  /**
   * Salva o arquivo no cache com metadados sidecar
   */
  set(cacheKey, sourcePath, metadata = {}, extension = 'jpg') {
    if (!fs.existsSync(sourcePath)) return false;

    try {
      const targetFilePath = path.join(this.cacheDir, `${cacheKey}.${extension}`);
      const targetMetaPath = path.join(this.cacheDir, `${cacheKey}.json`);

      fs.copyFileSync(sourcePath, targetFilePath);

      const payload = {
        key: cacheKey,
        cachedAt: new Date().toISOString(),
        fileSize: fs.statSync(sourcePath).size,
        metadata
      };

      fs.writeFileSync(targetMetaPath, JSON.stringify(payload, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.warn(`[Asset Cache] Falha ao persistir cache para ${cacheKey}: ${err.message}`);
      return false;
    }
  }
}

export const globalAssetCache = new AssetCache();
export default AssetCache;
