package com.autopublisher.application.port.out;

import com.autopublisher.domain.model.TenantConfig;

import java.util.List;
import java.util.Optional;

/**
 * Porta de saida para persistencia e busca de Tenants.
 */
public interface TenantRepositoryPort {
    Optional<TenantConfig> findById(String tenantId);
    Optional<TenantConfig> findByApiKey(String apiKey);
    TenantConfig save(TenantConfig tenant);
    List<TenantConfig> findAll();
    boolean deleteById(String tenantId);
}
