/* 雑学王 サービスワーカー（v128）
   - アプリが 裏・画面オフ・まるごと とじて いても、通知と おなじ 通り道で メッセージ（あんごう文のまま）を 受けとる
   - v128: バッジは ある/なし の み（「1」づけ）。新しい ワーカーが きどうした ときも バッジを けす
   - v127: 通知アイコンは ファイルの ままで（画像の直もじれつは iPhoneで だめな ことが わかった）。通知は さいしょに だす！（しまう 仕事で つかれて 通知が でない ことが ないように）
     あんごう文は 通知の おくにも いれて おくので、しまい場所が だめでも アプリを ひらけば わかる
   - 通知は 音なし。バッジは 数字なし（iPhoneの 決まりで 画像は だせない）
   ここでは 中身を 読めません（鍵は ここに ありません） */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil((async function(){ await self.clients.claim(); try { if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch (err) {} })()); });

var unread = 0;
var PAW = 'data:image/png;base64,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';

function idbOpen(){
  return new Promise(function(res, rej){
    var r = indexedDB.open('zg-inbox', 1);
    r.onupgradeneeded = function(){ r.result.createObjectStore('m', {autoIncrement:true}); };
    r.onsuccess = function(){ res(r.result); };
    r.onerror = function(){ rej(r.error); };
  });
}
function stash(body){
  return new Promise(function(res){ setTimeout(res, 2500); idbOpen().then(function(db){
    var tx = db.transaction('m', 'readwrite');
    tx.objectStore('m').add(body);
    tx.oncomplete = function(){ clearTimeout(k); db.close(); res(); }; tx.onerror = function(){ db.close(); res(); };
    var k=setTimeout(function(){ try{ db.close(); }catch(e){} res(); }, 2400);
  }).catch(function(){ res(); }); });
}

/* ntfy の Web Push は {event, message:{message:"本文"}} の 形で とどく */
function pickText(raw){
  try { var j = JSON.parse(raw); if (j && j.message && typeof j.message.message === 'string') return j.message.message; } catch (err) {}
  return raw || '';
}
function sx(p, ms){ return Promise.race([Promise.resolve(p), new Promise(function(r){ setTimeout(r, ms); })]); }

async function handlePush(raw){
  var txt = pickText(raw);
  var isTest = txt.indexOf('zg-test') >= 0;
  /* 本文つき: 'zgm:件数:あんごう文' / 数字だけの 合図 'zgn:件数' は v126 では つかわない（通知も ださない） */
  var mm = /^zgm:(\d+):([\s\S]+)$/.exec(txt);
  if (/^zgn:\d+$/.test(txt)) {
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(1); } catch (err) {}
    return;
  }
  /* ページが 画面に でている か（でていなければ かならず 通知。判断に まよったら 通知する） */
  var viewed = false;
  try {
    var list0 = await sx(self.clients.matchAll({type:'window', includeUncontrolled:true}), 1200);
    for (var i=0; i<list0.length; i++) { if (list0[i].visibilityState === 'visible') viewed = true; }
  } catch (err) {}
  var cnt = mm ? (parseInt(mm[1],10) || 1) : 1;
  unread = Math.max(unread + (mm?1:0), cnt) || 1;
  /* v126: 通知を さいしょに だす。あんごう文は data の おくにも のせて おく */
  if (!viewed) {
    try {
      await self.registration.showNotification('雑学王', {
        body: isTest ? '🐾 テスト通知です。とどいています！' : (cnt > 1 ? ('🐾 メッセージが ' + cnt + '件 とどいたよ！') : '🐾 メッセージが とどいたよ！'),
        tag: isTest ? 'mtp-test' : ('mtp-' + Date.now() + '-' + Math.floor(Math.random()*1000000)),
        renotify: true, silent: true, icon: './icon-192.png', badge: './icon-192.png',
        data: { app:'zg', zgm: mm ? mm[2] : null, n: unread }
      });
    } catch (err) {}
  }
  /* つぎに スマホの 中に しまう（ここが うまく いかなくても 通知は でている） */
  if (mm) { try { await stash(mm[2]); } catch (err) {} }
  try {
    var list = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (var j=0; j<list.length; j++) { try { list[j].postMessage('zg-new'); } catch (err) {} }
  } catch (err) {}
  try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(1); } catch (err) {}
}

self.addEventListener('push', function(e){
  var raw = '';
  try { raw = e.data ? e.data.text() : ''; } catch (err) {}
  e.waitUntil(handlePush(raw));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  unread = 0;
  e.waitUntil((async function(){
    try { if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch (err) {}
    var list = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});

self.addEventListener('message', function(e){
  if (e.data === 'clear') {
    unread = 0;
    try { if (self.navigator && self.navigator.clearAppBadge) self.navigator.clearAppBadge(); } catch (err) {}
    e.waitUntil(self.registration.getNotifications().then(function(a){ a.forEach(function(n){ if (n.data && n.data.app === 'zg') n.close(); }); }));
  }
});
