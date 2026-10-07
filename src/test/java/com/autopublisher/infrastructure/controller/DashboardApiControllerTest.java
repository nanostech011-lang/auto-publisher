package com.autopublisher.infrastructure.controller;

import com.autopublisher.application.port.in.CreatePostRequest;
import com.autopublisher.application.port.in.DashboardOverview;
import com.autopublisher.application.port.in.PublishBatchReport;
import com.autopublisher.application.port.in.PublishScheduledPostsUseCase;
import com.autopublisher.application.usecase.DashboardService;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PrivacyStatus;
import com.autopublisher.domain.model.PublishStatus;
import com.autopublisher.domain.model.VideoMetadata;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DashboardApiController.class)
@TestPropertySource(properties = {
        "autopublisher.security.api-key=test-dashboard-key-12345"
})
class DashboardApiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DashboardService dashboardService;

    @MockBean
    private PublishScheduledPostsUseCase publishUseCase;

    @MockBean
    private com.autopublisher.application.usecase.AiPipelineService aiPipelineService;

    private static final String API_KEY = "test-dashboard-key-12345";

    @Test
    @DisplayName("Deve retornar 401 Unauthorized ao tentar consultar overview sem chave de API")
    void shouldReturn401OnOverviewWithoutKey() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/overview"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized: Invalid or missing X-API-KEY"));
    }

    @Test
    @DisplayName("Deve retornar overview com sucesso quando chave X-API-KEY for fornecida")
    void shouldReturnOverviewWithValidKey() throws Exception {
        DashboardOverview overview = new DashboardOverview(
                Collections.emptyList(),
                10,
                3,
                6,
                1,
                DashboardOverview.YouTubeQuotaOverview.of(4)
        );

        when(dashboardService.getOverview()).thenReturn(overview);

        mockMvc.perform(get("/api/v1/dashboard/overview")
                        .header("X-API-KEY", API_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPosts").value(10))
                .andExpect(jsonPath("$.pendingPosts").value(3))
                .andExpect(jsonPath("$.publishedPosts").value(6))
                .andExpect(jsonPath("$.youtubeQuota.publishedToday").value(4));
    }

    @Test
    @DisplayName("Deve aceitar agendamento de novo post via POST /api/v1/dashboard/posts")
    void shouldCreatePostViaDashboard() throws Exception {
        CreatePostRequest request = new CreatePostRequest(
                "POST-API-1",
                "2026-09-03 18:00:00",
                Platform.YOUTUBE_SHORTS,
                "drive_vid_123",
                null,
                "Titulo de Teste",
                "Descricao",
                "tag1, tag2",
                24,
                false,
                PrivacyStatus.PUBLIC,
                "Comentario inicial"
        );

        VideoMetadata meta = new VideoMetadata("Titulo de Teste", "Descricao", List.of("tag1", "tag2"), 24, false, PrivacyStatus.PUBLIC);
        PostSchedule created = new PostSchedule("POST-API-1", 5, LocalDateTime.now(), Platform.YOUTUBE_SHORTS, "drive_vid_123", null, meta, PublishStatus.PENDENTE, 0);

        when(dashboardService.createPost(any(CreatePostRequest.class))).thenReturn(created);

        mockMvc.perform(post("/api/v1/dashboard/posts")
                        .header("X-API-KEY", API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("POST-API-1"));

        verify(dashboardService).createPost(any(CreatePostRequest.class));
    }

    @Test
    @DisplayName("Deve disparar publicacao sob demanda via POST /api/v1/dashboard/run")
    void shouldTriggerManualRunViaDashboard() throws Exception {
        PublishBatchReport report = new PublishBatchReport(1, 1, 0, false, 250, List.of("Post publicado"));
        when(publishUseCase.execute()).thenReturn(report);

        mockMvc.perform(post("/api/v1/dashboard/run")
                        .header("X-API-KEY", API_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalFound").value(1))
                .andExpect(jsonPath("$.successCount").value(1));

        verify(publishUseCase).execute();
    }

    @Test
    @DisplayName("Deve retornar status de credenciais mascaradas via GET /api/v1/dashboard/credentials")
    void shouldReturnCredentialsStatusWithMaskedValues() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/credentials")
                        .header("X-API-KEY", API_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apiKeyConfigured").value(true))
                .andExpect(jsonPath("$.maskedApiKey").isNotEmpty())
                .andExpect(jsonPath("$.geminiConfigured").exists());
    }

    @Test
    @DisplayName("Deve gerar template .env via POST /api/v1/dashboard/credentials/generate-env")
    void shouldGenerateEnvTemplateSuccessfully() throws Exception {
        com.autopublisher.application.port.in.CredentialsSettingsPayload payload =
                new com.autopublisher.application.port.in.CredentialsSettingsPayload(
                        "my-secret-key",
                        "sheet_123",
                        "Cronograma",
                        "client_123",
                        "secret_456",
                        "refresh_789",
                        true,
                        "ig_account_1",
                        "meta_token_abc",
                        true,
                        "tiktok_token_xyz",
                        "AIzaSyTestKey"
                );

        mockMvc.perform(post("/api/v1/dashboard/credentials/generate-env")
                        .header("X-API-KEY", API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.envContent").value(org.hamcrest.Matchers.containsString("AUTO_PUBLISHER_API_KEY=my-secret-key")))
                .andExpect(jsonPath("$.envContent").value(org.hamcrest.Matchers.containsString("YOUTUBE_CLIENT_ID=client_123")))
                .andExpect(jsonPath("$.envContent").value(org.hamcrest.Matchers.containsString("GEMINI_API_KEY=AIzaSyTestKey")));
    }

    @Test
    @DisplayName("Deve analisar vídeo do YouTube via POST /api/v1/dashboard/pipeline/analyze-youtube")
    void shouldAnalyzeYouTubeVideoSuccessfully() throws Exception {
        when(aiPipelineService.analyzeYouTubeVideo(any(), any(), any(), any(), any(), any(), any())).thenReturn(java.util.Map.of(
                "title", "Análise de Foco Viral #Shorts",
                "wordCount", 150,
                "author", "Canal de Referência"
        ));

        mockMvc.perform(post("/api/v1/dashboard/pipeline/analyze-youtube")
                        .header("X-API-KEY", API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\",\"channelId\":\"psicosegredo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Análise de Foco Viral #Shorts"))
                .andExpect(jsonPath("$.author").value("Canal de Referência"));
    }

    @Test
    @DisplayName("Deve rejeitar análise do YouTube sem URL válida (400 Bad Request)")
    void shouldRejectYouTubeAnalysisWithoutUrl() throws Exception {
        mockMvc.perform(post("/api/v1/dashboard/pipeline/analyze-youtube")
                        .header("X-API-KEY", API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channelId\":\"psicosegredo\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Campo 'url' e obrigatorio."));
    }

    @Test
    @DisplayName("Deve disparar pipeline com parâmetros 100% dinâmicos extraídos do dashboard")
    void shouldRunPipelineWithDynamicDashboardParameters() throws Exception {
        com.autopublisher.application.port.in.PipelineJobStatus mockStatus = new com.autopublisher.application.port.in.PipelineJobStatus(
                "job_dyn_123", "RUNNING", 5, "Iniciando", "canal_custom", "TIKTOK",
                "Produtividade Extrema", java.time.LocalDateTime.now(), null,
                java.util.List.of("Log 1"), null, null, null, null, null
        );
        when(aiPipelineService.startPipelineJob(any())).thenReturn(mockStatus);

        mockMvc.perform(post("/api/v1/dashboard/pipeline/run")
                        .header("X-API-KEY", API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "channelName": "@meunovocanal",
                            "channelNiche": "Produtividade",
                            "voiceId": "pt-BR-FranciscaNeural",
                            "affiliateUrl": "https://meuafiliado.com/curso",
                            "title": "Os 3 Hábitos Diários #Shorts",
                            "narrationText": "Você quer mudar sua rotina mas não sabe por onde começar...",
                            "firstComment": "👉 Link oficial do curso: https://meuafiliado.com/curso",
                            "platform": "TIKTOK",
                            "subtitlesTheme": "CYAN_ELECTRIC",
                            "enableSubtitles": true
                        }
                        """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId").value("job_dyn_123"))
                .andExpect(jsonPath("$.platform").value("TIKTOK"));
    }

    @Test
    @DisplayName("Deve aceitar requisição de execução de pipeline com payload completo do dashboard e audioMode minúsculo")
    void shouldAcceptPipelineRunWithDashboardPayloadAndAudioModeLowerCase() throws Exception {
        com.autopublisher.application.port.in.PipelineJobStatus mockStatus = new com.autopublisher.application.port.in.PipelineJobStatus(
                "job_dyn_456", "RUNNING", 5, "Iniciando", "custom", "TIKTOK",
                "Psicologia", java.time.LocalDateTime.now(), null,
                java.util.List.of("Log 1"), null, null, null, null, null
        );
        when(aiPipelineService.startPipelineJob(any())).thenReturn(mockStatus);

        mockMvc.perform(post("/api/v1/dashboard/pipeline/run")
                        .header("X-API-KEY", API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "channelId": "custom",
                            "channelName": "@maisquepsicologia",
                            "channelNiche": "Psicologia",
                            "voiceId": "pt-BR-AntonioNeural",
                            "affiliateUrl": null,
                            "enableSubtitles": true,
                            "subtitlesTheme": "CYAN_ELECTRIC",
                            "subtitlesLayout": "full_sentences",
                            "audioMode": "tts",
                            "targetDurationSec": null,
                            "flowClipsDir": null,
                            "scriptIndex": 0,
                            "topic": "É VOCÊ CONTRA VOCÊ! (VÍDEO MOTIVACIONAL) #Shorts",
                            "sourceUrl": "https://www.youtube.com/watch?v=lohB80mWWPg",
                            "visualDirective": "Cyberpunk dark futurista com hologramas e néon",
                            "platform": "TIKTOK",
                            "visualMode": "hybrid",
                            "title": "É VOCÊ CONTRA VOCÊ! (VÍDEO MOTIVACIONAL) #Shorts",
                            "narrationText": "O que você faria se pudesse voltar no tempo...",
                            "firstComment": null
                        }
                        """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId").value("job_dyn_456"));
    }

    @Test
    @DisplayName("Deve gerar pacote do Google Flow com parâmetros 100% dinâmicos")
    void shouldGenerateFlowPackageWithDynamicParameters() throws Exception {
        when(aiPipelineService.generateFlowPackage(any())).thenReturn(java.util.Map.of(
                "flowScenes", java.util.List.of(
                        java.util.Map.of("sceneIndex", 0, "flowPrompt", "Vertical 9:16 cinematic prompt...")
                ),
                "channelName", "@meunovocanal",
                "audioDurationSeconds", 65.5
        ));

        mockMvc.perform(post("/api/v1/dashboard/pipeline/flow-package")
                        .header("X-API-KEY", API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "channelName": "@meunovocanal",
                            "channelNiche": "Finanças",
                            "voiceId": "pt-BR-AntonioNeural",
                            "affiliateUrl": "https://meuafiliado.com/vip",
                            "subtitlesTheme": "GOLD_PUNCH"
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.channelName").value("@meunovocanal"));
    }

    @Test
    @DisplayName("Deve retornar status da pasta de clipes do Google Flow com sucesso")
    void shouldReturnFlowClipsStatusSuccessfully() throws Exception {
        when(aiPipelineService.getFlowClipsStatus()).thenReturn(java.util.Map.of(
                "directory", "pipeline/inputs/flow",
                "hasClips", true,
                "clipsCount", 2,
                "clips", java.util.List.of("scene_1.mp4", "scene_2.mp4")
        ));

        mockMvc.perform(get("/api/v1/dashboard/pipeline/flow-clips-status")
                        .header("X-API-KEY", API_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasClips").value(true))
                .andExpect(jsonPath("$.clipsCount").value(2))
                .andExpect(jsonPath("$.clips[0]").value("scene_1.mp4"));
    }
}
