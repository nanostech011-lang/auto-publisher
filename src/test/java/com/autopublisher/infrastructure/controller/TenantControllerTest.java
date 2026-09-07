package com.autopublisher.infrastructure.controller;

import com.autopublisher.application.port.in.CreateTenantCommand;
import com.autopublisher.application.port.in.ManageTenantUseCase;
import com.autopublisher.application.port.in.TenantSummaryDto;
import com.autopublisher.domain.model.TenantConfig;
import com.autopublisher.domain.model.TenantContext;
import com.autopublisher.domain.model.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantControllerTest {

    @Mock
    private ManageTenantUseCase tenantUseCase;

    private TenantController controller;

    @BeforeEach
    void setUp() {
        controller = new TenantController(tenantUseCase);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Deve permitir Master Admin criar novo tenant")
    void shouldAllowMasterAdminToCreateTenant() {
        TenantContextHolder.set(TenantContext.masterAdmin());
        TenantConfig created = new TenantConfig("c1", "Cliente 1", "sec_live_123", "sheet-1", "Cronograma", null, null, null, null, null, null, true, Instant.now());
        when(tenantUseCase.createTenant(any())).thenReturn(created);

        CreateTenantCommand cmd = new CreateTenantCommand("c1", "Cliente 1", null, "sheet-1", "Cronograma", null, null, null, null, null, null);
        ResponseEntity<?> res = controller.createTenant(cmd);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(res.getBody()).isEqualTo(created);
    }

    @Test
    @DisplayName("Deve bloquear usuario sem Master Admin de criar tenant")
    void shouldForbidNonMasterAdminFromCreatingTenant() {
        TenantContextHolder.set(TenantContext.of("user-1", "User"));

        CreateTenantCommand cmd = new CreateTenantCommand("c2", "C2", null, null, null, null, null, null, null, null, null);
        ResponseEntity<?> res = controller.createTenant(cmd);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(tenantUseCase);
    }

    @Test
    @DisplayName("Deve listar tenants quando for Master Admin")
    void shouldListTenantsForMasterAdmin() {
        TenantContextHolder.set(TenantContext.masterAdmin());
        when(tenantUseCase.listTenants()).thenReturn(List.of(
            new TenantSummaryDto("c1", "C1", "sec_...", "sheet", "Cronograma", true, Instant.now())
        ));

        ResponseEntity<?> res = controller.listTenants();
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("Deve rotacionar chave de API para o proprio tenant")
    void shouldRotateApiKeyForOwnTenant() {
        TenantContextHolder.set(TenantContext.of("c1", "C1"));
        TenantConfig updated = new TenantConfig("c1", "C1", "new_key", null, null, null, null, null, null, null, null, true, Instant.now());
        when(tenantUseCase.rotateApiKey("c1")).thenReturn(updated);

        ResponseEntity<?> res = controller.rotateApiKey("c1");
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("Deve proibir tenant de rotacionar chave de outro tenant")
    void shouldForbidTenantFromRotatingKeyOfAnotherTenant() {
        TenantContextHolder.set(TenantContext.of("c1", "C1"));

        ResponseEntity<?> res = controller.rotateApiKey("c2");
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(tenantUseCase);
    }
}
