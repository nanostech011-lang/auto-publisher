package com.autopublisher.domain.model;

/**
 * Plataformas de redes sociais suportadas pelo AutoPublisher.
 */
public enum Platform {
    YOUTUBE_SHORTS,
    YOUTUBE_VIDEO,
    INSTAGRAM_REELS,
    TIKTOK;

    public static Platform fromString(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("Plataforma nao pode ser nula ou vazia");
        }
        return Platform.valueOf(value.trim().toUpperCase());
    }
}
