package com.autopublisher.infrastructure.config;

import com.autopublisher.application.port.out.TenantRepositoryPort;
import com.autopublisher.domain.model.TenantConfig;
import com.autopublisher.domain.model.TenantContextHolder;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.youtube.YouTube;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.UserCredentials;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Provedor dinamico de clientes das APIs Google (Sheets, Drive, YouTube)
 * com isolamento por Tenant e cache em memoria.
 */
@Component
public class DynamicGoogleClientProvider {

    private static final Logger log = LoggerFactory.getLogger(DynamicGoogleClientProvider.class);

    private final Sheets defaultSheets;
    private final Drive defaultDrive;
    private final YouTube defaultYouTube;
    private final TenantRepositoryPort tenantRepository;
    private final String applicationName;

    private final ConcurrentHashMap<String, TenantGoogleClients> tenantCache = new ConcurrentHashMap<>();

    public DynamicGoogleClientProvider(
        Sheets defaultSheets,
        Drive defaultDrive,
        YouTube defaultYouTube,
        TenantRepositoryPort tenantRepository,
        @Value("${autopublisher.youtube.application-name:AutoPublisher-Pro}") String applicationName
    ) {
        this.defaultSheets = defaultSheets;
        this.defaultDrive = defaultDrive;
        this.defaultYouTube = defaultYouTube;
        this.tenantRepository = tenantRepository;
        this.applicationName = applicationName;
    }

    public Sheets getSheetsService() {
        return getClientHolder().sheets();
    }

    public Drive getDriveService() {
        return getClientHolder().drive();
    }

    public YouTube getYouTubeService() {
        return getClientHolder().youtube();
    }

    public String getCurrentSpreadsheetId(String fallbackSpreadsheetId) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        return tenantRepository.findById(tenantId)
            .map(TenantConfig::spreadsheetId)
            .filter(id -> id != null && !id.isBlank())
            .orElse(fallbackSpreadsheetId);
    }

    public String getCurrentSheetTabName(String fallbackTabName) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        return tenantRepository.findById(tenantId)
            .map(TenantConfig::sheetTabName)
            .filter(tab -> tab != null && !tab.isBlank())
            .orElse(fallbackTabName);
    }

    private TenantGoogleClients getClientHolder() {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        if ("default".equalsIgnoreCase(tenantId)) {
            return new TenantGoogleClients(defaultSheets, defaultDrive, defaultYouTube);
        }

        Optional<TenantConfig> tenantOpt = tenantRepository.findById(tenantId);
        if (tenantOpt.isEmpty()) {
            return new TenantGoogleClients(defaultSheets, defaultDrive, defaultYouTube);
        }

        TenantConfig tenant = tenantOpt.get();
        if (tenant.youtubeClientId() == null || tenant.youtubeRefreshToken() == null) {
            return new TenantGoogleClients(defaultSheets, defaultDrive, defaultYouTube);
        }

        return tenantCache.computeIfAbsent(tenantId, id -> createTenantClients(tenant));
    }

    private TenantGoogleClients createTenantClients(TenantConfig tenant) {
        try {
            log.info("[SaaS] Construindo clientes Google dedicados para o tenant '{}'", tenant.tenantId());
            GoogleCredentials credentials = UserCredentials.newBuilder()
                .setClientId(tenant.youtubeClientId())
                .setClientSecret(tenant.youtubeClientSecret())
                .setRefreshToken(tenant.youtubeRefreshToken())
                .build();
            HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(credentials);

            Sheets sheets = new Sheets.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                requestInitializer
            ).setApplicationName(applicationName).build();

            Drive drive = new Drive.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                requestInitializer
            ).setApplicationName(applicationName).build();

            YouTube youtube = new YouTube.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                requestInitializer
            ).setApplicationName(applicationName).build();

            return new TenantGoogleClients(sheets, drive, youtube);
        } catch (Exception e) {
            log.error("[SaaS] Falha ao instanciar clientes Google para o tenant '{}'. Usando defaults.", tenant.tenantId(), e);
            return new TenantGoogleClients(defaultSheets, defaultDrive, defaultYouTube);
        }
    }

    private record TenantGoogleClients(Sheets sheets, Drive drive, YouTube youtube) {}
}
