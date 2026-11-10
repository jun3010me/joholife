import type { Scenario } from '../engine/scenario.ts';
import { hasKind } from './helpers.ts';

export const phish: Scenario = {
  id: 'phish',
  title: '偽サイトにだまされない',
  desc: '登録ずみのパスキーを、そっくりな名前の偽サイトが使わせようとします。何が起こるでしょう。',
  build(w) {
    const ph = w.makeDevice('phone', ...w.pos(-1, 40), { id: 'phone-001', name: 'スマホ' });
    w.makeDevice('internet', ...w.pos(0, 40), { id: 'internet-001' });
    const real = w.makeDevice('server', ...w.pos(1, 40), { id: 'server-001', name: 'Webサイト', site: 'yamazon.com', machines: ['challenge', 'verify'] });
    w.makeDevice('server', ...w.pos(0, 'b'), { id: 'server-002', name: '偽サイト', site: 'yamazon.com.sagi', color: '#a8463c', machines: ['challenge', 'verify'] });
    w.connect('phone-001', 'internet-001', true);
    w.connect('server-001', 'internet-001', true);
    w.connect('server-002', 'internet-001', true);
    w.give(ph, { kind: 'privkey', pair: 'pk-reg', site: 'yamazon.com', owner: 'phone-001' });
    w.give(real, { kind: 'pubkey', pair: 'pk-reg', site: 'yamazon.com' }, true);
    return ['server-002'];
  },
  start: 'スマホには yamazon.com 用のパスキーが登録ずみです。偽サイト（yamazon.com.sagi）がチャレンジを送ってきます。',
  steps: [
    { text: '偽サイトのチャレンジがスマホに届く', hint: '偽サイトでチャレンジを発行して、スマホへドラッグします。',
      check: (w) => hasKind(w, 'phone-001', 'challenge', (c) => c.site === 'yamazon.com.sagi') },
    { text: 'スマホで偽サイトのチャレンジに署名してみる', hint: 'スマホの署名台に、秘密鍵と偽サイトのチャレンジを入れて「署名」。',
      check: (w) => !!w.flags.phishBlocked },
    { text: '本物のWebサイトでログインする', hint: '本物のサイトでチャレンジ発行→スマホで署名→返事を送って検証台へ。',
      check: (w) => !!w.dev('server-001')?.state.loggedIn },
  ],
  fail: () => false,
  failText: '',
  doneText: '🎉 シナリオ完了！パスキーは本物のサイトにしか反応しないので、そっくりな偽サイトでは使えません。',
};
