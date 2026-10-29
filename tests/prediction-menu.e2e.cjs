const { test, expect } = require('@playwright/test');

test.use({ hasTouch: true });

for (const screen of [
  { name: 'portrait', width: 820, height: 1180 },
  { name: 'landscape', width: 1180, height: 820 }
]) {
  for (const middle of [true, false]) {
    test('iPad ' + screen.name + ': submenu inserts both words ' + (middle ? 'before existing text' : 'at the end'), async ({ page }) => {
      await page.setViewportSize({ width: screen.width, height: screen.height });
      await page.goto('/writy.html');
      await page.evaluate(() => {
        const cfg = JSON.parse(localStorage.getItem('sw.cfg') || '{}');
        localStorage.setItem('sw.cfg', JSON.stringify({ ...cfg, place: 'menu',
          richMode: false, tablet: false, keys: false, check: false,
          size: 30, sugsize: 26, menuN: 6, menuKids: 5 }));
      });
      await page.reload();
      const ed = page.locator('#ed');
      await expect(ed).toBeEnabled();
      const before = middle ? 'I w coffee.' : 'I w';
      await ed.fill(before);
      await ed.evaluate(el => { el.focus(); el.setSelectionRange(3, 3); });
      await expect(page.locator('#ddmenu .ddmain .ddw[data-arg="0"] .tw')).toHaveText('would');
      await page.locator('#ddmenu .ddarrow[data-arg="0"]').tap();
      const child = page.locator('#ddmenu .ddsub[data-i="0"] .ddw').first();
      await expect(child).toBeVisible();
      const pair = await child.getAttribute('aria-label');
      expect(pair).toMatch(/^would \S+/);
      await child.tap();
      const expected = 'I ' + pair + (middle ? ' coffee.' : ' ');
      await expect(ed).toHaveValue(expected);
      await expect(page.locator('#stSaved')).toHaveText('Saved on this device');
      await page.locator('#btnUndo').tap();
      await expect(ed).toHaveValue(before);
      await page.locator('#btnRedo').tap();
      await expect(ed).toHaveValue(expected);
      await expect(page.locator('#stSaved')).toHaveText('Saved on this device');
      await page.reload();
      await expect(ed).toHaveValue(expected);
    });
  }
}
