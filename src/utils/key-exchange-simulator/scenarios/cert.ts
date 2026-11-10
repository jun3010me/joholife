import type { Scenario } from '../engine/scenario.ts';
import { hasKind } from './helpers.ts';

export const cert: Scenario = {
  id: 'cert',
  title: 'デジタル証明書でなりすましを防ぐ',
  desc: 'ブラウザが yamazon.com を開きます。届いた公開鍵が本当に yamazon.com のものか、認証局の証明書で確かめます。',
  build(w) {
    const pc = w.makeDevice('pc', ...w.pos(-1.5, 40, 1.5), { id: 'pc-001', name: 'ブラウザ', visit: 'yamazon.com' });
    w.makeDevice('internet', ...w.pos(-0.5, 40, 1.5), { id: 'internet-001' });
    w.makeDevice('server', ...w.pos(0.5, 40, 1.5), { id: 'server-001', name: 'Webサイト', site: 'yamazon.com', machines: ['keymake'] });
    const ca = w.makeDevice('ca', ...w.pos(1.5, 'b', 1.5), { id: 'ca-001', name: '認証局' });
    const e = w.makeDevice('eve', ...w.pos(-0.5, 'b', 1.5), { id: 'eve-001', machines: [] });
    w.connect('pc-001', 'internet-001', true);
    w.connect('server-001', 'internet-001', true);
    w.connect('ca-001', 'internet-001', true);
    w.connect('eve-001', 'internet-001', true);
    w.give(ca, { kind: 'privkey', pair: 'pk-ca', site: '認証局', owner: 'ca-001' });
    w.give(pc, { kind: 'pubkey', pair: 'pk-ca', site: '認証局', root: true });
    w.give(e, { kind: 'cert', subject: 'yamazon.com', pair: 'pk-eve', issuer: 'イブ', caPair: 'pk-eve' });
    return ['server-001'];
  },
  start: 'ブラウザには、信頼できる認証局の公開鍵（ルート証明書）が最初から入っています。まずは yamazon.com が鍵ペアを作りましょう。',
  steps: [
    { text: 'yamazon.com が鍵ペアを作る', hint: 'Webサイトの「鍵ペア作成」で「作る」。',
      check: (w) => hasKind(w, 'server-001', 'privkey') },
    { text: '公開鍵を認証局に送って、証明書を申し込む', hint: 'Webサイトの公開鍵を、キャンバス上の認証局へドラッグします。',
      check: (w) => hasKind(w, 'ca-001', 'pubkey', (p) => p.site === 'yamazon.com') },
    { text: '認証局が証明書を発行して、yamazon.com に返す', hint: '認証局の「証明書発行」に公開鍵を入れて「発行」。できた証明書をWebサイトへ送ります。',
      check: (w) => hasKind(w, 'server-001', 'cert', (c) => c.subject === 'yamazon.com' && c.caPair === 'pk-ca') },
    { text: '証明書をブラウザに送り、確かめる', hint: 'Webサイトの証明書をブラウザへ送り、「証明書チェック」で「確認」。',
      check: (w) => !!w.dev('pc-001')?.state.secure },
    { text: 'イブが作った偽の証明書も、ブラウザで確かめてみる', hint: 'イブの持ち物の証明書（発行：イブ）をブラウザへ送り、確かめてみましょう。',
      check: (w) => !!w.flags.fakeCertRejected },
  ],
  fail: (w) => hasKind(w, 'eve-001', 'privkey'),
  failText: '秘密鍵がイブに渡ってしまいました。秘密鍵は送ってはいけません。',
  doneText: '🎉 シナリオ完了！「公開鍵が本当にその持ち主のものか」を、信頼できる認証局が証明書で保証しています。',
};
