package com.autopublisher.infrastructure.adapter.tenant;

import com.autopublisher.domain.model.TenantConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryTenantRepositoryAdapterTest {

    private InMemoryTenantRepositoryAdapter repository;

    @BeforeEach
    void setUp() {
        repository = new InMemoryTenantRepositoryAdapter();
        repository.init();
    }

    @Test
    @DisplayName("Deve inicializar com tenant default")
    void shouldInitializeWithDefaultTenant() {
        Optional<TenantConfig> def = repository.findById("default");
        assertThat(def).isPresent();
        assertThat(def.get().tenantId()).isEqualTo("default");
        assertThat(def.get().active()).isTrue();
    }

    @Test
    @DisplayName("Deve salvar, buscar por ID e buscar por API Key")
    void shouldSaveAndFindByApiKey() {
        TenantConfig tenant = new TenantConfig(
            "client-a",
            "Client A",
            "key-secret-a",
            "sheet-a",
            "Cronograma",
            null,
            null,
            null,
            null,
            null,
            null,
            true,
            Instant.now()
        );

        repository.save(tenant);

        assertThat(repository.findById("client-a")).isPresent();
        assertThat(repository.findByApiKey("key-secret-a")).isPresent();
        assertThat(repository.findByApiKey("key-secret-a").get().tenantId()).isEqualTo("client-a");
        assertThat(repository.findAll()).hasSize(2); // default + client-a
    }

    @Test
    @DisplayName("Deve deletar tenant e desmapear chave")
    void shouldDeleteTenantAndUnmapApiKey() {
        TenantConfig tenant = new TenantConfig(
            "client-b",
            "Client B",
            "key-secret-b",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            true,
            Instant.now()
        );

        repository.save(tenant);
        assertThat(repository.findByApiKey("key-secret-b")).isPresent();

        boolean deleted = repository.deleteById("client-b");
        assertThat(deleted).isTrue();
        assertThat(repository.findById("client-b")).isEmpty();
        assertThat(repository.findByApiKey("key-secret-b")).isEmpty();
    }
}
