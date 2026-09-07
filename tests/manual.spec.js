import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Validação do Manual HTML do AutoPublisher Pro', () => {

    test('deve carregar o manual com sucesso, verificar elementos e capturar screenshot', async ({ page }) => {
        const manualPath = path.resolve(__dirname, '../docs/manual/index.html');
        const fileUrl = 'file://' + manualPath.replace(/\\/g, '/');

        // Navega até o arquivo HTML local
        await page.goto(fileUrl);

        // Verifica o título da página
        await expect(page).toHaveTitle(/Manual do Usuário \| AutoPublisher Pro/);

        // Verifica que os títulos principais estão presentes
        await expect(page.locator('h1')).toContainText('Domine a automação de vídeos com');
        await expect(page.locator('#visao-geral')).toBeVisible();
        await expect(page.locator('#planilha')).toBeVisible();
        await expect(page.locator('#google-drive')).toBeVisible();
        await expect(page.locator('#credenciais')).toBeVisible();
        await expect(page.locator('#monetizacao')).toBeVisible();
        await expect(page.locator('#deploy')).toBeVisible();
        await expect(page.locator('#faq')).toBeVisible();

        // Captura screenshot da página inteira para comprovação
        const screenshotPath = path.resolve(__dirname, '../docs/manual/manual_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        console.log(`Screenshot capturada com sucesso em: ${screenshotPath}`);
    });
});
