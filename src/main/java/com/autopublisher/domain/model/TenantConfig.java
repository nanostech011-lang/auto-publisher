package com.autopublisher.domain.model;

import java.time.Instant;
import java.util.Objects;

/**
 * Configuracao e credenciais de um Tenant (Cliente SaaS).
 * Contem chaves isoladas de API e conexoes de redes sociais.
 */
public record TenantConfig(
    String tenantId,
    String name,
    String apiKey,
    String spreadsheetId,
    String sheetTabName,
    String youtubeClientId,
    String youtubeClientSecret,
    String youtubeRefreshToken,
    String instagramAccountId,
    String instagramAccessToken,
    String tiktokAccessToken,
    boolean active,
    Instant createdAt
) {
    public TenantConfig {
        Objects.requireNonNull(tenantId, "tenantId must not be null");
        Objects.requireNonNull(name, "name must not be null");
        Objects.requireNonNull(apiKey, "apiKey must not be null");
        if (sheetTabName == null || sheetTabName.isBlank()) {
            sheetTabName = "Cronograma";
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public TenantConfig withApiKey(String newApiKey) {
        return new TenantConfig(
            this.tenantId,
            this.name,
            newApiKey,
            this.spreadsheetId,
            this.sheetTabName,
            this.youtubeClientId,
            this.youtubeClientSecret,
            this.youtubeRefreshToken,
            this.instagramAccountId,
            this.instagramAccessToken,
            this.tiktokAccessToken,
            this.active,
            this.createdAt
        );
    }

    public TenantConfig withActive(boolean newActive) {
        return new TenantConfig(
            this.tenantId,
            this.name,
            this.apiKey,
            this.spreadsheetId,
            this.sheetTabName,
            this.youtubeClientId,
            this.youtubeClientSecret,
            this.youtubeRefreshToken,
            this.instagramAccountId,
            this.instagramAccessToken,
            this.tiktokAccessToken,
            newActive,
            this.createdAt
        );
    }
}
