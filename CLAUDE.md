# 雑学王（zatsugakuou）引き継ぎメモ  ― 現在 v454

## これは何か
見た目は「雑学クイズ」アプリ。中身は **2人専用の暗号化チャット**（メッセージ・写真・ライブ映像・電話）。
トップを5回タップすると裏メニュー → 部屋づくり／トークに入る。**この隠し入口は絶対に壊さない。**
持ち主は日本語話者。画面の文言は、ひらがな多め・単語の間にスペース（例:「あいてを まっています」）の文体に合わせる。

## ファイル構成（すべて同じフォルダに置く／静的ホスティング）
- `index.html`  本体。1ファイル（約8.6MB）。大半は埋め込み画像(base64)。コードは約1.5MB・約1.3万行。
- `sw.js`  通知用 Service Worker。本文は復号しない（暗号文だけIndexedDB `zg-sw-inbox/pin` に保存）。互換契約なので形式を変えない。
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`  PWA用。
- `tools/` 確認用の道具（下記）。※このリポジトリにはまだ入っていない（持ち主の手元のみ）。
- `worker/` 自分専用サーバー（Cloudflare Worker＋Durable Objects）。通知(/key /sub /push)と中継所(/r/)。`zatsugaku-push.js`、`wrangler.toml`、持ち主向けの手順 `README.md`。

## 絶対のルール
1. **更新のたびに版番号を1つ上げる。** 場所は2つのファイルで計4か所:
   - `index.html`: `バージョン <b id="ver">vNNN</b>`（トップ画面）と、設定画面の `<b>vNNN</b>`（同じ数字に）
   - `sw.js`: `SW_VERSION='vNNN'` と `SHELL_CACHE='zg-vNNN-shell'`
   - 持ち主は画面の版番号で「更新できたか」を確認する。変えたら「index.html と sw.js の2つを上げてください」と伝える。
2. **クイズ（QBANK・qz*・sq*関数）は触らない。**（持ち主の指示）
3. 部屋は2人まで・ホスト承認必須・暗号化必須（`ROOM_POLICY`）。緩めない。
4. 端末の「あいず」（`S.sas`、再開後は「かぎの しるし」`S.keyMark`）の比較で相手を確かめる設計。表示を消さない（`sasLabel()`）。
5. 外部通信は中継サーバー（ntfy.sh、公開MQTT）経由の暗号文のみ。内容を平文で送らない。
6. 既存CSSは `!important` が何層にも重なっている。見た目の変更は末尾の `<style id="v447-polish">` に、強い詳細度で足す（古い規則を書き換えない）。

## 持ち主の希望で変えた点（履歴）
- v441 背景40枚・子犬スタンプ11枚を削除。「くらし」「動くハート」「きのこ」「全画面」スタンプを削除。
- v442 スタンプ選択欄の絵文字を、押さなくても動くように（`.sticker-choice` の動きの予算を外した）。
- v444/445 壊れたアニメWebP（とー君の🐶⑯大爆笑・⑬ふふふ笑い・㉙）を直した（壊れたコマは直前のコマで補う）。「とー君」を一番前のタブに。
- v446/447 チャット背景を夕焼けの1枚に固定（`BG_ONE`、白い膜10%、`background-position:center calc(100% + 14vh)`）。
- v447 見た目の仕上げ、「🔒 2人だけ」の帯（`#zg-room-strip`）、写真の自動再送を長く（約5分→約1時間）。
- v448 「前の部屋の鍵がないため…」のお知らせを出さないように（`resumeConnect` の sessionOnly 再開。安全面は変わらず、入室受付なし＝2人だけ）。
- v449 トークを見ている途中で記録が一瞬消える問題を修正。`sweepChat` が5秒ごとに `renderChat` で全部作り直していた（写真・スタンプが一瞬白くなる）。
  `chatSweepSigOf()` で画面に出る中身の要約を作り、変わったときだけ描き直す。
- v450 それでも自分のメッセージが約3秒ごとにちかっと消えた。受信確認待ちの送り直し(`flushOutbox`の完了)のたびに `renderChat(true)` で全部作り直し、
  `#chat-log .msg{animation:zg-pop}` が毎回やり直されていた。`renderChat` を入口にして、要約(`S._rcSig`)が同じなら作り直さない。本体は `renderChatFull`。
  ※ 画面に出る値を新しく増やしたら `chatSweepSigOf()` にも足すこと（足さないと表示が更新されない）。
- v451 1日250通(ntfy.sh無料の上限)をなくすため、自分専用の中継所に対応。`Relay`（WebSocketで /r/{topic}/ws を受信）と `Net.storeFetch`（送り先の切替）。
  受信は ntfy.sh と中継所の両方。送信は `relaySendBase()` が空でないときだけ中継所（自分が /key で relay:1 を確認 ＋ 相手が prof で rl:1 と同じ ps を送ってきた）。
  中継所が失敗したら60秒 ntfy.sh に戻す。中継所使用中は ntfy 用の節約（coolUntil/allow）を通さない。添付URLは `relayFileOk` で同じ origin の /r/ だけ許可。
  CSPに wss://*.workers.dev を追加。設定の「とどけ てんけん」に ⑮ を追加。
  試験: wrangler dev(https:443)＋chromium 2台（ntfy/MQTT遮断）で、メッセージ往復・閉じている間の受信・写真・相手が古い版のときntfyに戻る、を確認。
