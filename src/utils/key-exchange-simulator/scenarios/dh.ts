import { PERSON_COLORS } from '../engine/constants.ts';
import type { Scenario } from '../engine/scenario.ts';
import { hasBlock } from './helpers.ts';

export const DH_FINAL = ['P', 'S:person-001', 'S:person-002'];

export const dh: Scenario = {
  id: 'dh',
  title: 'ディフィー・ヘルマン鍵交換',
  desc: '盗み見されている通信路を使って、アリスとボブだけが同じ「共有鍵」を作れるか試します。',
  build(w) {
    const a = w.makeDevice('person', ...w.pos(-1, 40), { id: 'person-001', name: 'アリス', initial: 'A', color: PERSON_COLORS[0], machines: ['combine'] });
    const b = w.makeDevice('person', ...w.pos(1, 40), { id: 'person-002', name: 'ボブ', initial: 'B', color: PERSON_COLORS[1], machines: ['combine'] });
    w.makeDevice('internet', ...w.pos(0, 40), { id: 'internet-001' });
    w.makeDevice('eve', ...w.pos(0, 'b'), { id: 'eve-001', machines: ['combine'] });
    w.connect('person-001', 'internet-001', true);
    w.connect('person-002', 'internet-001', true);
    w.connect('eve-001', 'internet-001', true);
    w.give(a, { kind: 'block', parts: ['P'] });
    w.give(a, { kind: 'block', parts: ['S:person-001'] });
    w.give(b, { kind: 'block', parts: ['S:person-002'] });
    return ['person-001'];
  },
  start: '人物をタップすると、その場で持ち物と作業台が開きます。まずはアリスのPをボブに届けましょう。',
  steps: [
    { text: 'ボブにも公開鍵Pを届ける', hint: 'アリスの持ち物の「P」を、キャンバス上のボブへドラッグします。',
      check: (w) => hasBlock(w, 'person-002', ['P']) },
    { text: '2人とも「P＋自分の秘密鍵」を合成する', hint: 'それぞれの作業台にPと自分の秘密鍵を入れて「合成」。',
      check: (w) => hasBlock(w, 'person-001', ['P', 'S:person-001']) && hasBlock(w, 'person-002', ['P', 'S:person-002']) },
    { text: '合成した鍵を、インターネットで交換する', hint: '合成した鍵を、相手（または相手の持ち物欄）へドラッグします。',
      check: (w) => hasBlock(w, 'person-001', ['P', 'S:person-002']) && hasBlock(w, 'person-002', ['P', 'S:person-001']) },
    { text: '届いた鍵に自分の秘密鍵を合成する', hint: '「受信」マークの鍵と、自分の秘密鍵を作業台へ。',
      check: (w) => hasBlock(w, 'person-001', DH_FINAL) && hasBlock(w, 'person-002', DH_FINAL) },
    { text: 'イブの作業台で、同じものが作れないことを確かめる', hint: 'イブをタップし、盗み見た鍵どうしを作業台に入れてみましょう。',
      check: (w) => !!w.flags.eveTried },
  ],
  fail: (w) => hasBlock(w, 'eve-001', DH_FINAL),
  failText: 'イブにも共有鍵を作られてしまいました。秘密鍵か共有鍵そのものが通信路に流れたのが原因です。',
  doneText: '🎉 シナリオ完了！共有鍵は一度も通信路を通らず、イブは同じものを作れませんでした。',
};
