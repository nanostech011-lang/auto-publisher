package com.autopublisher.infrastructure.controller;

import com.autopublisher.application.port.in.PublishBatchReport;
import com.autopublisher.application.port.in.PublishScheduledPostsUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Adaptador de Entrada (Inbound Adapter HTTP) acionado pontualmente pelo Google Cloud Scheduler.
 * Protegido obrigatoriamente por validacao de chave de API no cabecalho X-API-KEY.
 */
@RestController
@RequestMapping("/api/v1/publisher")
public class JobTriggerController {

    private static final Logger log = LoggerFactory.getLogger(JobTriggerController.class);

    private final PublishScheduledPostsUseCase publishUseCase;
    private final String expectedApiKey;

    public JobTriggerController(
            PublishScheduledPostsUseCase publishUseCase,
            @Value("${autopublisher.security.api-key:}") String expectedApiKey
    ) {
        this.publishUseCase = publishUseCase;
        this.expectedApiKey = expectedApiKey;
    }

    @PostMapping("/run")
    public ResponseEntity<?> triggerPublishing(
            @RequestHeader(value = "X-API-KEY", required = false) String providedApiKey
    ) {
        // Valida chave de seguranca se configurada
        if (expectedApiKey != null && !expectedApiKey.trim().isEmpty()) {
            if (providedApiKey == null || !expectedApiKey.trim().equals(providedApiKey.trim())) {
                log.warn("Tentativa de disparo nao autorizada recebida com chave invalida.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
            }
        }

        log.info("Gatilho de publicacao recebido e autorizado. Iniciando orquestracao...");
        PublishBatchReport report = publishUseCase.execute();

        return ResponseEntity.ok(report);
    }
}
