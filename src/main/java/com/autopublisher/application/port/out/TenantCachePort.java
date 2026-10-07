package com.autopublisher.application.port.out;

/**
 * Porta de saida para invalidacao de cache de clientes ou configuracoes de Tenants.
 */
public interface TenantCachePort {
    /**
     * Invalida as referencias cacheadas do tenant especificado.
     *
     * @param tenantId Identificador do tenant
     */
    void evict(String tenantId);
}
