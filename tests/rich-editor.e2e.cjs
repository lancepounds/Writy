const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
async function ready(page){
  await page.goto('/writy.html');
  await expect(page.locator('#ed')).toBeEnabled();
  if(await page.locator('#richEditor').isHidden())await page.locator('#btnRich').click();
  await expect(page.locator('#richEditor')).toBeVisible();
  await expect(page.locator('#sugbar')).toBeVisible();
}
test('rich editor formats text inline and saves formatted HTML across reload',async({page})=>{
  await ready(page);
  const rich=page.locator('#richEditor');
  await rich.fill('Hello world');
  await rich.evaluate(el=>{
    const n=el.firstChild;
    const sel=window.getSelection(),r=document.createRange();
    r.setStart(n,0);r.setEnd(n,5);sel.removeAllRanges();sel.addRange(r);
  });
  await page.locator('[data-do=fmtbold]').click();
  await expect(rich.locator('b,strong')).toContainText('Hello');
  await expect(page.locator('#stSaved')).toHaveText('Saved on this device',{timeout:15000});
  const data=await page.evaluate(()=>window.WrityStore.load());
  const current=data.documents.find(d=>d.id===data.current);
  expect(current.rich).toMatch(/<(b|strong)>Hello<\/(b|strong)>/i);
  expect(current.text).toContain('Hello world');
  await page.reload();
  await expect(page.locator('#richEditor')).toBeVisible();
  await expect(page.locator('#richEditor').locator('b,strong')).toContainText('Hello');
});
test('headings and lists render directly in the editor',async({page})=>{
  await ready(page);
  const rich=page.locator('#richEditor');
  await rich.fill('My Heading');
  await rich.focus();
  await page.locator('[data-do=fmth1]').click();
  await expect(rich.locator('h1')).toHaveText('My Heading');
  await rich.fill('First item');
  await rich.focus();
  await page.locator('[data-do=fmtbullet]').click();
  await expect(rich.locator('ul li')).toContainText('First item');
});
test('predictive words can be inserted into rich editor without losing focus',async({page})=>{
  await ready(page);
  const rich=page.locator('#richEditor');
  await rich.fill('The meeting will ');
  await rich.focus();
  const first=page.locator('#sugbar .sug').first();
  await expect(first).toBeVisible();
  const before=await rich.innerText();
  await first.click();
  await expect.poll(()=>rich.innerText()).not.toBe(before);
  await expect(page.locator('#stSaved')).toHaveText('Saved on this device',{timeout:15000});
});
test('export rich formatting to Word and retain readable plain text fallback',async({page})=>{
  await ready(page);
  const rich=page.locator('#richEditor');
  await rich.fill('Bold legal text');
  await rich.evaluate(el=>{
    const r=document.createRange(),sel=window.getSelection();
    r.selectNodeContents(el);sel.removeAllRanges();sel.addRange(r);
  });
  await page.locator('[data-do=fmtbold]').click();
  const done=page.waitForEvent('download');
  await page.locator('.tbtn[data-do=backup]').click();
  await page.getByRole('button',{name:'Word file (.doc)'}).click();
  const dl=await done,content=await fs.readFile(await dl.path(),'utf8');
  expect(content).toMatch(/<(b|strong)>Bold legal text<\/(b|strong)>/i);
  await page.getByRole('button',{name:'Close'}).click().catch(()=>{});
  await page.locator('#btnRich').click();
  await expect(page.locator('#ed')).toHaveValue('Bold legal text');
});
test('unsafe formatted HTML from old backup is not executed',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('sw.docs',JSON.stringify([{id:'unsafe-rich',title:'Safety check',
      text:'Safe words',rich:'<p>Safe words</p><img src=x onerror="window.richInjected=true"><script>window.richInjected=true</script>',
      updated:Date.now()+100000}]));
    localStorage.setItem('sw.cur',JSON.stringify('unsafe-rich'));
    localStorage.setItem('sw.cfg',JSON.stringify({richMode:true}));
  });
  await page.goto('/writy.html');
  await expect(page.locator('#richEditor')).toBeVisible();
  await expect(page.locator('#richEditor')).toContainText('Safe words');
  expect(await page.evaluate(()=>window.richInjected)).toBeUndefined();
  await expect(page.locator('#richEditor img,#richEditor script')).toHaveCount(0);
});
