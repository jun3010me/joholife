import { PERSON_COLORS } from '../engine/constants.ts';
import type { Scenario } from '../engine/scenario.ts';
import { hasKind } from './helpers.ts';

/** 共通鍵・公開鍵のシナリオで送る手紙 */
export const SECRET_TEXT = 'あしたの集合は9:30、駅の改札前';

export const sym: Scenario = {
  id: 'sym',
  title: '共通鍵暗号方式で手紙を送る',
  desc: '同じ「共通鍵」で閉めて開ける暗号です。盗み見されている通信路で、アリスがボブに秘密の手紙を送ってみます。',
  build(w) {
    const a = w.makeDevice('person', ...w.pos(-1, 40), { id: 'person-001', name: 'アリス', initial: 'A', color: PERSON_COLORS[0], machines: ['encrypt'] });
    w.makeDevice('person', ...w.pos(1, 40), { id: 'person-002', name: 'ボブ', initial: 'B', color: PERSON_COLORS[1], machines: ['decrypt'] });
    w.makeDevice('internet', ...w.pos(0, 40), { id: 'internet-001' });
    w.makeDevice('eve', ...w.pos(0, 'b'), { id: 'eve-001', machines: ['decrypt'] });
    w.connect('person-001', 'internet-001', true);
    w.connect('person-002', 'internet-001', true);
    w.connect('eve-001', 'internet-001', true);
    w.give(a, { kind: 'symkey', kid: 'K1' });
    w.give(a, { kind: 'doc', text: SECRET_TEXT });
    return ['person-001'];
  },
  start: '人物をタップすると、その場で持ち物と装置が開きます。アリスは共通鍵と手紙を持っています。まずは手紙を暗号化しましょう。',
  steps: [
    { text: 'アリスが共通鍵で手紙を暗号化する', hint: 'アリスの「暗号化台」に、共通鍵と手紙を入れて「暗号化」。',
      check: (w) => hasKind(w, 'person-001', 'cipher', (c) => c.lock.type === 'sym') },
    { text: '暗号文をボブに送る（イブにもコピーされる）', hint: '暗号文をボブへドラッグします。イブをタップすると、暗号文は届いていても鍵がないので開けられないことがわかります。',
      check: (w) => hasKind(w, 'person-002', 'cipher') },
    { text: 'ボブに共通鍵を届ける', hint: 'ボブは鍵を持っていないので開けられません。アリスの共通鍵をボブへドラッグします。',
      check: (w) => hasKind(w, 'person-002', 'symkey') },
    { text: 'ボブが共通鍵で暗号文を復号する', hint: 'ボブの「復号台」に、共通鍵と暗号文を入れて「復号」。',
      check: (w) => !!w.flags.symRead },
    { text: 'イブも、盗み見た共通鍵で復号できるか試す', hint: 'イブをタップし、復号台に共通鍵と暗号文を入れてみましょう。',
      check: (w) => !!w.flags.symEveRead },
  ],
  fail: () => false,
  failText: '',
  doneText: '🎉 シナリオ完了！共通鍵暗号は、同じ鍵で閉めて開ける仕組み。でも、その鍵を安全に届ける方法がありません（鍵配送問題）。次は「公開鍵暗号方式」へ。',
};
