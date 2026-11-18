# とー君ニュース（旧 雑学王 / zatsugakuou）引き継ぎメモ  ― 現在 v507

## これは何か
見た目は「とー君ニュース」（ニュースアプリ。v460 までは「雑学クイズ」アプリ）。中身は **2人専用の暗号化チャット**（メッセージ・写真・ライブ映像・電話）。
トップを5回タップすると裏メニュー → 部屋づくり／トークに入る。**この隠し入口は絶対に壊さない。**
持ち主は日本語話者。**v486 から画面の文言は「漢字にできるところは漢字・単語の間にスペースを入れない」普通の文章**（例:「相手を待っています」）。
以前の「ひらがな多め・スペース区切り」は持ち主に「AI感がある」と言われてやめた。新しい文言も普通の文章で書く（とー君キャスターの関西弁はそのまま）。

## 引き継ぎ（会話で決めた約束・進め方。最初に必ず読む）
**進め方**
- 持ち主は**スマホしか持っていない**。説明はやさしく短く、手順は1つずつ。返事も「漢字かな交じり・スペースなし」の普通の文章で書く。
- 公開は **作業ブランチ `claude/claude-md-continuation-ptxzv8` と `main` の両方へ push**（持ち主が「main に直接入れて」を選んだ）。PR は作らない。
  コミットの末尾には、その時の指示どおりの Co-Authored-By / Claude-Session を付ける。
- 更新のたびに版番号（4か所）を上げ、**「index.html と sw.js の2つを上げてください」** と伝える。2人とも上げないと効かない変更（写真の大きさ・通知文など）はそう書く。
- 実機でしか分からないもの（通知・電話の音・キーボード・iPhone の挙動）は、ここでは確認できない。確認した範囲と、持ち主のスマホで確かめてほしい点を分けて報告する。
- 直す前に原因を調べ、再現できない時は「再現できなかった」と正直に書く（v479・v489）。

**安全のルール**
- Cloudflare などのトークンは**チャットに貼らせない**。`request_credential`（安全な入力欄）だけで受け取る。使い終わったら持ち主に**削除をお願いする**（今回のトークの期限は 2026-11-22）。
- 持ち主の写真・画面に写った住所や名前などの個人情報は、返事やコミットに書き写さない。
- 相手のアクセス履歴・「あいず」・2人だけの部屋の仕組みは仕様。弱めない。

**持ち主が決めたこと（勝手に戻さない）**
- 電話の通知は**今のまま**（アプリを開いている時だけ着信画面。閉じている時は何も届かない）。変えるなら「閉じている時にニュース風の通知」を提案済み（まだ希望なし）。
- メッセージの通知文は**ニュース風**「新しいニュースが更新されました」（見た目をごまかす目的）。電話・開いた・入室の通知文はそのまま。
- キャスターは**机とマイクの とー君が揺れるだけ**。芸・小物・あっかんべーの絵は出さない。とー君の絵は自作しない。
- クイズは一切いらない（コードは残すだけで触らない）。「相手が手でアプリを開きました」の黒いお知らせは出さない。
- 画面の文言は漢字かな交じり・「AI感」を出さない。トップ5回タップの裏メニューは絶対に壊さない。

**環境**
- この作業環境から `*.workers.dev` へは届かない。送受信は `tools/run_e2e.sh`（手元で中継所を立てる）で確かめる。Cloudflare の Worker は 2026-11 時点でデプロイ済み（変更したら API で書き込む必要があり、トークンが要る）。
- 次に聞かれそうな未着手: 閉じている時の電話通知、赤ちゃんスタンプ（約5MB）の軽量化。

**Cloudflare の Worker を書き換える手順（`worker/zatsugaku-push.js` を変えた時だけ。アプリだけの更新では不要）**
1. `request_credential` で api.cloudflare.com 用のトークンを持ち主にもらう（権限: Workers Scripts 編集・Workers KV 読み取り・Account Analytics 読み取り。トークンはチャットに貼らせない）。
   保存後は、リクエストに `Authorization: Bearer proxy-injected` と書けば、プロキシが本物に差し替える。確認は `GET /accounts/{id}/tokens/verify`。アカウント ID は `GET /accounts` で分かる。
2. 書き込みは `PUT /accounts/{id}/workers/scripts/zatsugaku-push`（multipart）。`metadata` に `main_module`、`compatibility_date`、
   bindings = `RELAY`（`durable_object_namespace`、class `ZgRelay`）と `SUBS`（`kv_namespace`、`GET /accounts/{id}/storage/kv/namespaces` で名前 SUBS の id）。**migrations は付けない**（作成済み）。
3. 1分ごとの Cron は **2026-11-18 に持ち主が削除した（今は無し）**。ニュースの先取りだけの用途で、無くても `/news` は呼ばれた時に取る。戻す時だけ `PUT /accounts/{id}/workers/scripts/zatsugaku-push/schedules`（`[{"cron":"* * * * *"}]`）。
4. 状況の確認は GraphQL（`workersInvocationsAdaptive`、`durableObjectsInvocationsAdaptiveGroups`）で、エラー数・呼び出し数が見られる。この環境から workers.dev へは届かない。
5. 終わったら**持ち主にトークの削除をお願いする**。

