// v549: sw.js の保存（IndexedDB）が止まったままでも、2秒ほどで通知が出る（iPhone で「アプリを開いたら通知が出た」の対策）。
// 使い方: node tools/sw_idb_hang_test.mjs
import fs from 'fs'; import vm from 'vm';
const src=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const shown=[]; const L={};
const self={ addEventListener:(t,f)=>{L[t]=f;}, registration:{ showNotification:async(t,o)=>{ shown.push({at:Date.now(),tag:o.tag,body:o.body}); } }, clients:{ matchAll:async()=>[] }, skipWaiting:()=>{} };
const store=new Map(); const cache={ match:async k=>store.has(k)?{text:async()=>store.get(k)}:undefined, put:async(k,r)=>{ store.set(k,await r.text()); } };
class Resp{ constructor(b){ this.b=String(b); } async text(){ return this.b; } }
const indexedDB={ open:()=>({}) };   // onsuccess も onerror も来ない＝止まったまま
const ctx={ self, caches:{ open:async()=>cache, keys:async()=>[] }, Response:Resp, indexedDB, URL, console, Date, setTimeout, clearTimeout };
vm.createContext(ctx); vm.runInContext(src,ctx);
const body='A'.repeat(60); const t0=Date.now(); let p=null;
L.push({ data:{ text:()=>'zgm:1:'+body }, waitUntil:(x)=>{ p=x; } });
await new Promise(r=>setTimeout(r,3000));
const ok=shown.length===1&&shown[0].at-t0<2600&&shown[0].body==='新しい記事があります';
console.log(JSON.stringify(shown.map(s=>({ms:s.at-t0,tag:s.tag,body:s.body}))));
console.log(ok?'OK: 保存が止まっても通知が出る':'NG: 通知が出ない'); process.exit(ok?0:1);
