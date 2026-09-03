package com.autopublisher.application.usecase;

import com.autopublisher.application.port.in.CreatePostRequest;
import com.autopublisher.application.port.in.DashboardOverview;
import com.autopublisher.application.port.out.ScheduleRepositoryPort;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PublishStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Caso de uso responsavel por fornecer os dados e agregacoes para o Dashboard de usuario.
 */
@Service
public class DashboardService {

    private static final Logger log = LoggerFactory.getLogger(DashboardService.class);

    private final ScheduleRepositoryPort scheduleRepositoryPort;

    public DashboardService(ScheduleRepositoryPort scheduleRepositoryPort) {
        this.scheduleRepositoryPort = scheduleRepositoryPort;
    }

    /**
     * Coleta todos os posts cadastrados, calcula métricas de status e o consumo de cota diária do YouTube.
     */
    public DashboardOverview getOverview() {
        List<PostSchedule> posts = scheduleRepositoryPort.findAllPosts();

        int totalPosts = posts.size();
        int pending = 0;
        int published = 0;
        int errors = 0;
        int youtubePublishedToday = 0;

        LocalDate today = LocalDate.now();

        for (PostSchedule post : posts) {
            if (post.status() == PublishStatus.PENDENTE) {
                pending++;
            } else if (post.status() == PublishStatus.PUBLICADO) {
                published++;
                if ((post.platform() == Platform.YOUTUBE_SHORTS || post.platform() == Platform.YOUTUBE_VIDEO)) {
                    // Considera posts agendados/publicados na data de hoje para a cota diária
                    if (post.scheduledTime().toLocalDate().isEqual(today)) {
                        youtubePublishedToday++;
                    }
                }
            } else if (post.status() == PublishStatus.ERRO_TEMPORARIO || post.status() == PublishStatus.COTA_ESGOTADA) {
                errors++;
            }
        }

        DashboardOverview.YouTubeQuotaOverview quotaOverview = DashboardOverview.YouTubeQuotaOverview.of(youtubePublishedToday);

        log.info("Dashboard overview gerado: {} posts ({} pendentes, {} publicados, {} erros). Cota YT hoje: {}/6",
                totalPosts, pending, published, errors, youtubePublishedToday);

        return new DashboardOverview(posts, totalPosts, pending, published, errors, quotaOverview);
    }

    /**
     * Cria e anexa um novo agendamento na planilha.
     */
    public PostSchedule createPost(CreatePostRequest request) {
        log.info("Recebida solicitacao para agendar novo post: {}", request.title());
        List<PostSchedule> currentPosts = scheduleRepositoryPort.findAllPosts();
        int nextRowIndex = currentPosts.size() + 2;

        PostSchedule newPost = request.toDomain(nextRowIndex);
        scheduleRepositoryPort.appendPost(newPost);
        log.info("Post {} salvo com sucesso na linha {}", newPost.id(), nextRowIndex);

        return newPost;
    }
}
