package com.autopublisher.infrastructure.adapter.youtube;

import com.autopublisher.application.port.out.SocialMediaPublisherPort;
import com.autopublisher.domain.exception.QuotaExceededException;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PublishResult;
import com.autopublisher.infrastructure.config.DynamicGoogleClientProvider;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.googleapis.media.MediaHttpUploader;
import com.google.api.client.http.InputStreamContent;
import com.google.api.services.youtube.YouTube;
import com.google.api.services.youtube.model.Video;
import com.google.api.services.youtube.model.VideoSnippet;
import com.google.api.services.youtube.model.VideoStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Optional;

/**
 * Adaptador de infraestrutura para o YouTube Data API v3 (implementa SocialMediaPublisherPort).
 * Executa Resumable Upload com chunks de ~10MB, injecao de thumbnails, comentarios de afiliados e conformidade COPPA para monetizacao.
 */
@Component
public class YouTubePublisherAdapter implements SocialMediaPublisherPort {

    private static final Logger log = LoggerFactory.getLogger(YouTubePublisherAdapter.class);

    private final YouTube youtubeService;
    private DynamicGoogleClientProvider dynamicClientProvider;

    public YouTubePublisherAdapter(YouTube youtubeService) {
        this.youtubeService = youtubeService;
    }

    @Autowired(required = false)
    public void setDynamicClientProvider(DynamicGoogleClientProvider dynamicClientProvider) {
        this.dynamicClientProvider = dynamicClientProvider;
    }

    private YouTube getActiveYouTube() {
        return (dynamicClientProvider != null) ? dynamicClientProvider.getYouTubeService() : youtubeService;
    }

    @Override
    public boolean supports(Platform platform) {
        return platform == Platform.YOUTUBE_SHORTS || platform == Platform.YOUTUBE_VIDEO;
    }

    @Override
    public PublishResult publish(PostSchedule post, InputStream videoStream, Optional<InputStream> thumbnailStream) {
        log.info("Iniciando upload para o YouTube do post ID: {} (Plataforma: {})", post.id(), post.platform());

        try {
            // 1. Configura metadados do video (Snippet)
            VideoSnippet snippet = new VideoSnippet();
            snippet.setTitle(post.metadata().title());
            snippet.setDescription(post.metadata().description());
            snippet.setTags(post.metadata().tags());
            snippet.setCategoryId(String.valueOf(post.metadata().categoryId()));

            // 2. Configura status e parametros mandatorios de monetizacao (COPPA)
            VideoStatus status = new VideoStatus();
            status.setPrivacyStatus(post.metadata().privacy().getApiValue());
            // COPPA: selfDeclaredMadeForKids: false e obrigatorio para liberar anuncios personalizados e comentarios
            status.setSelfDeclaredMadeForKids(post.metadata().madeForKids());

            Video videoObject = new Video();
            videoObject.setSnippet(snippet);
            videoObject.setStatus(status);

            // 3. Configura o payload de midia via streaming continuo (Zero-Copy)
            InputStreamContent mediaContent = new InputStreamContent("video/*", videoStream);

            YouTube.Videos.Insert insertRequest = getActiveYouTube().videos()
                    .insert(List.of("snippet", "status"), videoObject, mediaContent);

            // 4. Forca Resumable Upload com chunks de ~10MB gerenciados pelo SDK
            MediaHttpUploader uploader = insertRequest.getMediaHttpUploader();
            uploader.setDirectUploadEnabled(false);
            uploader.setChunkSize(MediaHttpUploader.MINIMUM_CHUNK_SIZE * 4);

            log.info("Despachando chunks de video para o YouTube...");
            Video uploadedVideo = insertRequest.execute();
            String videoId = uploadedVideo.getId();
            log.info("Upload de video concluido com sucesso no YouTube! Video ID: {}", videoId);

            // 5. Injeta thumbnail personalizada se fornecida (custo: 50 unidades de cota)
            if (thumbnailStream.isPresent()) {
                log.info("Enviando thumbnail personalizada para o video ID: {}", videoId);
                try {
                    InputStreamContent thumbContent = new InputStreamContent("image/jpeg", thumbnailStream.get());
                    getActiveYouTube().thumbnails().set(videoId, thumbContent).execute();
                    log.info("Thumbnail personalizada vinculada com sucesso ao video ID: {}", videoId);
                } catch (Exception e) {
                    log.warn("Nao foi possivel definir a thumbnail para o video {}: {}", videoId, e.getMessage());
                }
            }

            // 5b. Publica primeiro comentario (First Comment) para monetizacao e links de afiliados (US-06.3)
            if (post.getFirstComment().isPresent()) {
                String commentText = post.getFirstComment().get();
                log.info("Publicando primeiro comentario automatico para o video ID: {}", videoId);
                try {
                    com.google.api.services.youtube.model.CommentThread commentThread = new com.google.api.services.youtube.model.CommentThread();
                    com.google.api.services.youtube.model.CommentThreadSnippet threadSnippet = new com.google.api.services.youtube.model.CommentThreadSnippet();
                    threadSnippet.setVideoId(videoId);

                    com.google.api.services.youtube.model.Comment topComment = new com.google.api.services.youtube.model.Comment();
                    com.google.api.services.youtube.model.CommentSnippet commentSnippet = new com.google.api.services.youtube.model.CommentSnippet();
                    commentSnippet.setTextOriginal(commentText);
                    topComment.setSnippet(commentSnippet);

                    threadSnippet.setTopLevelComment(topComment);
                    commentThread.setSnippet(threadSnippet);

                    getActiveYouTube().commentThreads()
                            .insert(List.of("snippet"), commentThread)
                            .execute();
                    log.info("Primeiro comentario publicado com sucesso para o video ID: {}", videoId);
                } catch (Exception e) {
                    log.warn("Nao foi possivel publicar o primeiro comentario no video {}: {}", videoId, e.getMessage());
                }
            }

            // 6. Formata a URL final de visualizacao
            String publishedUrl = (post.platform() == Platform.YOUTUBE_SHORTS)
                    ? "https://youtube.com/shorts/" + videoId
                    : "https://youtu.be/" + videoId;

            return PublishResult.success(videoId, publishedUrl);

        } catch (GoogleJsonResponseException e) {
            log.error("GoogleJsonResponseException da YouTube API (HTTP {}): {}", e.getStatusCode(), e.getMessage());

            // Detecta cota excedida (10.000 unidades) de forma segura contra NPE
            boolean isQuotaExceeded = (e.getMessage() != null && e.getMessage().contains("quotaExceeded"))
                    || (e.getDetails() != null && e.getDetails().toString().contains("quotaExceeded"));

            if (e.getStatusCode() == 403 && isQuotaExceeded) {
                throw new QuotaExceededException("Cota diaria do YouTube excedida (10.000 unidades): " + (e.getMessage() != null ? e.getMessage() : "quotaExceeded"), e);
            }

            String details = e.getDetails() != null ? e.getDetails().getMessage() : e.getMessage();
            return PublishResult.failure("Erro da API do YouTube: " + details);

        } catch (IOException e) {
            log.error("Erro de I/O na comunicacao com o YouTube: {}", e.getMessage(), e);
            return PublishResult.failure("Falha de conexao com o YouTube: " + e.getMessage());

        } catch (Exception e) {
            log.error("Erro inesperado durante o upload para o YouTube (Post ID {}): {}", post.id(), e.getMessage(), e);
            return PublishResult.failure("Erro inesperado: " + e.getMessage());
        }
    }
}