## ファイル構成（すべて同じフォルダに置く／静的ホスティング）
- `index.html`  本体。1ファイル（約8.6MB）。大半は埋め込み画像(base64)。コードは約1.5MB・約1.3万行。
- `sw.js`  通知用 Service Worker。本文は復号しない（暗号文だけIndexedDB `zg-sw-inbox/pin` に保存）。互換契約なので形式を変えない。
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`  PWA用（v461 から とー君のアイコン）。
- `tools/` 確認用の道具（`tools/README.md`）。構文チェック・テスト用ビルド・2台の送受信テスト（wrangler dev の中継所つき）。公開はしない。
- `worker/` 自分専用サーバー（Cloudflare Worker＋Durable Objects）。通知(/key /sub /push)と中継所(/r/)。`zatsugaku-push.js`、`wrangler.toml`、持ち主向けの手順 `README.md`。

## 絶対のルール
1. **更新のたびに版番号を1つ上げる。** 場所は2つのファイルで計4か所:
   - `index.html`: `バージョン <b id="ver">vNNN</b>`（トップ画面）と、設定画面の `<b>vNNN</b>`（同じ数字に）
   - `sw.js`: `SW_VERSION='vNNN'` と `SHELL_CACHE='zg-vNNN-shell'`
   - **sw.js を書き換えたら、中身が空になっていないか必ず確かめる**（`wc -c sw.js` と `node --check sw.js`）。v456〜v459 は
     Python の `open('sw.js','w').write(open('sw.js').read()…)` で先に空にしてしまい、0バイトのまま公開していた（通知が届かない）。
   - 持ち主は画面の版番号で「更新できたか」を確認する。変えたら「index.html と sw.js の2つを上げてください」と伝える。
2. **クイズ（QBANK・qz*・sq*関数）は触らない。**（持ち主の指示）※ v462 で持ち主が「クイズは一切いらない」→ 入口の `#btn-solo` を削除（中身のコードは残置）。
3. 部屋は2人まで・ホスト承認必須・暗号化必須（`ROOM_POLICY`）。緩めない。
4. 端末の「あいず」の比較で相手を確かめる設計。表示を消さない（`sasLabel()`）。v472 から あいず は いつも `S.keyMark`（2人の鍵 sk のハッシュ、`refreshKeyMark()`）。
   入室時の `S.sas`（ECDHのハッシュ）とは別の文字になるので、混ぜて表示しないこと（混ぜると2台で ちがって見える）。
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
- v455 トップ画面に「最新ニュース」（持ち主の希望：徳島中心・事件事故・株価）。`#zg-news`（`#s-lobby` 内）と `News` オブジェクト。
  取得先は自分のWorkerの `GET /news` だけ（スマホはニュースサイトへ直接つながない）。開くたび・戻るたび・5分ごとに更新、前回分は localStorage `zg_news`。
  Worker側 `handleNews`: Google ニュースRSS（徳島）、NHK RSS cat1（事件事故）、Google ニュース「株価」/NHK cat5、日経平均・ドル円は Yahoo chart（予備 stooq）。5分キャッシュ（DO 'news'）。
  リンクは https のみ、target=_blank rel=noopener noreferrer。表示は textContent のみ。隠し入口（5回タップ）が動くことを確認。
- v456 ニュースが遅い（持ち主）。Worker: 1分ごとの Cron（`scheduled` → `refreshNews`）で先に取っておく。`/news` は45秒以内ならそのまま、古くても1時間以内なら
  古い物を即返して裏で更新（stale-while-revalidate）、`?fresh=1`（↻・開いた時・戻った時）は15秒に1回まで。取得タイムアウト6→4秒、一部のソースが失敗しても前の分で埋める。
  Cron は API `PUT /workers/scripts/zatsugaku-push/schedules` で設定済み（wrangler.toml の [triggers] も同じ）。アプリ側は90秒ごと＋開いた/戻った/↻で fresh 取得。
- v457 設定（チャット→名前）画面を作り直し（持ち主：見にくい・きちんとした文章に）。`#prof-modal .pm.zs`、カード `.zs-card`、行 `.zs-row`、
  オン/オフは `.zs-tg`（小さなscriptで `data-state` を付けて色分け）。ID・動作は変えず、文章を漢字かな交じりの普通の文に。作業メモ（v203等）を削除。
  ※ この画面だけは「ひらがな多め・スペース区切り」ではなく普通の文章（持ち主の希望）。
- v458 (1) トークの「メニュー」に「⚙ 設定」(`#btn-settings`、名前ボタンと同じ画面を開く)。
  (2) とー君の拡大が効いていなかった（114→154pxだけ）。`mtp_tokun_big` のとき `.v439-giant` を body 直下に出し、画面中央に大きく＋紙吹雪（`window.__zgConfetti`=confettiBurst）。
  (3) ライブと電話を区別: `callModeSet()` で `#call-box` に `mode-live`/`mode-call`。電話ではLIVE印・コメント・ハート・切替・画面を隠す・自分の小窓を出さない。
      終了ボタンを赤く「ライブを終了」「電話を切る」。`#center-note`（二重の説明）を消す。ツールは横一列で小窓と重ならない。
      トークの「ライブ」「電話」ボタンに🎥📞、使用中は赤く点滅（文字で `data-active` を付ける）。「ライブ止」→「ライブ終了」。
- v459 電話（声だけ）で `#call-box` が一度も開いていなかった（openCallUI はライブの時だけ）。`callPanel` が呼ばれたら、声だけでも開く。
  受ける側も「でる」直後に `callPanel('wait',…)`（受ける処理は2か所ある）。マイク切替が `callStream` だけ見ていて電話で効かなかった → `callStream||micStream`。
  ボタンを絵つきに: `callToolPaint()`／`callToolSet()`（SVGアイコン `CALL_ICO`＋ラベル、`data-state` on/off で色）。自分の小窓 `#call-local` を 24%→34%（約1.4倍）。
  試験: 本物の「電話」「ライブ」ボタンを押す流れで、画面が開く・マイク切替・電話を切る・ライブを終了を確認（偽カメラ）。
- v460 「とー君ニュース」に名前を変更（持ち主の希望。隠し入口＝タイトル文字の5回タップはそのまま）。
  トップ画面にキャスター `#zg-caster` と `Caster`（ニュースを関西弁で読み上げ、内容のキーワードでひとこと `react`、ジャンルで動き・マーク）。
  絵は持ち主が送った とー君（`TOKUN_CASTER`、背景を抜いた WebP を埋め込み）。名前入りの吹き出し絵（㉘〜㊳）と「かずよ〜♡」コメントは表に出さない。
  とー君（チャットの演出・拡大）はチャット画面を離れたらすぐ消す。クイズのボタンは「今日の 雑学クイズ」としてニュースの下へ（クイズの中身は触っていない）。
  名前の変更: title・apple-mobile-web-app-title・manifest・通知の題名（index.html と sw.js）・招待文。
  **sw.js が v456〜v459 で空になっていたのを v455 から復元**（通知の受け取りが止まっていた）。
