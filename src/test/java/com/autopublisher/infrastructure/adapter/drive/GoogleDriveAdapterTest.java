package com.autopublisher.infrastructure.adapter.drive;

import com.autopublisher.domain.exception.MediaStreamingException;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GoogleDriveAdapterTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private Drive driveService;

    private GoogleDriveAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new GoogleDriveAdapter(driveService);
    }

    @Test
    @DisplayName("Deve obter InputStream diretamente do Drive sem alocar byte[] na RAM")
    void shouldDownloadMediaAsInputStreamSuccessfully() throws IOException {
        String fileId = "drive-file-abc";
        InputStream expectedStream = new ByteArrayInputStream(new byte[]{10, 20, 30});

        when(driveService.files().get(fileId).executeMediaAsInputStream())
                .thenReturn(expectedStream);

        InputStream resultStream = adapter.downloadMediaStream(fileId);

        assertThat(resultStream).isNotNull();
        assertThat(resultStream).isSameAs(expectedStream);
    }

    @Test
    @DisplayName("Deve lancar MediaStreamingException quando a chamada ao Drive falhar")
    void shouldThrowMediaStreamingExceptionOnFailure() throws IOException {
        String fileId = "drive-file-error";

        when(driveService.files().get(fileId).executeMediaAsInputStream())
                .thenThrow(new IOException("Connection reset by peer"));

        assertThatThrownBy(() -> adapter.downloadMediaStream(fileId))
                .isInstanceOf(MediaStreamingException.class)
                .hasMessageContaining("Erro ao conectar e obter stream do Google Drive");
    }

    @Test
    @DisplayName("Deve retornar o tamanho do arquivo corretamente a partir dos metadados do Drive")
    void shouldReturnFileSizeSuccessfully() throws IOException {
        String fileId = "drive-file-size";
        File fileMetadata = new File().setSize(104857600L); // 100MB

        when(driveService.files().get(fileId).setFields("id, name, size").execute())
                .thenReturn(fileMetadata);

        long size = adapter.getFileSize(fileId);

        assertThat(size).isEqualTo(104857600L);
    }

    @Test
    @DisplayName("Nao deve abrir arquivo local fora de pipeline/output (prevencao de Path Traversal)")
    void shouldNotStreamArbitraryLocalFilesOutsideOutputDirectory() throws IOException {
        // pom.xml existe na raiz, mas nao esta dentro de pipeline/output
        String traversalPath = "pom.xml";
        InputStream expectedDriveStream = new ByteArrayInputStream(new byte[]{1, 2, 3});

        when(driveService.files().get(traversalPath).executeMediaAsInputStream())
                .thenReturn(expectedDriveStream);

        InputStream result = adapter.downloadMediaStream(traversalPath);

        // Deve buscar no Drive mockado e nao ler o pom.xml local
        assertThat(result).isSameAs(expectedDriveStream);
    }
}
