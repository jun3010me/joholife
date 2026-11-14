import { PERSON_COLORS } from '../engine/constants.ts';
import type { Scenario } from '../engine/scenario.ts';
import { hasKind } from './helpers.ts';
import { SECRET_TEXT } from './sym.ts';

export const pk: Scenario = {
  id: 'pk',
  title: '公開鍵暗号方式で手紙を送る',
  desc: '閉める鍵（公開鍵）と開ける鍵（秘密鍵）が別々の暗号です。共通鍵暗号の「鍵配送問題」を解決できるか試します。',
  build(w) {
    const a = w.makeDevice('person', ...w.pos(-1, 40), { id: 'person-001', name: 'アリス', initial: 'A', color: PERSON_COLORS[0], machines: ['pkencrypt'] });
    w.makeDevice('person', ...w.pos(1, 40), { id: 'person-002', name: 'ボブ', initial: 'B', color: PERSON_COLORS[1], machines: ['keymake', 'decrypt'] });
    w.makeDevice('internet', ...w.pos(0, 40), { id: 'internet-001' });
    w.makeDevice('eve', ...w.pos(0, 'b'), { id: 'eve-001', machines: ['decrypt'] });
    w.connect('person-001', 'internet-001', true);
    w.connect('person-002', 'internet-001', true);
    w.connect('eve-001', 'internet-001', true);
    w.give(a, { kind: 'doc', text: SECRET_TEXT });
    return ['person-002'];
  },
  start: '今度は、受け取る側のボブが鍵を用意します。ボブの「鍵ペア作成」で鍵を作りましょう。',
  steps: [
    { text: 'ボブが秘密鍵と公開鍵のペアを作る', hint: 'ボブの「鍵ペア作成」で「作る」。',
      check: (w) => hasKind(w, 'person-002', 'privkey') },
    { text: 'ボブの公開鍵をアリスに送る（イブに見られてもOK）', hint: 'ボブの公開鍵をアリスへドラッグします。秘密鍵は送りません。',
      check: (w) => hasKind(w, 'person-001', 'pubkey') },
    { text: 'アリスがボブの公開鍵で手紙を暗号化する', hint: 'アリスの「公開鍵で暗号化」に、ボブの公開鍵と手紙を入れて「暗号化」。',
      check: (w) => hasKind(w, 'person-001', 'cipher', (c) => c.lock.type === 'pk') },
    { text: '暗号文をボブに送る', hint: '暗号文をボブへドラッグします。',
      check: (w) => hasKind(w, 'person-002', 'cipher') },
    { text: 'ボブが自分の秘密鍵で復号する', hint: 'ボブの「復号台」に、秘密鍵と暗号文を入れて「復号」。',
      check: (w) => !!w.flags.pkRead },
    { text: 'イブが、盗み見た公開鍵で開けられるか試す', hint: 'イブをタップし、復号台に公開鍵と暗号文を入れてみましょう。',
      check: (w) => !!w.flags.pubDecFail },
  ],
  fail: (w) => hasKind(w, 'eve-001', 'privkey'),
  failText: 'ボブの秘密鍵が通信路に流れて、イブに渡ってしまいました。秘密鍵は自分の手元から出してはいけません。',
  doneText: '🎉 シナリオ完了！公開鍵は配っても大丈夫で、開けられるのは秘密鍵を持つボブだけ。ただ処理が重いので、実際は共通鍵と組み合わせて使います。次は、盗み見されても共通鍵を作れる「ディフィー・ヘルマン鍵交換」へ。',
};
