// v537: 同じメッセージの通知が2回届いた時（自分の通知サーバーと予備の ntfy の両方、送り直し）、2回目は音・バイブなしで同じ通知を置き換えるだけ。
// 別のメッセージは今までどおり鳴る。使い方: node tools/sw_dup_test.mjs
import fs from 'fs'; import vm from 'vm';
const src=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const store=new Map(); const shown=[]; const listeners={};
const cache={ async match(k){ return store.has(k)?{text:async()=>store.get(k)}:undefined; }, async put(k,r){ store.set(k,await r.text()); }, async delete(k){ store.delete(k); } };
class Resp{ constructor(t){ this.t=String(t); } async text(){ return this.t; } }
const self={ addEventListener:(n,f)=>{ listeners[n]=f; }, registration:{ showNotification:async(t,o)=>{ shown.push(o); }, scope:'https://zg.test/' }, clients:{ matchAll:async()=>[] }, skipWaiting(){} };
const ctx={ self, caches:{ open:async()=>cache, keys:async()=>[] }, Response:Resp, indexedDB:undefined, URL, console, Date, setTimeout, clearTimeout };
vm.createContext(ctx); vm.runInContext(src,ctx);
async function push(text){ let p; listeners.push({data:{text:()=>text}, waitUntil:(x)=>{ p=x; }}); await p; return shown[shown.length-1]; }
let ok=true; const chk=(n,c,x)=>{ console.log(n,JSON.stringify(x),c?'OK':'NG'); if(!c) ok=false; };
store.set('role','h');
const A='zgm:1:'+'A'.repeat(60), B2='zgm:2:'+'B'.repeat(60);
let n1=await push(A); chk('1回目は鳴る',n1.silent===false&&n1.renotify===true&&!!n1.vibrate,{silent:n1.silent,renotify:n1.renotify});
let n2=await push(A); chk('同じメッセージの2回目は鳴らさない（同じ通知を置き換える）',n2.silent===true&&n2.renotify===false&&!n2.vibrate&&n2.tag===n1.tag,{silent:n2.silent,renotify:n2.renotify,tag:n2.tag===n1.tag});
let n3=await push(B2); chk('別のメッセージは鳴る',n3.silent===false&&n3.renotify===true&&!!n3.vibrate,{silent:n3.silent});
chk('画面へ知らせる時刻（pt）は2通分だけ',String(store.get('pt')||'').split(',').length===2,store.get('pt'));
console.log(ok?'OK: 同じ通知は2回鳴らない':'NG'); process.exit(ok?0:1);
