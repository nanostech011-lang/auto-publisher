const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Validação da Interface de Usuário (Dashboard Web) do AutoPublisher Pro', () => {

    test('deve renderizar o dashboard, validar componentes, interações de modais e capturar screenshots', async ({ page }) => {
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

        // 5. Teste de Abertura e Fechamento do Modal de API Key
        await page.click('#apiKeyBadge');
        await expect(page.locator('#modalApiKey')).toBeVisible();
        await page.fill('#inputApiKey', 'test-user-api-key-999');
        await page.click('button:has-text("Salvar Chave")');
        await expect(page.locator('#modalApiKey')).toBeHidden();

        // 6. Teste de Abertura do Modal de Novo Agendamento
        await page.click('button:has-text("Novo Agendamento")');
        await expect(page.locator('#modalCreate')).toBeVisible();
        await expect(page.locator('#postTitle')).toBeVisible();
        await expect(page.locator('#postFirstComment')).toBeVisible();

        // Captura screenshot com o Modal aberto
        const modalScreenshotPath = path.resolve(__dirname, '../docs/manual/dashboard_modal_screenshot.png');
        await page.screenshot({ path: modalScreenshotPath, fullPage: true });
        console.log(`Screenshot do Modal capturada: ${modalScreenshotPath}`);

        // Fecha o modal
        await page.click('button:has-text("Cancelar")');
        await expect(page.locator('#modalCreate')).toBeHidden();

        // 7. Captura screenshot completa do Dashboard
        const screenshotPath = path.resolve(__dirname, '../docs/manual/dashboard_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot do Dashboard capturada com sucesso em: ${screenshotPath}`);
    });
});
