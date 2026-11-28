'use strict';
/* とー君ニュース（旧 雑学王）v460。本文は復号しない。鍵は受け取らず、暗号文だけを耐久保存する。
   zg-sw-inbox/pin {b:暗号文,t:時刻} は本体との互換契約。本文に時限削除を行わない。 */
const SW_VERSION='v561';
// v518: 通知の小さいアイコン（Android のステータスバー）は sw.js に埋め込む。別ファイル（badge-*.png）が公開先に無い・読めないと、いつものアイコンに戻ってしまうため
const BADGE_NEWS='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAEe0lEQVR42u2dvYtcVRjGf++9k038ICGKSTQEGyWmsdMiXSIiFoKthY2VCBaKKBbCWlqICaQSSRNtEvIHRBttFgWLgAYVPwqLEBSj+EHQnbmPxZ6Lx2UmmTt7ztyZOe8PlmFnh5lz3ue873mfO5ez4DiO4ziO4ziO4ziO4ziO4zjZsZRvJsmKCZyZFmIgkkzSoKTgh3nXkqpeM0BSbWaj6Pf9gFJn1iLFPTz+0c57ewzmJoCkyswaSQeAF4AngQdWOPixCNeADeC0mX0pyWYtSbbD4D8BnAXuK3QP3QReBU4D1SyZYLOWHUmPAx+Gp4dAVcDqj7OgCXOugDfNbH2WcmQdg9++/i7gCnAgDKQuNAMUFt8AOGFmn3QVoesuXoVa9yJwEBgVHPx2AbeZvx66IuXOgBr4HHh4itWvjBNftM7ob+Comf3Y7pFJMyDa6fcC90fqTxpU247m+GkWLAsE7AEe7LpABjMqrlv8vR3Ar9EAU010XxB+kt8YZgp0PUVgOy+MQYZ0NOAX4Fng08QCABwG3gMejTqRnHPKSg4BRsAzZvZRpjFfl/QUcBk4tE1cA84BPyQUnpB1z4Xym9TpDxIHvwJ+AzYk1VOUq5lKgZn9JOkKcG8QvN3PXjazdzJd+7kQfM9tKRuBHOlqwG4z+2snFv0mgWhCNzaIhB+E/eaMpN2JV3/bfm9I+gw4mbL9zlUvs16qNTNJUiR4A9wJnDSzS5ky4CBwLMp0FlmAPlrBXcAHkl4Hvk/UrrZt717gjVDyGhdgcod0N/BuZtNVpXzDVREgDlCTwSnrFsbTBdhm1nLsQVWOAa+aAMUbsT5LT/FGrE8aN2L9rn43Yj1vvG7E3Ii5AG7ExgSETOXAJnyGG7Ew2GHGWxUt3JO06UZs/ORvBw6Z2e+SdkkaJQ7+KIh7ZEK2Ff+N2B7gfUlPm9nVDOVnDTgDPBRtiG7EojQV8AhwWdIXCQfbdjWHgaPbNkQ3YmMCdU8wLTmdb5t1tRux8ZnQZBK4ciM2XaDmdduiGzE3YmUL4EZsDMOehSjOiK16di2NEctpiPoimxHr0oZZeNwv6bq2aPR/huG5l1ZtpUo6LulPSaMx8x6FxxPhtXUfGTAPQ9QXS2HE5mKIesyApTBiuQxRn/5iqYzYvAxRn+3tUhixXIaoz8AvlRHL+c1UbxuxGzE3Ym7E3Ii5EXMj5kbMjZgbMTdibsTciPUpgKbIhBLPEerccMyiaKnBzbKgOwkQvMAN4OcVvNSw071vE7jaNROmFiCc+VCZ2Q3g4yXvblLSxuA74NtwPkaTJQMiZd/mv1NKSs+CYViMb5nZZteYdnpxuC+/NrOvgVdCzWuCGCUJ0XZ5/wBrwEXg3CzHVnbeNML9+ZWZnZK0D1gfk46rTntS4hpwHnh+1j1xJ0cXWzg25jHgNeA4cEdBZecr4JSZnY3jMTcBwofW0SHWR9g6O7oErgHfhJJsUZPSQzHcOsa9qKPr47mn6F9TDaa0s6O1MP/EwXEcx3Ecx3Ecx3Ecx3Ecx3Fuzr+U47aohfYQxAAAAABJRU5ErkJggg==';
const BADGE_OPEN='data:image/png;base64,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';
const SHELL_CACHE='zg-v561-shell';
function unwrapPush(value){
  for(let i=0;i<8;i++){
    if(value&&typeof value==='object'){
      if(typeof value.message==='string'){value=value.message;continue;}
      if(typeof value.msg==='string'){value=value.msg;continue;}
      if(typeof value.zgm==='string'){value=value.zgm;continue;}
      if(typeof value.b==='string'){value=value.b;continue;}
      return '';
    }
    if(typeof value!=='string')return '';
    value=value.trim();
    if(value[0]==='{'||value[0]==='"'){try{value=JSON.parse(value);continue;}catch(e){return '';}}
    return value;
  }
  return '';
}
function sealedBody(value){
  let body=unwrapPush(value).replace(/^zgm:\d+:/,'');
  return /^[A-Za-z0-9_-]{40,}$/.test(body)?body:'';
}
function swInboxOpen(){return new Promise((resolve,reject)=>{
  const r=indexedDB.open('zg-sw-inbox',1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('pin'))r.result.createObjectStore('pin');};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});}