- v461 アイコンを とー君に（紫の背景＋丸い枠、icon-192/512.png・apple-touch-icon の埋め込み、manifest に maskable）。起動画面の色を紫（background_color #4B2ED6）。
  v462: アイコンに黄色い帯「ニュース」（IPAゴシック、帯は丸く切り抜かれても欠けない幅）。クイズの入口を削除。
  起動中に博士（`#lab`）が一瞬見えていた（隠すCSSがファイル末尾にあり読み込みが遅い）→ `#lab` に style="display:none"、`#zg-caster` に hidden を直接付けた。
- v463 とー君キャスターに動き: しゃべる間 `.talk`、ジャンル別の小物 `Caster.fx(mood)`（✨💦🚨🎉🌧💴 が頭上/上から）、
  7秒ごとの芸 `Caster.trick()`（spin/hophop/peek/dance/stretch/tilt/flip、`.zc-body` に t-xxx）。とー君を押すと芸→次のニュース。動きを減らす設定では止める。
- v464 とー君を部品に分けたSVGで描き直し（持ち主：手がずっと同じ）。`TOKUN_SVG`（元絵の寸法・色を測って作成。以前の WebP `TOKUN_CASTER` は削除）。
  手（aL-down/aR-down/aL-wave/aR-point/aR-mic/aL-cheek/aL-up/aR-up/aR-thumb）・目（e-open/wink/happy/worry/sad）・口（m-smile/big/o/frown）を
  `#zg-caster[data-mood]` で組み合わせ（hello/toku/jiken/up/down/keizai/bye/thumb）。手を振る・バンザイ・指さし・マイクは動き、まばたき、しゃべる間は口パク。芸に「グッド👍」(thumb)。
- v465 v464 のSVG描き直しは持ち主に不評（「ロボットみたい」「見た目は このままで」）→ **持ち主の本物の絵だけを使う**。
  `TK_IMG`（wink=最初の絵, stand=立ち姿, fart=プゥ〜ン, fire=たき火。背景を抜いた WebP を埋め込み）。`Caster.IMG` でニュースごとに絵を切替、
  芸 `fart`/`fire` で絵を2.4秒入れ替え（押したときは2.5秒見せてから次へ）。**とー君の絵を自作しない。新しいポーズは持ち主に絵をもらう。**
- v466 種類を増やす（持ち主の許可）。とー君自体は描かず、名前の入っていないスタンプ ⑫〜㉗（DOG_STK、本物の絵・動く）と本物の立ち姿を使う。
  `Caster.picFor(mood, 見出し)`: 事件=⑭、災害・事故=㉒、祭・観光=⑲、上がった=㉓、下がった=⑫/たき火、経済・あいさつ=キャスター席（立ち姿＋机とマイク `.zc-desk`）、おわり=⑱。
  芸 `PIC_TRICKS`: プゥ〜ン・たき火・⑯大笑い・⑰くすくす・㉑おふろ・㉔天使・㉕トイレ・㉖スポットライト・⑳うしろ姿。
  **あっかんべー（最初のウインクの絵）はトップ画面で使わない**（持ち主）。TK_IMG から wink を削除。アプリのアイコンは まだこの絵。
- v467 持ち主「マイクいいね・他のやつなくていい・揺れてたらそれでいい」→ いつもキャスター席（`picFor` は 'desk' を返す）。
  芸・絵の切替・まわりの小物（fx）・マーク（zc-emo）をやめ、とー君の絵だけ `zc-sway` で左右に揺れる（机とマイクは動かない）。コードは残してあるので戻せる。
- v468 「🔒 2人だけ」の帯を押すと出ていた説明（この 部屋は ホストが 承認した…）を出さない（持ち主: 毎回出ていらない）。帯の表示は残す。
- v469 キャスターの吹き出しを いつも同じ高さ（188px）に。本文は5行で「…」（line-clamp＋max-height 7.75em）。「記事を読む」の場所も固定。
- v470 相手のiPhoneで「トップから進めない」。(1) `tapSecret` は未接続だと `resumeConnect(false)` → 最後に show('lobby') でトップに戻っていた
  → `resumeConnect(true)` のあと show('play')+setTab('chat')。(2) `persistChat` は鍵の準備前（privateScope なし／chatLoaded=false）なら黙って何もしない
  （「本文を保存できません」が出ていた）。(3) ニュースは zg_psrv が無くても既定の https://zatsugaku-push.pprnt908.workers.dev から取る。
  試験: 未接続にして5回タップ → v469 はトップのまま、v470 はトーク画面。
- v471 「保存済みの履歴を今の鍵で読めません／ペアの鍵を保存できません／本文・送信待ちを保存できません」で保存が全部止まる（部屋を作り直した後）。
  `protectExistingHistory` を変更: (1) 鍵の比較を文字→バイト（古い版は普通の base64、今は URL用 base64。文字比較だと同じ鍵でも「別の鍵」扱いで保存が止まっていた）。
  (2) 承認ずみの新しい部屋（`privateReady()` かつ `!Net.sessionOnly`）なら、前の記録を `archiveStores()` で保管庫 'a'（キー 'moved:時刻'）へコピーしてから c/p を空にし、
      前の PAIR_KEY を外して新しい部屋の保存を通す。読めない記録も同様に保管庫へ（S.paired のときだけ）。準備前は従来どおり守って止める。
  試験: 古い形の部屋→保存OK・警告なし・ペア残る／新しい部屋→ペア保存OK・保管1件・警告なし／未承認→移さない。
- v472 「あいずが2台で違う」。入室直後は `S.sas`、開き直し後は `S.keyMark` を出していて、同じ鍵でも文字が違った。
  `sasLabel()` は いつも「あいず ＋ keyMark」。`S.sessKey` を入れる3か所で `refreshKeyMark()`。通信テスト③も keyMark。試験: ホスト・相手・開き直し後で同じ4文字。
