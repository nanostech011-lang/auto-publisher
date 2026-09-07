package com.autopublisher.application.port.in;

import com.autopublisher.domain.model.TenantConfig;

import java.util.List;
import java.util.Optional;

/**
 * Porta de entrada para gestao de clientes e tenants (SaaS).
 */
public interface ManageTenantUseCase {
    TenantConfig createTenant(CreateTenantCommand command);
    Optional<TenantConfig> getTenant(String tenantId);
    Optional<TenantConfig> findByApiKey(String apiKey);
    List<TenantSummaryDto> listTenants();
    TenantConfig rotateApiKey(String tenantId);
    TenantConfig updateTenantStatus(String tenantId, boolean active);
    boolean deleteTenant(String tenantId);
}
