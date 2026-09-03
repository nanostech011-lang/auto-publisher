package com.autopublisher.application.usecase;

import com.autopublisher.application.port.in.PublishBatchReport;
import com.autopublisher.application.port.in.PublishScheduledPostsUseCase;
import com.autopublisher.application.port.out.MediaStoragePort;
import com.autopublisher.application.port.out.ScheduleRepositoryPort;
import com.autopublisher.application.port.out.SocialMediaPublisherPort;
import com.autopublisher.domain.exception.QuotaExceededException;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PublishResult;
import com.autopublisher.domain.model.PublishStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Caso de Uso central que orquestra a publicacao de posts pendentes.
 * Coordena as portas de saida e implementa as salvaguardas de cota (Quota Guard) e SEO.
 */
@Service
public class PublishScheduledPostsService implements PublishScheduledPostsUseCase {

    private static final Logger log = LoggerFactory.getLogger(PublishScheduledPostsService.class);

    private final ScheduleRepositoryPort scheduleRepository;
    private final MediaStoragePort mediaStorage;
    private final List<SocialMediaPublisherPort> publishers;
    private final int maxDailyUploads;

    public PublishScheduledPostsService(
            ScheduleRepositoryPort scheduleRepository,
            MediaStoragePort mediaStorage,
            List<SocialMediaPublisherPort> publishers,
            @Value("${autopublisher.limits.max-daily-uploads:6}") int maxDailyUploads
    ) {
        this.scheduleRepository = scheduleRepository;
        this.mediaStorage = mediaStorage;
        this.publishers = publishers;
        this.maxDailyUploads = maxDailyUploads;
    }

    @Override
    public PublishBatchReport execute() {
        long startTime = System.currentTimeMillis();
        LocalDateTime now = LocalDateTime.now();
        List<String> executionLogs = new ArrayList<>();

        log.info("Iniciando varredura do cronograma de postagens para referencia: {}", now);
        List<PostSchedule> pendingPosts = scheduleRepository.findPendingPostsDue(now);

        if (pendingPosts.isEmpty()) {
            log.info("Nenhum post pendente encontrado para a data/hora atual.");
            return PublishBatchReport.empty();
        }

        log.info("Foram encontrados {} post(s) pendente(s) para processamento.", pendingPosts.size());

        int successCount = 0;
        int failureCount = 0;
        boolean quotaExceeded = false;
        int processedCount = 0;

        for (PostSchedule post : pendingPosts) {
            // Salvaguarda preventiva de cota diaria
            if (processedCount >= maxDailyUploads) {
                String quotaMsg = String.format("Limite diario preventivo de %d postagens atingido. Interrompendo lote.", maxDailyUploads);
                log.warn(quotaMsg);
                executionLogs.add(quotaMsg);
                break;
            }

            log.info("Iniciando processamento do post ID: {} (Linha: {}, Plataforma: {})",
                    post.id(), post.rowIndex(), post.platform());

            // 1. Sinaliza na planilha que o post entrou em processamento
            scheduleRepository.updateStatus(post.rowIndex(), PublishStatus.PROCESSANDO, null, "Iniciando upload...", post.attempts());

            // 2. Encontra o publicador compativel
            Optional<SocialMediaPublisherPort> matchingPublisher = publishers.stream()
                    .filter(p -> p.supports(post.platform()))
                    .findFirst();

            if (matchingPublisher.isEmpty()) {
                String errorMsg = "Nenhum publicador configurado para a plataforma: " + post.platform();
                log.error(errorMsg);
                scheduleRepository.updateStatus(post.rowIndex(), PublishStatus.ERRO_TEMPORARIO, null, errorMsg, post.attempts() + 1);
                failureCount++;
                executionLogs.add("Post " + post.id() + ": " + errorMsg);
                continue;
            }

            // 3. Aplica otimizacoes algoritmicas de SEO
            PostSchedule postToPublish = post;
            if (post.platform() == Platform.YOUTUBE_SHORTS) {
                postToPublish = new PostSchedule(
                        post.id(),
                        post.rowIndex(),
                        post.scheduledTime(),
                        post.platform(),
                        post.videoDriveId(),
                        post.thumbnailDriveId(),
                        post.metadata().withShortsOptimization(),
                        post.status(),
                        post.attempts()
                );
            }

            // 4. Executa download e upload em streaming
            try (InputStream videoStream = mediaStorage.downloadMediaStream(postToPublish.videoDriveId())) {
                Optional<InputStream> thumbnailStream = Optional.empty();
                if (postToPublish.getThumbnailDriveId().isPresent()) {
                    thumbnailStream = Optional.of(mediaStorage.downloadMediaStream(postToPublish.getThumbnailDriveId().get()));
                }

                try {
                    PublishResult result = matchingPublisher.get().publish(postToPublish, videoStream, thumbnailStream);

                    if (result.success()) {
                        log.info("Post {} publicado com sucesso! URL: {}", post.id(), result.publishedUrl());
                        scheduleRepository.updateStatus(
                                post.rowIndex(),
                                PublishStatus.PUBLICADO,
                                result.publishedUrl(),
                                "Publicado com sucesso!",
                                post.attempts()
                        );
                        successCount++;
                        processedCount++;
                        executionLogs.add(String.format("Post %s publicado: %s", post.id(), result.publishedUrl()));
                    } else {
                        log.error("Falha ao publicar post {}: {}", post.id(), result.errorMessage());
                        scheduleRepository.updateStatus(
                                post.rowIndex(),
                                PublishStatus.ERRO_TEMPORARIO,
                                null,
                                result.errorMessage(),
                                post.attempts() + 1
                        );
                        failureCount++;
                        executionLogs.add(String.format("Post %s falhou: %s", post.id(), result.errorMessage()));
                    }
                } finally {
                    // Fecha o stream da thumbnail se tiver sido aberto
                    if (thumbnailStream.isPresent()) {
                        try {
                            thumbnailStream.get().close();
                        } catch (Exception ignored) {
                        }
                    }
                }

            } catch (QuotaExceededException e) {
                quotaExceeded = true;
                String errorMsg = "Cota diaria do YouTube excedida (10.000 unidades). Interrompendo lote.";
                log.error(errorMsg, e);
                scheduleRepository.updateStatus(post.rowIndex(), PublishStatus.COTA_ESGOTADA, null, errorMsg, post.attempts());
                executionLogs.add(errorMsg);
                failureCount++;
                break; // Interrompe o processamento das proximas linhas imediatamente
            } catch (Exception e) {
                String errorMsg = "Excecao inesperada durante o processamento: " + e.getMessage();
                log.error(errorMsg, e);
                scheduleRepository.updateStatus(post.rowIndex(), PublishStatus.ERRO_TEMPORARIO, null, errorMsg, post.attempts() + 1);
                failureCount++;
                executionLogs.add(String.format("Post %s erro: %s", post.id(), errorMsg));
            }
        }

        long executionTime = System.currentTimeMillis() - startTime;
        log.info("Lote finalizado em {}ms. Sucessos: {}, Falhas: {}, Cota Excedida: {}",
                executionTime, successCount, failureCount, quotaExceeded);

        return new PublishBatchReport(
                pendingPosts.size(),
                successCount,
                failureCount,
                quotaExceeded,
                executionTime,
                executionLogs
        );
    }
}
