#!/usr/bin/env python3
"""テスト用の index.html を作る（本体は変えない）。
使い方: python3 tools/make_test.py index.html <出力フォルダ>
  出力フォルダに index.html（内部の関数を window.__t に出したもの）と sw.js を置く。
"""
import sys, os, shutil
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
NAMES = ['S','Net','Relay','Fast','FastH','FastE','renderChat','setTab','show','queueChat','relaySendBase','relayHas','relayAnyBase',
 'privateReady','privateScope','outSave','flushOutbox','newChatId','sasLabel','psrvRaw','metaText','sendPhoto',
 'chatSaveNow','maybeSendRead','chatOnScreen','drainInbox','consumeInbox','privateReady','vanishSweep','callLogAdd','Caster','News','appNav','plogAdd','peerChatOpen','plogNoteMsg','plogMarkRead','unseal',
 'deletionRemember','deletionLoad','syncDeletions','purgeSend','purgePending']
inject = 'window.__t={};' + ''.join("try{window.__t.%s=%s;}catch(e){}" % (n, n) for n in NAMES)
s = open(src, encoding='utf-8').read()
key = 'window.DOG_STK=DOG_STK;'
assert key in s, 'window.DOG_STK=DOG_STK; が見つかりません'
s = s.replace(key, key + ' ' + inject, 1)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(s)
sw = os.path.join(os.path.dirname(os.path.abspath(src)), 'sw.js')
if os.path.exists(sw): shutil.copy(sw, os.path.join(out, 'sw.js'))
print('ok ->', out)
