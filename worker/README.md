# じぶん専用サーバー（通知 ＋ 中継所）の つくりかた

いまの しくみは、みんなで つかう 無料の 中継（ntfy.sh）を とおって います。
そのため **1日250通** まで しか おくれず、こえると とどかなく なります。

じぶん専用の サーバーを 1つ つくると、

- **中継所**：メッセージ・写真を この サーバーに あずけます。**1日250通の せいげんが なくなります**
  （Cloudflare の 無料の わくは 1日10万回。ふつうの つかいかたでは つかいきれません）
- **通知**：アプリを とじて いても、通知が こちらから とどきます

- お金: かかりません（Cloudflare の 無料プラン）
- 中身: 今までどおり **2人の 鍵で 暗号化した もの だけ** を あずかります。サーバーは 読めません。12時間で 消えます。
- つくるのは **1人だけ** で OK（アドレスは あいてにも じどうで つたわります）
- **2人とも アプリを v451 以上に** して ください（あいてが 古い ときは 今までどおり ntfy.sh を つかいます）

## 1. サーバーを つくる（ボタン 1つ）
1. Cloudflare の アカウントを つくる（https://dash.cloudflare.com ）。
   **つよい パスワードと 2段階認証** を かならず つけて ください。
2. つぎの ボタンの アドレスを ひらく：

   https://deploy.workers.cloudflare.com/?url=https://github.com/pprntfine/shiritori/tree/main/worker

3. GitHub と Cloudflare に ログインして、そのまま「Deploy（デプロイ）」を おす。
   名前は `zatsugaku-push` の まま で よい。
4. おわると `https://zatsugaku-push.〇〇.workers.dev` の ような アドレスが でる。これを メモ。

※ ボタンが つかえない ときは、Claude に「Cloudflare に デプロイして」と たのんで ください
（Cloudflare の「APIトークン」を あんぜんな 入力らんに いれて もらい、Claude が かわりに つくります）。

## 2. うごいて いるか たしかめる
ブラウザで つぎを ひらく：

    https://zatsugaku-push.〇〇.workers.dev/key

`{"key":"B…","relay":1}` と でれば せいこう です。

## 3. アプリに いれる
1. 雑学王 の 裏メニュー → 設定 →「つうちサーバー」に
   `https://zatsugaku-push.〇〇.workers.dev` を いれて「ほぞん」
2. 「つうちサーバー：せってい ずみ ✓」と でれば OK
3. **2人とも** 「通知:オン」を おして おく
4. 設定の「とどけ てんけん」を おして、
   - ⑦ が「おくれた（1台）」
   - ⑮ が「うけとり つながって いる／おくりも 中継所（せいげん なし）」
   に なれば かんせい です。
   ⑮ が「あいてが まだ 対応して いません」の ときは、あいての アプリを ひらいて もらうと かわります。

## うまく いかない とき
- アプリの 欄を **空に して ほぞん** すれば、もとの しくみ（ntfy.sh）に もどります。
- 中継所が こたえない ときは、アプリが じどうで ntfy.sh に まわします（そのあいだは 250通の せいげんが あります）。

## しくみ（くわしい 人むけ）
- Cloudflare Workers ＋ Durable Objects（SQLite）。設定は `wrangler.toml`（`npx wrangler deploy` でも デプロイ できる）。
- 通知：`GET /key`（VAPID公開鍵・`relay:1`）、`POST /sub`、`POST /push`。RFC8291（aes128gcm）＋ RFC8292（VAPID/ES256）。外部ライブラリなし。
- 中継所：ntfy.sh と 同じ 受け答え。`POST /r/{topic}`、`PUT /r/{topic}?filename=&message=`、
  `GET /r/{topic}/json?poll=1&since=`、`GET /r/{topic}/ws?since=`、`GET /r/{topic}/file/{id}`。
  とおりみち（topic）ごとに 1つの Durable Object。12時間で 消去。本文 64KB・ファイル 2MB・1日2万通・同時ファイル300こ まで（いたずら よけ）。
- アプリ側（v451〜）：うけとりは ntfy.sh と 中継所の 両方。おくりは「あいても 中継所を 見て いる」（prof の `rl:1`）ときだけ 中継所。
  中継所が だめな ときは 60秒 ntfy.sh に もどす。
