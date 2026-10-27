const {test,expect}=require('@playwright/test');
// Enable touch events in each browser engine for these tests.
test.use({hasTouch:true});
// Browser-simulated iPad sizes are not a substitute for physical Safari.
const screens=[{label:'portrait',width:820,height:1180},{label:'landscape',width:1180,height:820}];
const modes=[
 ['top','#sugbar','.sug'],['around','#floatsug','.sug'],['cursor','#floatsug','.sug'],
 ['tree','#treebox','.sug'],['dial','#dialbox','.dw'],['menu','#ddmenu','.ddw'],
 ['phrase','#phrbox','.pchip']
];
async function modeOn(page,place,extras={}){
 await page.evaluate(({place,extras})=>{
   const saved=JSON.parse(localStorage.getItem('sw.cfg')||'{}');
   localStorage.setItem('sw.cfg',JSON.stringify({...saved,place,tablet:false,keys:false,
     sugsize:26,size:30,typewriter:true,check:false,treeN:5,treeKids:2,
     menuN:6,menuKids:5,nsug:5,rows:2,...extras}));
 },{place,extras});
 await page.reload();
 await expect(page.locator('#ed')).toBeEnabled();
 await page.locator('#ed').fill('The meeting is scheduled for ');
}
async function rect(page,selector){
 return page.locator(selector).evaluate(el=>{
   const r=el.getBoundingClientRect(),v=window.visualViewport;
   return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
     viewportWidth:v?v.width:innerWidth,viewportHeight:v?v.height:innerHeight};
 });
}
for(const screen of screens){
 test('iPad '+screen.label+': existing prediction layouts stay on screen',async({page})=>{
   await page.setViewportSize({width:screen.width,height:screen.height});
   await page.goto('/writy.html');
   await expect(page.locator('#ed')).toBeEnabled();
   for(const [mode,box,button] of modes){
     await modeOn(page,mode);
     // Cursor/around predictions may legitimately render above OR below the
     // caret, using different elements. Audit whichever panels are visible.
     const floating=mode==='around'||mode==='cursor';
     const panels=floating?page.locator('#floatsug:visible, #floatsug2:visible'):page.locator(box);
     await expect(panels.first(),mode+' panel hidden').toBeVisible();
     const count=await panels.count();
     for(let i=0;i<count;i++){
       const panel=panels.nth(i);
       await expect(panel.locator(button).first(),mode+' predictions empty').toBeVisible();
       const r=await panel.evaluate(el=>{
         const q=el.getBoundingClientRect(),v=window.visualViewport;
         return {x:q.left,y:q.top,right:q.right,bottom:q.bottom,width:q.width,height:q.height,
           viewportWidth:v?v.width:innerWidth,viewportHeight:v?v.height:innerHeight};
       });
       expect.soft(r.width,mode+' width').toBeGreaterThan(42);
       expect.soft(r.height,mode+' height').toBeGreaterThan(20);
       expect.soft(r.x,mode+' left').toBeGreaterThanOrEqual(-4);
       expect.soft(r.y,mode+' top').toBeGreaterThanOrEqual(-4);
       expect.soft(r.right,mode+' right').toBeLessThanOrEqual(r.viewportWidth+4);
       expect.soft(r.bottom,mode+' bottom').toBeLessThanOrEqual(r.viewportHeight+4);
     }
     const ed=await rect(page,'#ed');
     expect.soft(ed.height,mode+' editor height').toBeGreaterThan(100);
   }
 });
}
test('touching a predicted word inserts it exactly once',async({page})=>{
 await page.setViewportSize({width:820,height:1180});
 await page.goto('/writy.html');
 await modeOn(page,'top',{nsug:4,rows:1});
 const editor=page.locator('#ed'),before=await editor.inputValue();
 const first=page.locator('#sugbar .sug').first();
 await expect(first).toBeVisible();
 await first.tap();
 await expect.poll(async()=>editor.inputValue()).not.toBe(before);
 const after=await editor.inputValue();
 expect(after.length).toBeGreaterThan(before.length);
 await expect(page.locator('#stSaved')).toHaveText('Saved on this device');
});
test('iPad rotation preserves writing and caret location',async({page})=>{
 await page.setViewportSize({width:820,height:1180});
 await page.goto('/writy.html');await modeOn(page,'tree');
 const ed=page.locator('#ed');
 await ed.fill('Writing on the iPad in portrait and landscape.');
 await ed.evaluate(el=>{el.focus();el.setSelectionRange(11,11)});
 await page.setViewportSize({width:1180,height:820});
 await expect(ed).toHaveValue('Writing on the iPad in portrait and landscape.');
 const selection=await ed.evaluate(el=>[el.selectionStart,el.selectionEnd]);
 expect(selection).toEqual([11,11]);
 const r=await rect(page,'#ed');
 expect(r.height).toBeGreaterThan(100);
});
test('tablet mode on-screen keys keep a usable editor and visible suggestions',async({page})=>{
 await page.setViewportSize({width:820,height:1180});
 await page.goto('/writy.html');
 await modeOn(page,'top',{tablet:true,keys:true,nsug:3,rows:1,sugsize:26});
 await expect(page.locator('#kb')).toBeVisible();
 await expect(page.locator('#sugbar .sug').first()).toBeVisible();
 const r=await rect(page,'#ed');
 expect(r.height).toBeGreaterThan(100);
 expect(r.bottom).toBeLessThanOrEqual(r.viewportHeight+4);
});
