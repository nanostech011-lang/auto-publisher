package com.autopublisher.application.port.in;

import com.autopublisher.domain.model.TenantConfig;

import java.time.Instant;

public record TenantSummaryDto(
    String tenantId,
    String name,
    String maskedApiKey,
    String spreadsheetId,
    String sheetTabName,
    boolean active,
    Instant createdAt
) {
    public static TenantSummaryDto from(TenantConfig config) {
        String key = config.apiKey();
        String masked = key.length() > 8 
            ? key.substring(0, 4) + "..." + key.substring(key.length() - 4)
            : "****";
        return new TenantSummaryDto(
            config.tenantId(),
            config.name(),
            masked,
            config.spreadsheetId(),
            config.sheetTabName(),
            config.active(),
            config.createdAt()
        );
    }
}
