package com.autopublisher.application.usecase;

import com.autopublisher.application.port.in.CreatePostRequest;
import com.autopublisher.application.port.in.DashboardOverview;
import com.autopublisher.application.port.out.ScheduleRepositoryPort;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PrivacyStatus;
import com.autopublisher.domain.model.PublishStatus;
import com.autopublisher.domain.model.VideoMetadata;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private ScheduleRepositoryPort scheduleRepositoryPort;

    private DashboardService dashboardService;

    @BeforeEach
    void setUp() {
        dashboardService = new DashboardService(scheduleRepositoryPort);
    }

    @Test
    @DisplayName("Deve calcular métricas agregadas e cota diária do YouTube corretamente")
    void shouldReturnOverviewWithCalculatedMetrics() {
        VideoMetadata meta = new VideoMetadata("Video 1", "Desc", List.of("tag"), 24, false, PrivacyStatus.PUBLIC);
        LocalDateTime today = LocalDateTime.now();

        PostSchedule postPending = new PostSchedule("P1", 2, today, Platform.YOUTUBE_SHORTS, "vid1", null, meta, PublishStatus.PENDENTE, 0);
        PostSchedule postPublishedYT = new PostSchedule("P2", 3, today, Platform.YOUTUBE_SHORTS, "vid2", null, meta, PublishStatus.PUBLICADO, 0);
        PostSchedule postPublishedIG = new PostSchedule("P3", 4, today, Platform.INSTAGRAM_REELS, "vid3", null, meta, PublishStatus.PUBLICADO, 0);
        PostSchedule postError = new PostSchedule("P4", 5, today, Platform.TIKTOK, "vid4", null, meta, PublishStatus.ERRO_TEMPORARIO, 1);

        when(scheduleRepositoryPort.findAllPosts()).thenReturn(List.of(postPending, postPublishedYT, postPublishedIG, postError));

        DashboardOverview overview = dashboardService.getOverview();

        assertThat(overview.totalPosts()).isEqualTo(4);
        assertThat(overview.pendingPosts()).isEqualTo(1);
        assertThat(overview.publishedPosts()).isEqualTo(2);
        assertThat(overview.errorPosts()).isEqualTo(1);

        DashboardOverview.YouTubeQuotaOverview quota = overview.youtubeQuota();
        assertThat(quota.publishedToday()).isEqualTo(1);
        assertThat(quota.maxDailyVideos()).isEqualTo(6);
        assertThat(quota.consumedUnits()).isEqualTo(1650);
        assertThat(quota.totalDailyUnits()).isEqualTo(10000);
        assertThat(quota.percentageConsumed()).isEqualTo(16.5);
        assertThat(quota.isQuotaExceeded()).isFalse();
    }

    @Test
    @DisplayName("Deve criar e anexar novo post na próxima linha livre da planilha")
    void shouldCreateAndAppendPostSuccessfully() {
        VideoMetadata meta = new VideoMetadata("Existente", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule existing = new PostSchedule("P1", 2, LocalDateTime.now(), Platform.YOUTUBE_SHORTS, "vid", null, meta, PublishStatus.PUBLICADO, 0);

        when(scheduleRepositoryPort.findAllPosts()).thenReturn(List.of(existing));

        CreatePostRequest request = new CreatePostRequest(
                "POST-NOVO",
                LocalDateTime.now().plusDays(1).toString(),
                Platform.INSTAGRAM_REELS,
                "https://drive.google.com/file/d/drive_video_xyz/view",
                null,
                "Novo Reel Incrível",
                "Descrição do Reel",
                "reels, viral",
                24,
                false,
                PrivacyStatus.PUBLIC,
                "Comentário inicial com cupom"
        );

        PostSchedule created = dashboardService.createPost(request);

        assertThat(created.id()).isEqualTo("POST-NOVO");
        assertThat(created.rowIndex()).isEqualTo(3); // 1 existente + cabeçalho = linha 3
        assertThat(created.platform()).isEqualTo(Platform.INSTAGRAM_REELS);
        assertThat(created.videoDriveId()).isEqualTo("drive_video_xyz"); // extraído da URL do Drive
        assertThat(created.getFirstComment()).contains("Comentário inicial com cupom");

        ArgumentCaptor<PostSchedule> captor = ArgumentCaptor.forClass(PostSchedule.class);
        verify(scheduleRepositoryPort).appendPost(captor.capture());
        assertThat(captor.getValue().id()).isEqualTo("POST-NOVO");
    }
}
