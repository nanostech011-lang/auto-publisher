package com.autopublisher.application.usecase;

import com.autopublisher.application.port.in.CreateTenantCommand;
import com.autopublisher.application.port.in.TenantSummaryDto;
import com.autopublisher.application.port.out.TenantRepositoryPort;
import com.autopublisher.domain.model.TenantConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.autopublisher.application.port.out.TenantCachePort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantServiceTest {

    @Mock
    private TenantRepositoryPort tenantRepository;

    @Mock
    private TenantCachePort tenantCachePort;

    private TenantService tenantService;

    @BeforeEach
    void setUp() {
        tenantService = new TenantService(tenantRepository, tenantCachePort);
    }

    @Test
    @DisplayName("Deve criar novo tenant com chave de API gerada")
    void shouldCreateNewTenantSuccessfully() {
        when(tenantRepository.findById("cliente-x")).thenReturn(Optional.empty());
        when(tenantRepository.save(any(TenantConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateTenantCommand command = new CreateTenantCommand(
            "cliente-x",
            "Cliente X",
            null,
            "sheet-123",
            "Cronograma",
            "yt-client",
            "yt-secret",
            "yt-refresh",
            null,
            null,
            null
        );

        TenantConfig created = tenantService.createTenant(command);

        assertThat(created).isNotNull();
        assertThat(created.tenantId()).isEqualTo("cliente-x");
        assertThat(created.apiKey()).startsWith("sec_live_");
        assertThat(created.active()).isTrue();
        verify(tenantRepository).save(any(TenantConfig.class));
    }

    @Test
    @DisplayName("Deve rejeitar criacao de tenant com ID duplicado")
    void shouldRejectDuplicateTenantId() {
        TenantConfig existing = new TenantConfig("dup", "Dup", "key", null, null, null, null, null, null, null, null, true, Instant.now());
        when(tenantRepository.findById("dup")).thenReturn(Optional.of(existing));

        CreateTenantCommand command = new CreateTenantCommand("dup", "Dup", null, null, null, null, null, null, null, null, null);

        assertThatThrownBy(() -> tenantService.createTenant(command))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Tenant ja cadastrado");
    }

    @Test
    @DisplayName("Deve rotacionar chave de API de tenant existente e invalidar cache")
    void shouldRotateApiKey() {
        TenantConfig existing = new TenantConfig("t-1", "T1", "old-key", null, null, null, null, null, null, null, null, true, Instant.now());
        when(tenantRepository.findById("t-1")).thenReturn(Optional.of(existing));

        TenantConfig updated = tenantService.rotateApiKey("t-1");

        assertThat(updated.apiKey()).isNotEqualTo("old-key");
        assertThat(updated.apiKey()).startsWith("sec_live_");
        verify(tenantRepository).save(updated);
        verify(tenantCachePort).evict("t-1");
    }

    @Test
    @DisplayName("Deve listar resumos de tenants mascarando as chaves de API")
    void shouldListTenantsWithMaskedKeys() {
        TenantConfig t1 = new TenantConfig("t-1", "T1", "sec_live_12345678abcdef", "s-1", "Cronograma", null, null, null, null, null, null, true, Instant.now());
        when(tenantRepository.findAll()).thenReturn(List.of(t1));

        List<TenantSummaryDto> list = tenantService.listTenants();

        assertThat(list).hasSize(1);
        assertThat(list.get(0).tenantId()).isEqualTo("t-1");
        assertThat(list.get(0).maskedApiKey()).contains("...");
    }

    @Test
    @DisplayName("Deve atualizar status, invalidar cache e remover tenant")
    void shouldUpdateStatusAndDeleteTenant() {
        TenantConfig existing = new TenantConfig("t-1", "T1", "k", null, null, null, null, null, null, null, null, true, Instant.now());
        when(tenantRepository.findById("t-1")).thenReturn(Optional.of(existing));
        when(tenantRepository.deleteById("t-1")).thenReturn(true);

        TenantConfig deactivated = tenantService.updateTenantStatus("t-1", false);
        assertThat(deactivated.active()).isFalse();
        verify(tenantCachePort).evict("t-1");

        boolean deleted = tenantService.deleteTenant("t-1");
        assertThat(deleted).isTrue();
        verify(tenantCachePort, times(2)).evict("t-1");
    }

    @Test
    @DisplayName("Deve buscar tenant por ID e por ApiKey com tratativa de nulo e em branco")
    void shouldFindTenantByIdAndApiKey() {
        TenantConfig t = new TenantConfig("t-1", "T1", "sec_123", null, null, null, null, null, null, null, null, true, Instant.now());
        when(tenantRepository.findById("t-1")).thenReturn(Optional.of(t));
        when(tenantRepository.findByApiKey("sec_123")).thenReturn(Optional.of(t));

        assertThat(tenantService.getTenant("t-1")).contains(t);
        assertThat(tenantService.findByApiKey("sec_123")).contains(t);
        assertThat(tenantService.findByApiKey(null)).isEmpty();
        assertThat(tenantService.findByApiKey("  ")).isEmpty();
    }

    @Test
    @DisplayName("Deve lancar excecao ao rotacionar chave ou atualizar status de tenant inexistente")
    void shouldThrowWhenTenantNotFound() {
        when(tenantRepository.findById("inexistente")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tenantService.rotateApiKey("inexistente"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Tenant nao encontrado");

        assertThatThrownBy(() -> tenantService.updateTenantStatus("inexistente", false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Tenant nao encontrado");
    }
}
