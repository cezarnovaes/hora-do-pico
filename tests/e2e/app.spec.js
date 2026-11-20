import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const getButton = (page, name) => page.getByRole('button', { name, exact: true });
const compare = (page) => page.getByRole('link', { name: 'Comparar', exact: true }).click();
const simulate = (page) => page.getByRole('link', { name: 'Simulação', exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('reproduz, pausa, avança, reinicia e permite navegar pelo gráfico via teclado', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'Café da Estação' })).toBeVisible();
  await page.getByLabel('Velocidade da simulação').selectOption('8');
  await getButton(page, 'Iniciar').click();
  await expect(page.locator('#time')).not.toHaveText('00:00');
  await getButton(page, 'Pausar').click();
  await expect(getButton(page, 'Continuar')).toBeVisible();
  await getButton(page, 'Ir ao fim do turno').click();
  await expect(page.locator('#completed')).toHaveText('37');
  await expect(page.getByText('Turno concluído')).toBeVisible();
  const time = page.getByRole('slider', { name: 'Linha do tempo' });
  await time.focus();
  await time.press('Home');
  await time.press('ArrowRight');
  await expect(page.locator('#chart-readout')).toHaveText('Aos 00:01 · 0 pedidos na fila');
  await getButton(page, 'Reiniciar simulação').click();
  await expect(page.locator('#time')).toHaveText('00:00');
  await expect(page.getByText('Maior espera em Preparo')).toBeVisible();
  await page.getByText('Ver desempenho por etapa').click();
  await expect(page.getByRole('row', { name: /Preparo/ })).toContainText('3min 39s');
  expect(errors).toEqual([]);
});

test('compara o mesmo turno, preserva a referência e restaura demanda incompatível', async ({ page }) => {
  await compare(page);
  await getButton(page, 'Fixar cenário atual').click();
  await simulate(page);
  await page.getByRole('spinbutton', { name: 'Pessoas na etapa 2' }).fill('3');
  await expect(page.getByText('Mudanças por aplicar')).toBeVisible();
  await getButton(page, 'Aplicar mudanças').click();
  await compare(page);
  await expect(page.getByText('Comparação pareada', { exact: false })).toBeVisible();
  await expect(page.getByRole('row', { name: /Tempo médio/ })).toContainText('−2min 52s');
  await expect(page.getByRole('row', { name: /Dentro da meta/ })).toContainText('+32,4 p.p.');
  const compareTime = page.getByRole('slider', { name: 'Instante do turno' });
  await compareTime.press('End');
  await expect(page.locator('#compare-readout')).toHaveText('60:00 · Referência: 0 · Atual: 0');
  await page.reload();
  await expect(page.getByText('Comparação pareada', { exact: false })).toBeVisible();
  await simulate(page);
  await page.getByRole('spinbutton', { name: 'Pedidos por hora' }).fill('80');
  await getButton(page, 'Aplicar mudanças').click();
  await compare(page);
  await expect(page.getByText('A demanda, a duração ou a meta mudou.', { exact: false })).toBeVisible();
  await expect(page.getByRole('row', { name: /Tempo médio/ }).getByRole('cell').last()).toHaveText('—');
  await getButton(page, 'Restaurar parâmetros da referência').click();
  await expect(page.getByText('Comparação pareada', { exact: false })).toBeVisible();
  await expect(page.getByRole('row', { name: /Tempo médio/ })).toContainText('−2min 52s');
  await getButton(page, 'Atualizar referência').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('row', { name: /Tempo médio/ })).toContainText('−2min 52s');
  await getButton(page, 'Atualizar referência').click();
  await getButton(page, 'Confirmar atualização').click();
  await expect(page.getByRole('row', { name: /Tempo médio/ })).toContainText('Estável');
  await getButton(page, 'Limpar referência').click();
  await expect(getButton(page, 'Fixar cenário atual')).toBeFocused();
});

