package com.autopublisher.infrastructure.adapter.tenant;

import com.autopublisher.application.port.out.TenantRepositoryPort;
import com.autopublisher.domain.model.TenantConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Adaptador de repositorio de tenants em memoria (thread-safe).
 * Inicializa com o Tenant Default para 100% de compatibilidade com single-tenant.
 */
@Component
public class InMemoryTenantRepositoryAdapter implements TenantRepositoryPort {

    private static final Logger log = LoggerFactory.getLogger(InMemoryTenantRepositoryAdapter.class);

    private final ConcurrentHashMap<String, TenantConfig> tenantsById = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> tenantIdByApiKey = new ConcurrentHashMap<>();

    @Value("${autopublisher.security.api-key:}")
    private String defaultApiKey;

    @Value("${autopublisher.sheets.spreadsheet-id:}")
    private String defaultSpreadsheetId;

    @Value("${autopublisher.sheets.tab-name:Cronograma}")
    private String defaultTabName;

    @Value("${autopublisher.youtube.client-id:}")
    private String defaultYoutubeClientId;

    @Value("${autopublisher.youtube.client-secret:}")
    private String defaultYoutubeClientSecret;

    @Value("${autopublisher.youtube.refresh-token:}")
    private String defaultYoutubeRefreshToken;

    @PostConstruct
    public void init() {
        String key = (defaultApiKey != null && !defaultApiKey.isBlank())
            ? defaultApiKey
            : "dev-local-api-key";

        TenantConfig defaultTenant = new TenantConfig(
            "default",
            "Default Workspace",
            key,
            defaultSpreadsheetId,
            defaultTabName,
            defaultYoutubeClientId,
            defaultYoutubeClientSecret,
            defaultYoutubeRefreshToken,
            null,
            null,
            null,
            true,
            Instant.now()
        );

        save(defaultTenant);
        log.info("[SaaS] Tenant default inicializado com sucesso (id='default')");
    }

    @Override
    public Optional<TenantConfig> findById(String tenantId) {
        if (tenantId == null) return Optional.empty();
        return Optional.ofNullable(tenantsById.get(tenantId.toLowerCase()));
    }

    @Override
    public Optional<TenantConfig> findByApiKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return Optional.empty();
        String tenantId = tenantIdByApiKey.get(apiKey);
        if (tenantId == null) return Optional.empty();
        return findById(tenantId);
    }

    @Override
    public TenantConfig save(TenantConfig tenant) {
        String id = tenant.tenantId().toLowerCase();
        // Remove mapeamento de chave anterior se for rotacao
        TenantConfig old = tenantsById.get(id);
        if (old != null && !old.apiKey().equals(tenant.apiKey())) {
            tenantIdByApiKey.remove(old.apiKey());
        }

        tenantsById.put(id, tenant);
        tenantIdByApiKey.put(tenant.apiKey(), id);
        return tenant;
    }

    @Override
    public List<TenantConfig> findAll() {
        return new ArrayList<>(tenantsById.values());
    }

    @Override
    public boolean deleteById(String tenantId) {
        if (tenantId == null) return false;
        String id = tenantId.toLowerCase();
        TenantConfig removed = tenantsById.remove(id);
        if (removed != null) {
            tenantIdByApiKey.remove(removed.apiKey());
            return true;
        }
        return false;
    }
}