- v473 「送信中のまま／写真が遅い」。相手のiPhoneは zg_psrv が空で、しかも中継所の確認（psrvCheck）は通知を許可した端末でしか走らず、中継所を使えていなかった
  （ntfy.sh 250通制限のまま）。`relayBoot()`: 起動1.5秒後・オンライン復帰・画面復帰（死んでいたら）に、psrv が空なら `DEFAULT_PSRV` を入れて psrvCheck→Relay.connect→sendProf。
  写真のかけら（NO_STORE）も、相手が中継所対応（relaySendBase）なら即時路で送ったうえで中継所にも預ける（相手が閉じていても開いたら揃う）。
  Cloudflare の GraphQL（workersInvocationsAdaptive）で24時間のエラーが0なのを確認済み（中継所自体は健全）。
  試験: psrv なし・通知なし・ntfy/MQTT遮断の2台で、自動で中継所→メッセージ往復・写真・閉じている間・かけら預け・あいず一致。
- v474 キャスターを左右にスワイプで前後へ（左=つぎ・右=まえ、`Caster.wire` の touch/mouse、40px以上・横が縦の1.3倍以上）。
  スワイプ直後（450ms）のタップは無視して記事が開かないように（`swipedAt`）。`#zg-caster{touch-action:pan-y}`。
- v475 チャット中の とー君（`.v439-stage`）を上に重ねて出す。これまでは #chat-log の下に入って記録欄を縮め、最新メッセージが隠れていた。
  `dock` を #chat-log の前に置き、`position:absolute`（top は `placeDock()` で記録欄の上端＋6px）、`#pane-chat{position:relative}`。記録欄の高さは変わらない。
  ※ Cloudflare の API トークンは「cfat_」形式（アカウント所有トークン）。確認は /accounts/{id}/tokens/verify。
  持ち主の希望で「この版は 1ファイル…」の説明（#install-hint）を出さない。ニュース枠を広く、件数は 徳島12・事件事故8・経済6。
- v476 「やはり 送信中… でとまる」。中継所は健全（GraphQL で DO エラー0）なので、アプリ側の原因を直した:
  (1) `Relay.again()` が WebSocket の失敗4回で `badUntil` を立て、**送り（POST）まで60秒 中継所を使わなかった**（iPhone は裏で WS がよく切れる）→ 立てない。
  (2) WS が切れている間は相手の「とどいた」を受け取れず送信中のままだった → `Relay.poll()`（`/r/{topic}/json?poll=1&since=`）を5秒ごと（WSが無い／45秒無音のとき）＋画面復帰時。
  (3) `outSave` が新しい保存に追い越されると false を返し flush が止まっていた → true。
  (4) `flushOutbox`: 40秒返事のない inflight を解放、中継所があれば再送間隔の上限20秒。
  (5) 表示: 送り出せた（m.sent）が相手の受領証がまだ →「おくった・あいて まち」（相手がアプリを開くと「とどいた」に）。
  (6) とどけてんけんに ⑯（送信待ち件数・送り中・最後の送信 `window.__sendDiag`）。
  試験: wrangler dev＋chromium 2台で、WSを切った後の送信→既読、相手が閉じている間→「おくった・あいて まち」→開くと「とどいた」、写真・あいず一致。
- v477 メッセージを打つとき、記録も いっしょに上へ（持ち主の希望）。キーボードで `#chat-log` が縮んでも scrollTop がそのままで、最新が隠れていた。
  `ResizeObserver` で記録欄の高さが変わったら「下からの距離」を保つ（120px 未満なら一番下にくっつける）。入力欄が伸びた時・キーボードを閉じた時も同じ。
  試験: 高さ844→480で、最後のメッセージが見える（距離0）／上を読んでいる時は位置を保つ。
- v478 メニューの「設定」(`#btn-settings`)に ほかのボタン（カメラ・写真・通知）と同じ形のイラスト（歯車SVG、`::before`、v447-polish に追加）。文字は「⚙ 設定」→「設定」。
- v479 古いクイズ画面（スコア 0-0「あいてを まっています…」）が一瞬見える（持ち主・Android）。play 画面がタブ 'game' のまま出る道すじ
  （enterWait の S.tab='game'、相手からの 'restart'、戻るボタンの restore など）があり、見張り（1.2秒ごと）がトップへ戻すまで見えていた。
  `show('play')` は タブが chat 以外なら必ず `setTab('chat')`。appNav の restore も play なら chat。CSS で `#s-play #pane-game` を常に非表示。
- v480 まだ自分のメッセージがチカチカ（持ち主）。全部作り直し(renderChatFull)が2つの理由で起きていた:
  (1) 受領証待ちの送り直しのたびに封筒番号 m.n が変わり、要約(chatSweepSigOf)が変わっていた（v476 で送り直しが20秒ごとになり増えた）
      → 要約は n の有無だけ。`flushOutbox` で行の data-n をその場で書き換える。
  (2) 「既読・あと N分で きえる」の分が変わるたび（毎分）→ 要約は rad の有無だけ。数字は `vanishMetaTick()`（sweepChat から）で文字だけ書き換え。
  念のため作り直し時も、出ていた行は `.zg-still`（動きなし）。試験: 相手が閉じている間130秒で作り直し0回（v479 は70秒で3回）、受領・既読の表示は正しく変わる。
  ※ 画面に出る値を増やすときは、要約に入れるか、その場で書き換えるかを決めること。
- v481 トーク下のボタン（メニュー・ライブ・電話・スタンプ・削除・TikTok）を1段に（持ち主: TikTok が2段目になる）。v447-polish で nowrap・flex:1 1 auto・文字と余白を clamp で縮める。幅 320〜430px で1段・TikTok が右はしを確認。
- v482 「とー君ニュースの 時間やで〜」が2回続く（持ち主）。`Caster.set` はニュースが変わるたび（起動時の保存分→新しい分、90秒ごとの更新）`show(0)` で あいさつからやり直していた。
  初回だけ show(0)。2回目以降は、今の文が新しい一覧にあればそのまま、無ければ同じ番目（あいさつには戻らない）。画面に戻った時も同じ文を読み直さず、少し後に次へ。
