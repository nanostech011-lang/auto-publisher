package com.autopublisher.infrastructure.adapter.drive;

import com.autopublisher.application.port.out.MediaStoragePort;
import com.autopublisher.domain.exception.MediaStreamingException;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;

/**
 * Adaptador de infraestrutura para o Google Drive (implementa MediaStoragePort).
 * Cumpre a Regra 1 e ADR 0003: Streaming Zero-Copy direto via InputStream, sem alocar byte[] na RAM.
 */
@Component
public class GoogleDriveAdapter implements MediaStoragePort {

    private static final Logger log = LoggerFactory.getLogger(GoogleDriveAdapter.class);

    private final Drive driveService;

    public GoogleDriveAdapter(Drive driveService) {
        this.driveService = driveService;
    }

    @Override
    public InputStream downloadMediaStream(String fileId) {
        if (fileId == null || fileId.trim().isEmpty()) {
            throw new IllegalArgumentException("O ID do arquivo no Google Drive nao pode ser nulo ou vazio");
        }

        log.info("Abrindo conexao de streaming direto (Zero-Copy) para o arquivo do Drive: {}", fileId);

        try {
            return driveService.files()
                    .get(fileId)
                    .executeMediaAsInputStream();
        } catch (IOException e) {
            log.error("Falha ao abrir stream de midia para o arquivo do Drive {}: {}", fileId, e.getMessage(), e);
            throw new MediaStreamingException("Erro ao conectar e obter stream do Google Drive: " + e.getMessage(), e);
        }
    }

    @Override
    public long getFileSize(String fileId) {
        if (fileId == null || fileId.trim().isEmpty()) {
            return -1;
        }

        try {
            File fileMetadata = driveService.files()
                    .get(fileId)
                    .setFields("id, name, size")
                    .execute();

            if (fileMetadata != null && fileMetadata.getSize() != null) {
                return fileMetadata.getSize();
            }
            return -1;
        } catch (IOException e) {
            log.warn("Nao foi possivel obter metadados de tamanho para o arquivo {}: {}", fileId, e.getMessage());
            return -1;
        }
    }
}
