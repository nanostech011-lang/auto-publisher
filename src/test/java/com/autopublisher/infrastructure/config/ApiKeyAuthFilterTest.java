package com.autopublisher.infrastructure.config;

import com.autopublisher.application.port.out.TenantRepositoryPort;
import com.autopublisher.domain.model.TenantConfig;
import com.autopublisher.domain.model.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApiKeyAuthFilterTest {

    @Mock
    private TenantRepositoryPort tenantRepository;

    @Mock
    private FilterChain filterChain;

    private ApiKeyAuthFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ApiKeyAuthFilter(tenantRepository, "master-key-123");
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Deve liberar rotas estaticas sem filtro")
    void shouldIgnoreStaticAndNonApiRoutes() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/index.html");
        assertThat(filter.shouldNotFilter(req)).isTrue();

        MockHttpServletRequest healthReq = new MockHttpServletRequest("GET", "/api/v1/health");
        assertThat(filter.shouldNotFilter(healthReq)).isTrue();

        MockHttpServletRequest apiReq = new MockHttpServletRequest("GET", "/api/v1/dashboard/overview");
        assertThat(filter.shouldNotFilter(apiReq)).isFalse();
    }

    @Test
    @DisplayName("Deve autenticar com Master Admin Key")
    void shouldAuthenticateWithMasterAdminKey() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/v1/tenants");
        req.addHeader("X-API-KEY", "master-key-123");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, filterChain);

        assertThat(res.getStatus()).isEqualTo(200);
        verify(filterChain).doFilter(req, res);
    }

    @Test
    @DisplayName("Deve autenticar tenant ativo e propagar contexto")
    void shouldAuthenticateActiveTenant() throws ServletException, IOException {
        TenantConfig tenant = new TenantConfig("tenant-1", "T1", "valid-key", null, null, null, null, null, null, null, null, true, Instant.now());
        when(tenantRepository.findByApiKey("valid-key")).thenReturn(Optional.of(tenant));

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/v1/dashboard/overview");
        req.addHeader("X-API-KEY", "valid-key");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, filterChain);

        assertThat(res.getStatus()).isEqualTo(200);
        verify(filterChain).doFilter(req, res);
    }

    @Test
    @DisplayName("Deve rejeitar tenant inativo com 401")
    void shouldRejectInactiveTenant() throws ServletException, IOException {
        TenantConfig tenant = new TenantConfig("tenant-off", "Off", "off-key", null, null, null, null, null, null, null, null, false, Instant.now());
        when(tenantRepository.findByApiKey("off-key")).thenReturn(Optional.of(tenant));

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/v1/dashboard/overview");
        req.addHeader("X-API-KEY", "off-key");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, filterChain);

        assertThat(res.getStatus()).isEqualTo(401);
        assertThat(res.getContentAsString()).contains("Tenant inativo");
        verifyNoInteractions(filterChain);
    }

    @Test
    @DisplayName("Deve rejeitar chave ausente com 401")
    void shouldRejectMissingKey() throws ServletException, IOException {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/v1/dashboard/overview");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, filterChain);

        assertThat(res.getStatus()).isEqualTo(401);
        assertThat(res.getContentAsString()).contains("Acesso nao autorizado");
        verifyNoInteractions(filterChain);
    }
}
