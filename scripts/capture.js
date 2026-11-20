import { mkdir } from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';
import { preview } from 'vite';

const directory = 'docs/imagens';
await mkdir(directory, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;

try {
  browser = await chromium.launch();
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1030 }, reducedMotion: 'reduce' });
  await desktop.goto(url);
  await seek(desktop, 38 * 60);
  await desktop.screenshot({ path: `${directory}/simulacao.png`, fullPage: true });

  await desktop.getByRole('link', { name: 'Comparar', exact: true }).click();
  await desktop.getByRole('button', { name: 'Fixar cenário atual' }).click();
  await desktop.getByRole('link', { name: 'Simulação', exact: true }).click();
  await desktop.getByLabel('Pessoas na etapa 2').fill('3');
  await desktop.getByRole('button', { name: 'Aplicar mudanças' }).click();
  await desktop.getByRole('link', { name: 'Comparar', exact: true }).click();
  await desktop.getByText('Comparação pareada', { exact: false }).waitFor();
  await desktop.locator('#compare-timeline').evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, 38 * 60);
  await desktop.evaluate(() => window.scrollTo(0, 0));
  await desktop.screenshot({ path: `${directory}/comparacao.png`, fullPage: true });

  const mobile = await browser.newPage({ ...devices['Pixel 7'], deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await mobile.goto(url);
  await seek(mobile, 35 * 60);
  await mobile.screenshot({ path: `${directory}/celular.png`, fullPage: true });
} finally {
  await browser?.close();
  await server.close();
}

async function seek(page, seconds) {
  await page.locator('#timeline').evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, seconds);
  await page.evaluate(() => document.fonts.ready);
}
