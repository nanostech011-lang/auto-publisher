package com.autopublisher.infrastructure.adapter.sheets;

import com.autopublisher.infrastructure.config.DynamicGoogleClientProvider;

import com.autopublisher.application.port.out.ScheduleRepositoryPort;
import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PrivacyStatus;
import com.autopublisher.domain.model.PublishStatus;
import com.autopublisher.domain.model.VideoMetadata;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.model.ValueRange;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Adaptador de infraestrutura para o Google Sheets (implementa ScheduleRepositoryPort).
 * Executa leituras em lote e gravacoes cirurgicas nas colunas L ate P.
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
        if (getActiveSpreadsheetId() == null || getActiveSpreadsheetId().trim().isEmpty()) {
            log.warn("GOOGLE_SHEETS_SPREADSHEET_ID nao configurado. Nenhuma postagem sera lida.");
            return Collections.emptyList();
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

        } catch (IOException e) {
            log.error("Falha ao comunicar com a Google Sheets API: {}", e.getMessage(), e);
            throw new RuntimeException("Erro ao consultar Google Sheets: " + e.getMessage(), e);
        }
    }

    @Override
    public void updateStatus(int rowIndex, PublishStatus status, String publishedUrl, String logMessage, int attempts) {
        if (getActiveSpreadsheetId() == null || getActiveSpreadsheetId().trim().isEmpty()) {
            log.warn("GOOGLE_SHEETS_SPREADSHEET_ID nao configurado. Ignorando gravacao de status na linha {}.", rowIndex);
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
        } catch (IOException e) {
            log.error("Falha ao atualizar status na linha {} do Google Sheets: {}", rowIndex, e.getMessage(), e);
        }
    }

    @Override
    public List<PostSchedule> findAllPosts() {
        if (getActiveSpreadsheetId() == null || getActiveSpreadsheetId().trim().isEmpty()) {
            log.warn("GOOGLE_SHEETS_SPREADSHEET_ID nao configurado. Nenhum post sera retornado.");
            return Collections.emptyList();
        }

        String range = String.format("%s!A2:Q", getActiveTabName());
        try {
            ValueRange response = getActiveSheets().spreadsheets().values()
                    .get(getActiveSpreadsheetId(), range)
                    .execute();

            List<List<Object>> rows = response.getValues();
            if (rows == null || rows.isEmpty()) {
                return Collections.emptyList();
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
        } catch (IOException e) {
            log.error("Falha ao consultar todos os posts do Google Sheets: {}", e.getMessage(), e);
            throw new RuntimeException("Erro ao consultar Google Sheets: " + e.getMessage(), e);
        }
    }

    @Override
    public void appendPost(PostSchedule post) {
        if (getActiveSpreadsheetId() == null || getActiveSpreadsheetId().trim().isEmpty()) {
            throw new IllegalStateException("GOOGLE_SHEETS_SPREADSHEET_ID nao configurado.");
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
        } catch (IOException e) {
            log.error("Falha ao anexar novo post na planilha Google Sheets: {}", e.getMessage(), e);
            throw new RuntimeException("Erro ao anexar post no Google Sheets: " + e.getMessage(), e);
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
                : Arrays.stream(rawTags.split(","))
                .map(String::trim)
                .filter(t -> !t.isEmpty())
                .toList();

        String rawCategory = getCell(row, 8);
        Integer categoryId = 24; // Default Entretenimento
        if (!rawCategory.isEmpty()) {
            try {
                categoryId = Integer.parseInt(rawCategory);
            } catch (NumberFormatException ignored) {
            }
        }

        String rawMadeForKids = getCell(row, 9);
        boolean madeForKids = Boolean.parseBoolean(rawMadeForKids);

        String rawPrivacy = getCell(row, 10);
        PrivacyStatus privacy = PrivacyStatus.fromString(rawPrivacy);

        String rawStatus = getCell(row, 11);
        PublishStatus status = PublishStatus.fromString(rawStatus);

        String rawAttempts = getCell(row, 15);
        int attempts = 0;
        if (!rawAttempts.isEmpty()) {
            try {
                attempts = Integer.parseInt(rawAttempts);
            } catch (NumberFormatException ignored) {
            }
        }

        String rawFirstComment = getCell(row, 16);
        String firstComment = rawFirstComment.isEmpty() ? null : rawFirstComment;

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
                firstComment
        );
    }

    private String getCell(List<Object> row, int index) {
        if (index >= row.size() || row.get(index) == null) {
            return "";
        }
        return row.get(index).toString().trim();
    }

    private LocalDateTime parseDateTime(String text) {
        if (text == null || text.trim().isEmpty()) {
            return null;
        }
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDateTime.parse(text.trim(), formatter);
            } catch (DateTimeParseException ignored) {
            }
        }
        return null;
    }
}
