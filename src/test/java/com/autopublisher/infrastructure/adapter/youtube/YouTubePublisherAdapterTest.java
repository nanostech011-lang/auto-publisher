package com.autopublisher.infrastructure.adapter.youtube;

import com.autopublisher.domain.exception.QuotaExceededException;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PrivacyStatus;
import com.autopublisher.domain.model.PublishResult;
import com.autopublisher.domain.model.PublishStatus;
import com.autopublisher.domain.model.VideoMetadata;
import com.google.api.client.googleapis.json.GoogleJsonError;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.googleapis.media.MediaHttpUploader;
import com.google.api.client.http.HttpHeaders;
import com.google.api.client.http.HttpResponseException;
import com.google.api.services.youtube.YouTube;
import com.google.api.services.youtube.model.Video;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class YouTubePublisherAdapterTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private YouTube youtubeService;

    @Mock
    private MediaHttpUploader mediaHttpUploader;

    private YouTubePublisherAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new YouTubePublisherAdapter(youtubeService);
    }

    @Test
    @DisplayName("Deve suportar apenas plataformas do ecossistema YouTube")
    void shouldSupportOnlyYouTubePlatforms() {
        assertThat(adapter.supports(Platform.YOUTUBE_SHORTS)).isTrue();
        assertThat(adapter.supports(Platform.YOUTUBE_VIDEO)).isTrue();
        assertThat(adapter.supports(Platform.INSTAGRAM_REELS)).isFalse();
        assertThat(adapter.supports(Platform.TIKTOK)).isFalse();
    }

    @Test
    @DisplayName("Deve publicar video do Shorts com sucesso, configurando COPPA false e resumable upload")
    void shouldPublishShortsSuccessfully() throws IOException {
        VideoMetadata metadata = new VideoMetadata(
                "Teste Shorts #Shorts",
                "Descricao monetizada",
                List.of("tag1"),
                24,
                false, // COPPA false
                PrivacyStatus.PUBLIC
        );

        PostSchedule post = new PostSchedule(
                "P-1",
                2,
                LocalDateTime.now(),
                Platform.YOUTUBE_SHORTS,
                "drive-vid-1",
                null,
                metadata,
                PublishStatus.PENDENTE,
                0
        );

        InputStream videoStream = new ByteArrayInputStream(new byte[]{1, 2, 3});

        YouTube.Videos.Insert mockInsert = youtubeService.videos().insert(anyList(), any(Video.class), any());
        when(mockInsert.getMediaHttpUploader()).thenReturn(mediaHttpUploader);

        Video uploadedVideo = new Video();
        uploadedVideo.setId("yt-12345");
        when(mockInsert.execute()).thenReturn(uploadedVideo);

        org.mockito.Mockito.clearInvocations(youtubeService.videos());

        PublishResult result = adapter.publish(post, videoStream, Optional.empty());

        assertThat(result.success()).isTrue();
        assertThat(result.platformVideoId()).isEqualTo("yt-12345");
        assertThat(result.publishedUrl()).isEqualTo("https://youtube.com/shorts/yt-12345");

        // Verifica configuracao do uploader resumivel
        verify(mediaHttpUploader).setDirectUploadEnabled(false);

        // Verifica que o video enviado contem COPPA: false para monetizacao
        ArgumentCaptor<Video> videoCaptor = ArgumentCaptor.forClass(Video.class);
        verify(youtubeService.videos()).insert(anyList(), videoCaptor.capture(), any());
        assertThat(videoCaptor.getValue().getStatus().getSelfDeclaredMadeForKids()).isFalse();
    }

    @Test
    @DisplayName("Deve lancar QuotaExceededException ao receber erro 403 quotaExceeded do YouTube")
    void shouldThrowQuotaExceededExceptionOnQuotaExceeded() throws IOException {
        VideoMetadata metadata = new VideoMetadata("Titulo", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("P-2", 3, LocalDateTime.now(), Platform.YOUTUBE_VIDEO, "drive-2", null, metadata, PublishStatus.PENDENTE, 0);
        InputStream videoStream = new ByteArrayInputStream(new byte[]{1});

        YouTube.Videos.Insert mockInsert = youtubeService.videos().insert(anyList(), any(Video.class), any());
        when(mockInsert.getMediaHttpUploader()).thenReturn(mediaHttpUploader);

        GoogleJsonError error = new GoogleJsonError();
        error.setCode(403);
        error.setMessage("quotaExceeded: The request cannot be completed because you have exceeded your quota.");

        HttpResponseException.Builder builder = new HttpResponseException.Builder(403, "Forbidden", new HttpHeaders())
                .setMessage("quotaExceeded");
        GoogleJsonResponseException quotaException = new GoogleJsonResponseException(builder, error);

        when(mockInsert.execute()).thenThrow(quotaException);

        assertThatThrownBy(() -> adapter.publish(post, videoStream, Optional.empty()))
                .isInstanceOf(QuotaExceededException.class)
                .hasMessageContaining("Cota diaria do YouTube excedida");
    }

    @Test
    @DisplayName("Deve publicar o primeiro comentário automático se fornecido no post")
    void shouldPublishFirstCommentSuccessfully() throws IOException {
        VideoMetadata metadata = new VideoMetadata("Titulo", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule(
                "P-Com",
                2,
                LocalDateTime.now(),
                Platform.YOUTUBE_SHORTS,
                "drive-vid",
                null,
                metadata,
                PublishStatus.PENDENTE,
                0,
                "Cupom 50% OFF: https://afiliado.com/promo"
        );

        InputStream videoStream = new ByteArrayInputStream(new byte[]{1});
        YouTube.Videos.Insert mockInsert = youtubeService.videos().insert(anyList(), any(Video.class), any());
        when(mockInsert.getMediaHttpUploader()).thenReturn(mediaHttpUploader);
        Video uploadedVideo = new Video().setId("yt-comment-test");
        when(mockInsert.execute()).thenReturn(uploadedVideo);

        YouTube.CommentThreads.Insert mockCommentInsert = org.mockito.Mockito.mock(YouTube.CommentThreads.Insert.class);
        when(youtubeService.commentThreads().insert(anyList(), any())).thenReturn(mockCommentInsert);

        org.mockito.Mockito.clearInvocations(youtubeService.videos());

        PublishResult result = adapter.publish(post, videoStream, Optional.empty());

        assertThat(result.success()).isTrue();
        verify(youtubeService.commentThreads()).insert(eq(List.of("snippet")), any());
        verify(mockCommentInsert).execute();
    }
}