test('mantém alterações pendentes durante a navegação e identifica a configuração aplicada', async ({ page }) => {
  await page.getByLabel('Pessoas na etapa 2').fill('3');
  await compare(page);
  await expect(page.getByText('Há mudanças pendentes no editor.', { exact: false })).toBeVisible();
  await expect(page.getByText('4 pessoas', { exact: false })).toBeVisible();
  await simulate(page);
  await expect(page.getByLabel('Pessoas na etapa 2')).toHaveValue('3');
  await expect(page.getByText('Mudanças por aplicar')).toBeVisible();
});

test('edita o fluxo por arraste e teclado e preserva configurações de cada demonstração', async ({ page }) => {
  await getButton(page, 'Adicionar etapa').click();
  await expect(page.getByRole('textbox', { name: 'Nome da etapa 4' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Nome da etapa 4' }).fill('Conferência');
  await getButton(page, 'Subir etapa 4').press('Enter');
  await expect(page.getByRole('textbox', { name: 'Nome da etapa 3' })).toHaveValue('Conferência');
  await page.locator('[data-edit-stage="2"] .stage-grip').dragTo(page.locator('[data-edit-stage="0"]'));
  await expect(page.getByRole('textbox', { name: 'Nome da etapa 1' })).toHaveValue('Conferência');
  await getButton(page, 'Remover etapa 3').click();
  await getButton(page, 'Aplicar mudanças').click();
  await expect(page.getByRole('heading', { name: 'Conferência' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preparo' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Cenário de demonstração' }).selectOption('truck');
  await expect(page.getByRole('heading', { name: 'Food Truck da Praça' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chapa' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Cenário de demonstração' }).selectOption('cafe');
  await expect(page.getByRole('heading', { name: 'Conferência' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Conferência' })).toBeVisible();
});

test('valida entradas ocultas, protege nomes renderizados e exporta CSV', async ({ page }) => {
  await page.getByText('Mais parâmetros').click();
  await page.getByRole('spinbutton', { name: 'Semente' }).fill('0');
  await page.getByText('Mais parâmetros').click();
  await getButton(page, 'Aplicar mudanças').click();
  await expect(page.locator('#advanced')).toHaveAttribute('open', '');
  await page.getByRole('spinbutton', { name: 'Semente' }).fill('42');
  const name = '<b>Cozinha</b>';
  await page.getByRole('textbox', { name: 'Nome da etapa 2' }).fill(name);
  await getButton(page, 'Aplicar mudanças').click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.locator('.station h3 b')).toHaveCount(0);
  const waiting = page.waitForEvent('download');
  await getButton(page, 'Exportar CSV').click();
  const download = await waiting;
  expect(download.suggestedFilename()).toBe('hora-do-pico-cafe.csv');
  const contents = await readFile(await download.path(), 'utf8');
  expect(contents).toContain('"entrada_etapa_s"');
  expect(contents).toContain(name);
  expect(contents.trim().split('\r\n')).toHaveLength(112);
});

test('layout móvel mantém navegação, edição e comparação sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('heading', { name: 'Operação ao vivo' })).toBeVisible();
  await getButton(page, 'Configurar').click();
  await expect(page.getByRole('complementary', { name: 'Configurar operação' })).toBeFocused();
  await expect(page.getByRole('spinbutton', { name: 'Pedidos por hora' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await compare(page);
  await getButton(page, 'Fixar cenário atual').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await simulate(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByLabel('Nome da etapa 1').fill('Nomecompridodeetapaextra');
  await getButton(page, 'Aplicar mudanças').click();
  const station = page.locator('.station').first();
  const name = station.getByRole('heading');
  expect((await name.boundingBox()).height).toBeLessThan((await station.boundingBox()).height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('guia acessível e telas principais passam pelos critérios automatizados WCAG AA', async ({ page }) => {
  const scan = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  expect((await scan()).violations).toEqual([]);
  await getButton(page, 'Como usar').click();
  await expect(page.getByRole('dialog', { name: 'Como usar' })).toBeVisible();
  expect((await scan()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(getButton(page, 'Como usar')).toBeFocused();
  await compare(page);
  await getButton(page, 'Fixar cenário atual').click();
  await simulate(page);
  await page.getByLabel('Pessoas na etapa 2').fill('3');
  await getButton(page, 'Aplicar mudanças').click();
  await compare(page);
  expect((await scan()).violations).toEqual([]);
});
