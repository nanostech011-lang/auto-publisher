package com.autopublisher.application.port.in;

/**
 * DTO que resume o status de configuracao das chaves e credenciais de todas as integracoes da aplicacao,
 * garantindo mascaramento seguro de tokens e secrets.
 */
public record SystemCredentialsStatus(
        boolean apiKeyConfigured,
        String maskedApiKey,
        String spreadsheetId,
        String tabName,
        boolean sheetsConfigured,
        String youtubeClientIdMasked,
        boolean youtubeSecretConfigured,
        boolean youtubeRefreshTokenConfigured,
        boolean youtubeReady,
        boolean instagramEnabled,
        String instagramAccountId,
        boolean instagramTokenConfigured,
        boolean instagramReady,
        boolean tiktokEnabled,
        boolean tiktokTokenConfigured,
        boolean tiktokReady,
        boolean geminiConfigured,
        String maskedGeminiKey,
        boolean geminiReady
) {
    public static String mask(String secret) {
        if (secret == null || secret.trim().isEmpty()) {
            return "";
        }
        String clean = secret.trim();
        if (clean.length() <= 8) {
            return "********";
        }
        return clean.substring(0, 4) + "..." + clean.substring(clean.length() - 4);
    }
}
