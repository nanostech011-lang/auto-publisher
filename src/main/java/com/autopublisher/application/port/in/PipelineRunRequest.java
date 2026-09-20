package com.autopublisher.application.port.in;

/**
 * Requisicao para disparo do pipeline de geracao de video por IA.
 * Suporta canais customizados, selecao de plataforma, link de video do YouTube,
 * diretriz visual das imagens, perfil customizado (nome, nicho, voz, CTA),
 * estilo de legenda e clipes externos (Google Flow).
 *
 * Todas as informacoes sao extraidas dinamicamente do Dashboard, sem hardcoding.
 */
public record PipelineRunRequest(
        String channelId,
        Integer scriptIndex,
        String topic,
        String platform,
        String sourceUrl,
        String visualDirective,
        String visualMode,
        String channelName,
        String channelNiche,
        String voiceId,
        String affiliateUrl,
        String subtitlesTheme,
        String flowClipsDir,
        Boolean enableSubtitles,
        String title,
        String narrationText,
        String firstComment
) {
    public PipelineRunRequest(
            String channelId, Integer scriptIndex, String topic, String platform,
            String sourceUrl, String visualDirective, String visualMode,
            String channelName, String channelNiche, String voiceId,
            String affiliateUrl, String subtitlesTheme, String flowClipsDir,
            Boolean enableSubtitles
    ) {
        this(channelId, scriptIndex, topic, platform, sourceUrl, visualDirective, visualMode,
                channelName, channelNiche, voiceId, affiliateUrl, subtitlesTheme, flowClipsDir,
                enableSubtitles, null, null, null);
    }

    public PipelineRunRequest(String channelId, Integer scriptIndex, String topic, String platform) {
        this(channelId, scriptIndex, topic, platform, null, null, "hybrid", null, null, null, null, null, null, true, null, null, null);
    }

    public PipelineRunRequest(String channelId, Integer scriptIndex, String topic, String platform, String sourceUrl) {
        this(channelId, scriptIndex, topic, platform, sourceUrl, null, "hybrid", null, null, null, null, null, null, true);
    }

    public PipelineRunRequest(String channelId, Integer scriptIndex, String topic, String platform, String sourceUrl, String visualDirective) {
        this(channelId, scriptIndex, topic, platform, sourceUrl, visualDirective, "hybrid", null, null, null, null, null, null, true);
    }

    public PipelineRunRequest(String channelId, Integer scriptIndex, String topic, String platform, String sourceUrl, String visualDirective, String visualMode) {
        this(channelId, scriptIndex, topic, platform, sourceUrl, visualDirective, visualMode, null, null, null, null, null, null, true);
    }

    public String getChannelIdOrDefault() {
        if (channelId != null && !channelId.trim().isEmpty() && !channelId.equalsIgnoreCase("custom")) {
            return channelId.trim();
        }
        if (channelName != null && !channelName.trim().isEmpty()) {
            return channelName.replace("@", "").trim();
        }
        return "custom";
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

    public String getChannelName() {
        return (channelName != null && !channelName.trim().isEmpty()) ? channelName.trim() : null;
    }

    public String getChannelNiche() {
        return (channelNiche != null && !channelNiche.trim().isEmpty()) ? channelNiche.trim() : null;
    }

    public String getVoiceId() {
        return (voiceId != null && !voiceId.trim().isEmpty()) ? voiceId.trim() : null;
    }

    public String getAffiliateUrl() {
        return (affiliateUrl != null && !affiliateUrl.trim().isEmpty()) ? affiliateUrl.trim() : null;
    }

    public String getSubtitlesTheme() {
        return (subtitlesTheme != null && !subtitlesTheme.trim().isEmpty()) ? subtitlesTheme.trim() : null;
    }

    public String getFlowClipsDir() {
        return (flowClipsDir != null && !flowClipsDir.trim().isEmpty()) ? flowClipsDir.trim() : null;
    }

    public boolean isSubtitlesEnabled() {
        return enableSubtitles == null || enableSubtitles;
    }

    public String getTitle() {
        return (title != null && !title.trim().isEmpty()) ? title.trim() : null;
    }

    public String getNarrationText() {
        return (narrationText != null && !narrationText.trim().isEmpty()) ? narrationText.trim() : null;
    }

    public String getFirstComment() {
        return (firstComment != null && !firstComment.trim().isEmpty()) ? firstComment.trim() : null;
    }
}
