package com.autopublisher.infrastructure.adapter.instagram;

import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PrivacyStatus;
import com.autopublisher.domain.model.PublishResult;
import com.autopublisher.domain.model.PublishStatus;
import com.autopublisher.domain.model.VideoMetadata;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InstagramPublisherAdapterTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> initResponse;

    @Mock
    private HttpResponse<String> uploadResponse;

    @Mock
    private HttpResponse<String> statusResponse;

    @Mock
    private HttpResponse<String> publishResponse;

    @Mock
    private HttpResponse<String> permalinkResponse;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private InstagramPublisherAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new InstagramPublisherAdapter(
                "123456789",
                "meta-access-token-test",
                "v20.0",
                httpClient,
                objectMapper
        );
    }

    @Test
    @DisplayName("Deve suportar apenas Platform.INSTAGRAM_REELS")
    void shouldSupportOnlyInstagramReels() {
        assertThat(adapter.supports(Platform.INSTAGRAM_REELS)).isTrue();
        assertThat(adapter.supports(Platform.YOUTUBE_SHORTS)).isFalse();
        assertThat(adapter.supports(Platform.TIKTOK)).isFalse();
    }

    @Test
    @DisplayName("Deve retornar falha quando credenciais nao estiverem configuradas")
    void shouldReturnFailureWhenCredentialsMissing() {
        InstagramPublisherAdapter noCredsAdapter = new InstagramPublisherAdapter("", "", "v20.0", httpClient, objectMapper);
        VideoMetadata metadata = new VideoMetadata("Titulo", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("IG-1", 2, LocalDateTime.now(), Platform.INSTAGRAM_REELS, "vid", null, metadata, PublishStatus.PENDENTE, 0);

        PublishResult result = noCredsAdapter.publish(post, new ByteArrayInputStream(new byte[]{1}), Optional.empty());

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("Credenciais do Instagram nao configuradas");
    }

    @Test
    @DisplayName("Deve executar o fluxo completo de publicação de Reels com sucesso")
    void shouldPublishReelsSuccessfully() throws Exception {
        VideoMetadata metadata = new VideoMetadata("Meu Reel Incrivel", "Descricao do Reel", List.of("viral", "reels"), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("IG-2", 2, LocalDateTime.now(), Platform.INSTAGRAM_REELS, "vid", null, metadata, PublishStatus.PENDENTE, 0);
        InputStream videoStream = new ByteArrayInputStream(new byte[]{1, 2, 3});

        // Mocks das respostas
        when(initResponse.statusCode()).thenReturn(200);
        when(initResponse.body()).thenReturn("{\"id\":\"container_123\",\"uri\":\"https://rupload.facebook.com/reels/upload\"}");

        when(uploadResponse.statusCode()).thenReturn(200);

        when(statusResponse.statusCode()).thenReturn(200);
        when(statusResponse.body()).thenReturn("{\"status_code\":\"FINISHED\"}");

        when(publishResponse.statusCode()).thenReturn(200);
        when(publishResponse.body()).thenReturn("{\"id\":\"media_999\"}");

        when(permalinkResponse.statusCode()).thenReturn(200);
        when(permalinkResponse.body()).thenReturn("{\"permalink\":\"https://www.instagram.com/reel/C12345/\"}");

        when(httpClient.send(any(HttpRequest.class), any())).thenAnswer(invocation -> {
            HttpRequest req = invocation.getArgument(0);
            String uri = req.uri().toString();
            if (uri.contains("rupload.facebook.com")) {
                return uploadResponse;
            } else if (uri.contains("status_code")) {
                return statusResponse;
            } else if (uri.contains("/media_publish")) {
                return publishResponse;
            } else if (uri.contains("permalink")) {
                return permalinkResponse;
            } else {
                return initResponse;
            }
        });

        PublishResult result = adapter.publish(post, videoStream, Optional.empty());

        assertThat(result.success()).isTrue();
        assertThat(result.platformVideoId()).isEqualTo("media_999");
        assertThat(result.publishedUrl()).isEqualTo("https://www.instagram.com/reel/C12345/");
    }
}
