package com.autopublisher.infrastructure.adapter.sheets;

import com.autopublisher.domain.model.Platform;
import com.autopublisher.domain.model.PostSchedule;
import com.autopublisher.domain.model.PublishStatus;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.model.ValueRange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GoogleSheetsAdapterTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private Sheets sheetsService;

    private GoogleSheetsAdapter adapter;

    private final String spreadsheetId = "test-spreadsheet-id";
    private final String tabName = "Cronograma";

    @BeforeEach
    void setUp() {
        adapter = new GoogleSheetsAdapter(sheetsService, spreadsheetId, tabName);
    }

    @Test
    @DisplayName("Deve filtrar apenas posts com status PENDENTE e data anterior ou igual a de referencia")
    void shouldFilterOnlyPendingAndDuePosts() throws IOException {
        String pastDate = LocalDateTime.now().minusHours(1).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String futureDate = LocalDateTime.now().plusHours(2).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        List<Object> row1 = Arrays.asList("POST-01", pastDate, "YOUTUBE_SHORTS", "vid-1", "thumb-1", "Titulo 1", "Desc", "tag1,tag2", "24", "FALSE", "PUBLIC", "PENDENTE", "", "", "", "0", "Comentario Promocional");
        List<Object> row2 = Arrays.asList("POST-02", futureDate, "YOUTUBE_VIDEO", "vid-2", "", "Titulo 2", "Desc", "", "28", "FALSE", "PUBLIC", "PENDENTE", "", "", "", "0");
        List<Object> row3 = Arrays.asList("POST-03", pastDate, "YOUTUBE_SHORTS", "vid-3", "", "Titulo 3", "Desc", "", "24", "FALSE", "PUBLIC", "PUBLICADO", "https://...", "", "", "0");

        ValueRange response = new ValueRange().setValues(List.of(row1, row2, row3));

        when(sheetsService.spreadsheets().values().get(spreadsheetId, "Cronograma!A2:Q").execute())
                .thenReturn(response);

        List<PostSchedule> duePosts = adapter.findPendingPostsDue(LocalDateTime.now());

        assertThat(duePosts).hasSize(1);
        PostSchedule post = duePosts.get(0);
        assertThat(post.id()).isEqualTo("POST-01");
        assertThat(post.rowIndex()).isEqualTo(2); // Linha física 2
        assertThat(post.platform()).isEqualTo(Platform.YOUTUBE_SHORTS);
        assertThat(post.metadata().title()).isEqualTo("Titulo 1");
        assertThat(post.getThumbnailDriveId()).contains("thumb-1");
        assertThat(post.getFirstComment()).contains("Comentario Promocional");
    }

    @Test
    @DisplayName("Deve atualizar cirurgicamente o status na linha correspondente (colunas L ate P)")
    void shouldUpdateStatusSurgically() throws IOException {
        int rowIndex = 5;
        PublishStatus status = PublishStatus.PUBLICADO;
        String publishedUrl = "https://youtube.com/shorts/xyz123";
        String logMsg = "Upload finalizado";
        int attempts = 1;

        when(sheetsService.spreadsheets().values()
                .update(eq(spreadsheetId), eq("Cronograma!L5:P5"), any(ValueRange.class))
                .setValueInputOption(anyString())
                .execute()).thenReturn(null);

        adapter.updateStatus(rowIndex, status, publishedUrl, logMsg, attempts);

        ArgumentCaptor<ValueRange> captor = ArgumentCaptor.forClass(ValueRange.class);
        verify(sheetsService.spreadsheets().values())
                .update(eq(spreadsheetId), eq("Cronograma!L5:P5"), captor.capture());

        ValueRange captured = captor.getValue();
        List<?> rowValues = captured.getValues().get(0);

        assertThat(rowValues.get(0)).isEqualTo("PUBLICADO");
        assertThat(rowValues.get(1)).isEqualTo("https://youtube.com/shorts/xyz123");
        assertThat(rowValues.get(3)).isEqualTo("Upload finalizado");
        assertThat(rowValues.get(4)).isEqualTo(1);
    }
}
