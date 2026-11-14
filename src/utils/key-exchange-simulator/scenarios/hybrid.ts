import type { Scenario } from '../engine/scenario.ts';
import { hasKind } from './helpers.ts';

/** ブラウザからWebサイトへ送る注文 */
export const ORDER_TEXT = '注文：ノート3冊／カード番号 ****-1234';
const PC = 'pc-001', SITE = 'server-001', EVE = 'eve-001';

export const hybrid: Scenario = {
  id: 'hybrid',
  title: 'SSL/TLSで安全に注文する（ハイブリッド暗号方式）',
  desc: '公開鍵暗号で共通鍵を届け、あとは共通鍵暗号でやりとりする「ハイブリッド暗号方式」です。Webサイトの通信を守るSSL/TLSの基本の流れを体験します。',
  build(w) {
    const pc = w.makeDevice('pc', ...w.pos(-1, 40), { id: PC, name: 'ブラウザ', visit: 'yamazon.com', machines: ['symmake', 'pkencrypt', 'encrypt'] });
    w.makeDevice('internet', ...w.pos(0, 40), { id: 'internet-001' });
    const sv = w.makeDevice('server', ...w.pos(1, 40), { id: SITE, name: 'Webサイト', site: 'yamazon.com', machines: ['decrypt'] });
    w.makeDevice('eve', ...w.pos(0, 'b'), { id: EVE, machines: ['decrypt'] });
    w.connect(PC, 'internet-001', true);
    w.connect(SITE, 'internet-001', true);
    w.connect(EVE, 'internet-001', true);
    w.give(sv, { kind: 'privkey', pair: 'pk-site', site: 'yamazon.com', owner: SITE });
    w.give(sv, { kind: 'pubkey', pair: 'pk-site', site: 'yamazon.com' });
    w.give(pc, { kind: 'doc', text: ORDER_TEXT });
    return [SITE];
  },
  start: 'yamazon.com は、自分の秘密鍵と公開鍵を持っています。まずは公開鍵をブラウザに送りましょう。',
  steps: [
    { text: 'Webサイトの公開鍵をブラウザに送る', hint: 'Webサイトの「公開鍵」をブラウザへドラッグします。秘密鍵は送りません。',
      check: (w) => hasKind(w, PC, 'pubkey') },
    { text: 'ブラウザが共通鍵（セッション鍵）を作る', hint: 'ブラウザをタップし、「共通鍵を作る」で「作る」。',
      check: (w) => hasKind(w, PC, 'symkey') },
    { text: '共通鍵を公開鍵で暗号化して、Webサイトに送る', hint: 'ブラウザの「公開鍵で暗号化」に、公開鍵と共通鍵を入れて「暗号化」。できたものをWebサイトへ送ります。',
      check: (w) => hasKind(w, SITE, 'cipher', (c) => !!c.key) },
    { text: 'Webサイトが秘密鍵で復号して、共通鍵を取り出す', hint: 'Webサイトの「復号台」に、秘密鍵と暗号化された共通鍵を入れて「復号」。',
      check: (w) => hasKind(w, SITE, 'symkey') },
    { text: 'ブラウザが注文を共通鍵で暗号化して、Webサイトに送る', hint: 'ブラウザの「暗号化（共通鍵）」に、共通鍵と注文を入れて「暗号化」。できた暗号文をWebサイトへ送ります。',
      check: (w) => hasKind(w, SITE, 'cipher', (c) => c.lock.type === 'sym') },
    { text: 'Webサイトが共通鍵で復号して、注文を読む', hint: 'Webサイトの「復号台」に、共通鍵と注文の暗号文を入れて「復号」。',
      check: (w) => hasKind(w, SITE, 'doc', (d) => d.text === ORDER_TEXT) },
    { text: 'イブが、盗み見た公開鍵で共通鍵を取り出せるか試す', hint: 'イブをタップし、復号台に公開鍵と暗号化された共通鍵を入れてみましょう。',
      check: (w) => !!w.flags.pubDecFail },
  ],
  // 秘密鍵・共通鍵・注文そのものがイブに渡ったら失敗
  fail: (w) => hasKind(w, EVE, 'privkey') || hasKind(w, EVE, 'symkey') || hasKind(w, EVE, 'doc', (d) => d.text === ORDER_TEXT),
  failText: '秘密鍵・共通鍵・注文のどれかが、そのままの形で通信路に流れて、イブに渡ってしまいました。送るものは必ず暗号化しましょう。',
  doneText: '🎉 シナリオ完了！公開鍵暗号で共通鍵だけを安全に届け、あとは速い共通鍵暗号でやりとりする。これが「ハイブリッド暗号方式」で、SSL/TLSの基本の形です。次は、鍵を送らずに共通鍵を作る「ディフィー・ヘルマン鍵交換」へ。',
};