async function swInboxSave(body){
  const db=await swInboxOpen();
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction('pin','readwrite');
    // 同じ暗号文の再通知は同じ行。IDB完了前に通知成功としない。
    tx.objectStore('pin').put({b:body,t:Date.now()},body);
    tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('通知本文の保存失敗'));
  });}finally{db.close();}
}
async function broadcast(value){
  const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  list.forEach(c=>c.postMessage(value));return list;
}
async function getRole(){
  try{const c=await caches.open('zg-count'),r=await c.match('role');return r?await r.text():'';}catch(e){return '';}
}
async function handlePush(raw){
  const msg=unwrapPush(raw),body=sealedBody(msg);
  let tag='mtp-chat',text='新しい記事があります',data={},saved=false,badge=BADGE_NEWS,stamp=0,saveP=null;
  if(body){
    data.zgm=body;
    // v549: 保存（IndexedDB）が止まったままだと通知も出ない（iPhone で「開いたら通知が出た」）。最大2秒だけ待って通知を出し、保存は後ろで続ける
    saveP=swInboxSave(body).then(()=>{saved=true;},()=>{data.saveFailed=true;});
    await Promise.race([saveP,new Promise(r=>setTimeout(r,2000))]);
    // 保存できない場合も通知のdataに暗号文を残す。成功と偽らず再取込対象とする。
    if(data.saveFailed)text='新しいニュースがあります。アプリを開いてください';
    tag='zgs-'+body.slice(-32);
  }else if(/^zgcall:/.test(msg)){
    tag='mtp-call';text='電話がきています';data.call=true;badge='';
  }else if(/^zgo:\d+$/.test(msg)){
    // 相手の開封通知だけはホスト限定。役割不明も表示しない。
    if(await getRole()!=='h')return;
    // v512: 閉じている間の「開いた」を全部残す（以前は最後の1回だけ）。時刻は相手が開いた時刻。
    const c=await caches.open('zg-count');let prev='';try{const o=await c.match('po');prev=o?await o.text():'';}catch(e){}
    const list=(prev?prev.split(','):[]).filter(x=>/^\d+$/.test(x));list.push(msg.slice(4));
    await c.put('po',new Response(list.slice(-20).join(',')));
    tag='mtp-peer';text='相手がアプリを開きました';badge=BADGE_OPEN;stamp=+msg.slice(4)||0;
  }else if(msg==='zg-test'){
    tag='mtp-test';text='テスト通知です';
  }else if(/^zgm:\d+:!/.test(msg)){
    data.stub=true;
  }else if(msg==='💬'||/^zgn:/.test(msg)){
    data.stub=true;
  }else if(msg.startsWith('⚠')){
    if(await getRole()!=='h')return;
    tag='mtp-alert';text='入室のお知らせがあります';badge='';
  }else{return;}
  // v512: ステータスバーの小さいアイコンを種類で分ける（Android）。ニュース＝新聞、相手が開いた＝目
  const opt={body:text,tag,renotify:true,data,silent:false,vibrate:data.call?[600,250,600,250,600]:(tag==='mtp-peer'?[350]:[160,100,160])};   // v519: 震え方で見分ける（相手が開いた＝長く1回、メッセージ＝短く2回）
  if(badge)opt.badge=badge;
  if(stamp&&stamp<=Date.now()+120000&&Date.now()-stamp<12*3600*1000)opt.timestamp=stamp;
  // v537: 同じメッセージの通知が2つの道（自分の通知サーバーと予備の ntfy）や送り直しで2回届いた時は、音もバイブも鳴らさず同じ通知を置き換えるだけ（持ち主: 1通に通知が2回）
  let dup=false;
  if(/^zgs-/.test(tag)){try{const c=await caches.open('zg-count'),o=await c.match('tg');const now=Date.now();const l=((o?await o.text():'').split(',').filter(x=>/^[^|]+\|\d+$/.test(x)).filter(x=>now-(+x.split('|')[1])<30*60*1000));dup=l.some(x=>x.split('|')[0]===tag);if(!dup){l.push(tag+'|'+now);await c.put('tg',new Response(l.slice(-30).join(',')));}}catch(e){}}
  if(dup){opt.renotify=false;opt.silent=true;delete opt.vibrate;}
  // v555: 同じメッセージの2回目（あなたのスマホからと中継所からの2つの道で、ほぼ同時に届く）は、同じ通知がまだ出ていれば何もしない。
  // 置き換えると Android では上に出た通知（ポップアップ）がすぐ引っ込み「一瞬点いて消える」ように見えた（持ち主）。
  // 通知が出ている間は Chrome も既定の通知を出さない。消されていた時だけ、静かに出し直す
  let skip=false;
  if(dup){try{const ex=await self.registration.getNotifications({tag});skip=!!(ex&&ex.length);}catch(e){}}
  if(!skip)await self.registration.showNotification('とー君ニュース',opt);
  // v524: メッセージの通知を出した時刻を残す（画面の方は、これを見て同じ通知を重ねて出さない）
  // v553: メッセージの通知が鳴った時刻を、暗号文の末尾32文字と一緒に残す（画面がどのメッセージか合わせて、ホストに「鳴った時刻」を知らせる）
  if(body&&!dup){try{const c=await caches.open('zg-count'),o=await c.match('rg');const l=((o?await o.text():'').split(',').filter(x=>/^[A-Za-z0-9_-]{32}\|\d+$/.test(x)));l.push(body.slice(-32)+'|'+Date.now());await c.put('rg',new Response(l.slice(-60).join(',')));}catch(e){}}
  if((body||data.stub)&&!dup){try{const c=await caches.open('zg-count'),o=await c.match('pt');const l=((o?await o.text():'').split(',').filter(x=>/^\d+$/.test(x)));l.push(String(Date.now()));await c.put('pt',new Response(l.slice(-20).join(',')));}catch(e){}}
  if(saveP)await saveP;
  if(body)await broadcast({zgm:body,saved,swver:SW_VERSION});
  await broadcast(data.call?'zg-call':'zg-new');
}
// v556: 通知は1つずつ順番に処理する。同じメッセージが2つの道でほぼ同時に届くと、2つの処理が重なって
// 「まだ出ていない」と見たり、同じ通知を2回出し直したりして、1回目のバイブ・ポップアップが消えていた（持ち主: バイブが鳴らない時がある）
let pushChain=Promise.resolve();
self.addEventListener('push',event=>{
  let raw='';try{raw=event.data?event.data.text():'';}catch(e){}
  const p=pushChain.then(()=>handlePush(raw)).catch(()=>{});
  pushChain=p;
  event.waitUntil(p);
});
self.addEventListener('notificationclick',event=>{
  event.waitUntil((async()=>{
    const n=event.notification,body=n&&n.data&&n.data.zgm;
    if(body){try{await swInboxSave(body);}catch(e){
      // 唯一の暗号文を閉じる前に再保存。失敗時は新しい通知へ引き継ぐ。
      await self.registration.showNotification('とー君ニュース',{body:'新しいニュースがあります。アプリを開いてください',tag:n.tag,data:{zgm:body,saveFailed:true}});
    }}
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    let client=windows.find(c=>c.url.startsWith(self.registration.scope));
    if(client){await client.focus();}else{client=await self.clients.openWindow(new URL('./index.html',self.registration.scope).href);}
    if(client){if(body)client.postMessage({zgm:body,swver:SW_VERSION});client.postMessage(n.data&&n.data.call?'zg-call':'zg-new');}
    // 本文つき通知は本体が保存完了後に閉じる。OSが閉じてもIDBから回収する。
    if(!body)n.close();
  })());
});
self.addEventListener('message',event=>{
  const d=event.data;
  if(d&&d.get==='ver'){if(event.source)event.source.postMessage({swver:SW_VERSION});return;}
  if(d==='skipWaiting'){self.skipWaiting();return;}
  if(d==='clear')event.waitUntil((async()=>{
    const ns=await self.registration.getNotifications();
    ns.forEach(n=>{if(!(n.data&&n.data.zgm))n.close();});
    if(self.registration.clearAppBadge)await self.registration.clearAppBadge();
  })());
});
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>/^zg-v\d+-shell$/.test(n)&&n!==SHELL_CACHE).map(n=>caches.delete(n)));
  await self.clients.claim();await broadcast({swver:SW_VERSION});await broadcast('zg-new');
})());});
// HTMLを旧キャッシュから返さない。通信・画像・通話要求のfetchには介入しない。
