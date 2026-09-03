package com.autopublisher.infrastructure.controller;

import com.autopublisher.application.port.in.CreatePostRequest;
import com.autopublisher.application.port.in.DashboardOverview;
import com.autopublisher.application.port.in.PublishBatchReport;
import com.autopublisher.application.port.in.PublishScheduledPostsUseCase;
import com.autopublisher.application.usecase.DashboardService;
import com.autopublisher.domain.model.PostSchedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Adaptador de Entrada (Inbound REST Controller) para o Dashboard Web da aplicacao.
 * Permite listar dados consolidados, adicionar novos agendamentos e disparar execucoes sob demanda.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardApiController {

    private static final Logger log = LoggerFactory.getLogger(DashboardApiController.class);

    private final DashboardService dashboardService;
    private final PublishScheduledPostsUseCase publishUseCase;
    private final String expectedApiKey;

    public DashboardApiController(
            DashboardService dashboardService,
            PublishScheduledPostsUseCase publishUseCase,
            @Value("${autopublisher.security.api-key:}") String expectedApiKey
    ) {
        this.dashboardService = dashboardService;
        this.publishUseCase = publishUseCase;
        this.expectedApiKey = expectedApiKey;
    }

    private boolean isUnauthorized(String providedHeader, String providedQuery) {
        if (expectedApiKey == null || expectedApiKey.trim().isEmpty()) {
            return false;
        }
        String key = (providedHeader != null && !providedHeader.trim().isEmpty())
                ? providedHeader.trim()
                : (providedQuery != null ? providedQuery.trim() : null);

        return key == null || !expectedApiKey.trim().equals(key);
    }

    @GetMapping("/overview")
    public ResponseEntity<?> getOverview(
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        try {
            DashboardOverview overview = dashboardService.getOverview();
            return ResponseEntity.ok(overview);
        } catch (Exception e) {
            log.error("Erro ao carregar dados do dashboard: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro ao carregar dados: " + e.getMessage()));
        }
    }

    @PostMapping("/posts")
    public ResponseEntity<?> createPost(
            @RequestBody CreatePostRequest request,
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        try {
            PostSchedule created = dashboardService.createPost(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (Exception e) {
            log.error("Erro ao agendar novo post via dashboard: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Erro ao criar agendamento: " + e.getMessage()));
        }
    }

    @PostMapping("/run")
    public ResponseEntity<?> triggerManualRun(
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        log.info("Disparo manual acionado a partir do Dashboard Web.");
        try {
            PublishBatchReport report = publishUseCase.execute();
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            log.error("Erro durante execucao sob demanda do dashboard: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro na execucao do lote: " + e.getMessage()));
        }
    }
}
