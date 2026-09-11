package com.autopublisher.application.port.in;

/**
 * Requisicao para disparo do pipeline de geracao de video por IA.
 * Suporta canais customizados, selecao de plataforma, link de video do YouTube e diretriz visual das imagens.
 */
public record PipelineRunRequest(
        String channelId,
        Integer scriptIndex,
        String topic,
        String platform,
        String sourceUrl,
        String visualDirective,
        String visualMode
) {
    public PipelineRunRequest(String channelId, Integer scriptIndex, String topic, String platform) {
        this(channelId, scriptIndex, topic, platform, null, null, "hybrid");
    }

    public PipelineRunRequest(String channelId, Integer scriptIndex, String topic, String platform, String sourceUrl) {
        this(channelId, scriptIndex, topic, platform, sourceUrl, null, "hybrid");
    }

    public PipelineRunRequest(String channelId, Integer scriptIndex, String topic, String platform, String sourceUrl, String visualDirective) {
        this(channelId, scriptIndex, topic, platform, sourceUrl, visualDirective, "hybrid");
    }

    public String getChannelIdOrDefault() {
        return (channelId != null && !channelId.trim().isEmpty()) ? channelId.trim() : "psicosegredo";
    }

    public int getScriptIndexOrDefault() {
        return scriptIndex != null ? scriptIndex : 0;
    }

    public String getPlatformOrDefault() {
        return (platform != null && !platform.trim().isEmpty()) ? platform.trim() : "YOUTUBE_SHORTS";
    }

    public String getSourceUrl() {
        return (sourceUrl != null && !sourceUrl.trim().isEmpty()) ? sourceUrl.trim() : null;
    }

    public String getVisualDirective() {
        return (visualDirective != null && !visualDirective.trim().isEmpty()) ? visualDirective.trim() : null;
    }

    public String getVisualModeOrDefault() {
        return (visualMode != null && !visualMode.trim().isEmpty()) ? visualMode.trim().toLowerCase() : "hybrid";
    }
}
