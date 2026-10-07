package com.autopublisher.infrastructure.adapter.tiktok;

import com.autopublisher.application.port.out.MediaStoragePort;
import com.autopublisher.application.port.out.SocialMediaPublisherPort;
import com.autopublisher.application.port.out.TenantRepositoryPort;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PublishResult;
import com.autopublisher.domain.model.TenantConfig;
import com.autopublisher.domain.model.TenantContextHolder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Adaptador de infraestrutura para o TikTok Content Posting API (implementa SocialMediaPublisherPort).
 * Executa publicacao direta e streaming de video com suporte a hashtags de engajamento.
 */
@Component
public class TikTokPublisherAdapter implements SocialMediaPublisherPort {

    private static final Logger log = LoggerFactory.getLogger(TikTokPublisherAdapter.class);

    private final String accessToken;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private TenantRepositoryPort tenantRepository;
    private MediaStoragePort mediaStorage;

    @Autowired
    public TikTokPublisherAdapter(
            @Value("${autopublisher.tiktok.access-token:}") String accessToken,
            ObjectMapper objectMapper) {
        this.accessToken = accessToken;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    // Construtor adicional para injecao de mocks em testes unitarios
    TikTokPublisherAdapter(
            String accessToken,
            HttpClient httpClient,
            ObjectMapper objectMapper) {
        this(accessToken, httpClient, objectMapper, null);
    }

    TikTokPublisherAdapter(
            String accessToken,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            MediaStoragePort mediaStorage) {
        this.accessToken = accessToken;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.mediaStorage = mediaStorage;
    }

    @Autowired(required = false)
    public void setMediaStorage(MediaStoragePort mediaStorage) {
        this.mediaStorage = mediaStorage;
    }

    @Autowired(required = false)
    public void setTenantRepository(TenantRepositoryPort tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    private String getActiveAccessToken() {
        if (tenantRepository != null && TenantContextHolder.get().isPresent()) {
            String tenantId = TenantContextHolder.getRequiredTenantId();
            return tenantRepository.findById(tenantId)
                    .map(TenantConfig::tiktokAccessToken)
                    .filter(t -> t != null && !t.isBlank())
                    .orElse(accessToken);
        }
        return accessToken;
    }

    @Override
    public boolean supports(Platform platform) {
        return platform == Platform.TIKTOK;
    }

    @Override
    public PublishResult publish(PostSchedule post, InputStream videoStream, Optional<InputStream> thumbnailStream) {
        log.info("Iniciando publicacao no TikTok para o post ID: {}", post.id());

        String activeToken = getActiveAccessToken();
        if (activeToken == null || activeToken.isBlank()) {
            return PublishResult.failure("Token de acesso do TikTok nao configurado (TIKTOK_ACCESS_TOKEN ausente).");
        }

        try {
            // 1. Monta o titulo enriquecido com hashtags
            String fullTitle = buildTitleWithTags(post);

            // 2. Passo 1: Inicializa o post na TikTok Content Posting API v2
            String initUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";

            Map<String, Object> postInfo = new HashMap<>();
            postInfo.put("title", fullTitle);
            postInfo.put("privacy_level", "PUBLIC_TO_EVERYONE");
            postInfo.put("disable_duet", false);
            postInfo.put("disable_stitch", false);
            postInfo.put("disable_comment", false);
            postInfo.put("video_cover_timestamp_ms", 1000);

            long actualVideoSize = (mediaStorage != null && post.videoDriveId() != null)
                    ? mediaStorage.getFileSize(post.videoDriveId())
                    : -1L;

            // TikTok requer chunk_size entre 5MB e 64MB; se tamanho for conhecido e <= 64MB, envia em 1 chunk
            long chunkSize = (actualVideoSize > 0 && actualVideoSize <= 64L * 1024 * 1024)
                    ? actualVideoSize
                    : 10L * 1024 * 1024;
            int totalChunks = (actualVideoSize > 0)
                    ? (int) Math.ceil((double) actualVideoSize / chunkSize)
                    : 1;
            long declaredVideoSize = (actualVideoSize > 0) ? actualVideoSize : chunkSize;

            Map<String, Object> sourceInfo = new HashMap<>();
            sourceInfo.put("source", "FILE_UPLOAD");
            sourceInfo.put("chunk_size", chunkSize);
            sourceInfo.put("total_chunk_count", totalChunks);
            sourceInfo.put("video_size", declaredVideoSize);

            Map<String, Object> payload = new HashMap<>();
            payload.put("post_info", postInfo);
            payload.put("source_info", sourceInfo);

            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest initRequest = HttpRequest.newBuilder()
                    .uri(URI.create(initUrl))
                    .header("Authorization", "Bearer " + activeToken)
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> initResponse = httpClient.send(initRequest, HttpResponse.BodyHandlers.ofString());

            if (initResponse.statusCode() >= 400) {
                log.error("Falha ao inicializar post no TikTok: HTTP {} - {}", initResponse.statusCode(), initResponse.body());
                return PublishResult.failure("Erro da TikTok API ao inicializar upload: " + initResponse.body());
            }

            JsonNode initJson = objectMapper.readTree(initResponse.body());
            JsonNode dataNode = initJson.path("data");
            String publishId = dataNode.path("publish_id").asText();
            String uploadUrl = dataNode.path("upload_url").asText();

            if (publishId.isBlank() || uploadUrl.isBlank()) {
                return PublishResult.failure("Resposta inesperada do TikTok: publish_id ou upload_url ausentes.");
            }

            log.info("Inicializacao do TikTok confirmada! Publish ID: {}. Despachando stream do video...", publishId);

            // 3. Passo 2: Upload de dados binarios via streaming direto (Zero-Copy)
            HttpRequest uploadRequest = HttpRequest.newBuilder()
                    .uri(URI.create(uploadUrl))
                    .header("Content-Type", "video/mp4")
                    .PUT(HttpRequest.BodyPublishers.ofInputStream(() -> videoStream))
                    .build();

            HttpResponse<String> uploadResponse = httpClient.send(uploadRequest, HttpResponse.BodyHandlers.ofString());

            if (uploadResponse.statusCode() >= 400) {
                log.error("Falha na transferencia do video para o TikTok: HTTP {} - {}", uploadResponse.statusCode(), uploadResponse.body());
                return PublishResult.failure("Falha no upload do video para os servidores do TikTok: " + uploadResponse.body());
            }

            log.info("Upload para o TikTok concluido com sucesso! Publish ID: {}", publishId);
            String publishedUrl = "https://www.tiktok.com/publish_id/" + publishId;

            return PublishResult.success(publishId, publishedUrl);

        } catch (Exception e) {
            log.error("Erro inesperado ao publicar no TikTok: {}", e.getMessage(), e);
            return PublishResult.failure("Erro na publicacao do TikTok: " + e.getMessage());
        }
    }

    private String buildTitleWithTags(PostSchedule post) {
        StringBuilder sb = new StringBuilder();
        sb.append(post.metadata().title());

        if (post.metadata().tags() != null && !post.metadata().tags().isEmpty()) {
            sb.append(" ");
            for (String tag : post.metadata().tags()) {
                String clean = tag.trim().replace(" ", "").replace("#", "");
                if (!clean.isEmpty()) {
                    sb.append("#").append(clean).append(" ");
                }
            }
        }
        return sb.toString().trim();
    }
}
