# 雑学王（zatsugakuou）引き継ぎメモ  ― 現在 v448

## これは何か
見た目は「雑学クイズ」アプリ。中身は **2人専用の暗号化チャット**（メッセージ・写真・ライブ映像・電話）。
トップを5回タップすると裏メニュー → 部屋づくり／トークに入る。**この隠し入口は絶対に壊さない。**
持ち主は日本語話者。画面の文言は、ひらがな多め・単語の間にスペース（例:「あいてを まっています」）の文体に合わせる。

## ファイル構成（すべて同じフォルダに置く／静的ホスティング）
- `index.html`  本体。1ファイル（約8.6MB）。大半は埋め込み画像(base64)。コードは約1.5MB・約1.3万行。
- `sw.js`  通知用 Service Worker。本文は復号しない（暗号文だけIndexedDB `zg-sw-inbox/pin` に保存）。互換契約なので形式を変えない。
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`  PWA用。
- `tools/` 確認用の道具（下記）。※このリポジトリにはまだ入っていない（持ち主の手元のみ）。
- `worker/` 自分専用の通知サーバー（Cloudflare Worker）。`zatsugaku-push.js` と、持ち主向けの手順 `README.md`。

## 絶対のルール
1. **更新のたびに版番号を1つ上げる。** 場所は2つのファイルで計4か所:
   - `index.html`: `バージョン <b id="ver">vNNN</b>`（トップ画面）と、設定画面の `<b>vNNN</b>`（同じ数字に）
   - `sw.js`: `SW_VERSION='vNNN'` と `SHELL_CACHE='zg-vNNN-shell'`
   - 持ち主は画面の版番号で「更新できたか」を確認する。変えたら「index.html と sw.js の2つを上げてください」と伝える。
2. **クイズ（QBANK・qz*・sq*関数）は触らない。**（持ち主の指示）
3. 部屋は2人まで・ホスト承認必須・暗号化必須（`ROOM_POLICY`）。緩めない。
4. 端末の「あいず」（`S.sas`）の比較で相手を確かめる設計。表示を消さない。
5. 外部通信は中継サーバー（ntfy.sh、公開MQTT）経由の暗号文のみ。内容を平文で送らない。
6. 既存CSSは `!important` が何層にも重なっている。見た目の変更は末尾の `<style id="v447-polish">` に、強い詳細度で足す（古い規則を書き換えない）。

## 持ち主の希望で変えた点（履歴）
- v441 背景40枚・子犬スタンプ11枚を削除。「くらし」「動くハート」「きのこ」「全画面」スタンプを削除。
- v442 スタンプ選択欄の絵文字を、押さなくても動くように（`.sticker-choice` の動きの予算を外した）。
- v444/445 壊れたアニメWebP（とー君の🐶⑯大爆笑・⑬ふふふ笑い・㉙）を直した（壊れたコマは直前のコマで補う）。「とー君」を一番前のタブに。
- v446/447 チャット背景を夕焼けの1枚に固定（`BG_ONE`、白い膜10%、`background-position:center calc(100% + 14vh)`）。
- v447 見た目の仕上げ、「🔒 2人だけ」の帯（`#zg-room-strip`）、写真の自動再送を長く（約5分→約1時間）。
- v448 「前の部屋の鍵がないため…」のお知らせを出さないように（`resumeConnect` の sessionOnly 再開。安全面は変わらず、入室受付なし＝2人だけ）。
  ※ 再開後は `S.sas` が空で「あいず」が出ない。必要なら「鍵の しるし」（sk のハッシュ）を出す案あり。

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
  → **Workerのコードを作成済み**（`worker/zatsugaku-push.js`、手順は `worker/README.md`）。KVを変数名 `ZG` でつなぐだけ。
    VAPID鍵は初回 `/key` で自動生成しKVに保存。暗号(RFC8291)とVAPID署名は http_ece と node:crypto で検証済み。
    持ち主がデプロイして、2台で「とどけ てんけん」⑦が「おくれた」になるか確認してもらう段階。
  - 注意: 受け手の端末は Worker の鍵で購読し直すので、送り手が ntfy に落ちた分はその端末に届かない（既存の設計のまま）。
- `index.html` に Cloudflare の解析スクリプト(`static.cloudflareinsights.com`)が5か所ある。機密重視なら削除を提案する（持ち主に確認）。
- 赤ちゃんスタンプ(約5MB)の軽量化の余地。
