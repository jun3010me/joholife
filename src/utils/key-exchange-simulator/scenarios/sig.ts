import { PERSON_COLORS } from '../engine/constants.ts';
import { hash } from '../engine/items.ts';
import type { Scenario } from '../engine/scenario.ts';
import { hasKind } from './helpers.ts';

export const DOC_TEXT = 'ボブに1,000円払います';

export const sig: Scenario = {
  id: 'sig',
  title: 'デジタル署名で改ざんを見破る',
  desc: 'アリスがボブに送る文書を、間に入ったイブが書き換えます。署名があれば、ボブは見破れるでしょうか。',
  build(w) {
    const a = w.makeDevice('person', ...w.pos(-1, 40), { id: 'person-001', name: 'アリス', initial: 'A', color: PERSON_COLORS[0], machines: ['docsign'] });
    const b = w.makeDevice('person', ...w.pos(1, 40), { id: 'person-002', name: 'ボブ', initial: 'B', color: PERSON_COLORS[1], machines: ['docverify'] });
    w.makeDevice('internet', ...w.pos(0, 40), { id: 'internet-001' });
    w.makeDevice('eve', ...w.pos(0, 'b'), { id: 'eve-001', mitm: true, machines: ['tamper'] });
    w.connect('person-001', 'internet-001', true);
    w.connect('person-002', 'internet-001', true);
    w.connect('eve-001', 'internet-001', true);
    w.give(a, { kind: 'privkey', pair: 'pk-alice', site: 'アリス', owner: 'person-001' });
    w.give(a, { kind: 'pubkey', pair: 'pk-alice', site: 'アリス' });
    w.give(a, { kind: 'doc', text: DOC_TEXT });
    w.give(b, { kind: 'pubkey', pair: 'pk-alice', site: 'アリス' }, true);
    return ['person-001'];
  },
  start: 'ボブは、前もってアリスの公開鍵を受け取っています。まずはアリスが文書に署名しましょう。',
  steps: [
    { text: 'アリスが自分の秘密鍵で文書に署名する', hint: 'アリスの「文書に署名」に、秘密鍵と文書を入れて「署名」。',
      check: (w) => hasKind(w, 'person-001', 'doc', (d) => !!d.sig) },
    { text: '署名した文書をボブに送る（イブが横取りする）', hint: '署名つきの文書をボブへドラッグします。間にいるイブに横取りされます。',
      check: (w) => hasKind(w, 'eve-001', 'doc', (d) => !!d.sig) },
    { text: 'イブが文書を書き換えて、ボブに送る', hint: 'イブをタップし、書き換え台に文書を入れて「書き換え」。できた文書をボブへ送ります。',
      check: (w) => hasKind(w, 'person-002', 'doc', (d) => !!d.sig && hash(d.text) !== d.sig.h) },
    { text: 'ボブがアリスの公開鍵で確かめ、改ざんを見破る', hint: 'ボブの「署名を確かめる」に、アリスの公開鍵と届いた文書を入れて「確認」。',
      check: (w) => !!w.flags.tamperDetected },
    { text: '書き換えられていない文書なら、本物と確認できることも確かめる', hint: 'イブの持ち物にある元の文書をそのままボブへ送り、もう一度確かめます。',
      check: (w) => !!w.flags.docVerified },
  ],
  fail: (w) => hasKind(w, 'eve-001', 'privkey'),
  failText: 'アリスの秘密鍵がイブに渡ってしまいました。これではイブがアリスになりすまして署名できます。',
  doneText: '🎉 シナリオ完了！署名があれば「だれが書いたか」と「書き換えられていないか」を確かめられます。',
};
