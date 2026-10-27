/* Writy local-first document store.
   IndexedDB is primary. The legacy localStorage snapshot remains a fallback and
   migration source; nothing is sent to a server. */
(function(){
'use strict';
const DATABASE='writy-local-v1', MAX_VERSIONS=30;
let connection;
function connect(){
  if(connection)return connection;
  connection=new Promise(resolve=>{
    if(!('indexedDB' in window)){resolve(null);return}
    let finished=false;
    const done=db=>{if(finished){if(db)db.close();return}finished=true;clearTimeout(timer);resolve(db)};
    const timer=setTimeout(()=>done(null),5000);
    let req;
    try{req=indexedDB.open(DATABASE,1)}catch(e){done(null);return}
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('documents'))db.createObjectStore('documents',{keyPath:'id'});
      if(!db.objectStoreNames.contains('versions')){
        const v=db.createObjectStore('versions',{keyPath:'key',autoIncrement:true});
        v.createIndex('docId','docId',{unique:false});
      }
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
    };
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();done(db)};
    req.onerror=()=>done(null);
    req.onblocked=()=>done(null);
  });
  return connection;
}
function normalize(d){
  if(!d||typeof d.id!=='string'||!d.id||typeof d.text!=='string')return null;
  return{id:d.id,title:String(d.title||'Untitled').slice(0,160),text:d.text,
    updated:Number.isFinite(+d.updated)?+d.updated:Date.now()};
}
function load(){
  return connect().then(db=>{
    if(!db)return{available:false,documents:[],deleted:{},current:null};
    return new Promise(resolve=>{
      let rows=[],cur=null,finished=false;
      const fail=()=>{if(!finished){finished=true;resolve({available:false,documents:[],deleted:{},current:null})}};
      try{
        const tx=db.transaction(['documents','meta'],'readonly');
        const req=tx.objectStore('documents').getAll(),meta=tx.objectStore('meta').get('current');
        req.onsuccess=()=>{rows=req.result||[]};
        meta.onsuccess=()=>{cur=meta.result&&meta.result.value};
        tx.oncomplete=()=>{
          finished=true;
          const deleted={},documents=[];
          rows.forEach(r=>{
            if(r.deleted)deleted[r.id]=+r.updated||0;
            else{const d=normalize(r);if(d)documents.push(d)}
          });
          resolve({available:true,documents,deleted,current:cur});
        };
        tx.onerror=fail;tx.onabort=fail;
      }catch(e){fail()}
    });
  });
}
function archive(versions,doc,kind){
  if(!doc||doc.deleted||typeof doc.text!=='string')return;
  versions.add({docId:doc.id,title:doc.title||'Untitled',text:doc.text,
    updated:doc.updated,archivedAt:Date.now(),kind:kind||'previous'});
  /* Bound recovery history per document, without deleting the newest entry. */
  const ix=versions.index('docId'),keys=[];
  const req=ix.openKeyCursor(IDBKeyRange.only(doc.id));
  req.onsuccess=()=>{
    const cursor=req.result;
    if(cursor){keys.push(cursor.primaryKey);cursor.continue()}
    else for(const key of keys.slice(0,Math.max(0,keys.length-MAX_VERSIONS)))versions.delete(key);
  };
}
function write(documents,deleted,current){
  return connect().then(db=>{
    if(!db)return{available:false,conflicts:0};
    return new Promise((resolve,reject)=>{
      let tx,conflicts=0;
      try{
        tx=db.transaction(['documents','versions','meta'],'readwrite');
        const ds=tx.objectStore('documents'),vs=tx.objectStore('versions'),now=Date.now();
        const currentDocs=new Map();
        (Array.isArray(documents)?documents:[]).forEach(raw=>{
          const d=normalize(raw);if(d)currentDocs.set(d.id,d);
        });
        const deletedIds=deleted&&typeof deleted==='object'?deleted:{};
        for(const [id,value] of Object.entries(deletedIds)){
          const time=+value||0,doc=currentDocs.get(id);
          if(doc&&doc.updated>time)continue;
          if(doc)currentDocs.delete(id);
          if(!time)continue;
          const get=ds.get(id);
          get.onsuccess=()=>{
            const old=get.result;
            if(!old||old.updated<time){
              if(old&&!old.deleted)archive(vs,old,'deleted');
              ds.put({id,deleted:true,updated:time});
            }
          };
        }
        for(const d of currentDocs.values()){
          const get=ds.get(d.id);
          get.onsuccess=()=>{
            const old=get.result;
            if(!old||d.updated>old.updated){
              let lastRevisionAt=old&&old.lastRevisionAt||0;
              if(old&&!old.deleted&&(old.text!==d.text||old.title!==d.title)&&now-lastRevisionAt>=30000){
                archive(vs,old,'previous');lastRevisionAt=now;
              }
              ds.put({...d,lastRevisionAt});
            }else if(!old.deleted&&(old.text!==d.text||old.title!==d.title)){
              /* Keep the incoming version if another window saved a newer one. */
              archive(vs,d,'conflict');conflicts++;
            }
          };
        }
        tx.objectStore('meta').put({key:'current',value:current||null});
        tx.oncomplete=()=>resolve({available:true,conflicts});
        tx.onerror=()=>reject(tx.error||new Error('Storage transaction failed'));
        tx.onabort=()=>reject(tx.error||new Error('Storage transaction aborted'));
      }catch(e){if(tx){try{tx.abort()}catch(_){} }reject(e)}
    });
  });
}
function versions(id){
  return connect().then(db=>{
    if(!db)return[];
    return new Promise((resolve,reject)=>{
      try{
        const tx=db.transaction('versions','readonly');
        const req=tx.objectStore('versions').index('docId').getAll(IDBKeyRange.only(id));
        req.onsuccess=()=>resolve((req.result||[]).slice(-MAX_VERSIONS).reverse());
        req.onerror=()=>reject(req.error);
      }catch(e){reject(e)}
    });
  });
}
function pin(doc){
  return connect().then(db=>{
    if(!db)return false;
    return new Promise((resolve,reject)=>{
      try{
        const tx=db.transaction('versions','readwrite');
        archive(tx.objectStore('versions'),normalize(doc),'manual');
        tx.oncomplete=()=>resolve(true);
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error);
      }catch(e){reject(e)}
    });
  });
}
window.WrityStore=Object.freeze({load,write,versions,pin});
})();