const {test,expect}=require('@playwright/test');

test('Writy inside Lance.os uses one window frame and retains its writing controls',async({page})=>{
  await page.goto('/');
  await page.setContent('<iframe title="Lance.os Writy program" src="/writy.html?embed=lanceos" style="width:100%;height:700px;border:0"></iframe>');
  const app=page.frameLocator('iframe[title="Lance.os Writy program"]');
  await expect(app.locator('#ed')).toBeEnabled();
  await expect(app.locator('html')).toHaveClass(/lanceos-embedded/);
  await expect(app.locator('.titlebar')).toBeHidden();
  await expect(app.locator('.taskbar')).toBeHidden();
  await expect(app.locator('#docTitle')).toBeVisible();
  await expect(app.locator('#embeddedMenu')).toHaveCount(0);
  await expect(app.locator('#startmenu')).toBeHidden();
  await expect(app.locator('#toolbar [data-do=settings]')).toBeVisible();
  await expect(app.locator('#stSaved')).toBeVisible();
  const chrome=await app.locator('.window').evaluate(el=>{
    const styles=getComputedStyle(el),desk=getComputedStyle(document.querySelector('.desk'));
    return {border:styles.borderTopWidth,padding:desk.paddingTop,maxWidth:styles.maxWidth};
  });
  expect(chrome.border).toBe('0px');
  expect(chrome.padding).toBe('0px');
  expect(chrome.maxWidth).toBe('none');
  // Backup is available directly on the writing toolbar without a second
  // Start menu; the original Start menu remains inaccessible in this view.
  await app.locator('#toolbar [data-do=backup]').click();
  await expect(app.locator('#overlay')).toBeVisible();
  await expect(app.locator('#startmenu')).toBeHidden();
  await app.locator('[data-do=closedlg]').click();
  await app.locator('#ed').fill('Writy embedded writing test.');
  await expect(app.locator('#stSaved')).toHaveText('Saved on this device',{timeout:15000});
});

test('opening Writy directly retains its own XP window and Start taskbar',async({page})=>{
  await page.goto('/writy.html');
  await expect(page.locator('#ed')).toBeEnabled();
  await expect(page.locator('html')).not.toHaveClass(/lanceos-embedded/);
  await expect(page.locator('.titlebar')).toBeVisible();
  await expect(page.locator('.taskbar')).toBeVisible();
  await expect(page.locator('#orb')).toBeVisible();
  await expect(page.locator('#embeddedMenu')).toHaveCount(0);
  const windowBorder=await page.locator('.window').evaluate(el=>getComputedStyle(el).borderLeftWidth);
  expect(windowBorder).not.toBe('0px');
});

test('embedding query in standalone tab never removes navigation',async({page})=>{
  await page.goto('/writy.html?embed=lanceos');
  await expect(page.locator('#ed')).toBeEnabled();
  await expect(page.locator('html')).not.toHaveClass(/lanceos-embedded/);
  await expect(page.locator('.titlebar')).toBeVisible();
  await expect(page.locator('.taskbar')).toBeVisible();
});
