package com.autopublisher.domain.model;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Entidade de dominio que representa uma linha de postagem agendada da planilha.
 * Suporta metadados de publicacao, miniatura personalizada e primeiro comentario automatico (US-06.3).
 */
public record PostSchedule(
        String id,
        int rowIndex,
        LocalDateTime scheduledTime,
        Platform platform,
        String videoDriveId,
        String thumbnailDriveId,
        VideoMetadata metadata,
        PublishStatus status,
        int attempts,
        String firstComment
) {
    // Construtor de conveniencia para compatibilidade retroativa
    public PostSchedule(
            String id,
            int rowIndex,
            LocalDateTime scheduledTime,
            Platform platform,
            String videoDriveId,
            String thumbnailDriveId,
            VideoMetadata metadata,
            PublishStatus status,
            int attempts) {
        this(id, rowIndex, scheduledTime, platform, videoDriveId, thumbnailDriveId, metadata, status, attempts, null);
    }

    public PostSchedule {
        if (id == null || id.trim().isEmpty()) {
            throw new IllegalArgumentException("ID do agendamento nao pode ser nulo ou vazio");
        }
        if (rowIndex < 2) {
            throw new IllegalArgumentException("Indice da linha na planilha deve ser maior ou igual a 2");
        }
        if (scheduledTime == null) {
            throw new IllegalArgumentException("Horario de agendamento e obrigatorio");
        }
        if (platform == null) {
            throw new IllegalArgumentException("Plataforma e obrigatoria");
        }
        if (videoDriveId == null || videoDriveId.trim().isEmpty()) {
            throw new IllegalArgumentException("ID do arquivo de video no Google Drive e obrigatorio");
        }
        if (metadata == null) {
            throw new IllegalArgumentException("Metadados do video sao obrigatorios");
        }
        status = status == null ? PublishStatus.PENDENTE : status;
    }

    public Optional<String> getThumbnailDriveId() {
        return (thumbnailDriveId == null || thumbnailDriveId.trim().isEmpty())
                ? Optional.empty()
                : Optional.of(thumbnailDriveId.trim());
    }

    public Optional<String> getFirstComment() {
        return (firstComment == null || firstComment.trim().isEmpty())
                ? Optional.empty()
                : Optional.of(firstComment.trim());
    }

    public boolean isDue(LocalDateTime referenceTime) {
        return !scheduledTime.isAfter(referenceTime);
    }
}
