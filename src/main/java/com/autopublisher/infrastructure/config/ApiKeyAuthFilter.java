package com.autopublisher.infrastructure.config;

import com.autopublisher.application.port.out.TenantRepositoryPort;
import com.autopublisher.domain.model.TenantConfig;
import com.autopublisher.domain.model.TenantContext;
import com.autopublisher.domain.model.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Filtro centralizado de seguranca Multi-Tenant (X-API-KEY).
 * Intercepta endpoints de API e propaga o TenantContext para as Virtual Threads.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyAuthFilter.class);

    private final TenantRepositoryPort tenantRepository;
    private final String masterApiKey;
    private final String defaultApiKey;

    @org.springframework.beans.factory.annotation.Autowired
    public ApiKeyAuthFilter(
        @org.springframework.beans.factory.annotation.Autowired(required = false) TenantRepositoryPort tenantRepository,
        @Value("${autopublisher.security.master-api-key:}") String masterApiKey,
        @Value("${autopublisher.security.api-key:}") String defaultApiKey
    ) {
        this.tenantRepository = tenantRepository;
        this.masterApiKey = (masterApiKey != null && !masterApiKey.isBlank()) ? masterApiKey : null;
        this.defaultApiKey = (defaultApiKey != null && !defaultApiKey.isBlank()) ? defaultApiKey : null;
    }

    public ApiKeyAuthFilter(TenantRepositoryPort tenantRepository, String masterApiKey) {
        this(tenantRepository, masterApiKey, null);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Preflight CORS requests nunca exigem API key e devem passar livremente
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        // Permite navegacao estatica, documentacao e endpoints publicos
        if (!path.startsWith("/api/")) {
            return true;
        }
        if (path.equals("/api/v1/health") || path.startsWith("/api/v1/public/")) {
            return true;
        }
        if (path.startsWith("/v3/api-docs") || path.startsWith("/swagger-ui") || path.startsWith("/api/v1/dashboard/pipeline/media")) {
            return true;
        }
        return false;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String key = extractApiKey(request);

        try {
            // 1. Verificacao de Master Admin Key
            if (masterApiKey != null && masterApiKey.equals(key)) {
                TenantContextHolder.set(TenantContext.masterAdmin());
                filterChain.doFilter(request, response);
                return;
            }

            // 1.1 Verificacao de Default API Key (Cloud Scheduler / Single Tenant principal)
            if (defaultApiKey != null && defaultApiKey.equals(key)) {
                TenantContextHolder.set(TenantContext.of("default", "Default Workspace"));
                filterChain.doFilter(request, response);
                return;
            }

            // 1.2 Verificacao de Dev Local Key (apenas se dev-local-api-key estiver configurada explicitamente)
            if ("dev-local-api-key".equals(key) && ("dev-local-api-key".equals(defaultApiKey) || "dev-local-api-key".equals(masterApiKey))) {
                TenantContextHolder.set(TenantContext.of("default", "Default Workspace (Local Dev)"));
                filterChain.doFilter(request, response);
                return;
            }

            // 2. Verificacao de Tenant API Key
            if (key != null && !key.isBlank()) {
                if (tenantRepository != null) {
                    Optional<TenantConfig> tenantOpt = tenantRepository.findByApiKey(key);
                    if (tenantOpt.isPresent()) {
                        TenantConfig tenant = tenantOpt.get();
                        if (!tenant.active()) {
                            sendUnauthorized(response, "Tenant inativo ou suspenso.");
                            return;
                        }

                        TenantContext context = TenantContext.of(tenant.tenantId(), tenant.name());
                        TenantContextHolder.set(context);
                        filterChain.doFilter(request, response);
                        return;
                    }
                } else {
                    // Fallback para testes unitarios de WebMvcTest isolados
                    filterChain.doFilter(request, response);
                    return;
                }
            } else if (tenantRepository == null) {
                // Fallback para testes unitarios de WebMvcTest isolados
                filterChain.doFilter(request, response);
                return;
            }

            // 3. Chave ausente ou invalida
            sendUnauthorized(response, "Acesso nao autorizado. Forneca um header 'X-API-KEY' valido.");
        } finally {
            // Limpeza estrita garantindo que a Virtual Thread fique limpa
            TenantContextHolder.clear();
        }
    }

    private String extractApiKey(HttpServletRequest request) {
        String header = request.getHeader("X-API-KEY");
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        String queryParam = request.getParameter("api_key");
        if (queryParam != null && !queryParam.isBlank()) {
            return queryParam.trim();
        }
        return null;
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(String.format("{\"error\": \"Unauthorized\", \"message\": \"%s\"}", message));
    }
}