- v452 総点検（持ち主の依頼：暗号化と2人だけ）。結果と修正:
  - 確認OK: 本文は seal（AES-GCM・毎回乱数IV・長さを隠す詰め物）。写真/ファイルは putFile で AES-GCM＋SHA-256照合。ライブ(live-frame/audio/jpg)も Net 経由で封緘。
    電話・ライブ映像は WebRTC（DTLS-SRTP）、SDPは封緘して送る、STUNのみ（TURNなし）。受信 `process` は private 型を「ふたりの鍵・from=相手・to=自分・sec=289」だけ受理。
    入室は2人で満席（`replyFull`/`intruderAlert`）、承認は必ず手動。sessionOnly 再開中は入室受付そのものが無い。
  - 修正: `pushSelfAlert` が「3人目が…」の文を平文で ntfy に送っていた → 本文は「⚠」だけ、つうちサーバーがあればそちら優先。
  - 修正: Cloudflare 解析スクリプト5か所を削除（CSPで止まっていて動いてはいなかった）。
  - 追加: 再開後は `S.sas` が無いので「かぎの しるし」（`keyMarkFrom(sk)`、`S.keyMark`）を出す。表示は `sasLabel()` に統一。
  - 試験: 中継所に別の鍵で作った偽メッセージ・乱数を入れても捨てられることを確認。
- v453 「送信中のまま送れない」への対策。相手の対応(rl)が未確認だと ntfy.sh だけで送り、ntfy が上限(429)だと止まっていた。
  `Net.storeFetch` を作り直し: 相手確認済みなら中継所→ntfy、未確認なら ntfy→だめなら中継所（`relayAnyBase()`）。中継所の試行は `relayTry`（POST 4秒・PUT 30秒で打ち切り、
  失敗で60秒休む）。ntfy の節約ゲート(coolUntil/allow)は `relayAnyBase()` があれば通さない。`sweepChat` は描けたときだけ要約を覚える。
  試験: 相手未確認＋ntfy遮断でもメッセージ・写真・閉じている間の受信が中継所で届くことを確認。
- v454 ペアが消えた件（持ち主は「更新のせい？」）。v447→v453 の更新でペアが残り再開できることを、新形式(idb-v436)・旧形式(rk=sk)の両方で試験して確認（更新では消えない）。
  ペアが消えるのは unpairBoth / btn-wipe / 相手からの 'unpair' だけ。危なかったので:
  `#btn-wipe`（1回で消えていた）と `unpairBoth`（2回押しで消えていた）に確認ダイアログ(confirm)を追加。`#pf-unpair` を設定の下に離して「きけん」表示。
  再開で部屋の鍵がIDBに無いとき、黙って false にせず storageWarn を出す。

## 構造のメモ（行番号は目安。検索で探すこと）
- メインのスクリプトは `<script>(function(){'use strict'; …})();</script>` の1つの大きな閉じ込み。外から内部は見えない（テスト用に `tools/make_test.py` で `window.__t` を出す）。
- 通信: `var Net={…}`（ntfy: SSE/WS/ポーリング、429対応）、`var Fast`（公開MQTT）。暗号: ECDH→AES-GCM（`seal/unseal`, `pairSecret`）。
- 送信: `submitChat → queueChat → flushOutbox`。相手の受信確認(peerAck)が来るまで再送し続ける。表示文は `metaText`。
- 写真: `sendPhoto`, `photoQueueTick`, `photoStuckSweep`, `photoAutoRetry`。かけら(約1200字)に分けて送る。受信側は pid で重複を除く。
- 入室: `startAnnounce`(ゲスト) / `approveJoin`(ホスト)。3人目は `thirdPartyAlert`。
- スタンプ: `STICKER_CATEGORIES`（絵文字）＋ `DOG_STK`（とー君の画像WebP）。タブの動きは名前で割り当て。
- 背景: ファイル末尾の `<style id="bg40-css">` と `<script>`（`BG_ONE`）。

## 確認のしかた
```
python3 tools/make_test.py index.html test.html
node tools/shot_chat.js test.html shot 390 800     # 実画面に近い画像が出る（playwright必要）
node tools/check_syntax.js index.html              # 全scriptの構文チェック（scripts N errors 0 になること）
node --check sw.js
```
通信（実際の送受信・ライブ・電話）は、ここでは試せない。**2台のスマホで確認してもらう。**

## 未解決・次にやると良いこと
- 「メッセージ・写真が届かないことが多い」→ 原因は公開の無料中継（ntfy.sh）の回数制限が有力。
  根本対策は自分専用の通知サーバー(Cloudflare Workers)。アプリは設定画面の「つうちサーバー」(`zg_psrv`)に対応済み。
  → **Workerのコードを作成済み**（`worker/zatsugaku-push.js`、手順は `worker/README.md`）。v451で中継所も同じWorkerに入れた（KVは使わずDurable Objectのみ）。
    デプロイは Deploy ボタン（deploy.workers.cloudflare.com/?url=…/tree/main/worker）か、APIトークンで代わりに行う。VAPID鍵は初回 `/key` で自動生成しDOに保存。暗号(RFC8291)とVAPID署名は http_ece と node:crypto で検証済み。
    **デプロイ済み**: https://zatsugaku-push.pprnt908.workers.dev （APIで直接書き込み。前の版のKV「SUBS」もバインドし、VAPID鍵と登録を引き継ぐ）。
    この作業環境からは workers.dev に繋がらないので、動作確認は持ち主のスマホで /key を開いてもらう。
  - 注意: 受け手の端末は Worker の鍵で購読し直すので、送り手が ntfy に落ちた分はその端末に届かない（既存の設計のまま）。
- 赤ちゃんスタンプ(約5MB)の軽量化の余地。
