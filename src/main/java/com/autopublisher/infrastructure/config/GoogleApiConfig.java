package com.autopublisher.infrastructure.config;

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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuracao dos clientes oficiais do Google APIs (Sheets, Drive, YouTube)
 * utilizando autenticacao headless via OAuth 2.0 com Refresh Token permanente.
 */
@Configuration
public class GoogleApiConfig {

    private static final Logger log = LoggerFactory.getLogger(GoogleApiConfig.class);

    @Value("${autopublisher.youtube.client-id:}")
    private String clientId;

    @Value("${autopublisher.youtube.client-secret:}")
    private String clientSecret;

    @Value("${autopublisher.youtube.refresh-token:}")
    private String refreshToken;

    @Value("${autopublisher.youtube.application-name:AutoPublisher-Pro}")
    private String applicationName;

    @Bean
    @ConditionalOnProperty(name = "autopublisher.youtube.refresh-token")
    public HttpRequestInitializer googleHttpRequestInitializer() {
        log.info("Inicializando credenciais OAuth 2.0 para servicos do Google (Sheets, Drive, YouTube)...");
        GoogleCredentials credentials = UserCredentials.newBuilder()
                .setClientId(clientId)
                .setClientSecret(clientSecret)
                .setRefreshToken(refreshToken)
                .build();
        return new HttpCredentialsAdapter(credentials);
    }

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean(HttpRequestInitializer.class)
    public HttpRequestInitializer fallbackHttpRequestInitializer() {
        return request -> {};
    }

    @Bean
    public Sheets sheetsService(HttpRequestInitializer requestInitializer) throws Exception {
        return new Sheets.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                requestInitializer
        ).setApplicationName(applicationName).build();
    }

    @Bean
    public Drive driveService(HttpRequestInitializer requestInitializer) throws Exception {
        return new Drive.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                requestInitializer
        ).setApplicationName(applicationName).build();
    }

    @Bean
    public YouTube youtubeService(HttpRequestInitializer requestInitializer) throws Exception {
        return new YouTube.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                requestInitializer
        ).setApplicationName(applicationName).build();
    }
}
