# 確認用の道具（tools/）

アプリ本体には含まれません（公開するのは index.html・sw.js・manifest・アイコンだけ）。
必要なもの: node、python3、playwright（chromium）。中継所のテストは wrangler（初回に `tools/deps` へ自動で入る）。

## いつも使うもの
```
node tools/check_syntax.js index.html          # 全 script の構文チェック（scripts N errors 0）
node --check sw.js && wc -c sw.js              # sw.js が空でないか
python3 tools/make_test.py index.html /tmp/zg  # テスト用の index.html（内部を window.__t に出す）を作る
node tools/shot_chat.js /tmp/zg                # トーク画面の画像（k_chat.png など）を作る（1台・通信なし）
```

## 2台の送受信テスト（中継所つき）
`bash tools/run_e2e.sh tools/e2e/<名前>.js`

| ファイル | 何を確かめるか |
|---|---|
| e2e/relay_basic.js | 中継所で往復・偽メッセージを捨てる・写真・閉じている間の受信・あいず一致 |
| e2e/send_status.js | 表示（既読・未読・送信済み）／受け取り線が切れた後／相手が閉じている間→開くと届く |
| e2e/big_photo.js | 縦長スクショがきれいなまま全体で届く（v485） |
| e2e/photo_2000.js | 写真が長辺2000で全体が届く（スクショ・重いカメラ写真）（v496） |
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
| e2e/save_warning.js | 保存の一時的な失敗では警告を出さない（v489） |

## 1台だけのテスト（中継所なし）
`python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/<名前>.js /tmp/zg`

| ファイル | 何を確かめるか |
|---|---|
| e2e/keyboard_bottom.js | キーボードが出ても最後のメッセージが見える（v487） |
| e2e/send_bottom.js | 送ったら一番下を表示（v490） |
| e2e/access_log.js | 相手のアクセス履歴の画面（plog.png）（v483） |
| e2e/photo_viewer.js | 受け取った写真をタップ→全画面で出て「高画質を読み込んでいます」が残らない（v495） |
| e2e/news_fetch.js | 開いたらすぐニュースを1回取る（v484） |

## その他
- `kanji_convert.py` … v486 で画面の文言を漢字かな交じりにした変換（クイズの範囲は除く）。新しい文言は最初から普通の文章で書けばよいので、ふだんは使わない。
- テストのしくみ: `chromium --host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1`、
  `--disable-features=LocalNetworkAccessChecks,...`、ntfy.sh・MQTT はルートでふさぐ。プロキシ環境では `env -u HTTPS_PROXY ...` で動かす（run_e2e.sh がやる）。
- 本物のスマホ2台での確認（通知・電話の音・キーボード）は、ここではできない。持ち主に確かめてもらう。