- v483 相手のアクセス履歴（ホストがトーク中にタイトル `.brand` を5回タップ → `#mem-box`）の点検と作り直し（持ち主）。
  点検: 合図は相手(ゲスト)→ホストの一方向だけ（`sendAppOpen` は v439 からトーク画面を開いた時だけ 'play'）、ホスト側だけ記録（`plogAdd`、localStorage `zg_peer_log` 100件）。
  直した: (1) `chat-open` の版が 'v436' 固定だった → 画面の版。(2) `app-live` の「推定」(guess) と直後の本物の合図が2件に数えられていた → 3分以内なら1件にまとめる。
  (3) 一覧を時刻順に。見た目を明るいカード（紫の見出し・×で閉じる・状態の帯・今日の回数・種類ごとの色・チップ）に、文章を普通の文に（`peerLine`/`openProofLabel`/`plogTimeLine`/めも）。CSS は v447-polish の `#mem-box .zl-*`。
- v484 ニュースの↻ボタン（`#zn-re`）を削除（持ち主: いらない・開いたら最新に）。起動時は待たずに `News.load(true)`（以前は0.8秒後）、bfcache復帰(pageshow persisted)・online・focus(30秒以上たったら)でも取得、定期は90→60秒。起動時の取得は1回だけ（約0.5秒）を確認。
- v485 写真が粗い・スクショが真ん中しか送れない（持ち主）。原因: `photoFitURL` が ntfy.sh 向けに 約12,000字（長辺800）まで縮め、しかも 4:3 で真ん中を切り出していた。
  (1) 切り出しをやめた（全体を送る）。(2) 相手も中継所OK（`relaySendBase()`）なら `photoFitURL(src,'big')`（長辺1600・約52万字以内・画質0.86から）で1枚のファイル（PUT）として送る。
  かけら送りはしない（`msg.__big`）。2回失敗したら従来の小さい写真に戻して送り直す。`sendFile` 失敗時の自動かけら化は 60KB 以下だけ。
  元画像も きれいに: カメラ 長辺1600・0.9、写真選択 長辺1600・0.9。確認文の「写真は小さくします」を削除。
  試験: 1170×2532 のスクショ風画像 → 相手に 739×1600・約28万字（上端の赤・下端の青も届く）、中継所経由、「とどいた」表示。
- v486 画面の文言を漢字かな交じり・スペースなしに（持ち主: 「あと15分できえる」を漢字に、漢字にできるところは漢字で、AI感を少なく）。
  クイズの範囲（`var QBANK` 〜 `sq*` の行）以外の文字列リテラルと HTML の文字を、単語の頭を見る置き換え表（相手・写真・送信・届く・開く・消える・待つ…）で変換し、日本語どうしの間の半角スペースを削除。sw.js の通知文も同じ。
  文言で判定していた2か所（`/つながって いません/`、`/かくにん しています/`）は新旧どちらでも合うように。表示: 「既読 12:00／あと15分で消えます」「未読 12:00」「送信済み 12:00／相手の受信待ち」（2行、`.meta{white-space:pre-line}`）、帯「🔒 2人だけ・暗号化　合図 XXXX」。
  ※ 文言を条件にしている所（=== や .test）を変えるときは両方そろえること。
- v487 入力欄を押しても最後の受信が上へ動かない（持ち主・実機）。v477 の ResizeObserver だけでは効かない端末がある。入力欄の touchstart/pointerdown/focus の時点で記録欄が下から260px以内なら `kbStick`、キーボードが出る間（0〜1.3秒の数回と vv の resize）に一番下へ合わせる。記録欄を指で動かしたら止める。Pixel 7 の画面で、下にいた時・200px 上にいた時とも最後が見えることを確認。
- v488 メッセージの通知文をニュース風に（持ち主: 見た目をごまかしたい）。sw.js `handlePush` の既定文・保存失敗時・`notificationclick` の再通知、index.html `notifyIncoming` を「新しいニュースが更新されました」「新しいニュースがあります。アプリを開いてください」に。電話・開いた・入室の通知文はそのまま。
- v489 「本文を保存できません。アプリを閉じずに、保存をやり直してください。」が出る（持ち主・Android）。`chatSaveNow` の失敗を全部すぐ警告にしていた。
  実機でしか再現しない（起動直後の読み込み前・ペア切替中・裏に回った瞬間に IndexedDB が中断、など）。`chatSaveFailed`: 準備前/鍵なし/ペアが変わった は出さない、
  それ以外は2.5秒後に1回自動でやり直し、それも失敗した時だけ出す。保存が成功したら警告を自動で消す（以前は「保存をやり直す」を押すまで残った）。persistChat の警告も同じ道へ。
  試験: 1回だけ失敗→出ない／ずっと失敗→出る／直ったら消える。
- v490 送ったあと必ず一番下（送ったメッセージ）を表示（持ち主）。`chatJumpBottom()` を `queueChat`（文字・スタンプ）、写真の撮影送信、写真・ファイル選択の送信に。0〜1.6秒の間に数回 scrollTop を一番下へ（キーボード・入力欄の高さ・画像の読み込みで ずれるため）。記録欄を指で動かしたら止める。Pixel 7 画面で、下にいた時・1500px 上を読んでいた時とも送信後は一番下を確認。
- v491 電話の記録をトークに残す（持ち主: 電話を掛けても記録が出ない）。この端末だけの記録（相手へは送らない）。`callLogBegin('out'|'in')`／`callLogConnected()`（pc が connected）／`callLogEnd(reason)`（stopCall から、ライブは除く）／`callLogAdd(text)`。
  文言: 発信・通話 m:ss／着信・通話 m:ss／発信・応答なし／発信・キャンセル／発信・相手が切りました／不在着信（出る前に相手がやめた・時間切れ）／着信・拒否しました。末尾に時刻。
  `S.chat` に `{sys:true,callLog:true}` で入れ、保存（`chatSaveSnapshot` で cl:1）・復元（`chatRestore`）する。表示は `.line-sys.zg-call`（白い丸い帯）。
  試験: 偽マイクの2台で 出た→両方に通話時間／断った／かけた側がやめた（相手は不在着信）／開き直しても残る。
