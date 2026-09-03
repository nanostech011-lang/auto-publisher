package com.autopublisher.domain.model;

import java.time.LocalDateTime;

/**
 * Resultado da operacao de publicacao de video em qualquer plataforma de rede social.
 */
public record PublishResult(
        boolean success,
        String platformVideoId,
        String publishedUrl,
        LocalDateTime publishedAt,
        String errorMessage
) {
    public static PublishResult success(String platformVideoId, String publishedUrl) {
        return new PublishResult(true, platformVideoId, publishedUrl, LocalDateTime.now(), null);
    }

    public static PublishResult failure(String errorMessage) {
        return new PublishResult(false, null, null, null, errorMessage);
    }
}
