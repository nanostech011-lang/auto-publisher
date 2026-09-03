package com.autopublisher.application.port.in;

/**
 * Payload para manipulacao e exportacao centralizada de todas as credenciais do sistema.
 */
public record CredentialsSettingsPayload(
        String apiKey,
        String spreadsheetId,
        String tabName,
        String youtubeClientId,
        String youtubeClientSecret,
        String youtubeRefreshToken,
        Boolean instagramEnabled,
        String instagramAccountId,
        String metaAccessToken,
        Boolean tiktokEnabled,
        String tiktokAccessToken
) {
    /**
     * Gera o conteudo textual pronto para o arquivo .env
     */
    public String toEnvFormat() {
        return "# ==============================================================================\n" +
                "# AutoPublisher Pro - Variaveis de Ambiente Geradas via Dashboard\n" +
                "# ==============================================================================\n\n" +
                "AUTO_PUBLISHER_API_KEY=" + (apiKey != null ? apiKey.trim() : "") + "\n\n" +
                "# Google Sheets & Drive\n" +
                "GOOGLE_SHEETS_SPREADSHEET_ID=" + (spreadsheetId != null ? spreadsheetId.trim() : "") + "\n" +
                "GOOGLE_SHEETS_TAB_NAME=" + (tabName != null && !tabName.trim().isEmpty() ? tabName.trim() : "Cronograma") + "\n\n" +
                "# YouTube Data API v3 (OAuth 2.0 Headless)\n" +
                "YOUTUBE_CLIENT_ID=" + (youtubeClientId != null ? youtubeClientId.trim() : "") + "\n" +
                "YOUTUBE_CLIENT_SECRET=" + (youtubeClientSecret != null ? youtubeClientSecret.trim() : "") + "\n" +
                "YOUTUBE_REFRESH_TOKEN=" + (youtubeRefreshToken != null ? youtubeRefreshToken.trim() : "") + "\n\n" +
                "# Meta Graph API (Instagram Reels)\n" +
                "INSTAGRAM_ENABLED=" + (Boolean.TRUE.equals(instagramEnabled) ? "true" : "false") + "\n" +
                "INSTAGRAM_BUSINESS_ACCOUNT_ID=" + (instagramAccountId != null ? instagramAccountId.trim() : "") + "\n" +
                "META_ACCESS_TOKEN=" + (metaAccessToken != null ? metaAccessToken.trim() : "") + "\n\n" +
                "# TikTok Content Posting API v2\n" +
                "TIKTOK_ENABLED=" + (Boolean.TRUE.equals(tiktokEnabled) ? "true" : "false") + "\n" +
                "TIKTOK_ACCESS_TOKEN=" + (tiktokAccessToken != null ? tiktokAccessToken.trim() : "") + "\n";
    }
}