- v492 「相手が手でアプリを開きました」の黒いお知らせ（toast）を出さない（持ち主）。`peerOpenNotice` の toast だけ削除。アクセス履歴の記録・相手の行の光・ランプ・音/バイブ（設定どおり）はそのまま。
- v493 メッセージ2通で通知が6件（持ち主・Android）。相手が閉じている間、受領待ちの送り直し（約20秒ごと）のたびに新しい封筒（新しい暗号文）を作り、`pushToPeer` で通知も送り直していた（通知の tag は暗号文の末尾なので毎回別の通知になる）。`Net.post` で、通知を送り終えたメッセージの mid を `pushMidsMark`（localStorage `zg_pushed_mids`、300件）に覚え、全部済みなら `pushMidsAllDone` で通知を送らない（送り直し自体は続ける）。
  試験 `tools/e2e/push_once.js`: 相手が閉じている間に2通・120秒で、v492 は通知6回、v493 は2回（送り直しは各5回）。relay_basic も通過。送る側の変更なので、2人とも上げると両方向で効く。
- v494 「通知が来たのにトークにメッセージがない」（持ち主）。`vanishSweep` が、受け取ったメッセージ（相手から）に時計(rad)が無ければ、トーク画面を見ていなくても5秒ごとの見回りで時計を入れていた（v251 からの条件 `m.read||m.from!==S.me.id`）。トップ画面・裏にいる間に届いた分が、見ないまま15分で消え、相手側にも消す合図が行っていた。受け取った分は `chatOnScreen()` の時だけ時計を入れる（自分の分は従来どおり既読になってから）。
  試験 `tools/e2e/vanish_unseen.js`（Date.now をずらす）: v493 は見ないまま16分で消えた／v494 は消えない、トークで見てから16分で消える。
- v495 受け取った写真をタップすると「高画質を読み込んでいます…」が出たまま（持ち主）。`imgViewerAskHQ` が相手に 'photo-hq' を頼むが、送る側は v348 から `schedulePhotoHQ` が何もしない（`photoSentHQ` が空）ので返事が来ず、9秒後は「高画質はまだ届いていません」に変わるだけだった。写真は v485 から長辺1600で届くので、`hm.hq` が無ければ頼まず案内も出さない（送る側の 'photo-hq' 受け付けはそのまま）。
  試験 `tools/e2e/photo_viewer.js`（1台）: v494 は案内が出たまま・頼み1回／v495 は全画面で出て案内なし・頼み0回。
- v496 写真の画質を上げる（持ち主: 長辺2000に）。`PHOTO_BIG_MAXSIDE` 1600→2000、`PHOTO_BIG_WEBP` 52万→82万字・`PHOTO_BIG_JPEG` 70万→110万字（面積に合わせ約1.56倍）、元画像もカメラ `PHOTO_FULL_MAXSIDE`・写真選択とも 1600→2000。中継所の上限は1枚2MB（`MAX_FILE`）で、その内側。中継所が使えない時の小さい写真は変えていない。
  試験 `tools/e2e/photo_2000.js`: 縦長スクショ 1170×2532 → 924×2000・約37万字、重いカメラ風 3024×4032 → 1500×2000・約70万字（約0.5MB）、どちらも上下の色まで届く・中継所経由。relay_basic も通過。
- v497 文字入力中に一瞬固まる（持ち主）。受け取った暗号文は受信箱 IndexedDB `zg-inbox/m` に預け、`process` が true なら消す仕組みだが、中継所・ntfy から戻ってきた**自分の送信**（chats・ack・read・prof・app-live）は `process` が何も返さず（undefined）消されなかった。その受信箱を `drainInbox` が1.2秒ごと（画面表示中）に全部読み直して復号し直すため、使うほど重くなる（10往復で各端末36〜39件たまった）。`Net.process` で、自分の送信は「相手から」の確認（privateType の from/to 照合。ここで undefined を返していた）より先に `return true`（片付け済み）にした。たまっていた分も次の drainInbox で1回処理されて消える。
  試験 `tools/e2e/inbox_clean.js`（10往復で受信箱が数件以内）。測定 `tools/e2e/typing_prof.js`（CPUを遅くして入力中の長い処理・関数ごとのCPU時間）。※ `chatGrow`（入力のたびに高さを測り直す）も1文字あたり少し重いが、今回は触っていない。
- v498 メッセージを入力した形（改行・空行・行頭の空白）のまま見せる（持ち主）。送受信では改行は保たれていたが、自分の吹き出しだけ v386 の処理（`renderChatFull` で改行を空白にして1行につなぐ）と v389 の CSS（`.msg.out .bubble{white-space:normal!important}`）で1行に見えていた。置き換えをやめ、v447-polish に `.msg .bubble:not(.sticker-animated):not(.dog-b){white-space:pre-wrap!important}`。末尾の空行は従来どおり送らない（`submitChat` の末尾空白の除去）。
  試験 `tools/e2e/newline_keep.js`: キーボードで改行・空行・行頭の空白を入れて送る → 送った側・受け取った側とも入力どおりの形。
- v499 チャット画面のとー君の設定（現れる `mtp_tokun_off`・間隔 `mtp_tokun_iv`・拡大 `mtp_tokun_big`）を2台でそろえる（持ち主）。`prof`（つながった時・開き直した時にやり取りする暗号化メッセージ。中継所に預けられる）に `tk:tokunState()` を載せる。設定ボタンを押すと `tokunChanged()` で版 `mtp_tokun_v` を1上げて `sendProf()`。受け取り側 `tokunApply(tk,相手がホスト)` は版が大きければ合わせ、版が同じで中身が違う時（どちらも変えていない等）はホストに合わせる。反映時は `window.__tokSet(iv)` と設定画面の再描画 `window.__tokPaint`。
  試験 `tools/e2e/tokun_sync.js`: 最初の食い違い→ホストに合わせる／ホストが拡大オン／相手が間隔変更／相手がオフ／相手が閉じている間の変更→開いたら反映、すべて2台一致。relay_basic も通過。
