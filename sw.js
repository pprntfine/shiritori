/* 雑学王 サービスワーカー（v124）
   - アプリが 裏・画面オフ でも、とどいた メッセージ（あんごう文のまま）を スマホの 中に しまう
     → アプリを ひらいた 瞬間に 表示される（2人の 鍵で しか 読めない）
   - 通知は 音なし。Android は アイコンに バッジ（件数）
   ここでは 中身を 読みません（鍵は ここに ありません） */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

var unread = 0;

function idbOpen(){
  return new Promise(function(res, rej){
    var r = indexedDB.open('zg-inbox', 1);
    r.onupgradeneeded = function(){ r.result.createObjectStore('m', {autoIncrement:true}); };
    r.onsuccess = function(){ res(r.result); };
    r.onerror = function(){ rej(r.error); };
  });
}
async function stash(body){
  try {
    var db = await idbOpen();
    await new Promise(function(res){
      var tx = db.transaction('m', 'readwrite');
      tx.objectStore('m').add(body);
      tx.oncomplete = res; tx.onerror = res;
    });
    db.close();
  } catch (err) {}
}

/* ntfy の Web Push は {event, message:{message:"本文"}} の 形で とどく */
function pickText(raw){
  try { var j = JSON.parse(raw); if (j && j.message && typeof j.message.message === 'string') return j.message.message; } catch (err) {}
  return raw || '';
}

self.addEventListener('push', function(e){
  var raw = '';
  try { raw = e.data ? e.data.text() : ''; } catch (err) {}
  var txt = pickText(raw);
  var isTest = txt.indexOf('zg-test') >= 0;
  e.waitUntil((async function(){
    /* 本文つき: 'zgm:件数:あんごう文' → スマホの 中に しまう */
    var mm = /^zgm:(\d+):([\s\S]+)$/.exec(txt);
    var cnt = 0;
    if (mm) { cnt = parseInt(mm[1], 10) || 1; await stash(mm[2]); }
    else { var nn = /zgn:(\d+)/.exec(txt); if (nn) cnt = parseInt(nn[1], 10) || 1; }

    var list = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    var visible = false;
    for (var i = 0; i < list.length; i++) {
      try { list[i].postMessage('zg-new'); } catch (err) {}
      if (list[i].visibilityState === 'visible' && list[i].focused !== false) visible = true;
    }
    if (visible && !isTest) return;
    if (cnt) unread = Math.max(unread + (mm ? 1 : 0), cnt); else unread++;
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(unread); } catch (err) {}
    await self.registration.showNotification('雑学王', {
      body: isTest ? 'テスト通知です。とどいています！' : (unread > 1 ? ('メッセージが ' + unread + '件 とどいています') : 'メッセージが とどきました'),
      tag: isTest ? 'mtp-test' : 'mtp-chat',
      renotify: true,
      silent: true,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { n: unread }
    });
  })());
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
    e.waitUntil(self.registration.getNotifications({tag:'mtp-chat'}).then(function(a){ a.forEach(function(n){ n.close(); }); }));
  }
});
