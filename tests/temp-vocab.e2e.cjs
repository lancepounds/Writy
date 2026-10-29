const {test,expect}=require('@playwright/test');
test.use({hasTouch:true,viewport:{width:820,height:1180}});
async function setup(page){
  await page.goto('/writy.html');
  await page.evaluate(()=>{
    const cfg=JSON.parse(localStorage.getItem('sw.cfg')||'{}');
    localStorage.setItem('sw.cfg',JSON.stringify({...cfg,place:'menu',richMode:false,tablet:false,keys:false,check:false,menuN:6}));
  });
  await page.reload();
  await expect(page.locator('#ed')).toBeEnabled();
}
async function open(page){
  await page.locator('#btnMore').tap();
  await page.locator('#moremenu [data-do=vocab]').tap();
  await expect(page.locator('#tvWords')).toBeVisible();
}
test('custom vocabulary predicts names, survives reload and turns off',async({page})=>{
  await setup(page);await open(page);
  await page.locator('#tvWords').fill('Quorvexium, Quorvexium');
  await expect(page.locator('#tvCount')).toHaveText('1 / 120 words');
  await page.locator('[data-do=vocabapply]').tap();
  await page.locator('#ed').fill('I need quorv');
  const candidate=page.locator('#ddmenu .ddmain .tw').filter({hasText:'Quorvexium'});
  await expect(candidate).toBeVisible();
  await page.reload();
  await page.locator('#ed').fill('I need quorv');
  await expect(candidate).toBeVisible();
  await open(page);
  await expect(page.locator('#tvWords')).toHaveValue('Quorvexium');
  await page.locator('[data-do=vocaboff]').tap();
  await page.locator('#ed').fill('I need quorv');
  await expect(candidate).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sw.tempVocab')).active)).toBe(false);
});
test('starter list activates only on Apply and can be customized',async({page})=>{
  await setup(page);await open(page);
  await page.locator('#tvTopic').selectOption('Legal');
  expect(await page.locator('#tvWords').inputValue()).toContain('affidavit');
  expect(await page.evaluate(()=>sessionStorage.getItem('sw.tempVocab'))).toBeNull();
  await page.locator('[data-do=vocabapply]').tap();
  await expect(page.locator('#btnVocab')).toHaveText('Vocab: Legal');
  await page.locator('#ed').fill('An affid');
  await expect(page.locator('#ddmenu .ddmain .tw').filter({hasText:'affidavit'})).toBeVisible();
  await open(page);await page.locator('#tvWords').fill('Zephyra');
  await expect(page.locator('#tvTopic')).toHaveValue('Custom');
  await page.locator('[data-do=vocabapply]').tap();
  await expect(page.locator('#btnVocab')).toHaveText('Vocab: Custom');
});
test('activation does not add the list to permanent storage',async({page})=>{
  await setup(page);await open(page);
  await page.locator('#tvWords').fill('Quorvexium');
  await page.locator('[data-do=vocabapply]').tap();
  const stored=await page.evaluate(()=>Object.values(localStorage).join('\n'));
  expect(stored).not.toContain('Quorvexium');
  expect(stored).not.toContain('quorvexium');
  await open(page);await page.locator('#tvWords').fill('');
  await page.locator('[data-do=vocabapply]').tap();
  await expect(page.locator('#tvError')).toHaveText('Enter at least one word.');
  await expect(page.locator('#overlay')).toBeVisible();
});
