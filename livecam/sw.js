// ライブカメラ一覧の Service Worker（アプリとしてインストールできるようにするためだけ。保存はしない）
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(e){if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(function(){return new Response('<meta charset=utf-8><p style="font:16px sans-serif;padding:24px">電波がつながっていません。つながってから開き直してください。</p>',{headers:{'content-type':'text/html; charset=utf-8'}})}))}});
