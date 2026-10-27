'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {IDBFactory,IDBKeyRange}=require('fake-indexeddb');
const source=fs.readFileSync(path.join(__dirname,'../writy-store.js'),'utf8');
function make(opts={}){
 const factory=opts.factory||new IDBFactory(),window=opts.noDB?{}:{indexedDB:factory};
 const env={window,IDBKeyRange,setTimeout,clearTimeout,Promise};
 if(!opts.noDB)env.indexedDB=factory;
 if(opts.clock)env.Date=class extends Date{static now(){return opts.clock.now}};
 vm.runInNewContext(source,env,{filename:'writy-store.js'});
 return{db:factory,api:window.WrityStore};
}
const doc=(id,text,updated)=>({id,title:id,text,updated});
const plain=x=>JSON.parse(JSON.stringify(x));

test('offline save persists across restart',async()=>{
 const {api,db}=make();
 assert.equal((await api.write([doc('a','saved',10)],{},'a')).available,true);
 const copy=await make({factory:db}).api.load();
 assert.deepEqual(plain(copy.documents),[doc('a','saved',10)]);
 assert.equal(copy.current,'a');
});
test('legacy migration takes newer text and keeps independent documents',()=>{
 const {api}=make();
 const r=api.mergeLegacy({documents:[doc('a','old',10)],deleted:{},current:'a'},[doc('a','new',20),doc('b','extra',11)],'a',{});
 assert.equal(r.documents.length,2);assert.equal(r.documents.find(d=>d.id==='a').text,'new');
});
test('same-timestamp migration conflict preserves both drafts',()=>{
 const {api}=make();
 const r=api.mergeLegacy({documents:[doc('a','db',10)],deleted:{},current:'a'},[doc('a','browser',10)],'a',{});
 assert.equal(r.documents.length,2);assert(r.documents.some(d=>d.text==='db'));assert(r.documents.some(d=>d.text==='browser'));
});
test('deleted document does not reappear during migration',()=>{
 const {api}=make();
 const r=api.mergeLegacy({documents:[],deleted:{a:20},current:null},[doc('a','stale',10)],'a',{});
 assert.equal(r.documents.length,0);assert.equal(r.deleted.a,20);
});
test('earlier text is available in recovery history',async()=>{
 const clock={now:100000},{api}=make({clock});
 await api.write([doc('a','first',10)],{},'a');clock.now+=32000;
 await api.write([doc('a','second',20)],{},'a');
 assert((await api.versions('a')).some(v=>v.text==='first'));
});
test('manual checkpoint survives restoration',async()=>{
 const {api}=make();
 await api.write([doc('a','current',10)],{},'a');
 assert.equal(await api.pin(doc('a','current',10)),true);
 await api.write([doc('a','older',20)],{},'a');
 assert((await api.versions('a')).some(v=>v.kind==='manual'&&v.text==='current'));
 assert.equal((await api.load()).documents[0].text,'older');
});
test('invalid checkpoint is rejected',async()=>{
 const {api}=make();assert.equal(await api.pin({id:'a'}),false);
});
test('stale tab cannot overwrite newer text and gets conflict archive',async()=>{
 const {api}=make();
 await api.write([doc('a','newer',200)],{},'a');
 const r=await api.write([doc('a','stale',100)],{},'a');
 assert.equal(r.conflicts,1);
 assert.equal((await api.load()).documents[0].text,'newer');
 assert((await api.versions('a')).some(v=>v.kind==='conflict'&&v.text==='stale'));
});
test('delete is recoverable; stale writes cannot resurrect document',async()=>{
 const {api}=make();
 await api.write([doc('a','recover me',10)],{},'a');
 await api.write([],{a:20},null);
 await api.write([doc('a','stale',15)],{a:20},'a');
 assert.equal((await api.load()).documents.length,0);
 assert((await api.versions('a')).some(v=>v.text==='recover me'));
 await api.write([doc('a','restored',25)],{a:20},'a');
 assert.equal((await api.load()).documents[0].text,'restored');
});
test('recovery history is capped at 30 drafts',async()=>{
 const clock={now:100000},{api}=make({clock});
 await api.write([doc('a','draft 0',10)],{},'a');
 for(let n=1;n<=34;n++){clock.now+=32000;await api.write([doc('a','draft '+n,n+10)],{},'a')}
 const versions=await api.versions('a');
 assert(versions.length<=30);assert.equal(versions[0].text,'draft 33');
});
test('absence of IndexedDB falls back without false success',async()=>{
 const {api}=make({noDB:true});
 assert.equal((await api.load()).available,false);
 assert.equal((await api.write([doc('a','text',10)],{},'a')).available,false);
 assert.equal(await api.pin(doc('a','text',10)),false);
});
