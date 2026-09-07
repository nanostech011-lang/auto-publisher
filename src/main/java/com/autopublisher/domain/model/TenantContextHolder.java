package com.autopublisher.domain.model;

import java.util.Optional;

/**
 * Propagador de contexto do Tenant ativo para Virtual Threads.
 * Garante isolamento estrito entre requisicoes de clientes concorrentes.
 */
public final class TenantContextHolder {

    private static final ThreadLocal<TenantContext> CONTEXT = new ThreadLocal<>();

    private TenantContextHolder() {}

    public static void set(TenantContext context) {
        CONTEXT.set(context);
    }

    public static Optional<TenantContext> get() {
        return Optional.ofNullable(CONTEXT.get());
    }

    public static String getRequiredTenantId() {
        return get()
            .map(TenantContext::tenantId)
            .orElse("default");
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