- v500 とー君と一緒に出るメッセージ（設定画面の `pf-tcm-🐶㉘` など10個、localStorage `mtp_cm_<キー>`。null は既定文 `TOKUN_CM`）も2台でそろえる（持ち主）。v499 と同じく `prof` に `tc:tokunCmState()`（版 `mtp_cm_v`＋10個の文）を載せ、`tokunCmApply` で版が大きい方・同じならホストに合わせる。入力は止まって1.5秒後に1回だけ版を上げて送る（`tokunCmChanged`）。自分が入力中（未送信）の間は相手の分で上書きしない。反映時は入力欄も `window.__cmPaint` で書き換え（入力中の欄は除く）。
  試験 `tools/e2e/tokun_msg_sync.js`: 最初の食い違い→ホスト／ホストが書き換え／相手が書き換え／空にする／閉じている間の変更→開いたら反映、すべて2台一致。tokun_sync・relay_basic も通過。
- v501 アプリ内カメラの写真をもっときれいに（持ち主）。`camOpen` の getUserMedia が `width:{ideal:720},height:{ideal:960}` で、映像の1コマ（約960）をそのまま写真にしていたため、v496 で上限を2000にしてもカメラの写真は細かくならなかった。`ideal:1536×2048`（同じ3:4）に上げた。ideal なので対応しない端末は近い大きさ（多くは1920×1080級）。さらに上げるなら Android の `ImageCapture.takePhoto()`（センサーの全画素）が候補（向き・鏡像・画角の差を実機で確かめる必要あり）。
  試験 `tools/e2e/camera_res.js`（1台・偽カメラ）: v500 は映像720×960→写真720×960、v501 は映像1536×2048→写真1500×2000。
- v502 写真と吹き出しの枠が合っていない（持ち主）。写真の吹き出し `.bubble.photo-b` に、古い規則の色（自分=緑・相手=白）と余白（上下10・左右15px）が付き、写真の外に色の枠が出ていた（v497 でも同じ）。v447-polish で `.bubble.photo-b` を余白0・背景なし・影なし・角丸16px、写真 `img.photo-msg` にも角丸と影。送れなかった時の「もう一度送る」(`.photo-retry`) は白地のボタンで吹き出しの中。v498 の pre-wrap 規則から `.photo-b` を外した。
  試験 `tools/e2e/photo_frame.js`（1台）: 縦長・横長・相手の写真で写真と吹き出しの差0、もう一度送るが吹き出しの中、文字の吹き出しは余白あり・改行2行。newline_keep も通過。
- v503 「まだまだ写真の画質が悪い」（持ち主）。きれいな1枚（長辺2000）で送るのは `relaySendBase()`（相手も中継所OKの確認 `zg_peer_relay`）がある時だけで、無いと予備の道（`PHOTO_MAXSIDE` 800・`PHOTO_TGT_WEBP` 約1万2千字）まで縮めていた。`relayPeerMark` は相手の prof が一度でも rl:0（起動直後・電波が悪く /key の確認に失敗した時など）だと確認を消すため、その間の写真が粗くなる。`sendPhoto` の条件を `relaySendBase()||relayAnyBase()`（自分が中継所を使えれば）にした。届け方は `storeFetch` がこれまでどおり選ぶ（未確認なら ntfy→だめなら中継所）。
  試験 `tools/e2e/photo_unconfirmed.js`（確認を消して送る）: v502 は縦長スクショ 203×440・約1.4万字／カメラ風 600×800、v503 は 924×2000／1500×2000。photo_2000・relay_basic も通過。
  ※ 確認が消えやすいこと自体（メッセージの送り先にも影響）は未対応。
- v504＋中継所（Worker）の直し（2026-11-17）。Cloudflare から「Durable Objects の1日の読み出し上限（rows_read 500万）を超えた」メール。23:02 JST から翌 09:00 JST（00:00 UTC）まで中継所が止まった。GraphQL `durableObjectsPeriodicGroups{sum{rowsRead rowsWritten}}` で、11/16 読み出し約117万、11/17 約536万（夜は1時間130万）、書き込みも約10万（無料上限10万）だった。
  原因と直し: (1) Worker `rows()` が `ORDER BY seq` で索引 m_t を使わず、5秒ごとの poll・WS接続のたびに12時間分を全件読み（SQLite の EXPLAIN で SCAN m を確認）→ `ORDER BY t, seq`（SEARCH USING INDEX）。(2) 写真を預ける時の `COUNT(*) WHERE an IS NOT NULL` も全件読み → 部分索引 `m_an`。(3) 1通ごとの日数カウンタ書き込み → メモリで数えて20通ごとに保存。(1)(2) は 2026-11-17 14:41 UTC、(3) は同日 15:0x UTC にAPIで書き込み済み（bindings RELAY・SUBS、Cron そのまま）。
  アプリ v504: (a) 相手が閉じている間、送信済み（中継所が受け取った）メッセージも20秒ごとに送り直して毎回中継所に保存していた → 送信済みの分は普通の間隔（15秒→…→最大10分）。(b) 25秒ごとの app-live と10秒ごとの ack 送り直しは `__noStore`（`postStore(...,noStore)` → `?cache=no`、中継所は保存せず接続中の相手へ流すだけ）。最初の受領証は従来どおり保存。
  試験 `tools/e2e/relay_load.js`（中継所への保存回数）: 2台開いて60秒 v503 保存9回 → v504 0回、相手が閉じて2通・120秒 15回 → 5回。※ 中継所の使い方を変える時は、この試験と GraphQL の rowsRead/rowsWritten を見ること。
