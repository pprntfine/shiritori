/* 雑学王 サービスワーカー（v117）
   - アプリを とじていても「メッセージが とどきました」の 通知を だす
   - ホーム画面アイコンに 未読バッジを つける（対応端末のみ）
   メッセージの 中身は ここには とどきません（通知の 合図だけ） */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

var unread = 0;

self.addEventListener('push', function(e){
  e.waitUntil((async function(){
    var list = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    /* アプリが 画面に 出ている ときは アプリ側で 知らせるので 何もしない */
    for (var i = 0; i < list.length; i++) {
      if (list[i].visibilityState === 'visible') return;
    }
    unread++;
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(unread); } catch (err) {}
    await self.registration.showNotification('雑学王', {
      body: 'メッセージが とどきました',
      tag: 'mtp-chat',
      renotify: true,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [120, 60, 120]
    });
  })());
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  unread = 0;
  e.waitUntil((async function(){
    try { if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch (err) {}
    var list = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) return list[i].focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});

self.addEventListener('message', function(e){
  if (e.data === 'clear') {
    unread = 0;
    try { if (self.navigator && self.navigator.clearAppBadge) self.navigator.clearAppBadge(); } catch (err) {}
  }
});
