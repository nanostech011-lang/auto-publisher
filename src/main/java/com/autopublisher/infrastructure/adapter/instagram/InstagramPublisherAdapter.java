package com.autopublisher.infrastructure.adapter.instagram;

import com.autopublisher.application.port.out.SocialMediaPublisherPort;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PublishResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

/**
 * Adaptador de infraestrutura para o Instagram Reels via Meta Graph API (implementa SocialMediaPublisherPort).
 * Executa o fluxo de upload resumível em duas fases (Container Creation -> Stream Upload -> Media Publish).
 */
@Component
public class InstagramPublisherAdapter implements SocialMediaPublisherPort {

    private static final Logger log = LoggerFactory.getLogger(InstagramPublisherAdapter.class);

    private final String businessAccountId;
    private final String accessToken;
    private final String apiVersion;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public InstagramPublisherAdapter(
            @Value("${autopublisher.instagram.business-account-id:}") String businessAccountId,
            @Value("${autopublisher.instagram.access-token:}") String accessToken,
            @Value("${autopublisher.instagram.graph-api-version:v20.0}") String apiVersion,
            ObjectMapper objectMapper) {
        this.businessAccountId = businessAccountId;
        this.accessToken = accessToken;
        this.apiVersion = apiVersion;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    // Construtor adicional para injeção em testes unitários
    InstagramPublisherAdapter(
            String businessAccountId,
            String accessToken,
            String apiVersion,
            HttpClient httpClient,
            ObjectMapper objectMapper) {
        this.businessAccountId = businessAccountId;
        this.accessToken = accessToken;
        this.apiVersion = apiVersion;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean supports(Platform platform) {
        return platform == Platform.INSTAGRAM_REELS;
    }

    @Override
    public PublishResult publish(PostSchedule post, InputStream videoStream, Optional<InputStream> thumbnailStream) {
        log.info("Iniciando publicacao no Instagram Reels para o post ID: {}", post.id());

        if (businessAccountId == null || businessAccountId.isBlank() || accessToken == null || accessToken.isBlank()) {
            return PublishResult.failure("Credenciais do Instagram nao configuradas (business-account-id ou access-token ausentes).");
        }

        try {
            // 1. Monta a legenda com título, descrição e tags
            String caption = buildCaption(post);

            // 2. Passo 1: Cria o contêiner de mídia resumível na Meta Graph API
            String initUrl = String.format("https://graph.facebook.com/%s/%s/media", apiVersion, businessAccountId);
            String formBody = String.format("media_type=REELS&upload_type=resumable&caption=%s&access_token=%s",
                    URLEncoder.encode(caption, StandardCharsets.UTF_8),
                    URLEncoder.encode(accessToken, StandardCharsets.UTF_8));

            HttpRequest initRequest = HttpRequest.newBuilder()
                    .uri(URI.create(initUrl))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(formBody))
                    .build();

            HttpResponse<String> initResponse = httpClient.send(initRequest, HttpResponse.BodyHandlers.ofString());

            if (initResponse.statusCode() >= 400) {
                log.error("Falha ao criar container de Reels no Instagram: HTTP {} - {}", initResponse.statusCode(), initResponse.body());
                return PublishResult.failure("Erro da Meta Graph API ao criar container: " + initResponse.body());
            }

            JsonNode initJson = objectMapper.readTree(initResponse.body());
            String containerId = initJson.path("id").asText();
            String uploadUri = initJson.path("uri").asText();

            if (containerId.isBlank() || uploadUri.isBlank()) {
                return PublishResult.failure("Resposta invalida da Meta Graph API: containerId ou uploadUri ausentes.");
            }

            log.info("Container de Reels criado com sucesso! ID: {}. Iniciando streaming do video...", containerId);

            // 3. Passo 2: Upload de dados binários diretamente via InputStream (Zero-Copy)
            HttpRequest uploadRequest = HttpRequest.newBuilder()
                    .uri(URI.create(uploadUri))
                    .header("Authorization", "OAuth " + accessToken)
                    .header("offset", "0")
                    .header("Content-Type", "application/octet-stream")
                    .POST(HttpRequest.BodyPublishers.ofInputStream(() -> videoStream))
                    .build();

            HttpResponse<String> uploadResponse = httpClient.send(uploadRequest, HttpResponse.BodyHandlers.ofString());

            if (uploadResponse.statusCode() >= 400) {
                log.error("Falha ao transferir streaming para o Instagram: HTTP {} - {}", uploadResponse.statusCode(), uploadResponse.body());
                return PublishResult.failure("Falha no upload do video para o Instagram: " + uploadResponse.body());
            }

            log.info("Streaming concluido. Aguardando processamento da Meta para o container: {}", containerId);

            // 4. Passo 3: Polling de status do container até FINISHED
            boolean ready = waitForContainerReady(containerId);
            if (!ready) {
                return PublishResult.failure("Timeout ou erro de processamento do video nos servidores da Meta.");
            }

            // 5. Passo 4: Publica o container (Media Publish)
            String publishUrl = String.format("https://graph.facebook.com/%s/%s/media_publish", apiVersion, businessAccountId);
            String publishBody = String.format("creation_id=%s&access_token=%s",
                    URLEncoder.encode(containerId, StandardCharsets.UTF_8),
                    URLEncoder.encode(accessToken, StandardCharsets.UTF_8));

            HttpRequest publishRequest = HttpRequest.newBuilder()
                    .uri(URI.create(publishUrl))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(publishBody))
                    .build();

            HttpResponse<String> publishResponse = httpClient.send(publishRequest, HttpResponse.BodyHandlers.ofString());

            if (publishResponse.statusCode() >= 400) {
                log.error("Falha ao publicar Reels no Instagram: HTTP {} - {}", publishResponse.statusCode(), publishResponse.body());
                return PublishResult.failure("Erro da Meta Graph API ao publicar Reels: " + publishResponse.body());
            }

            JsonNode publishJson = objectMapper.readTree(publishResponse.body());
            String publishedMediaId = publishJson.path("id").asText();

            // 6. Passo 5: Busca o link permanente (permalink) do Reel publicado
            String permalink = fetchPermalink(publishedMediaId);

            log.info("Reels publicado com sucesso no Instagram! Media ID: {}, URL: {}", publishedMediaId, permalink);
            return PublishResult.success(publishedMediaId, permalink);

        } catch (Exception e) {
            log.error("Erro inesperado ao publicar Reels no Instagram: {}", e.getMessage(), e);
            return PublishResult.failure("Erro na publicacao do Reels: " + e.getMessage());
        }
    }