- v505 相手が閉じた直後に送ったメッセージの通知が遅い（持ち主の確認から）。`Net.post` は相手が70秒以内に生きていた（`__zgsPeerLive`）と通知（`pushToPeer`）を送らず、後の送り直しで送っていたため、v504 で送り直しを延ばすと最大約2分遅れた。通知を送らなかった時は8秒後に受領（peerAck/acked/read）を確かめ、来ていなければ通知する（`env.__pushLater`）。開いている相手には今までどおり通知しない。
  試験 `tools/e2e/push_fast.js`: 相手が開いている時の通知0回（v504・v505とも）、閉じた直後に送って通知まで v504 61秒 → v505 8秒。push_once・send_status・relay_basic・relay_load も通過。
- v506 「通知が来ない時がある。送ったが相手にまだ転送されない。送った瞬間に切れるところは？」（持ち主）。**送った直後に送る側が画面を消す／アプリを閉じる**と、iPhone などは JS を止める。
  (1) 通知は「相手が70秒以内に生きていた」と見えると送らず、3秒後（v505 は8秒）に受領を確かめて送る作りだが、**その待ちタイマーが止まって通知が一度も出なかった**（再現: 相手が閉じた直後に送り0.5秒後に自分が画面を消す → v505 は通知0件）。
  → 待ち一覧 `pushWaitList` に入れ、`visibilitychange`(hidden)／`pagehide` で `pushWaitFlush()`（受領がまだのものを先に `pushToPeer`）。待ちは 8→3 秒。
  (2) どの通信にも `keepalive` が無く、送信中の POST が途中で切れ得た → `kaInit()`（本文が文字で60KB未満なら keepalive:true）を `relayTry`・`storeFetch` の ntfy・`psrvPush`・`pushToPeer` に。写真の大きいファイル（PUT）は対象外。
  試験 `tools/e2e/push_hide.js`（CDP の Page.setWebLifecycleState で凍結）: v505 通知0 → v506 1秒後に1件。push_fast: 閉じた直後の通知 8→3秒・開いている時は0。push_once（1通1回）・relay_basic・send_status・relay_load（中継所の保存回数は v504 と同じ）も通過。
  ※ Worker は `Urgency: high`・TTL 86400 で送信済み（Android の省電力で遅れる心配はコード側にはない）。それでも来ない時は、相手の端末の通知設定・電池の最適化・通知の登録（設定の「届け設定」）を疑う。
- v507 「メッセージが送信中のままの人がいる」（持ち主）。再現: 中継所への送信（POST）の返事が一度6秒かかる（弱い電波）→ **2分以上「送信中」のまま**。原因が重なっていた:
  (1) `relayTry` の POST は4秒で打ち切り、失敗すると `Relay.badUntil` を60秒立てて中継所を使わない（MQTT・ntfy が使えない回線では送り先が無くなる）。
  (2) `flushOutbox` は中継所が使えない間（`relayAnyBase()` が空）、まだ送れていない分の再送間隔の上限が10分で、15秒→30秒→1分と延びた。
  → POST の打ち切り 4→10秒、`badUntil` 60→10秒、まだ送れていない分の再送は最初3秒後・最大10秒ごと（送信済みの分は v504 どおり延ばす＝中継所の保存回数は増やさない）。
  試験 `tools/e2e/slow_relay.js`（最初の10秒だけ中継所の POST を6秒遅らせる）: v506 は120秒以上 → v507 は6秒で送信済み。relay_load（保存回数は v504 と同じ）・push_once・push_hide・relay_basic・send_status も通過。
  ※ 相手の中継所対応の確認（`zg_peer_relay`）が消えやすいこと（v503 の※）は今回も未対応。
- 2026-11-18 JST 09:32 に同じ Cloudflare の警告メール（rows_read 500万超過）がまた届いた（持ち主）。GraphQL で確認: 11/17(UTC) の読み出し 5,355,115・書き込み 105,033（無料の上限は読み出し500万・書き込み10万）。14:00 UTC 台から全件エラー（毎時60件前後）で、11/18 00:00 UTC の後も約30分エラーが残り、メールはその頃（00:32 UTC）。つまり **11/17 の超過（v504 の前）の通知で、新しい超過ではない**。
  v504 以降（11/18 00:00〜06:30 UTC）は読み出し約9.7万・書き込み約3.8万で正常（毎時の読み出しは数千〜6万、前は70万〜130万）。11/18 03〜06 UTC の書き込み（毎時5千〜2万）は、11/17 夜に預かった分の12時間後の掃除（削除も書き込みに数える）が中心とみられる。
  次に同じメールが来たら新しい超過。まず `durableObjectsPeriodicGroups`（`datetimeHour` ごとの rowsRead・rowsWritten）を見る。恒久策は Workers 有料プラン（月5ドル。持ち主が決める）。1通あたりの書き込みは約6（保存3＋期限切れの削除3）なので、書き込み10万 ≒ 1日1.5万通が目安。
- 2026-11-18 Cloudflare の Cron トリガー（毎分）を持ち主が削除。用途は `refreshNews` の先取りだけ（`scheduled`）。メッセージ・通知・中継所（期限切れの掃除は DO のアラーム）には関係しない。ニュースは、アプリが開いた時・60秒ごとの `?fresh=1` が来た時に取る（古い順の返し方は `handleNews`）。毎分の書き込み（DO 'news' の保存）が1日約3千行減る。`wrangler.toml` の `[triggers]` も外した（`wrangler deploy` で戻らないように）。

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
node tools/check_syntax.js index.html              # 全scriptの構文チェック（scripts N errors 0 になること）
node --check sw.js && wc -c sw.js                  # sw.js が空でないか
python3 tools/make_test.py index.html /tmp/zg      # テスト用（内部を window.__t に出す）を作る
node tools/shot_chat.js /tmp/zg                    # トーク画面の画像
bash tools/run_e2e.sh tools/e2e/relay_basic.js     # 2台の送受信テスト（中継所を手元で立てる）。ほかのテストは tools/README.md
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
