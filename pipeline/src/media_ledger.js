import fs from 'fs';
import path from 'path';

const DEFAULT_LEDGER_PATH = path.resolve('pipeline/state/used_media_ledger.json');
const MAX_ITEMS_PER_CHANNEL = 400;
const MAX_AGE_DAYS = 45;

/**
 * Livro-Razão Persistente de Mídias Utilizadas (Anti-Repetição de Vídeos e Fotos)
 * Mantém o histórico de clipes/fotos por canal e suporta reserva temporária intra-vídeo
 * e gravação atômica após o sucesso do render.
 */
export class MediaLedger {
  constructor(ledgerPath = DEFAULT_LEDGER_PATH, options = {}) {
    this.ledgerPath = ledgerPath;
    this.maxItems = options.maxEntriesPerChannel || MAX_ITEMS_PER_CHANNEL;
    this.retentionDays = options.retentionDays || MAX_AGE_DAYS;
    this.channels = {};
    this.reservations = new Map(); // channelId -> Set<key>
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.ledgerPath)) {
        const raw = fs.readFileSync(this.ledgerPath, 'utf8');
        this.channels = JSON.parse(raw);
      } else {
        const dir = path.dirname(this.ledgerPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        this.channels = {};
      }
    } catch (e) {
      console.warn(`[Media Ledger] Aviso: Falha ao carregar livro-razão: ${e.message}`);
      this.channels = {};
    }
  }

  save() {
    const dir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tempPath = `${this.ledgerPath}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(this.channels, null, 2), 'utf8');
      fs.renameSync(tempPath, this.ledgerPath);
    } catch (err) {
      console.warn(`[Media Ledger] Erro na escrita atômica: ${err.message}`);
      try {
        fs.writeFileSync(this.ledgerPath, JSON.stringify(this.channels, null, 2), 'utf8');
      } catch (fallbackErr) {
        console.error(`[Media Ledger] Falha crítica ao salvar livro-razão: ${fallbackErr.message}`);
      }
    } finally {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
    }
  }

  /**
   * Obtém a lista histórica de mídias de um canal
   */
  getChannelEntries(channelId = 'custom') {
    if (!this.channels[channelId]) {
      this.channels[channelId] = [];
    }
    return this.channels[channelId];
  }

  /**
   * Verifica se uma mídia (provider:id) já foi usada ou reservada no canal
   */
  has(channelId = 'custom', key = '') {
    if (!key) return false;
    const normKey = String(key).trim();

    // 1. Checa reservas ativas em memória da execução atual (intra-vídeo)
    const reserved = this.reservations.get(channelId);
    if (reserved && reserved.has(normKey)) {
      return true;
    }

    // 2. Checa histórico persistido
    const entries = this.getChannelEntries(channelId);
    return entries.some(e => e.key === normKey);
  }

  /**
   * Reserva uma mídia para o vídeo atual em processamento
   */
  reserve(channelId = 'custom', key = '', metadata = {}) {
    if (!key) return;
    const normKey = String(key).trim();
    if (!this.reservations.has(channelId)) {
      this.reservations.set(channelId, new Set());
    }
    this.reservations.get(channelId).add(normKey);
  }

  /**
   * Persiste as mídias reservadas após a conclusão bem-sucedida do render do vídeo
   */
  commit(channelId = 'custom', runId = `run_${Date.now()}`) {
    const reserved = this.reservations.get(channelId);
    if (!reserved || reserved.size === 0) return 0;

    const entries = this.getChannelEntries(channelId);
    const nowIso = new Date().toISOString();
    const cutoffDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));

    let addedCount = 0;
    for (const key of reserved) {
      if (!entries.some(e => e.key === key)) {
        entries.push({
          key,
          usedAt: nowIso,
          runId
        });
        addedCount++;
      }
    }

    // Aplica janela de retenção: remove itens mais antigos ou limita a maxItems
    const filtered = entries
      .filter(e => new Date(e.usedAt) >= cutoffDate)
      .slice(-this.maxItems);

    this.channels[channelId] = filtered;
    this.reservations.delete(channelId);

    this.save();
    return addedCount;
  }

  /**
   * Descarta reservas não confirmadas (caso ocorra erro antes do término do vídeo)
   */
  rollback(channelId = 'custom') {
    this.reservations.delete(channelId);
  }

  /**
   * Devolve um Set contendo todas as chaves (usadas + reservadas) para fácil consulta
   */
  getAllUsedKeys(channelId = 'custom') {
    const keys = new Set();
    const entries = this.getChannelEntries(channelId);
    for (const e of entries) {
      keys.add(e.key);
    }
    const reserved = this.reservations.get(channelId);
    if (reserved) {
      for (const k of reserved) {
        keys.add(k);
      }
    }
    return keys;
  }
}

// Instância singleton global
let defaultLedgerInstance = null;

export function getMediaLedger(filePath = DEFAULT_LEDGER_PATH) {
  if (!defaultLedgerInstance || defaultLedgerInstance.ledgerPath !== filePath) {
    defaultLedgerInstance = new MediaLedger(filePath);
  }
  return defaultLedgerInstance;
}
