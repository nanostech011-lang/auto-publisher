package com.autopublisher.infrastructure.adapter.sheets;

import com.autopublisher.application.port.out.ScheduleRepositoryPort;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PrivacyStatus;
import com.autopublisher.domain.model.PublishStatus;
import com.autopublisher.domain.model.VideoMetadata;
import com.autopublisher.infrastructure.config.DynamicGoogleClientProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.model.ValueRange;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Adaptador de infraestrutura para o Google Sheets (implementa ScheduleRepositoryPort).
 * Executa leituras em lote e gravacoes cirurgicas nas colunas L ate P.
 * Suporta fallback automatico em memoria para ambiente local e testes quando GOOGLE_SHEETS_SPREADSHEET_ID nao estiver configurado.
 */
@Component
public class GoogleSheetsAdapter implements ScheduleRepositoryPort {

    private static final Logger log = LoggerFactory.getLogger(GoogleSheetsAdapter.class);

    private static final DateTimeFormatter[] DATE_FORMATTERS = new DateTimeFormatter[]{
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
    };

    private final Sheets sheetsService;
    private final String spreadsheetId;
    private final String tabName;

    private DynamicGoogleClientProvider dynamicClientProvider;
    private final List<PostSchedule> localMemoryPosts = new CopyOnWriteArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GoogleSheetsAdapter(
            Sheets sheetsService,
            @Value("${autopublisher.sheets.spreadsheet-id:}") String spreadsheetId,
            @Value("${autopublisher.sheets.tab-name:Cronograma}") String tabName
    ) {
        this.sheetsService = sheetsService;
        this.spreadsheetId = spreadsheetId;
        this.tabName = tabName;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setDynamicClientProvider(DynamicGoogleClientProvider dynamicClientProvider) {
        this.dynamicClientProvider = dynamicClientProvider;
    }

    private Sheets getActiveSheets() {
        return (dynamicClientProvider != null) ? dynamicClientProvider.getSheetsService() : sheetsService;
    }

    private String getActiveSpreadsheetId() {
        return (dynamicClientProvider != null) ? dynamicClientProvider.getCurrentSpreadsheetId(spreadsheetId) : spreadsheetId;
    }

    private String getActiveTabName() {
        return (dynamicClientProvider != null) ? dynamicClientProvider.getCurrentSheetTabName(tabName) : tabName;
    }

    @Override
    public List<PostSchedule> findPendingPostsDue(LocalDateTime referenceTime) {
        if (getActiveSpreadsheetId() == null || getActiveSpreadsheetId().trim().isEmpty() || isDummySpreadsheetId(getActiveSpreadsheetId())) {
            syncManifestsFromDisk();
            return localMemoryPosts.stream()
                    .filter(p -> p.status() == PublishStatus.PENDENTE && p.isDue(referenceTime))
                    .toList();
        }

        String range = String.format("%s!A2:Q", getActiveTabName());
        log.info("Lendo planilha do Google Sheets no range: {}", range);

        try {
            ValueRange response = getActiveSheets().spreadsheets().values()
                    .get(getActiveSpreadsheetId(), range)
                    .execute();

            List<List<Object>> rows = response.getValues();
            if (rows == null || rows.isEmpty()) {
                log.info("Nenhuma linha de dados encontrada na planilha.");
                return Collections.emptyList();
            }

            List<PostSchedule> pendingPosts = new ArrayList<>();

            for (int i = 0; i < rows.size(); i++) {
                int physicalRowIndex = i + 2; // Linha 1 e o cabecalho
                List<Object> row = rows.get(i);

                if (row == null || row.isEmpty()) {
                    continue;
                }

                try {
                    PostSchedule post = parseRow(row, physicalRowIndex);
                    if (post != null && post.status() == PublishStatus.PENDENTE && post.isDue(referenceTime)) {
                        pendingPosts.add(post);
                    }
                } catch (Exception e) {
                    log.warn("Linha {} ignorada devido a erro de formato: {}", physicalRowIndex, e.getMessage());
                }
            }

            return pendingPosts;

        } catch (Exception e) {
            log.warn("Falha ao comunicar com a Google Sheets API ({}), usando fila local de manifestos.", e.getMessage());
            syncManifestsFromDisk();
            return localMemoryPosts.stream()
                    .filter(p -> p.status() == PublishStatus.PENDENTE && p.isDue(referenceTime))
                    .toList();
        }
    }

    @Override
    public void updateStatus(int rowIndex, PublishStatus status, String publishedUrl, String logMessage, int attempts) {
        if (getActiveSpreadsheetId() == null || getActiveSpreadsheetId().trim().isEmpty() || isDummySpreadsheetId(getActiveSpreadsheetId())) {
            updateLocalMemoryPost(rowIndex, status, publishedUrl, logMessage, attempts);
            return;
        }

        String range = String.format("%s!L%d:P%d", getActiveTabName(), rowIndex, rowIndex);
        String formattedTimestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        List<Object> updateValues = Arrays.asList(
                status.name(),
                publishedUrl != null ? publishedUrl : "",
                formattedTimestamp,
                logMessage != null ? logMessage : "",
                attempts
        );

        ValueRange body = new ValueRange().setValues(List.of(updateValues));

        try {
            getActiveSheets().spreadsheets().values()
                    .update(getActiveSpreadsheetId(), range, body)
                    .setValueInputOption("USER_ENTERED")
                    .execute();
            log.info("Status da linha {} atualizado com sucesso para: {}", rowIndex, status);
        } catch (Exception e) {
            log.warn("Falha ao atualizar status na linha {} do Google Sheets ({}), atualizando em memória local.", rowIndex, e.getMessage());
            updateLocalMemoryPost(rowIndex, status, publishedUrl, logMessage, attempts);
        }
    }

    private void updateLocalMemoryPost(int rowIndex, PublishStatus status, String publishedUrl, String logMessage, int attempts) {
        for (int i = 0; i < localMemoryPosts.size(); i++) {
            PostSchedule p = localMemoryPosts.get(i);
            if (p.rowIndex() == rowIndex) {
                PostSchedule updated = new PostSchedule(
                        p.id(),
                        p.rowIndex(),
                        p.scheduledTime(),
                        p.platform(),
                        p.videoDriveId(),
                        p.thumbnailDriveId(),
                        p.metadata(),
                        status,
                        attempts,
                        p.firstComment()
                );
                localMemoryPosts.set(i, updated);
                log.info("[Local Dev] Post {} na linha {} atualizado para status {}", p.id(), rowIndex, status);
                break;
            }
        }
    }

    private boolean isDummySpreadsheetId(String id) {
        return id == null || id.isBlank() || id.contains("1AbCdEfGhIjKlMnOpQrStUvWxYz123456789") || id.startsWith("seu-");
    }

    @Override
    public List<PostSchedule> findAllPosts() {
        if (getActiveSpreadsheetId() == null || getActiveSpreadsheetId().trim().isEmpty() || isDummySpreadsheetId(getActiveSpreadsheetId())) {
            syncManifestsFromDisk();
            return new ArrayList<>(localMemoryPosts);
        }

        String range = String.format("%s!A2:Q", getActiveTabName());
        try {
            ValueRange response = getActiveSheets().spreadsheets().values()
                    .get(getActiveSpreadsheetId(), range)
                    .execute();

            List<List<Object>> rows = response.getValues();
            if (rows == null || rows.isEmpty()) {
                syncManifestsFromDisk();
                return new ArrayList<>(localMemoryPosts);
            }

            List<PostSchedule> allPosts = new ArrayList<>();
            for (int i = 0; i < rows.size(); i++) {
                int physicalRowIndex = i + 2;
                List<Object> row = rows.get(i);
                if (row == null || row.isEmpty()) {
                    continue;
                }
                try {
                    PostSchedule post = parseRow(row, physicalRowIndex);
                    if (post != null) {
                        allPosts.add(post);
                    }
                } catch (Exception e) {
                    log.warn("Linha {} ignorada na listagem geral: {}", physicalRowIndex, e.getMessage());
                }
            }
            return allPosts;
        } catch (Exception e) {
            log.warn("Google Sheets inacessível ou credenciais inválidas ({}), utilizando fila local e manifestos.", e.getMessage());
            syncManifestsFromDisk();
            return new ArrayList<>(localMemoryPosts);
        }
    }

    @Override
    public void appendPost(PostSchedule post) {
        if (getActiveSpreadsheetId() == null || getActiveSpreadsheetId().trim().isEmpty() || isDummySpreadsheetId(getActiveSpreadsheetId())) {
            localMemoryPosts.removeIf(p -> p.id().equals(post.id()));
            localMemoryPosts.add(post);
            log.info("[Local Dev] Post {} salvo na fila local com sucesso (Google Sheets não configurado ou em modo local).", post.id());
            return;
        }

        String range = String.format("%s!A:Q", getActiveTabName());
        String formattedScheduledTime = post.scheduledTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String tagsJoined = (post.metadata().tags() != null) ? String.join(", ", post.metadata().tags()) : "";

        List<Object> newRow = Arrays.asList(
                post.id(),
                formattedScheduledTime,
                post.platform().name(),
                post.videoDriveId(),
                post.thumbnailDriveId() != null ? post.thumbnailDriveId() : "",
                post.metadata().title(),
                post.metadata().description(),
                tagsJoined,
                post.metadata().categoryId() != null ? post.metadata().categoryId().toString() : "24",
                post.metadata().madeForKids() ? "TRUE" : "FALSE",
                post.metadata().privacy().name(),
                post.status().name(),
                "", // URL_Publicada inicial
                "", // Data_Publicacao inicial
                "", // Log_Erro inicial
                post.attempts(),
                post.firstComment() != null ? post.firstComment() : ""
        );

        ValueRange body = new ValueRange().setValues(List.of(newRow));

        try {
            getActiveSheets().spreadsheets().values()
                    .append(getActiveSpreadsheetId(), range, body)
                    .setValueInputOption("USER_ENTERED")
                    .setInsertDataOption("INSERT_ROWS")
                    .execute();
            log.info("Novo post {} inserido com sucesso na aba {}", post.id(), getActiveTabName());
        } catch (Exception e) {
            log.warn("Falha ao anexar novo post na planilha Google Sheets ({}), mantendo post {} na fila local.", e.getMessage(), post.id());
            localMemoryPosts.removeIf(p -> p.id().equals(post.id()));
            localMemoryPosts.add(post);
        }
    }

    private void syncManifestsFromDisk() {
        try {
            File outputDir = new File("pipeline/output");
            if (!outputDir.exists() || !outputDir.isDirectory()) {
                return;
            }
            File[] runs = outputDir.listFiles();
            if (runs == null) return;

            for (File runDir : runs) {
                if (!runDir.isDirectory()) continue;
                File[] manifests = runDir.listFiles((dir, name) -> name.endsWith("_manifest.json"));
                if (manifests == null) continue;

                for (File manifest : manifests) {
                    try {
                        String content = Files.readString(manifest.toPath());
                        parseAndLoadManifest(content, runDir);
                    } catch (Exception e) {
                        log.debug("Nao foi possivel carregar manifesto {}: {}", manifest.getName(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Erro ao escanear manifestos locais: {}", e.getMessage());
        }
    }

    private void parseAndLoadManifest(String jsonContent, File runDir) {
        try {
            JsonNode node = objectMapper.readTree(jsonContent);
            String id = node.path("id").asText();
            if (id == null || id.isBlank() || localMemoryPosts.stream().anyMatch(p -> p.id().equals(id))) {
                return;
            }
            String dateStr = node.path("scheduledTime").asText();
            LocalDateTime scheduled = parseDateTime(dateStr);
            if (scheduled == null) scheduled = LocalDateTime.now();

            String platformStr = node.path("platform").asText("YOUTUBE_SHORTS");
            Platform platform;
            try {
                platform = Platform.fromString(platformStr);
            } catch (Exception e) {
                platform = Platform.YOUTUBE_SHORTS;
            }

            File vFile = new File(runDir, "video_final_9x16.mp4");
            if (!vFile.exists()) {
                vFile = new File(runDir, node.path("videoDriveId").asText("video_final_9x16.mp4"));
            }
            String videoId = vFile.exists() ? vFile.getAbsolutePath().replace('\\', '/') : node.path("videoDriveId").asText("video_final_9x16.mp4");

            File tFile = new File(runDir, "thumbnail.png");
            if (!tFile.exists()) {
                tFile = new File(runDir, node.path("thumbnailDriveId").asText("thumbnail.png"));
            }
            String thumbId = tFile.exists() ? tFile.getAbsolutePath().replace('\\', '/') : node.path("thumbnailDriveId").asText("thumbnail.png");
            String title = node.path("title").asText("Vídeo Sem Título");
            String description = node.path("description").asText("");
            String tagsStr = node.path("tags").asText("");
            List<String> tags = tagsStr.isBlank() ? Collections.emptyList() : Arrays.stream(tagsStr.split(",")).map(String::trim).toList();
            int categoryId = node.path("categoryId").asInt(28);
            boolean madeForKids = node.path("madeForKids").asBoolean(false);
            String privacyStr = node.path("privacy").asText("PUBLIC");
            PrivacyStatus privacy;
            try {
                privacy = PrivacyStatus.valueOf(privacyStr);
            } catch (Exception e) {
                privacy = PrivacyStatus.PUBLIC;
            }
            String firstComment = node.hasNonNull("firstComment") ? node.path("firstComment").asText() : null;

            VideoMetadata metadata = new VideoMetadata(title, description, tags, categoryId, madeForKids, privacy);
            int nextRow = localMemoryPosts.size() + 2;

            PostSchedule post = new PostSchedule(
                    id,
                    nextRow,
                    scheduled,
                    platform,
                    videoId,
                    thumbId,
                    metadata,
                    PublishStatus.PENDENTE,
                    0,
                    firstComment
            );
            localMemoryPosts.add(post);
            log.info("[Local Dev] Post carregado a partir do manifesto: {} - '{}'", id, title);
        } catch (Exception e) {
            log.debug("Erro ao converter manifesto em PostSchedule: {}", e.getMessage());
        }
    }

    private PostSchedule parseRow(List<Object> row, int physicalRowIndex) {
        String id = getCell(row, 0);
        if (id.isEmpty()) {
            return null; // Linha sem ID considerada vazia/invalida
        }

        String rawDate = getCell(row, 1);
        LocalDateTime scheduledTime = parseDateTime(rawDate);
        if (scheduledTime == null) {
            log.warn("Linha {}: Data de agendamento invalida: '{}'", physicalRowIndex, rawDate);
            return null;
        }

        String rawPlatform = getCell(row, 2);
        Platform platform;
        try {
            platform = Platform.fromString(rawPlatform);
        } catch (Exception e) {
            log.warn("Linha {}: Plataforma invalida: '{}'", physicalRowIndex, rawPlatform);
            return null;
        }

        String videoDriveId = getCell(row, 3);
        if (videoDriveId.isEmpty()) {
            log.warn("Linha {}: Drive_Video_ID vazio.", physicalRowIndex);
            return null;
        }

        String thumbnailDriveId = getCell(row, 4);
        String title = getCell(row, 5);
        if (title.isEmpty()) {
            log.warn("Linha {}: Titulo do video vazio.", physicalRowIndex);
            return null;
        }

        String description = getCell(row, 6);
        String rawTags = getCell(row, 7);
        List<String> tags = rawTags.isEmpty()
                ? Collections.emptyList()
                : Arrays.stream(rawTags.split(",")).map(String::trim).toList();

        int categoryId = 24;
        try {
            String rawCategory = getCell(row, 8);
            if (!rawCategory.isEmpty()) {
                categoryId = Integer.parseInt(rawCategory.trim());
            }
        } catch (NumberFormatException e) {
            log.warn("Linha {}: Categoria invalida, usando 24 (Entretenimento): {}", physicalRowIndex, getCell(row, 8));
        }

        boolean madeForKids = "TRUE".equalsIgnoreCase(getCell(row, 9));
        PrivacyStatus privacy = PrivacyStatus.fromString(getCell(row, 10));
        PublishStatus status = PublishStatus.fromString(getCell(row, 11));

        int attempts = 0;
        try {
            String rawAttempts = getCell(row, 15);
            if (!rawAttempts.isEmpty()) {
                attempts = Integer.parseInt(rawAttempts.trim());
            }
        } catch (NumberFormatException ignored) {}

        String firstComment = getCell(row, 16);

        VideoMetadata metadata = new VideoMetadata(title, description, tags, categoryId, madeForKids, privacy);

        return new PostSchedule(
                id,
                physicalRowIndex,
                scheduledTime,
                platform,
                videoDriveId,
                thumbnailDriveId.isEmpty() ? null : thumbnailDriveId,
                metadata,
                status,
                attempts,
                firstComment.isEmpty() ? null : firstComment
        );
    }

    private String getCell(List<Object> row, int index) {
        if (row != null && index < row.size() && row.get(index) != null) {
            return row.get(index).toString().trim();
        }
        return "";
    }

    private LocalDateTime parseDateTime(String rawDate) {
        if (rawDate == null || rawDate.trim().isEmpty()) {
            return null;
        }
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDateTime.parse(rawDate.trim(), formatter);
            } catch (DateTimeParseException ignored) {}
        }
        return null;
    }
}