    private boolean waitForContainerReady(String containerId) throws Exception {
        int maxAttempts = 15;
        for (int i = 0; i < maxAttempts; i++) {
            Thread.sleep(2000); // 2 segundos entre verificações

            String statusUrl = String.format("https://graph.facebook.com/%s/%s?fields=status_code&access_token=%s",
                    apiVersion, containerId, URLEncoder.encode(accessToken, StandardCharsets.UTF_8));

            HttpRequest req = HttpRequest.newBuilder().uri(URI.create(statusUrl)).GET().build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

            if (res.statusCode() == 200) {
                JsonNode json = objectMapper.readTree(res.body());
                String statusCode = json.path("status_code").asText();
                if ("FINISHED".equalsIgnoreCase(statusCode)) {
                    return true;
                } else if ("ERROR".equalsIgnoreCase(statusCode)) {
                    log.error("Meta retornou status de erro no processamento do video: {}", res.body());
                    return false;
                }
            }
        }
        return false;
    }

    private String fetchPermalink(String mediaId) {
        try {
            String permalinkUrl = String.format("https://graph.facebook.com/%s/%s?fields=permalink&access_token=%s",
                    apiVersion, mediaId, URLEncoder.encode(accessToken, StandardCharsets.UTF_8));

            HttpRequest req = HttpRequest.newBuilder().uri(URI.create(permalinkUrl)).GET().build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

            if (res.statusCode() == 200) {
                JsonNode json = objectMapper.readTree(res.body());
                return json.path("permalink").asText("https://www.instagram.com");
            }
        } catch (Exception e) {
            log.warn("Nao foi possivel recuperar o permalink para o mediaId {}: {}", mediaId, e.getMessage());
        }
        return "https://www.instagram.com";
    }

    private String buildCaption(PostSchedule post) {
        StringBuilder sb = new StringBuilder();
        sb.append(post.metadata().title()).append("\n\n");
        if (post.metadata().description() != null && !post.metadata().description().isBlank()) {
            sb.append(post.metadata().description()).append("\n\n");
        }
        if (post.metadata().tags() != null && !post.metadata().tags().isEmpty()) {
            for (String tag : post.metadata().tags()) {
                String cleanTag = tag.trim().replace(" ", "").replace("#", "");
                if (!cleanTag.isEmpty()) {
                    sb.append("#").append(cleanTag).append(" ");
                }
            }
        }
        return sb.toString().trim();
    }
}
