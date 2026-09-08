package com.autopublisher.infrastructure.config;

import com.autopublisher.application.port.out.TenantRepositoryPort;
import com.autopublisher.domain.model.TenantConfig;
import com.autopublisher.domain.model.TenantContext;
import com.autopublisher.domain.model.TenantContextHolder;
import com.google.api.services.drive.Drive;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.youtube.YouTube;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class DynamicGoogleClientProviderTest {

    @Mock
    private Sheets defaultSheets;

    @Mock
    private Drive defaultDrive;

    @Mock
    private YouTube defaultYouTube;

    @Mock
    private TenantRepositoryPort tenantRepository;

    private DynamicGoogleClientProvider provider;

    private AutoCloseable mocks;

    @BeforeEach
    void setUp() {
        mocks = MockitoAnnotations.openMocks(this);
        provider = new DynamicGoogleClientProvider(
                defaultSheets,
                defaultDrive,
                defaultYouTube,
                tenantRepository,
                "AutoPublisher-Test"
        );
    }

    @AfterEach
    void tearDown() throws Exception {
        TenantContextHolder.clear();
        mocks.close();
    }

    @Test
    @DisplayName("Deve retornar clientes default quando o tenant for 'default'")
    void shouldReturnDefaultClientsWhenTenantIsDefault() {
        TenantContextHolder.set(TenantContext.of("default", "Default Tenant"));

        assertThat(provider.getSheetsService()).isSameAs(defaultSheets);
        assertThat(provider.getDriveService()).isSameAs(defaultDrive);
        assertThat(provider.getYouTubeService()).isSameAs(defaultYouTube);
    }

    @Test
    @DisplayName("Deve retornar spreadsheetId e tabName customizados do tenant ativo")
    void shouldReturnCustomSpreadsheetConfigForTenant() {
        String tenantId = "tenant-agency-x";
        TenantContextHolder.set(TenantContext.of(tenantId, "Agency X"));

        TenantConfig config = new TenantConfig(
                tenantId,
                "Agency X",
                "key-xyz",
                "sheet-12345",
                "FilaDePostagens",
                null, null, null, null, null, null,
                true,
                Instant.now()
        );

        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(config));

        String sheetId = provider.getCurrentSpreadsheetId("fallback-sheet");
        String tabName = provider.getCurrentSheetTabName("fallback-tab");

        assertThat(sheetId).isEqualTo("sheet-12345");
        assertThat(tabName).isEqualTo("FilaDePostagens");
    }

    @Test
    @DisplayName("Deve retornar fallback quando o tenant nao tiver planilha especifica")
    void shouldReturnFallbackWhenTenantHasNoCustomSheet() {
        String tenantId = "tenant-no-sheet";
        TenantContextHolder.set(TenantContext.of(tenantId, "No Sheet"));

        when(tenantRepository.findById(tenantId)).thenReturn(Optional.empty());

        String sheetId = provider.getCurrentSpreadsheetId("fallback-sheet");
        String tabName = provider.getCurrentSheetTabName("fallback-tab");

        assertThat(sheetId).isEqualTo("fallback-sheet");
        assertThat(tabName).isEqualTo("fallback-tab");
    }
}
