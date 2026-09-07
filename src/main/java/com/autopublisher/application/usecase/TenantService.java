package com.autopublisher.application.usecase;

import com.autopublisher.application.port.in.CreateTenantCommand;
import com.autopublisher.application.port.in.ManageTenantUseCase;
import com.autopublisher.application.port.in.TenantSummaryDto;
import com.autopublisher.application.port.out.TenantRepositoryPort;
import com.autopublisher.domain.model.TenantConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Implementacao do caso de uso de gestao de Tenants (SaaS Multi-Tenant).
 */
@Service
public class TenantService implements ManageTenantUseCase {

    private static final Logger log = LoggerFactory.getLogger(TenantService.class);

    private final TenantRepositoryPort tenantRepository;

    public TenantService(TenantRepositoryPort tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    @Override
    public TenantConfig createTenant(CreateTenantCommand command) {
        Objects.requireNonNull(command, "command must not be null");
        String tenantId = (command.tenantId() != null && !command.tenantId().isBlank())
            ? command.tenantId().trim().toLowerCase()
            : "tenant-" + UUID.randomUUID().toString().substring(0, 8);

        if (tenantRepository.findById(tenantId).isPresent()) {
            throw new IllegalArgumentException("Tenant ja cadastrado com o ID: " + tenantId);
        }

        String apiKey = (command.customApiKey() != null && !command.customApiKey().isBlank())
            ? command.customApiKey().trim()
            : generateSecureApiKey();

        TenantConfig tenant = new TenantConfig(
            tenantId,
            command.name() != null ? command.name() : tenantId,
            apiKey,
            command.spreadsheetId(),
            command.sheetTabName(),
            command.youtubeClientId(),
            command.youtubeClientSecret(),
            command.youtubeRefreshToken(),
            command.instagramAccountId(),
            command.instagramAccessToken(),
            command.tiktokAccessToken(),
            true,
            Instant.now()
        );

        TenantConfig saved = tenantRepository.save(tenant);
        log.info("[SaaS] Novo tenant provisionado com sucesso: id='{}', name='{}'", tenantId, saved.name());
        return saved;
    }

    @Override
    public Optional<TenantConfig> getTenant(String tenantId) {
        return tenantRepository.findById(tenantId);
    }

    @Override
    public Optional<TenantConfig> findByApiKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }
        return tenantRepository.findByApiKey(apiKey);
    }

    @Override
    public List<TenantSummaryDto> listTenants() {
        return tenantRepository.findAll().stream()
            .map(TenantSummaryDto::from)
            .toList();
    }

    @Override
    public TenantConfig rotateApiKey(String tenantId) {
        TenantConfig existing = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Tenant nao encontrado: " + tenantId));

        String newKey = generateSecureApiKey();
        TenantConfig updated = existing.withApiKey(newKey);
        tenantRepository.save(updated);
        log.info("[SaaS] Chave de API rotacionada para o tenant: '{}'", tenantId);
        return updated;
    }

    @Override
    public TenantConfig updateTenantStatus(String tenantId, boolean active) {
        TenantConfig existing = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Tenant nao encontrado: " + tenantId));

        TenantConfig updated = existing.withActive(active);
        tenantRepository.save(updated);
        log.info("[SaaS] Status do tenant '{}' atualizado para active={}", tenantId, active);
        return updated;
    }

    @Override
    public boolean deleteTenant(String tenantId) {
        return tenantRepository.deleteById(tenantId);
    }

    private String generateSecureApiKey() {
        return "sec_live_" + UUID.randomUUID().toString().replace("-", "");
    }
}
