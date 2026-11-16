# とー君ニュース（旧 雑学王 / zatsugakuou）引き継ぎメモ  ― 現在 v483

## これは何か
見た目は「とー君ニュース」（ニュースアプリ。v460 までは「雑学クイズ」アプリ）。中身は **2人専用の暗号化チャット**（メッセージ・写真・ライブ映像・電話）。
トップを5回タップすると裏メニュー → 部屋づくり／トークに入る。**この隠し入口は絶対に壊さない。**
持ち主は日本語話者。画面の文言は、ひらがな多め・単語の間にスペース（例:「あいてを まっています」）の文体に合わせる。

## ファイル構成（すべて同じフォルダに置く／静的ホスティング）
- `index.html`  本体。1ファイル（約8.6MB）。大半は埋め込み画像(base64)。コードは約1.5MB・約1.3万行。
- `sw.js`  通知用 Service Worker。本文は復号しない（暗号文だけIndexedDB `zg-sw-inbox/pin` に保存）。互換契約なので形式を変えない。
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`  PWA用（v461 から とー君のアイコン）。
- `tools/` 確認用の道具（下記）。※このリポジトリにはまだ入っていない（持ち主の手元のみ）。
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
