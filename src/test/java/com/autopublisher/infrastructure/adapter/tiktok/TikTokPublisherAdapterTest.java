package com.autopublisher.infrastructure.adapter.tiktok;

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
class TikTokPublisherAdapterTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> initResponse;

    @Mock
    private HttpResponse<String> uploadResponse;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private TikTokPublisherAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new TikTokPublisherAdapter(
                "tiktok-access-token-test",
                httpClient,
                objectMapper
        );
    }

    @Test
    @DisplayName("Deve suportar apenas Platform.TIKTOK")
    void shouldSupportOnlyTikTok() {
        assertThat(adapter.supports(Platform.TIKTOK)).isTrue();
        assertThat(adapter.supports(Platform.YOUTUBE_SHORTS)).isFalse();
        assertThat(adapter.supports(Platform.INSTAGRAM_REELS)).isFalse();
    }

    @Test
    @DisplayName("Deve retornar falha quando o token de acesso do TikTok nao estiver configurado")
    void shouldReturnFailureWhenTokenMissing() {
        TikTokPublisherAdapter noTokenAdapter = new TikTokPublisherAdapter("", httpClient, objectMapper);
        VideoMetadata metadata = new VideoMetadata("Titulo", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("TT-1", 2, LocalDateTime.now(), Platform.TIKTOK, "vid", null, metadata, PublishStatus.PENDENTE, 0);

        PublishResult result = noTokenAdapter.publish(post, new ByteArrayInputStream(new byte[]{1}), Optional.empty());

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("Token de acesso do TikTok nao configurado");
    }

    @Test
    @DisplayName("Deve inicializar e transferir video para o TikTok com sucesso")
    void shouldPublishToTikTokSuccessfully() throws Exception {
        VideoMetadata metadata = new VideoMetadata("Video TikTok Incrivel", "Descricao", List.of("fyp", "viral"), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("TT-2", 2, LocalDateTime.now(), Platform.TIKTOK, "vid", null, metadata, PublishStatus.PENDENTE, 0);
        InputStream videoStream = new ByteArrayInputStream(new byte[]{10, 20, 30});

        // Mock Step 1: Init post
        when(initResponse.statusCode()).thenReturn(200);
        when(initResponse.body()).thenReturn("{\"data\":{\"publish_id\":\"v_pub_tiktok_123\",\"upload_url\":\"https://upload.tiktok.com/v1/chunk\"}}");

        // Mock Step 2: Upload chunk
        when(uploadResponse.statusCode()).thenReturn(200);

        when(httpClient.send(any(HttpRequest.class), any())).thenAnswer(invocation -> {
            HttpRequest req = invocation.getArgument(0);
            String uri = req.uri().toString();
            if (uri.contains("upload.tiktok.com")) {
                return uploadResponse;
            } else {
                return initResponse;
            }
        });

        PublishResult result = adapter.publish(post, videoStream, Optional.empty());

        assertThat(result.success()).isTrue();
        assertThat(result.platformVideoId()).isEqualTo("v_pub_tiktok_123");
        assertThat(result.publishedUrl()).isEqualTo("https://www.tiktok.com/publish_id/v_pub_tiktok_123");
    }

    @Test
    @DisplayName("Deve tratar erro retornado pela API do TikTok no passo de inicializacao")
    void shouldHandleApiErrorOnInit() throws Exception {
        VideoMetadata metadata = new VideoMetadata("Video Erro", "Desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule post = new PostSchedule("TT-3", 2, LocalDateTime.now(), Platform.TIKTOK, "vid", null, metadata, PublishStatus.PENDENTE, 0);

        when(initResponse.statusCode()).thenReturn(400);
        when(initResponse.body()).thenReturn("{\"error\":{\"code\":\"invalid_params\",\"message\":\"Video size too small\"}}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(initResponse);

        PublishResult result = adapter.publish(post, new ByteArrayInputStream(new byte[]{1}), Optional.empty());

        assertThat(result.success()).isFalse();
        assertThat(result.errorMessage()).contains("Erro da TikTok API ao inicializar upload");
    }
}
