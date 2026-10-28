const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');

async function ready(page){
  await page.goto('/writy.html');
  await expect(page.locator('#ed')).toBeEnabled();
  await expect(page.locator('#stSaved')).not.toHaveText('Loading documents...');
}
test('bold formatting previews correctly and survives reload',async({page})=>{
  await ready(page);
  const ed=page.locator('#ed');
  await ed.fill('Writy helps me write.');
  await ed.evaluate(el=>el.setSelectionRange(0,5));
  await page.locator('[data-do=fmtbold]').click();
  await expect(ed).toHaveValue('**Writy** helps me write.');
  await page.locator('#fmtPreviewBtn').click();
  await expect(page.locator('#fmtpreview strong')).toHaveText('Writy');
  await expect(page.locator('#fmtPreviewBtn')).toHaveText('Edit');
  await page.locator('#fmtPreviewBtn').click();
  await expect(page.locator('#stSaved')).toHaveText('Saved on this device',{timeout:15000});
  await page.reload();
  await expect(ed).toHaveValue('**Writy** helps me write.');
  await page.locator('#fmtPreviewBtn').click();
  await expect(page.locator('#fmtpreview strong')).toHaveText('Writy');
});
test('list formatting can be undone and preview does not execute text as HTML',async({page})=>{
  await ready(page);
  const ed=page.locator('#ed');
  await ed.fill('First\nSecond');
  await ed.evaluate(el=>el.setSelectionRange(0,el.value.length));
  await page.locator('[data-do=fmtbullet]').click();
  await expect(ed).toHaveValue('- First\n- Second');
  await page.locator('#fmtPreviewBtn').click();
  await expect(page.locator('#fmtpreview li')).toHaveCount(2);
  await page.locator('#fmtPreviewBtn').click();
  await page.locator('#btnUndo').click();
  await expect(ed).toHaveValue('First\nSecond');
  await ed.fill('# Heading\n<script>window.fmtInjected=true</script>');
  await page.locator('#fmtPreviewBtn').click();
  await expect(page.locator('#fmtpreview h1')).toHaveText('Heading');
  await expect(page.locator('#fmtpreview')).toContainText('<script>window.fmtInjected=true</script>');
  expect(await page.evaluate(()=>window.fmtInjected)).toBeUndefined();
});
test('Word export retains formatting while safely escaping source text',async({page})=>{
  await ready(page);
  const ed=page.locator('#ed');
  await ed.fill('# Title\n**Bold** and ++underlined++\n- Item\n<p>Unsafe markup stays text</p>');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('.tbtn[data-do=backup]').click();
  await page.getByRole('button',{name:'Word file (.doc)'}).click();
  const download=await downloadPromise;
  const body=await fs.readFile(await download.path(),'utf8');
  expect(body).toContain('<h1>Title</h1>');
  expect(body).toContain('<strong>Bold</strong>');
  expect(body).toContain('<u>underlined</u>');
  expect(body).toContain('&lt;p&gt;Unsafe markup stays text&lt;/p&gt;');
});
