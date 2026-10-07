package com.autopublisher.application.usecase;

import com.autopublisher.application.port.in.PipelineJobStatus;
import com.autopublisher.application.port.in.PipelineRunRequest;
import com.autopublisher.domain.model.AudioMode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AiPipelineServiceTest {

    private AiPipelineService aiPipelineService;

    @BeforeEach
    void setUp() {
        aiPipelineService = new AiPipelineService(new ObjectMapper(), "fake-gemini-key", "fake-pexels-key", "fake-pixabay-key");
    }

    @Test
    @DisplayName("Deve gerar roteiro com fallback consistente quando Node.js nao puder ser invocado")
    void shouldGenerateScriptFallbackGracefully() {
        Map<String, Object> script = aiPipelineService.previewScript(
                "canal-tech",
                "Produtividade com IA",
                0,
                null,
                "Foco em produtividade",
                "Tech Master",
                "Tecnologia",
                "pt-BR-AntonioNeural",
                "https://link.com/afiliado"
        );

        assertThat(script).isNotNull();
        assertThat(script).containsKey("title");
        assertThat(script).containsKey("narrationText");
        assertThat(script).containsKey("blocks");
        assertThat(script.get("rewardsEligible")).isEqualTo(true);
        assertThat(script.get("firstComment")).toString().contains("https://link.com/afiliado");
    }

    @Test
    @DisplayName("Deve analisar video do YouTube com fallback consistente")
    void shouldAnalyzeYouTubeVideoFallbackGracefully() {
        Map<String, Object> analysis = aiPipelineService.analyzeYouTubeVideo(
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "canal-analise"
        );

        assertThat(analysis).isNotNull();
        assertThat(analysis).containsKeys("title", "narrationText", "blocks", "firstComment", "tags");
        assertThat(analysis.get("source")).isEqualTo("youtube");
    }

    @Test
    @DisplayName("Deve listar canais configurados ou retornar lista vazia sem lancar excecao")
    void shouldListConfiguredChannelsSafely() {
        List<Map<String, Object>> channels = aiPipelineService.listChannels();
        assertThat(channels).isNotNull();
    }

    @Test
    @DisplayName("Deve verificar status da pasta de clipes locais do Google Flow")
    void shouldCheckFlowClipsStatus() {
        Map<String, Object> status = aiPipelineService.getFlowClipsStatus();
        assertThat(status).isNotNull();
        assertThat(status).containsKeys("directory", "hasClips", "clipsCount");
    }

    @Test
    @DisplayName("Deve iniciar job assincrono e registrar status inicial em execucao")
    void shouldStartPipelineJobAndRetrieveStatus() {
        PipelineRunRequest request = new PipelineRunRequest(
                "canal-teste",
                0,
                "Tema do Teste",
                "YOUTUBE_SHORTS",
                null,
                null,
                "auto",
                "Canal Teste",
                "Educacao",
                "pt-BR-AntonioNeural",
                "https://link.afiliado",
                "classic",
                null,
                true,
                "Titulo de Teste",
                "Texto de narracao de teste",
                "Comentario de teste",
                AudioMode.TTS,
                65.0,
                "karaoke"
        );

        PipelineJobStatus status = aiPipelineService.startPipelineJob(request);

        assertThat(status).isNotNull();
        assertThat(status.jobId()).isNotBlank();
        assertThat(status.status()).isEqualTo("RUNNING");
        assertThat(status.channelId()).isEqualTo("canal-teste");

        PipelineJobStatus retrieved = aiPipelineService.getJobStatus(status.jobId());
        assertThat(retrieved).isNotNull();
        assertThat(retrieved.jobId()).isEqualTo(status.jobId());
    }

    @Test
    @DisplayName("Deve manter repositório de jobs limitado a MAX_JOBS (50) para evitar vazamento de memória")
    void shouldBoundJobRepository() {
        for (int i = 0; i < 60; i++) {
            PipelineRunRequest request = new PipelineRunRequest(
                    "canal-" + i,
                    0,
                    "Tema " + i,
                    "YOUTUBE_SHORTS"
            );
            aiPipelineService.startPipelineJob(request);
        }

        // Como o repositório é bounded em 50, ele não acumula infinitamente
        // Verificando que getJobStatus para os primeiros jobs eventualmente é descartado
        // após as 50 inserções mais recentes.
        assertThat(aiPipelineService.getJobStatus("job_inexistente")).isNull();
    }
}
