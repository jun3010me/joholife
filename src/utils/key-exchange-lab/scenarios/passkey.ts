import type { Scenario } from '../engine/scenario.ts';
import { hasKind } from './helpers.ts';

export const passkey: Scenario = {
  id: 'passkey',
  title: 'パスキーで登録してログイン',
  desc: 'スマホの中で作った秘密鍵を一度も外に出さずに、Webサイトに登録してログインします。',
  build(w) {
    w.makeDevice('phone', ...w.pos(-1, 40), { id: 'phone-001', name: 'スマホ' });
    w.makeDevice('internet', ...w.pos(0, 40), { id: 'internet-001' });
    w.makeDevice('server', ...w.pos(1, 40), { id: 'server-001', name: 'Webサイト', site: 'yamazon.com', machines: ['challenge', 'verify'] });
    w.makeDevice('eve', ...w.pos(0, 'b'), { id: 'eve-001', machines: [] });
    w.connect('phone-001', 'internet-001', true);
    w.connect('server-001', 'internet-001', true);
    w.connect('eve-001', 'internet-001', true);
    return ['server-001'];
  },
  start: 'Webサイトの吹き出しで、まずは登録用のチャレンジを発行しましょう。',
  steps: [
    { text: 'Webサイトでチャレンジを発行する', hint: 'Webサイトの「チャレンジ発行」で「発行」を押します。',
      check: (w) => (w.dev('server-001')?.state.issued.length ?? 0) > 0 },
    { text: 'チャレンジをスマホに届ける', hint: 'できたチャレンジを、キャンバス上のスマホへドラッグします。',
      check: (w) => hasKind(w, 'phone-001', 'challenge') },
    { text: 'スマホの中で、サイト専用の鍵ペアを作る', hint: 'スマホをタップし、チャレンジを「鍵ペア生成」に入れます。',
      check: (w) => hasKind(w, 'phone-001', 'privkey') },
    { text: '公開鍵だけをWebサイトに送って登録する', hint: 'スマホの「公開鍵」をWebサイトへ。秘密鍵は送りません。',
      check: (w) => hasKind(w, 'server-001', 'pubkey') },
    { text: '新しいチャレンジに、スマホで署名する', hint: 'もう一度チャレンジを発行してスマホに送り、秘密鍵と一緒に署名台へ。',
      check: (w) => hasKind(w, 'phone-001', 'sig') },
    { text: '返事をWebサイトに送り、検証台で確かめる', hint: '署名つき返事をWebサイトへ送り、公開鍵と一緒に検証台へ。',
      check: (w) => !!w.dev('server-001')?.state.loggedIn },
  ],
  fail: (w) => hasKind(w, 'eve-001', 'privkey'),
  failText: '秘密鍵が通信路に流れて、イブに渡ってしまいました。パスキーの秘密鍵はスマホから出してはいけません。',
  doneText: '🎉 シナリオ完了！イブは通信をすべて見ていましたが、秘密鍵がないので署名を作れません。',
};
