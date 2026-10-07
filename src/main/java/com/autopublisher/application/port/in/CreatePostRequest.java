package com.autopublisher.application.port.in;

import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PrivacyStatus;
import com.autopublisher.domain.model.PublishStatus;
import com.autopublisher.domain.model.VideoMetadata;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Requisicao para criacao de um novo agendamento de postagem via interface.
 */
public record CreatePostRequest(
        String id,
        String scheduledTime,
        Platform platform,
        String videoDriveId,
        String thumbnailDriveId,
        String title,
        String description,
        String tags,
        Integer categoryId,
        Boolean madeForKids,
        PrivacyStatus privacy,
        String firstComment,
        PublishStatus status
) {
    public CreatePostRequest(
            String id,
            String scheduledTime,
            Platform platform,
            String videoDriveId,
            String thumbnailDriveId,
            String title,
            String description,
            String tags,
            Integer categoryId,
            Boolean madeForKids,
            PrivacyStatus privacy,
            String firstComment
    ) {
        this(id, scheduledTime, platform, videoDriveId, thumbnailDriveId, title,
                description, tags, categoryId, madeForKids, privacy, firstComment, PublishStatus.PENDENTE);
    }

    private static final Pattern DRIVE_ID_PATTERN = Pattern.compile("/d/([a-zA-Z0-9_-]+)");

    /**
     * Converte esta requisição para a entidade imutável de domínio PostSchedule.
     */
    public PostSchedule toDomain(int physicalRowIndex) {
        String finalId = (id != null && !id.trim().isEmpty())
                ? id.trim()
                : "POST-" + System.currentTimeMillis();

        LocalDateTime parsedTime = parseDateTime(scheduledTime);
        Platform finalPlatform = platform != null ? platform : Platform.YOUTUBE_SHORTS;
        String cleanVideoId = extractDriveId(videoDriveId);
        String cleanThumbId = (thumbnailDriveId != null && !thumbnailDriveId.trim().isEmpty())
                ? extractDriveId(thumbnailDriveId)
                : null;

        List<String> parsedTags = (tags != null && !tags.trim().isEmpty())
                ? Arrays.stream(tags.split(",")).map(String::trim).filter(t -> !t.isEmpty()).toList()
                : Collections.emptyList();

        VideoMetadata metadata = new VideoMetadata(
                title != null ? title.trim() : "Sem Titulo",
                description != null ? description.trim() : "",
                parsedTags,
                categoryId != null ? categoryId : 24,
                Boolean.TRUE.equals(madeForKids),
                privacy != null ? privacy : PrivacyStatus.PUBLIC
        );

        return new PostSchedule(
                finalId,
                physicalRowIndex,
                parsedTime,
                finalPlatform,
                cleanVideoId,
                cleanThumbId,
                metadata,
                status != null ? status : PublishStatus.PENDENTE,
                0,
                (firstComment != null && !firstComment.trim().isEmpty()) ? firstComment.trim() : null
        );
    }

    private static String extractDriveId(String input) {
        if (input == null || input.trim().isEmpty()) {
            return "";
        }
        String trimmed = input.trim();
        Matcher matcher = DRIVE_ID_PATTERN.matcher(trimmed);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return trimmed;
    }

    private static LocalDateTime parseDateTime(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return LocalDateTime.now().plusMinutes(5);
        }
        String clean = raw.trim();
        try {
            if (clean.contains("T")) {
                return LocalDateTime.parse(clean);
            }
            return LocalDateTime.parse(clean, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        } catch (Exception e) {
            return LocalDateTime.now().plusMinutes(5);
        }
    }
}
