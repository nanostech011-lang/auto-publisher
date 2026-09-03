package com.autopublisher.application.usecase;

import com.autopublisher.application.port.in.PublishBatchReport;
import com.autopublisher.application.port.out.MediaStoragePort;
import com.autopublisher.application.port.out.ScheduleRepositoryPort;
import com.autopublisher.application.port.out.SocialMediaPublisherPort;
import com.autopublisher.domain.exception.QuotaExceededException;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PrivacyStatus;
import com.autopublisher.domain.model.PublishResult;
import com.autopublisher.domain.model.PublishStatus;
import com.autopublisher.domain.model.VideoMetadata;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublishScheduledPostsServiceTest {

    @Mock
    private ScheduleRepositoryPort scheduleRepository;

    @Mock
    private MediaStoragePort mediaStorage;

    @Mock
    private SocialMediaPublisherPort youtubePublisher;

    private PublishScheduledPostsService service;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.lenient().when(youtubePublisher.supports(any(Platform.class))).thenReturn(true);

        service = new PublishScheduledPostsService(
                scheduleRepository,
                mediaStorage,
                List.of(youtubePublisher),
                6
        );
    }

    @Test
    @DisplayName("Deve retornar relatorio vazio quando nao houver posts pendentes")
    void shouldReturnEmptyReportWhenNoPendingPosts() {
        when(scheduleRepository.findPendingPostsDue(any(LocalDateTime.class))).thenReturn(Collections.emptyList());

        PublishBatchReport report = service.execute();

        assertThat(report.totalFound()).isZero();
        assertThat(report.successCount()).isZero();
        assertThat(report.quotaExceeded()).isFalse();
        verify(mediaStorage, never()).downloadMediaStream(anyString());
    }

    @Test
    @DisplayName("Deve publicar post do YouTube Shorts com sucesso e atualizar planilha")
    void shouldPublishShortsPostSuccessfully() {
        VideoMetadata metadata = new VideoMetadata(
                "3 Segredos de IA",
                "Descricao com link de afiliado https://link.com",
                List.of("ia", "tech"),
                28,
                false,
                PrivacyStatus.PUBLIC
        );

        PostSchedule post = new PostSchedule(
                "POST-001",
                2,
                LocalDateTime.now().minusMinutes(5),
                Platform.YOUTUBE_SHORTS,
                "drive-video-123",
                null,
                metadata,
                PublishStatus.PENDENTE,
                0
        );

        InputStream fakeStream = new ByteArrayInputStream(new byte[]{1, 2, 3});

        when(scheduleRepository.findPendingPostsDue(any(LocalDateTime.class))).thenReturn(List.of(post));
        when(mediaStorage.downloadMediaStream("drive-video-123")).thenReturn(fakeStream);
        when(youtubePublisher.publish(any(PostSchedule.class), eq(fakeStream), eq(Optional.empty())))
                .thenReturn(PublishResult.success("yt-vid-999", "https://youtube.com/shorts/yt-vid-999"));

        PublishBatchReport report = service.execute();

        assertThat(report.totalFound()).isEqualTo(1);
        assertThat(report.successCount()).isEqualTo(1);
        assertThat(report.failureCount()).isZero();
        assertThat(report.quotaExceeded()).isFalse();

        // Verifica atualizacao cirurgica no Sheets
        verify(scheduleRepository).updateStatus(
                eq(2),
                eq(PublishStatus.PUBLICADO),
                eq("https://youtube.com/shorts/yt-vid-999"),
                eq("Publicado com sucesso!"),
                eq(0)
        );
    }

    @Test
    @DisplayName("Deve abortar lote imediatamente e marcar COTA_ESGOTADA ao receber QuotaExceededException")
    void shouldAbortBatchWhenQuotaExceeded() {
        VideoMetadata metadata = new VideoMetadata(
                "Video Quota Test",
                "Descricao",
                List.of(),
                24,
                false,
                PrivacyStatus.PUBLIC
        );

        PostSchedule post1 = new PostSchedule("P1", 2, LocalDateTime.now().minusMinutes(10), Platform.YOUTUBE_VIDEO, "drive-1", null, metadata, PublishStatus.PENDENTE, 0);
        PostSchedule post2 = new PostSchedule("P2", 3, LocalDateTime.now().minusMinutes(5), Platform.YOUTUBE_VIDEO, "drive-2", null, metadata, PublishStatus.PENDENTE, 0);

        InputStream fakeStream = new ByteArrayInputStream(new byte[]{1});

        when(scheduleRepository.findPendingPostsDue(any(LocalDateTime.class))).thenReturn(List.of(post1, post2));
        when(mediaStorage.downloadMediaStream("drive-1")).thenReturn(fakeStream);
        when(youtubePublisher.publish(any(PostSchedule.class), any(InputStream.class), any()))
                .thenThrow(new QuotaExceededException("403 quotaExceeded"));

        PublishBatchReport report = service.execute();

        assertThat(report.quotaExceeded()).isTrue();
        assertThat(report.failureCount()).isEqualTo(1);
        assertThat(report.successCount()).isZero();

        // Verifica que o post 1 foi marcado com COTA_ESGOTADA
        verify(scheduleRepository).updateStatus(eq(2), eq(PublishStatus.COTA_ESGOTADA), any(), anyString(), anyInt());

        // Garante que o post 2 NUNCA foi chamado porque o lote foi interrompido
        verify(mediaStorage, never()).downloadMediaStream("drive-2");
    }

    @Test
    @DisplayName("Deve registrar ERRO_TEMPORARIO quando nao houver publicador compativel")
    void shouldHandlePublisherNotFound() {
        VideoMetadata metadata = new VideoMetadata("Titulo", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("P-IG", 2, LocalDateTime.now().minusMinutes(5), Platform.INSTAGRAM_REELS, "drive-ig", null, metadata, PublishStatus.PENDENTE, 0);

        when(scheduleRepository.findPendingPostsDue(any(LocalDateTime.class))).thenReturn(List.of(post));

        PublishBatchReport report = service.execute();

        assertThat(report.failureCount()).isEqualTo(1);
        assertThat(report.successCount()).isZero();
        verify(scheduleRepository).updateStatus(eq(2), eq(PublishStatus.ERRO_TEMPORARIO), any(), anyString(), eq(1));
    }

    @Test
    @DisplayName("Deve tratar falha retornada pelo publicador e incrementar contador de tentativas")
    void shouldHandlePublicationFailureResult() {
        VideoMetadata metadata = new VideoMetadata("Titulo", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("P-Fail", 2, LocalDateTime.now().minusMinutes(5), Platform.YOUTUBE_VIDEO, "drive-fail", null, metadata, PublishStatus.PENDENTE, 1);
        InputStream fakeStream = new ByteArrayInputStream(new byte[]{1});

        when(scheduleRepository.findPendingPostsDue(any(LocalDateTime.class))).thenReturn(List.of(post));
        when(mediaStorage.downloadMediaStream("drive-fail")).thenReturn(fakeStream);
        when(youtubePublisher.publish(any(PostSchedule.class), any(InputStream.class), any()))
                .thenReturn(PublishResult.failure("Invalid video format"));

        PublishBatchReport report = service.execute();

        assertThat(report.failureCount()).isEqualTo(1);
        assertThat(report.successCount()).isZero();
        verify(scheduleRepository).updateStatus(eq(2), eq(PublishStatus.ERRO_TEMPORARIO), any(), eq("Invalid video format"), eq(2));
    }

    @Test
    @DisplayName("Deve interromper processamento preventivamente quando o limite maximo diario for atingido")
    void shouldRespectMaxDailyUploadsLimit() {
        PublishScheduledPostsService limitedService = new PublishScheduledPostsService(
                scheduleRepository,
                mediaStorage,
                List.of(youtubePublisher),
                1 // Limite de 1 upload
        );

        VideoMetadata metadata = new VideoMetadata("Titulo", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post1 = new PostSchedule("P-1", 2, LocalDateTime.now().minusMinutes(10), Platform.YOUTUBE_VIDEO, "drive-1", null, metadata, PublishStatus.PENDENTE, 0);
        PostSchedule post2 = new PostSchedule("P-2", 3, LocalDateTime.now().minusMinutes(5), Platform.YOUTUBE_VIDEO, "drive-2", null, metadata, PublishStatus.PENDENTE, 0);

        InputStream fakeStream1 = new ByteArrayInputStream(new byte[]{1});

        when(scheduleRepository.findPendingPostsDue(any(LocalDateTime.class))).thenReturn(List.of(post1, post2));
        when(mediaStorage.downloadMediaStream("drive-1")).thenReturn(fakeStream1);
        when(youtubePublisher.publish(any(PostSchedule.class), any(InputStream.class), any()))
                .thenReturn(PublishResult.success("vid-1", "https://youtu.be/vid-1"));

        PublishBatchReport report = limitedService.execute();

        assertThat(report.successCount()).isEqualTo(1);
        // Garante que o post 2 foi ignorado devido ao limite preventivo
        verify(mediaStorage, never()).downloadMediaStream("drive-2");
    }

    @Test
    @DisplayName("Deve baixar stream da thumbnail quando thumbnailDriveId estiver presente")
    void shouldDownloadThumbnailWhenPresent() {
        VideoMetadata metadata = new VideoMetadata("Titulo", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("P-Thumb", 2, LocalDateTime.now().minusMinutes(5), Platform.YOUTUBE_VIDEO, "vid-drive", "thumb-drive", metadata, PublishStatus.PENDENTE, 0);

        InputStream fakeVid = new ByteArrayInputStream(new byte[]{1});
        InputStream fakeThumb = new ByteArrayInputStream(new byte[]{2});

        when(scheduleRepository.findPendingPostsDue(any(LocalDateTime.class))).thenReturn(List.of(post));
        when(mediaStorage.downloadMediaStream("vid-drive")).thenReturn(fakeVid);
        when(mediaStorage.downloadMediaStream("thumb-drive")).thenReturn(fakeThumb);
        when(youtubePublisher.publish(any(PostSchedule.class), any(InputStream.class), any()))
                .thenReturn(PublishResult.success("vid-ok", "https://youtu.be/vid-ok"));

        PublishBatchReport report = service.execute();

        assertThat(report.successCount()).isEqualTo(1);
        verify(mediaStorage).downloadMediaStream("thumb-drive");
    }
}
