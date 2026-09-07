package com.autopublisher.domain.model;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TenantModelTest {

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Deve criar TenantConfig com defaults corretos")
    void shouldCreateTenantConfigWithDefaults() {
        TenantConfig config = new TenantConfig(
            "cliente-1",
            "Canal Piloto",
            "key-123",
            "sheet-1",
            null,
            "client-id",
            "secret",
            "refresh",
            null,
            null,
            null,
            true,
            null
        );

        assertThat(config.tenantId()).isEqualTo("cliente-1");
        assertThat(config.name()).isEqualTo("Canal Piloto");
        assertThat(config.sheetTabName()).isEqualTo("Cronograma");
        assertThat(config.active()).isTrue();
        assertThat(config.createdAt()).isNotNull();

        TenantConfig updated = config.withApiKey("new-key-456").withActive(false);
        assertThat(updated.apiKey()).isEqualTo("new-key-456");
        assertThat(updated.active()).isFalse();
    }

    @Test
    @DisplayName("Deve validar campos obrigatorios de TenantConfig")
    void shouldValidateRequiredFieldsInTenantConfig() {
        assertThatThrownBy(() -> new TenantConfig(null, "Name", "key", null, null, null, null, null, null, null, null, true, null))
            .isInstanceOf(NullPointerException.class);

        assertThatThrownBy(() -> new TenantConfig("id", null, "key", null, null, null, null, null, null, null, null, true, null))
            .isInstanceOf(NullPointerException.class);

        assertThatThrownBy(() -> new TenantConfig("id", "Name", null, null, null, null, null, null, null, null, null, true, null))
            .isInstanceOf(NullPointerException.class);
    }

    @Test
    @DisplayName("Deve propagar e limpar TenantContext no TenantContextHolder")
    void shouldPropagateAndClearTenantContext() {
        assertThat(TenantContextHolder.get()).isEmpty();
        assertThat(TenantContextHolder.getRequiredTenantId()).isEqualTo("default");

        TenantContext ctx = TenantContext.of("tenant-abc", "Canal ABC");
        TenantContextHolder.set(ctx);

        assertThat(TenantContextHolder.get()).isPresent();
        assertThat(TenantContextHolder.get().get().tenantId()).isEqualTo("tenant-abc");
        assertThat(TenantContextHolder.get().get().isMasterAdmin()).isFalse();
        assertThat(TenantContextHolder.getRequiredTenantId()).isEqualTo("tenant-abc");

        TenantContextHolder.clear();
        assertThat(TenantContextHolder.get()).isEmpty();
    }

    @Test
    @DisplayName("Deve reconhecer contexto Master Admin")
    void shouldRecognizeMasterAdminContext() {
        TenantContext master = TenantContext.masterAdmin();
        assertThat(master.tenantId()).isEqualTo("master-admin");
        assertThat(master.isMasterAdmin()).isTrue();
    }
}
