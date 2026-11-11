import { expect, test, type Page } from '@playwright/test';
import { installBridge, type BridgeOptions } from './bridge';

async function start(page: Page, opts: BridgeOptions = {}) {
  // responses show when they arrived; a moving clock would fail every run
  await page.clock.setFixedTime(new Date('2026-05-04T09:30:00Z'));
  await installBridge(page, opts);
  await page.goto('/');
}

// clicks through the sidebar tree: folders first, then the request
async function openRequest(page: Page, ...names: string[]) {
  await expect(page.locator('.sidebar-head')).toBeVisible();
  for (const name of names) {
    await page.locator('.row-wrap .name').getByText(name, { exact: true }).click();
  }
  await expect(page.locator('.url-row')).toBeVisible();
}

async function send(page: Page) {
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.status-line')).toBeVisible();
}

// the mouse parked in the empty bottom-right corner, so no row wears a hover tint
async function shoot(page: Page, name: string) {
  await page.mouse.move(1275, 795);
  await expect(page).toHaveScreenshot(name);
}

test('welcome screen without a collection', async ({ page }) => {
  await start(page, { collection: false });
  await expect(page.getByRole('button', { name: 'Open Collection…' })).toBeVisible();
  await shoot(page, 'welcome.png');
});

test('collection open, nothing selected', async ({ page }) => {
  await start(page);
  await expect(page.locator('.row-wrap .name').getByText('pets', { exact: true })).toBeVisible();
  await shoot(page, 'collection.png');
});

test('query tab: {{vars}} in values, a switched-off param, passing tests', async ({ page }) => {
  await start(page);
  await openRequest(page, 'pets', 'list pets');
  await expect(page.locator('tr.off')).toHaveCount(1);
  await send(page);
  await expect(page.locator('.badge')).toHaveText('2/2');
  await shoot(page, 'query-vars-disabled.png');
});

test('json response with a path variable', async ({ page }) => {
  await start(page);
  await openRequest(page, 'pets', 'get pet');
  await send(page);
  await expect(page.getByText('"Düsseldorf"')).toBeVisible();
  await shoot(page, 'json-response.png');
});

test('json body editor and an error response', async ({ page }) => {
  await start(page);
  await openRequest(page, 'orders', 'place order');
  await page.locator('nav.tabs').first().getByRole('button', { name: 'Body' }).click();
  await send(page);
  await expect(page.getByText('409')).toBeVisible();
  await shoot(page, 'body-error-response.png');
});

test('unsaved edits show the discard button', async ({ page }) => {
  await start(page);
  await openRequest(page, 'health');
  const url = page.locator('.url-row .cm-content');
  await url.click();
  await page.keyboard.press('End');
  await page.keyboard.type('?verbose=1');
  await expect(page.getByRole('button', { name: 'Discard changes' })).toBeVisible();
  await shoot(page, 'dirty.png');

  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.locator('.dialog')).toBeVisible();
  await shoot(page, 'discard-dialog.png');
});

test('{{ completes environment variables in a query value', async ({ page }) => {
  await start(page);
  await openRequest(page, 'pets', 'list pets');
  await page.locator('td.value-cell .cm-content').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' {{');
  await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible();
  await shoot(page, 'var-completion.png');
});

test('environment editor', async ({ page }) => {
  await start(page);
  await page.getByTitle('Switch environment').click();
  await page.getByText('Edit environments…').click();
  await expect(page.getByRole('row', { name: /baseUrl/ })).toBeVisible();
  await shoot(page, 'environments.png');
});

for (const theme of ['gruvbox-light', 'pastel'] as const) {
  test(`theme ${theme}`, async ({ page }) => {
    await start(page, { theme });
    await openRequest(page, 'pets', 'get pet');
    await send(page);
    await expect(page.getByText('"Düsseldorf"')).toBeVisible();
    await shoot(page, `theme-${theme}.png`);
  });
}
