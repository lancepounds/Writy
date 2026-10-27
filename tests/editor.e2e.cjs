const {test,expect}=require('@playwright/test');

async function ready(page){
  await page.goto('/writy.html');
  await expect(page.locator('#ed')).toBeEnabled();
  await expect(page.locator('#stSaved')).not.toHaveText('Loading documents...');
}
async function saved(page){
  await expect(page.locator('#stSaved')).toHaveText('Saved on this device',{timeout:15000});
}
test('typing saves in IndexedDB and survives reloading Writy',async({page})=>{
  await ready(page);
  await page.locator('#ed').fill('A test document that must survive a reload.');
  await saved(page);
  await page.reload();
  await expect(page.locator('#ed')).toBeEnabled();
  await expect(page.locator('#ed')).toHaveValue('A test document that must survive a reload.');
  await saved(page);
});

test('existing localStorage document is migrated without deletion',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{
    const data=[{id:'legacy-001',title:'Older writing',text:'Imported from the previous save system',updated:Date.now()-1000}];
    localStorage.setItem('sw.docs',JSON.stringify(data));
    localStorage.setItem('sw.cur',JSON.stringify('legacy-001'));
  });
  await ready(page);
  await expect(page.locator('#ed')).toHaveValue('Imported from the previous save system');
  await saved(page);
  const state=await page.evaluate(()=>window.WrityStore.load());
  expect(state.documents.some(d=>d.id==='legacy-001'&&d.text==='Imported from the previous save system')).toBe(true);
  const legacy=await page.evaluate(()=>JSON.parse(localStorage.getItem('sw.docs')));
  expect(legacy.some(d=>d.id==='legacy-001')).toBe(true);
});

test('previous version can be restored from the Backup screen',async({page})=>{
  await ready(page);
  const editor=page.locator('#ed');
  await editor.fill('Keep this older draft.');
  await saved(page);
  await page.evaluate(async()=>{
    const docs=JSON.parse(localStorage.getItem('sw.docs'));
    const d=docs.find(d=>d.text==='Keep this older draft.');
    if(!d)throw new Error('Could not find saved draft');
    await window.WrityStore.pin(d);
  });
  await editor.fill('A replacement draft.');
  await saved(page);
  await page.locator('.tbtn[data-do=backup]').click();
  await page.getByRole('button',{name:'Previous versions of this document'}).click();
  await page.locator('[data-do=revrestore]').first().click();
  await page.getByRole('button',{name:'Confirm restore'}).click();
  await expect(editor).toHaveValue('Keep this older draft.');
  await saved(page);
  await page.reload();
  await expect(editor).toHaveValue('Keep this older draft.');
});

test('offline reopening retains the last on-device document',async({page,context})=>{
  await ready(page);
  await page.locator('#ed').fill('This document works without the network.');
  await saved(page);
  await page.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller!==null,{timeout:20000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:20000});
  await expect(page.locator('#ed')).toBeEnabled();
  await expect(page.locator('#ed')).toHaveValue('This document works without the network.');
});
