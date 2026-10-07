package com.autopublisher.infrastructure.adapter.drive;

import com.autopublisher.application.port.out.MediaStoragePort;
import com.autopublisher.domain.exception.MediaStreamingException;
import com.autopublisher.infrastructure.config.DynamicGoogleClientProvider;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Adaptador de infraestrutura para o Google Drive (implementa MediaStoragePort).
 * Cumpre a Regra 1 e ADR 0003: Streaming Zero-Copy direto via InputStream, sem alocar byte[] na RAM.
 * Suporta fallback automatico para streaming de arquivos locais gerados pela esteira de IA.
 */
@Component
public class GoogleDriveAdapter implements MediaStoragePort {

    private static final Logger log = LoggerFactory.getLogger(GoogleDriveAdapter.class);

    private final Drive driveService;
    private DynamicGoogleClientProvider dynamicClientProvider;

    public GoogleDriveAdapter(Drive driveService) {
        this.driveService = driveService;
    }

    @Autowired(required = false)
    public void setDynamicClientProvider(DynamicGoogleClientProvider dynamicClientProvider) {
        this.dynamicClientProvider = dynamicClientProvider;
    }

    private Drive getActiveDrive() {
        return (dynamicClientProvider != null) ? dynamicClientProvider.getDriveService() : driveService;
    }

    @Override
    public InputStream downloadMediaStream(String fileId) {
        if (fileId == null || fileId.trim().isEmpty()) {
            throw new IllegalArgumentException("O ID do arquivo no Google Drive nao pode ser nulo ou vazio");
        }

        java.io.File localFile = findLocalFile(fileId);
        if (localFile != null) {
            log.info("[Local Media] Abrindo streaming zero-copy a partir do arquivo local: {}", localFile.getAbsolutePath());
            try {
                return new FileInputStream(localFile);
            } catch (IOException e) {
                throw new MediaStreamingException("Erro ao abrir arquivo local para streaming: " + e.getMessage(), e);
            }
        }

        log.info("Abrindo conexao de streaming direto (Zero-Copy) para o arquivo do Drive: {}", fileId);

        try {
            return getActiveDrive().files()
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

        java.io.File localFile = findLocalFile(fileId);
        if (localFile != null) {
            return localFile.length();
        }

        try {
            File fileMetadata = getActiveDrive().files()
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

    private java.io.File findLocalFile(String fileId) {
        if (fileId == null || fileId.isBlank()) return null;

        try {
            java.io.File outputBase = new java.io.File("pipeline/output").getCanonicalFile();
            if (!outputBase.exists() || !outputBase.isDirectory()) {
                return null;
            }

            // 1. Caminho direto se estiver estritamente contido em pipeline/output
            java.io.File candidate = new java.io.File(fileId).getCanonicalFile();
            if (candidate.exists() && candidate.isFile() && candidate.getPath().startsWith(outputBase.getPath())) {
                return candidate;
            }

            // 2. Busca por nome de arquivo em subpastas de execuções geradas (desarmando directory traversal)
            String sanitizedName = new java.io.File(fileId).getName();
            if (sanitizedName.isBlank() || sanitizedName.contains("..")) {
                return null;
            }

            java.io.File[] runs = outputBase.listFiles();
            if (runs != null) {
                for (java.io.File r : runs) {
                    if (r.isDirectory()) {
                        java.io.File target = new java.io.File(r, sanitizedName).getCanonicalFile();
                        if (target.exists() && target.isFile() && target.getPath().startsWith(outputBase.getPath())) {
                            return target;
                        }
                    }
                }
            }
        } catch (IOException e) {
            log.warn("Falha ao resolver caminho seguro de arquivo local: {}", e.getMessage());
        }
        return null;
    }
}
