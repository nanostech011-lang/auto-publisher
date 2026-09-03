const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Validação da Interface de Usuário (Dashboard Web) do AutoPublisher Pro', () => {

    test('deve renderizar o dashboard, validar componentes, testar a Central de Chaves e capturar screenshots', async ({ page }) => {
        const dashboardPath = path.resolve(__dirname, '../src/main/resources/static/index.html');
        const fileUrl = 'file://' + dashboardPath.replace(/\\/g, '/');

        // Navega até o arquivo HTML do Dashboard
        await page.goto(fileUrl);

        // 1. Validação de Título e Brand
        await expect(page).toHaveTitle(/Dashboard \| AutoPublisher Pro/);
        await expect(page.locator('text=AutoPublisher PRO')).toBeVisible();

        // 2. Validação dos 4 Cards de KPI
        await expect(page.locator('text=Total Agendado')).toBeVisible();
        await expect(page.locator('text=Pendentes')).toBeVisible();
        await expect(page.locator('text=Publicados')).toBeVisible();
        await expect(page.locator('text=Quota Guard (YouTube)')).toBeVisible();

        // 3. Validação dos Controles de Ação
        await expect(page.locator('#btnRunNow')).toBeVisible();
        await expect(page.locator('button:has-text("Novo Agendamento")')).toBeVisible();
        await expect(page.locator('#apiKeyBadge')).toBeVisible();

        // 4. Validação dos Filtros da Tabela
        await expect(page.locator('#searchInput')).toBeVisible();
        await expect(page.locator('#platformFilter')).toBeVisible();
        await expect(page.locator('#statusFilter')).toBeVisible();

        // 5. Teste da Nova Central de Chaves & Credenciais (All-in-One)
        await page.click('#apiKeyBadge');
        await expect(page.locator('#modalCredentials')).toBeVisible();
        await expect(page.locator('text=Central de Chaves & Credenciais')).toBeVisible();

        // Preenche chave de segurança
        await page.fill('#inputApiKey', 'test-user-api-key-999');

        // Navega para aba Google Sheets
        await page.click('#btnTabSheets');
        await expect(page.locator('#inputSpreadsheetId')).toBeVisible();
        await page.fill('#inputSpreadsheetId', '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');

        // Navega para aba YouTube
        await page.click('#btnTabYoutube');
        await expect(page.locator('#inputYtClientId')).toBeVisible();
        await page.fill('#inputYtClientId', '123456789.apps.googleusercontent.com');
        await page.fill('#inputYtSecret', 'GOCSPX-secret123');
        await page.fill('#inputYtRefreshToken', '1//04refreshtoken');

        // Testa alternar visibilidade de senha
        await page.click('#eyeYtRef');
        await expect(page.locator('#inputYtRefreshToken')).toHaveAttribute('type', 'text');
        await page.click('#eyeYtRef');
        await expect(page.locator('#inputYtRefreshToken')).toHaveAttribute('type', 'password');

        // Navega para aba Redes Sociais (Meta & TikTok)
        await page.click('#btnTabSocial');
        await expect(page.locator('#inputIgAccountId')).toBeVisible();
        await page.fill('#inputIgAccountId', '17841400000000000');
        await page.fill('#inputMetaToken', 'EAA...longlivedtoken');

        // Navega para aba Gerar .env
        await page.click('#btnTabEnv');
        await expect(page.locator('#envPreview')).toBeVisible();

        // Captura screenshot da Central de Credenciais aberta
        const credScreenshotPath = path.resolve(__dirname, '../docs/manual/dashboard_credentials_screenshot.png');
        await page.screenshot({ path: credScreenshotPath, fullPage: true });
        console.log(`Screenshot da Central de Credenciais capturada: ${credScreenshotPath}`);

        // Salva credenciais
        await page.click('button:has-text("Salvar Chaves")');
        await expect(page.locator('#modalCredentials')).toBeHidden();

        // 6. Teste de Abertura do Modal de Novo Agendamento
        await page.click('button:has-text("Novo Agendamento")');
        await expect(page.locator('#modalCreate')).toBeVisible();
        await expect(page.locator('#postTitle')).toBeVisible();
        await expect(page.locator('#postFirstComment')).toBeVisible();

        // Captura screenshot com o Modal de Agendamento aberto
        const modalScreenshotPath = path.resolve(__dirname, '../docs/manual/dashboard_modal_screenshot.png');
        await page.screenshot({ path: modalScreenshotPath, fullPage: true });
        console.log(`Screenshot do Modal de Agendamento capturada: ${modalScreenshotPath}`);

        // Fecha o modal
        await page.click('#modalCreate button:has-text("Cancelar")');
        await expect(page.locator('#modalCreate')).toBeHidden();

        // 7. Captura screenshot completa do Dashboard
        const screenshotPath = path.resolve(__dirname, '../docs/manual/dashboard_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot do Dashboard capturada com sucesso em: ${screenshotPath}`);
    });
});
