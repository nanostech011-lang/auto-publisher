package com.autopublisher.infrastructure.controller;

import com.autopublisher.application.port.in.CreatePostRequest;
import com.autopublisher.application.port.in.CredentialsSettingsPayload;
import com.autopublisher.application.port.in.DashboardOverview;
import com.autopublisher.application.port.in.PipelineJobStatus;
import com.autopublisher.application.port.in.PipelineRunRequest;
import com.autopublisher.application.port.in.PublishBatchReport;
import com.autopublisher.application.port.in.PublishScheduledPostsUseCase;
import com.autopublisher.application.port.in.SystemCredentialsStatus;
import com.autopublisher.application.usecase.AiPipelineService;
import com.autopublisher.application.usecase.DashboardService;
import com.autopublisher.domain.model.PostSchedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.util.List;
import java.util.Map;

/**
 * Adaptador de Entrada (Inbound REST Controller) para o Dashboard Web da aplicacao.
 * Permite listar dados consolidados, gerenciar credenciais, adicionar novos agendamentos e disparar execucoes.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardApiController {

    private static final Logger log = LoggerFactory.getLogger(DashboardApiController.class);

    private final DashboardService dashboardService;
    private final PublishScheduledPostsUseCase publishUseCase;
    private final AiPipelineService aiPipelineService;
    private final String expectedApiKey;

    private final String spreadsheetId;
    private final String tabName;
    private final String youtubeClientId;
    private final String youtubeClientSecret;
    private final String youtubeRefreshToken;
    private final boolean instagramEnabled;
    private final String instagramAccountId;
    private final String metaAccessToken;
    private final boolean tiktokEnabled;
    private final String tiktokAccessToken;

    public DashboardApiController(
            DashboardService dashboardService,
            PublishScheduledPostsUseCase publishUseCase,
            AiPipelineService aiPipelineService,
            @Value("${autopublisher.security.api-key:}") String expectedApiKey,
            @Value("${autopublisher.sheets.spreadsheet-id:}") String spreadsheetId,
            @Value("${autopublisher.sheets.tab-name:Cronograma}") String tabName,
            @Value("${autopublisher.youtube.client-id:}") String youtubeClientId,
            @Value("${autopublisher.youtube.client-secret:}") String youtubeClientSecret,
            @Value("${autopublisher.youtube.refresh-token:}") String youtubeRefreshToken,
            @Value("${autopublisher.instagram.enabled:false}") boolean instagramEnabled,
            @Value("${autopublisher.instagram.business-account-id:}") String instagramAccountId,
            @Value("${autopublisher.instagram.access-token:}") String metaAccessToken,
            @Value("${autopublisher.tiktok.enabled:false}") boolean tiktokEnabled,
            @Value("${autopublisher.tiktok.access-token:}") String tiktokAccessToken
    ) {
        this.dashboardService = dashboardService;
        this.publishUseCase = publishUseCase;
        this.aiPipelineService = aiPipelineService;
        this.expectedApiKey = expectedApiKey;
        this.spreadsheetId = spreadsheetId;
        this.tabName = tabName;
        this.youtubeClientId = youtubeClientId;
        this.youtubeClientSecret = youtubeClientSecret;
        this.youtubeRefreshToken = youtubeRefreshToken;
        this.instagramEnabled = instagramEnabled;
        this.instagramAccountId = instagramAccountId;
        this.metaAccessToken = metaAccessToken;
        this.tiktokEnabled = tiktokEnabled;
        this.tiktokAccessToken = tiktokAccessToken;
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

    @GetMapping("/credentials")
    public ResponseEntity<?> getCredentialsStatus(
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        boolean hasApiKey = expectedApiKey != null && !expectedApiKey.trim().isEmpty();
        boolean hasSheets = spreadsheetId != null && !spreadsheetId.trim().isEmpty();
        boolean hasYtSecret = youtubeClientSecret != null && !youtubeClientSecret.trim().isEmpty();
        boolean hasYtRefresh = youtubeRefreshToken != null && !youtubeRefreshToken.trim().isEmpty();
        boolean ytReady = hasYtSecret && hasYtRefresh && (youtubeClientId != null && !youtubeClientId.trim().isEmpty());

        boolean hasIgToken = metaAccessToken != null && !metaAccessToken.trim().isEmpty();
        boolean igReady = instagramEnabled && hasIgToken && (instagramAccountId != null && !instagramAccountId.trim().isEmpty());

        boolean hasTtToken = tiktokAccessToken != null && !tiktokAccessToken.trim().isEmpty();
        boolean ttReady = tiktokEnabled && hasTtToken;

        SystemCredentialsStatus status = new SystemCredentialsStatus(
                hasApiKey,
                SystemCredentialsStatus.mask(expectedApiKey),
                spreadsheetId != null ? spreadsheetId : "",
                tabName != null ? tabName : "Cronograma",
                hasSheets,
                SystemCredentialsStatus.mask(youtubeClientId),
                hasYtSecret,
                hasYtRefresh,
                ytReady,
                instagramEnabled,
                instagramAccountId != null ? instagramAccountId : "",
                hasIgToken,
                igReady,
                tiktokEnabled,
                hasTtToken,
                ttReady
        );

        return ResponseEntity.ok(status);
    }

    @PostMapping("/credentials/generate-env")
    public ResponseEntity<?> generateEnvTemplate(
            @RequestBody CredentialsSettingsPayload payload,
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        String envContent = payload.toEnvFormat();
        return ResponseEntity.ok(Map.of("envContent", envContent));
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

    @PostMapping("/posts/{id}/retry")
    public ResponseEntity<?> retryPost(
            @PathVariable("id") String id,
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        try {
            PostSchedule post = dashboardService.retryPost(id);
            return ResponseEntity.ok(Map.of("success", true, "message", "Post redefinido para PENDENTE com sucesso!", "postId", post.id()));
        } catch (Exception e) {
            log.error("Erro ao reprocessar post {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/pipeline/channels")
    public ResponseEntity<?> getPipelineChannels(
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        List<Map<String, Object>> channels = aiPipelineService.listChannels();
        return ResponseEntity.ok(channels);
    }

    @PostMapping("/pipeline/preview-script")
    public ResponseEntity<?> previewPipelineScript(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        String channelId = (String) body.get("channelId");
        String topic = (String) body.get("topic");
        Integer scriptIndex = body.get("scriptIndex") != null ? ((Number) body.get("scriptIndex")).intValue() : 0;

        Map<String, Object> scriptPreview = aiPipelineService.previewScript(channelId, topic, scriptIndex);
        return ResponseEntity.ok(scriptPreview);
    }

    @PostMapping("/pipeline/run")
    public ResponseEntity<?> runPipeline(
            @RequestBody PipelineRunRequest request,
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        PipelineJobStatus job = aiPipelineService.startPipelineJob(request);
        return ResponseEntity.accepted().body(job);
    }

    @GetMapping("/pipeline/jobs/{jobId}")
    public ResponseEntity<?> getPipelineJob(
            @PathVariable("jobId") String jobId,
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized: Invalid or missing X-API-KEY"));
        }

        PipelineJobStatus job = aiPipelineService.getJobStatus(jobId);
        if (job == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Job " + jobId + " nao encontrado."));
        }
        return ResponseEntity.ok(job);
    }

    @GetMapping("/pipeline/media")
    public ResponseEntity<Resource> getPipelineMedia(
            @RequestParam("path") String requestedPath,
            @RequestHeader(value = "X-API-KEY", required = false) String providedHeaderKey,
            @RequestParam(value = "api_key", required = false) String providedQueryKey
    ) {
        if (isUnauthorized(providedHeaderKey, providedQueryKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            File file = new File(requestedPath);
            String canonical = file.getCanonicalPath();
            File pipelineDir = new File("pipeline").getCanonicalFile();
            if (!canonical.startsWith(pipelineDir.getCanonicalPath())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            if (!file.exists() || !file.isFile()) {
                return ResponseEntity.notFound().build();
            }

            String contentType = "application/octet-stream";
            if (canonical.endsWith(".mp4")) {
                contentType = "video/mp4";
            } else if (canonical.endsWith(".png")) {
                contentType = "image/png";
            } else if (canonical.endsWith(".jpg") || canonical.endsWith(".jpeg")) {
                contentType = "image/jpeg";
            }

            Resource resource = new FileSystemResource(file);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .body(resource);

        } catch (Exception e) {
            log.error("Erro ao servir arquivo de midia {}: {}", requestedPath, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}

