package com.autopublisher.infrastructure.controller;

import com.autopublisher.application.port.in.PublishBatchReport;
import com.autopublisher.application.port.in.PublishScheduledPostsUseCase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(JobTriggerController.class)
@TestPropertySource(properties = {
        "autopublisher.security.api-key=test-secret-key-12345"
})
class JobTriggerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PublishScheduledPostsUseCase publishUseCase;

    @Test
    @DisplayName("Deve retornar 401 Unauthorized quando o cabecalho X-API-KEY estiver ausente")
    void shouldReturn401WhenApiKeyIsMissing() throws Exception {
        mockMvc.perform(post("/api/v1/publisher/run"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized: Invalid or missing X-API-KEY"));
    }

    @Test
    @DisplayName("Deve retornar 401 Unauthorized quando o cabecalho X-API-KEY for invalido")
    void shouldReturn401WhenApiKeyIsInvalid() throws Exception {
        mockMvc.perform(post("/api/v1/publisher/run")
                        .header("X-API-KEY", "chave-errada"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized: Invalid or missing X-API-KEY"));
    }

    @Test
    @DisplayName("Deve executar o caso de uso e retornar 200 OK quando o cabecalho X-API-KEY for valido")
    void shouldExecuteAndReturn200WhenApiKeyIsValid() throws Exception {
        PublishBatchReport mockReport = new PublishBatchReport(1, 1, 0, false, 250, List.of("Post publicado com sucesso"));
        when(publishUseCase.execute()).thenReturn(mockReport);

        mockMvc.perform(post("/api/v1/publisher/run")
                        .header("X-API-KEY", "test-secret-key-12345"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalFound").value(1))
                .andExpect(jsonPath("$.successCount").value(1))
                .andExpect(jsonPath("$.failureCount").value(0))
                .andExpect(jsonPath("$.quotaExceeded").value(false));

        verify(publishUseCase).execute();
    }

    @Test
    @DisplayName("Deve retornar 401 Unauthorized quando nenhuma chave de seguranca estiver configurada no servidor (Fail-Secure)")
    void shouldReturn401WhenNoApiKeyConfigured() {
        JobTriggerController controller = new JobTriggerController(publishUseCase, "");
        var response = controller.triggerPublishing("alguma-chave");
        org.assertj.core.api.Assertions.assertThat(response.getStatusCode())
                .isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED);
    }
}
