# 確認用の道具（tools/）

アプリ本体には含まれません（公開するのは index.html・sw.js・manifest・アイコンだけ）。
必要なもの: node、python3、playwright（chromium）。中継所のテストは wrangler（初回に `tools/deps` へ自動で入る）。

## いつも使うもの
```
node tools/check_syntax.js index.html          # 全 script の構文チェック（scripts N errors 0）
node --check sw.js && wc -c sw.js              # sw.js が空でないか
python3 tools/make_test.py index.html /tmp/zg  # テスト用の index.html（内部を window.__t に出す）を作る
node tools/shot_chat.js /tmp/zg                # トーク画面の画像（k_chat.png など）を作る（1台・通信なし）
node tools/sw_badge_test.mjs                   # sw.js の通知の小さいアイコン（ニュース＝新聞・相手が開いた＝目）（v512）
```

## 2台の送受信テスト（中継所つき）
`bash tools/run_e2e.sh tools/e2e/<名前>.js`

| ファイル | 何を確かめるか |
|---|---|
| e2e/delivery_stress.js | **届くかの総点検**: 同時連続・相手が閉じている・相手が画面を消している・送ってすぐ画面を消す・不安定な回線・中継所が15秒止まる、の6場面で約60通。全部1回ずつ順番どおり届き、送った側も受領済みか（2026-11-18: 2回とも OK） |
| e2e/store_by_type.js | 中継所に「保存」される送信を種類ごとに数える（書き込み上限の調査用）。`IDLE_MIN=4`、相手だけ古い版で試す時は `DIR_B=<make_test.pyで作ったフォルダ>`、B の画面を N 秒ごとに消す・つける時は `FLIP_SEC=15` |
| e2e/recall_loop.js | 消えたメッセージの合図（recall）を、届いた後も画面を開くたびに送り直していないか（v508 の書き込み上限の原因）。`HIST=160 IDLE_MIN=4`、開き直しで試す時は `RELOAD=1` |
| e2e/real_use.js | **本物のスマホに近い回線**（にせ ntfy・にせ MQTT がつながった状態）で、ふつうに使った時の中継所への保存回数を種類ごとに数える。`HIST=150`（消えた記録）、`DIR_A`/`DIR_B` で版を変えられる（v507 1時間約1,000回 → v508 置く・画面の切替で0回） |
| e2e/long_use.js | **長い使い方（約35分）**で、場面ごと（会話・写真・相手が閉じている・放置・消える・夜）の中継所への保存回数を数える。にせ ntfy・MQTT つき。`PHASE_MIN=8`（v508 46回 → v509 35回） |
| fake_net.js | 試験用の にせ ntfy.sh（127.0.0.2:443）と にせ公開MQTT（127.0.0.3:8884/8084）。real_use.js が自分で立てる |
| e2e/purge_loop.js | 既読から15分で消えた後（時計を16分進める）、purge・recall の保存が止まるか（v508） |
| e2e/relay_basic.js | 中継所で往復・偽メッセージを捨てる・写真・閉じている間の受信・あいず一致 |
| e2e/send_status.js | 表示（既読・未読・送信済み）／受け取り線が切れた後／相手が閉じている間→開くと届く |
| e2e/big_photo.js | 縦長スクショがきれいなまま全体で届く（v485） |
| e2e/photo_2000.js | 写真が長辺2000で全体が届く（スクショ・重いカメラ写真）（v496） |
| e2e/photo_unconfirmed.js | 相手の中継所の確認が消えていても写真が長辺2000で届く（v503） |
| e2e/no_flicker.js | 相手が閉じている間に画面の作り直しが起きない（v480） |
| e2e/call_log.js | 電話の記録（通話時間・拒否・キャンセル・不在着信、開き直しても残る）（v491） |
| e2e/call_no_stale_ring.js | 閉じていた間の電話が、あとで開いた時に鳴らない |
| e2e/push_once.js | 相手が閉じている間、送り直しが続いても通知は1通につき1回（v493） |
| e2e/vanish_unseen.js | 見ていないメッセージは消えない・見てから15分で消える（v494） |
| e2e/inbox_clean.js | 戻ってきた自分の暗号文が受信箱にたまらない（v497） |
| e2e/typing_prof.js | 測定用: 文字入力中の長い処理と、CPUを使った関数（THR・NPH で条件を変える） |
| e2e/newline_keep.js | 改行・空行・行頭の空白が入力どおりに両方の画面に出る（v498） |
| e2e/tokun_sync.js | とー君の設定（現れる・間隔・拡大）が2台でそろう（v499） |
| e2e/tokun_msg_sync.js | とー君と一緒に出るメッセージが2台でそろう（v500） |
| e2e/relay_load.js | 中継所への保存回数を数える（Durable Objects の上限対策、v504） |
| e2e/push_fast.js | 相手が開いている時は通知なし・閉じた直後に送っても数秒で通知（v505） |
| e2e/push_hide.js | 相手が閉じた直後に送り、すぐ送る側が画面を消しても通知が出る（v506） |
| e2e/slow_relay.js | 中継所の返事が一度遅れても、送信中のまま長く止まらない（v507） |
| e2e/latency.js | 送信ボタンから相手の画面に出るまでの時間（`NET_DELAY_MS=150` で回線の遅れを足せる）。2026-11-18: 遅れ0で中央値42ms、150ms足すと片道約175ms・逆向き約345ms |
| e2e/save_warning.js | 保存の一時的な失敗では警告を出さない（v489） |

