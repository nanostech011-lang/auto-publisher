/**
 * AutoPublisher Pro - Script History & Anti-Duplication Ledger
 * 
 * Mantém o histórico criptográfico de narrações em pipeline/state/script_history.json
 * para evitar publicações de conteúdo repetido ou desmonetização por duplicatas.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { calculateDiceTrigramSimilarity } from './qc_gate.js';

export class ScriptLedger {
  constructor(ledgerPath = path.resolve('pipeline/state/script_history.json')) {
    this.ledgerPath = ledgerPath;
    this.history = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.ledgerPath)) {
        const data = fs.readFileSync(this.ledgerPath, 'utf8');
        this.history = JSON.parse(data);
      } else {
        const dir = path.dirname(this.ledgerPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        this.history = [];
      }
    } catch (e) {
      console.warn(`[Script Ledger] Falha ao carregar histórico: ${e.message}`);
      this.history = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(this.ledgerPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.ledgerPath, JSON.stringify(this.history, null, 2), 'utf8');
    } catch (e) {
      console.warn(`[Script Ledger] Falha ao salvar histórico: ${e.message}`);
    }
  }

  /**
   * Calcula hash SHA-1 de uma narração normalizada
   */
  hashNarration(text = '') {
    const normalized = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
    return crypto.createHash('sha1').update(normalized).digest('hex');
  }

  /**
   * Verifica se a narração já foi gerada ou se possui alta similaridade com histórico do canal
   */
  checkNovelty(narrationText = '', channelId = 'custom', threshold = 0.55) {
    const sha1 = this.hashNarration(narrationText);
    const channelEntries = this.history.filter(h => h.channelId === channelId);

    // 1. Ineditismo exato por hash SHA-1
    const exactMatch = channelEntries.find(h => h.sha1 === sha1);
    if (exactMatch) {
      return {
        novel: false,
        reason: 'DUPLICATE_EXACT_HASH',
        similarity: 1.0,
        matchedId: exactMatch.id
      };
    }

    // 2. Similaridade semântica por trigramas de Dice
    let highestSim = 0;
    let matchedEntry = null;

    for (const entry of channelEntries) {
      const sim = calculateDiceTrigramSimilarity(narrationText, entry.narrationText);
      if (sim > highestSim) {
        highestSim = sim;
        matchedEntry = entry;
      }
    }

    if (highestSim > threshold) {
      return {
        novel: false,
        reason: 'HIGH_SEMANTIC_SIMILARITY',
        similarity: Number(highestSim.toFixed(3)),
        matchedId: matchedEntry?.id
      };
    }

    return {
      novel: true,
      similarity: Number(highestSim.toFixed(3)),
      sha1
    };
  }

  /**
   * Registra novo roteiro no ledger
   */
  recordScript({ id, channelId, topic, title, narrationText }) {
    const sha1 = this.hashNarration(narrationText);
    this.history.push({
      id: id || `SCRIPT_${Date.now()}`,
      channelId: channelId || 'custom',
      topic: topic || '',
      title: title || '',
      sha1,
      narrationText: narrationText || '',
      createdAt: new Date().toISOString()
    });

    // Mantém no máximo 500 registros mais recentes
    if (this.history.length > 500) {
      this.history = this.history.slice(-500);
    }

    this.save();
  }
}

export const globalScriptLedger = new ScriptLedger();
export default ScriptLedger;
