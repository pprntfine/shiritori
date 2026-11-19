'use strict';
/* とー君ニュース（旧 雑学王）v460。本文は復号しない。鍵は受け取らず、暗号文だけを耐久保存する。
   zg-sw-inbox/pin {b:暗号文,t:時刻} は本体との互換契約。本文に時限削除を行わない。 */
const SW_VERSION='v513';
const SHELL_CACHE='zg-v513-shell';
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
  let tag='mtp-chat',text='新しいニュースが更新されました',data={},saved=false,badge='./badge-news.png',stamp=0;
  if(body){
    data.zgm=body;
    try{await swInboxSave(body);saved=true;}catch(e){data.saveFailed=true;}
    // 保存できない場合も通知のdataに暗号文を残す。成功と偽らず再取込対象とする。
    if(!saved)text='新しいニュースがあります。アプリを開いてください';
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
    tag='mtp-peer';text='相手がアプリを開きました';badge='./badge-open.png';stamp=+msg.slice(4)||0;
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
  const opt={body:text,tag,renotify:true,data,silent:false,vibrate:data.call?[600,250,600,250,600]:[110,70,110]};
  if(badge)opt.badge=badge;
  if(stamp&&stamp<=Date.now()+120000&&Date.now()-stamp<12*3600*1000)opt.timestamp=stamp;
  await self.registration.showNotification('とー君ニュース',opt);
  if(body)await broadcast({zgm:body,saved,swver:SW_VERSION});
  await broadcast(data.call?'zg-call':'zg-new');
}
self.addEventListener('push',event=>{
  let raw='';try{raw=event.data?event.data.text():'';}catch(e){}
  event.waitUntil(handlePush(raw));
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
