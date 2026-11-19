// v512: 通知の小さいアイコン（badge）が種類で分かれるか。sw.js を node の vm で動かす（偽の caches・通知）。
// メッセージ＝新聞 badge-news.png、相手が開いた＝目 badge-open.png（時刻は相手が開いた時刻）、電話・入室は従来どおり。
// 閉じている間の「開いた」は全部残る（po にカンマ区切り）。使い方: node tools/sw_badge_test.mjs
import fs from 'fs'; import vm from 'vm';
const src=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const store=new Map(); const shown=[]; const listeners={};
const cache={ async match(k){ return store.has(k)?{text:async()=>store.get(k)}:undefined; }, async put(k,r){ store.set(k,await r.text()); }, async delete(k){ store.delete(k); } };
class Resp{ constructor(t){ this.t=String(t); } async text(){ return this.t; } }
const self={ addEventListener:(n,f)=>{ listeners[n]=f; }, registration:{ showNotification:async(t,o)=>{ shown.push(o); }, scope:'https://zg.test/' }, clients:{ matchAll:async()=>[] }, skipWaiting(){} };
const ctx={ self, caches:{ open:async()=>cache, keys:async()=>[] }, Response:Resp, indexedDB:undefined, URL, console, Date };
vm.createContext(ctx); vm.runInContext(src,ctx);
async function push(text){ let p; listeners.push({data:{text:()=>text}, waitUntil:(x)=>{ p=x; }}); await p; return shown[shown.length-1]; }
let ok=true; const chk=(n,c,x)=>{ console.log(n,JSON.stringify(x),c?'OK':'NG'); if(!c) ok=false; };
store.set('role','h');
const now=Date.now(), t1=now-40*60000, t2=now-5*60000;
let n=await push('zgn:1'); chk('メッセージ（ニュース風）は新聞',n.badge==='./badge-news.png'&&n.body==='新しいニュースが更新されました',n);
n=await push('zgo:'+t1); chk('相手が開いた は目・時刻は開いた時刻',n.badge==='./badge-open.png'&&n.timestamp===t1&&n.body==='相手がアプリを開きました',n);
n=await push('zgo:'+t2); chk('閉じている間の2回とも残る',store.get('po')===t1+','+t2,store.get('po'));
n=await push('zgcall:x'); chk('電話は従来どおり（badge なし）',!n.badge&&n.body==='電話がきています',n);
store.set('role','g'); const before=shown.length; await push('zgo:'+now); chk('ホスト以外は「開いた」を出さない',shown.length===before,{});
for(const f of ['badge-news.png','badge-open.png']){ const b=fs.readFileSync(new URL('../'+f,import.meta.url)); chk(f+' は96×96のPNG',b.readUInt32BE(16)===96&&b.readUInt32BE(20)===96,{bytes:b.length}); }
console.log(ok?'OK: 通知のアイコンは2種類':'NG'); process.exit(ok?0:1);
