/**
 * AutoPublisher Pro - Provider & Model Circuit Breaker
 * 
 * Gerencia a disponibilidade de APIs externas (Gemini, Pollinations, Pexels, Pixabay, Veo)
 * com classificação de erro e TTL configurável, evitando chamadas repetidas a endpoints mortos (404)
 * ou saturados (429).
 */

export class CircuitBreaker {
  constructor() {
    this.states = new Map(); // providerKey -> { state: 'CLOSED'|'OPEN'|'HALF_OPEN', failures: 0, nextAttemptTime: 0, reason: '' }
  }

  /**
   * Verifica se o provedor está disponível para receber chamadas
   */
  isAvailable(providerKey) {
    const entry = this.states.get(providerKey);
    if (!entry) return true;

    if (entry.state === 'OPEN') {
      const now = Date.now();
      if (now >= entry.nextAttemptTime) {
        entry.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Registra sucesso na chamada do provedor, resetando o circuito
   */
  recordSuccess(providerKey) {
    const entry = this.states.get(providerKey);
    if (entry) {
      entry.state = 'CLOSED';
      entry.failures = 0;
      entry.reason = '';
    }
  }

  /**
   * Registra falha e atualiza o estado com base na classificação do erro
   */
  recordFailure(providerKey, error) {
    const msg = String(error?.message || error || '');
    let ttlMs = 60 * 1000; // Padrão: 60s
    let isPermanentForRun = false;

    if (msg.includes('404') || msg.includes('not found') || msg.includes('no longer available')) {
      // 404 Modelo descontinuado ou ausente: abre permanentemente durante a execução
      ttlMs = 24 * 60 * 60 * 1000;
      isPermanentForRun = true;
    } else if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      // 429 Quota temporária / rate limit: 60 segundos de cooldown
      ttlMs = 60 * 1000;
    } else if (msg.includes('401') || msg.includes('403') || msg.includes('API_KEY_INVALID')) {
      // Autenticação inválida: permanente na execução
      ttlMs = 24 * 60 * 60 * 1000;
      isPermanentForRun = true;
    } else {
      // Erro de rede ou timeout: 30 segundos
      ttlMs = 30 * 1000;
    }

    const current = this.states.get(providerKey) || { state: 'CLOSED', failures: 0, nextAttemptTime: 0, reason: '' };
    current.failures += 1;
    current.state = 'OPEN';
    current.nextAttemptTime = Date.now() + ttlMs;
    current.reason = msg;
    this.states.set(providerKey, current);

    console.warn(`[Circuit Breaker] Provedor "${providerKey}" marcado como OPEN (${isPermanentForRun ? 'Permanente na run' : `Cooldown ${ttlMs / 1000}s`}): ${msg}`);
  }

  /**
   * Retorna motivo do bloqueio para logs
   */
  getBlockReason(providerKey) {
    const entry = this.states.get(providerKey);
    return entry ? entry.reason : '';
  }

  /**
   * Reinicia o estado do circuit breaker
   */
  reset() {
    this.states.clear();
  }
}

export const globalCircuitBreaker = new CircuitBreaker();
export default CircuitBreaker;
