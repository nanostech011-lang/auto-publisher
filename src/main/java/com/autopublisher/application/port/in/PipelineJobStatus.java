package com.autopublisher.application.port.in;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Status consolidado de uma execucao do pipeline de IA.
 */
public record PipelineJobStatus(
        String jobId,
        String status, // PENDING, RUNNING, COMPLETED, FAILED
        int progressPercent,
        String currentStep,
        String channelId,
        String platform,
        String topic,
        LocalDateTime startedAt,
        LocalDateTime finishedAt,
        List<String> logs,
        String videoPath,
        String thumbnailPath,
        Double durationSeconds,
        Boolean rewardsEligible,
        String errorMessage
) {}
