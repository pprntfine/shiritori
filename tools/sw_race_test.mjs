// v556: 同じメッセージの通知が2つの道（あなたのスマホから・中継所から）で「同時に」届いた時。
//  1回目の通知を出し終わる前に2回目が来ると、2回目は「まだ出ていない」と見て静かな通知で置き換え、1回目のバイブ・ポップアップを消していた（持ち主: バイブが鳴らない時がある）。
//  期待: バイブ付きの通知が1回だけ出て、その後に静かな置き換えが来ない。使い方: node tools/sw_race_test.mjs [sw.js の場所]
import fs from 'fs'; import vm from 'vm';
const file=process.argv[2]||new URL('../sw.js',import.meta.url);
const src=fs.readFileSync(file,'utf8');
const store=new Map(); const calls=[]; const live=new Map(); const listeners={};
const cache={ async match(k){ return store.has(k)?{text:async()=>store.get(k)}:undefined; }, async put(k,r){ await new Promise(z=>setTimeout(z,3)); store.set(k,await r.text()); } };
class Resp{ constructor(t){ this.t=String(t); } async text(){ return this.t; } }
// 本物の Android に近く: 通知を出し終わるまで 40ms かかる
const self={ addEventListener:(n,f)=>{ listeners[n]=f; }, registration:{ showNotification:async(t,o)=>{ calls.push({tag:o.tag,silent:o.silent,vib:!!o.vibrate,at:Date.now()}); await new Promise(z=>setTimeout(z,40)); live.set(o.tag,o); }, getNotifications:async(f)=>[...live.values()].filter(o=>!f||!f.tag||o.tag===f.tag), scope:'https://zg.test/' }, clients:{ matchAll:async()=>[] }, skipWaiting(){} };
const idb={ open(){ const r={}; setTimeout(()=>{ r.result={ objectStoreNames:{contains:()=>true}, transaction(){ const tx={ objectStore(){ return { put(){ setTimeout(()=>tx.oncomplete&&tx.oncomplete(),15); } }; } }; return tx; }, close(){} }; r.onsuccess&&r.onsuccess(); },5); return r; } };
const ctx={ self, caches:{ open:async()=>cache, keys:async()=>[] }, Response:Resp, indexedDB:idb, URL, console, Date, setTimeout, clearTimeout };
vm.createContext(ctx); vm.runInContext(src,ctx);
store.set('role','h');
const body='Q'.repeat(80);
const ps=[];
const fire=(text)=>{ listeners.push({data:{text:()=>text}, waitUntil:(x)=>{ ps.push(x); }}); };
fire('zgm:3:'+body); fire('zgm:0:'+body);   // 同時に2つ
await Promise.all(ps);
const loud=calls.filter(c=>!c.silent), quietAfter=calls.filter((c,i)=>c.silent&&i>calls.findIndex(x=>!x.silent));
console.log(JSON.stringify(calls.map(c=>({silent:c.silent,vib:c.vib}))));
const ok=loud.length===1&&loud[0].vib&&quietAfter.length===0;
console.log(ok?'OK: 同時に2つ届いてもバイブ付きの通知が1回だけ（後から消されない）':'NG: 1回目の通知が静かな通知で置き換えられる（バイブ・ポップアップが消える）');
process.exit(ok?0:1);
