package com.autopublisher.application.port.in;

public record CreateTenantCommand(
    String tenantId,
    String name,
    String customApiKey,
    String spreadsheetId,
    String sheetTabName,
    String youtubeClientId,
    String youtubeClientSecret,
    String youtubeRefreshToken,
    String instagramAccountId,
    String instagramAccessToken,
    String tiktokAccessToken
) {}
