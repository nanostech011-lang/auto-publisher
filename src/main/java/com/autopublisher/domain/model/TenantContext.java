package com.autopublisher.domain.model;

import java.util.List;
import java.util.Objects;

/**
 * Contexto imutavel do Tenant ativo na requisicao corrente (ThreadLocal / ScopedValue).
 * Totalmente compativel com Virtual Threads (Project Loom) do Java 21 LTS.
 */
public record TenantContext(
    String tenantId,
    String name,
    List<String> roles
) {
    public TenantContext {
        Objects.requireNonNull(tenantId, "tenantId must not be null");
        if (name == null || name.isBlank()) {
            name = tenantId;
        }
        if (roles == null) {
            roles = List.of("TENANT_USER");
        }
    }

    public static TenantContext of(String tenantId, String name) {
        return new TenantContext(tenantId, name, List.of("TENANT_USER"));
    }

    public static TenantContext masterAdmin() {
        return new TenantContext("master-admin", "Master Administrator", List.of("ROLE_ADMIN", "TENANT_USER"));
    }

    public boolean isMasterAdmin() {
        return roles.contains("ROLE_ADMIN");
    }
}
