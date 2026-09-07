package com.autopublisher.application.port.in;

/**
 * Requisicao para disparo do pipeline de geracao de video por IA.
 */
public record PipelineRunRequest(
        String channelId,
        Integer scriptIndex,
        String topic,
        String platform
) {
    public String getChannelIdOrDefault() {
        return (channelId != null && !channelId.trim().isEmpty()) ? channelId.trim() : "psicosegredo";
    }

    public int getScriptIndexOrDefault() {
        return scriptIndex != null ? scriptIndex : 0;
    }

    public String getPlatformOrDefault() {
        return (platform != null && !platform.trim().isEmpty()) ? platform.trim() : "YOUTUBE_SHORTS";
    }
}