## 1台だけのテスト（中継所なし）
`python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/<名前>.js /tmp/zg`

| ファイル | 何を確かめるか |
|---|---|
| e2e/keyboard_bottom.js | キーボードが出ても最後のメッセージが見える（v487） |
| e2e/send_bottom.js | 送ったら一番下を表示（v490） |
| e2e/access_log.js | 相手のアクセス履歴の画面（plog.png）（v483） |
| e2e/photo_viewer.js | 受け取った写真をタップ→全画面で出て「高画質を読み込んでいます」が残らない（v495） |
| e2e/camera_res.js | アプリ内カメラで大きく撮れる（偽カメラ、v501） |
| e2e/photo_frame.js | 写真と吹き出しがぴったり・もう一度送るボタン・文字の吹き出しは崩れない（v502） |
| e2e/news_fetch.js | 開いたらすぐニュースを1回取る（v484） |
| e2e/camera_takephoto.js | 外カメラは偽の takePhoto でカメラ本来の画素数で撮れる／向きが違う・返らない・インカメラは映像の1コマ（v511） |
| e2e/bubble_width.js | 入力欄と吹き出し（送った・受け取った）の改行が同じか。幅 360〜430、相手の列数が小さい時はそちらに合わせる（v512） |
| e2e/privacy_shield.js | 画面を離れる瞬間に覆う・裏に回るとその場でトップ・戻ってもトークが出ない・電話中は移さない・5回タップで入れる（v512） |
| e2e/voice_input.js | 音声入力: 入力欄の右端（送信の横）のマイク、話した言葉＋内容に合う絵文字が入る、続きに足す、音声認識が無い端末・不許可の案内、設定で絵文字オフ、絵文字の表（偽の音声認識）（v513） |
| e2e/access_late.js | アクセス履歴: 遅れて届いた合図を本当の時刻で記録・「接続が切れました」を付けない・通知サーバー経由と2件にしない（v512） |
| e2e/cols_sync.js | 1行の文字数（列数）が2台でそろう（幅412と360 → 両方15列、入力欄も15列）（v512） |
| e2e/story.js | ストーリー: 写真＋文字・スタンプが届く・輪っか・既読・いいね・返信・4.5MBを分けて送る・本物の動画の再生・削除・閉じている間の投稿・24時間で消える（v515） |
| e2e/story_block.js | 15MBの動画（ストーリー）を受け取っている最中のメッセージがすぐ届くか（中身の受け取りを2秒遅らせる）（v516） |
| e2e/photo_block.js | 重い写真3枚を受け取っている最中のメッセージ（v516） |

## Worker の試験（ネットなし）
`node tools/worker_quote_test.mjs` … 日経平均・ドル円の前日比（Yahoo・stooq は作り物の応答）。

## その他
- `kanji_convert.py` … v486 で画面の文言を漢字かな交じりにした変換（クイズの範囲は除く）。新しい文言は最初から普通の文章で書けばよいので、ふだんは使わない。
- テストのしくみ: `chromium --host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1`、
  `--disable-features=LocalNetworkAccessChecks,...`、ntfy.sh・MQTT はルートでふさぐ。プロキシ環境では `env -u HTTPS_PROXY ...` で動かす（run_e2e.sh がやる）。
- 本物のスマホ2台での確認（通知・電話の音・キーボード）は、ここではできない。持ち主に確かめてもらう。
