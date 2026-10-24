/* 雑学王 サービスワーカー（v122）
   - アプリを とじていても「メッセージが とどきました」の 通知を だす
   - 通知が あると Android は アイコンに バッジ（点・数字）が つく
   メッセージの 中身は ここには とどきません（合図だけ） */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

var unread = 0;

self.addEventListener('push', function(e){
  var raw = '';
  try { raw = e.data ? e.data.text() : ''; } catch (err) {}
  var isTest = raw.indexOf('zg-test') >= 0;
  e.waitUntil((async function(){
    var list = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    var visible = false;
    for (var i = 0; i < list.length; i++) { if (list[i].visibilityState === 'visible' && list[i].focused !== false) visible = true; }
    /* アプリを 見ている ときは アプリ側で 知らせる（テストは つねに 出す） */
    if (visible && !isTest) return;
    /* 合図 'zgn:数' = 前回 読まれてから 送られた 通数（中身は ふくまない） */
    var m = /zgn:(\d+)/.exec(raw);
    if (m) unread = Math.max(unread, parseInt(m[1], 10) || 1); else unread++;
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(unread); } catch (err) {}
    await self.registration.showNotification('雑学王', {
      body: isTest ? 'テスト通知です。とどいています！' : (unread > 1 ? ('メッセージが ' + unread + '件 とどいています') : 'メッセージが とどきました'),
      tag: isTest ? 'mtp-test' : 'mtp-chat',
      renotify: true,
      icon: './icon-192.png',
      badge: './icon-192.png',
      silent: true,
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
