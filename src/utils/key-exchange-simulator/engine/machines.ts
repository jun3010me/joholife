import { hash } from './items.ts';
import type { Device, Flags, Item, ItemData, LogAction, MachineId, Result } from './types.ts';

export interface MachineDef {
  title: string;
  slots: number;
  accept?: (i: Item) => boolean;
  btn: string;
  hint: string;
}

export const MACH: Record<MachineId, MachineDef> = {
  combine: { title: '作業台', slots: 2, accept: (i) => i.kind === 'block', btn: '合成',
    hint: '鍵を2本入れると、持ち手の中身を合わせた新しい鍵ができます。分解はできません。' },
  keygen: { title: '鍵ペア生成', slots: 1, accept: (i) => i.kind === 'challenge', btn: '作る',
    hint: 'チャレンジを入れると、そのサイト専用の秘密鍵と公開鍵ができます。' },
  sign: { title: '署名台', slots: 2, accept: (i) => i.kind === 'privkey' || i.kind === 'challenge', btn: '署名',
    hint: '秘密鍵とチャレンジで、署名つきの返事を作ります。' },
  challenge: { title: 'チャレンジ発行', slots: 0, btn: '発行',
    hint: '毎回ちがうランダムな問題を作ります。' },
  verify: { title: '検証台', slots: 2, accept: (i) => i.kind === 'pubkey' || i.kind === 'sig', btn: '確認',
    hint: '公開鍵で、返事が本物かを確かめます。' },
  keymake: { title: '鍵ペア作成', slots: 0, btn: '作る',
    hint: '自分専用の秘密鍵と公開鍵を作ります。' },
  docsign: { title: '文書に署名', slots: 2, accept: (i) => i.kind === 'privkey' || i.kind === 'doc', btn: '署名',
    hint: '自分の秘密鍵で文書に署名します。署名は文書の中身と結びつきます。' },
  docverify: { title: '署名を確かめる', slots: 2, accept: (i) => i.kind === 'pubkey' || i.kind === 'doc', btn: '確認',
    hint: '書いた人の公開鍵で、署名と中身が合っているかを確かめます。' },
  tamper: { title: '書き換え台', slots: 1, accept: (i) => i.kind === 'doc', btn: '書き換え',
    hint: '横取りした文書の中身を書き換えます。' },
  issue: { title: '証明書発行', slots: 1, accept: (i) => i.kind === 'pubkey', btn: '発行',
    hint: '届いた公開鍵が本当にその持ち主のものか確認して、認証局の署名つき証明書を作ります。' },
  certcheck: { title: '証明書チェック', slots: 1, accept: (i) => i.kind === 'cert', btn: '確認',
    hint: '内蔵のルート証明書（認証局の公開鍵）で、証明書が本物かを確かめます。' },
};

export const TAMPER_DEFAULT = 'イブに10,000円払います';

/** 装置の実行に必要な、世界（KeyLab）側の機能 */
export interface MachineCtx {
  flags: Flags;
  rng: () => number;
  seq: () => number;
  give(d: Device, data: ItemData, recv?: boolean): Item;
  log(action: LogAction, detail: Record<string, unknown>): void;
  label(i: ItemData): string;
}

const res = (text: string, tone: Result['tone'], cleared = false): Result => ({ text, tone, cleared });

/** 装置を動かす。items はスロットに入っている持ち物（実体） */
export function executeMachine(
  ctx: MachineCtx, d: Device, m: MachineId, items: Item[], opts: { tamperText?: string } = {},
): Result {
  const def = MACH[m];
  if (items.length < def.slots) return res(`${def.title}に入れるものが足りません。`, 'warn');

  switch (m) {
    case 'combine': {
      const parts = [...(items[0] as Extract<Item, { kind: 'block' }>).parts, ...(items[1] as Extract<Item, { kind: 'block' }>).parts].sort();
      const it = ctx.give(d, { kind: 'block', parts }, false);
      ctx.log('combine', { device: d.id, result: parts });
      const pc = parts.filter((p) => p === 'P').length;
      const sec = new Set(parts.filter((p) => p !== 'P'));
      if (d.type === 'eve' && pc >= 2 && sec.size >= 2) {
        ctx.flags.eveTried = true;
        return res(`惜しい！${d.name}が作れたのは「${ctx.label(it)}」。Pが${pc}つ入った別物で、2人の共有鍵（Pは1つ）とは一致しません。`, 'warn', true);
      }
      return res(`${d.name}が作業台で「${ctx.label(it)}」を作りました。`, 'ok', true);
    }
    case 'challenge': {
      const nonce = Math.floor(ctx.rng() * 0x10000).toString(16).toUpperCase().padStart(4, '0');
      const cid = 'ch-' + ctx.seq();
      d.state.issued.push(cid);
      ctx.give(d, { kind: 'challenge', cid, nonce, site: d.config.site ?? '', issuer: d.id }, false);
      ctx.log('challenge', { device: d.id, cid, site: d.config.site });
      return res(`${d.name}（${d.config.site}）がチャレンジ #${nonce} を発行しました。`, 'ok');
    }
    case 'keygen': {
      const c = items[0];
      if (c.kind !== 'challenge') return res('チャレンジを入れてください。', 'warn');
      if (c.used) return res('このチャレンジはもう使いました。サイトから新しいチャレンジをもらいましょう。', 'warn');
      const pair = 'pk-' + ctx.seq();
      ctx.give(d, { kind: 'privkey', pair, site: c.site, owner: d.id }, false);
      ctx.give(d, { kind: 'pubkey', pair, site: c.site }, false);
      c.used = true;
      ctx.log('keygen', { device: d.id, pair, site: c.site });
      return res(`${d.name}の中で「${c.site}」専用の秘密鍵と公開鍵ができました。秘密鍵はこの中から出しません。`, 'ok', true);
    }
    case 'sign': {
      const k = items.find((i) => i.kind === 'privkey');
      const c = items.find((i) => i.kind === 'challenge');
      if (!k || !c || k.kind !== 'privkey' || c.kind !== 'challenge') return res('署名台には、秘密鍵とチャレンジを1つずつ入れます。', 'warn');
      if (k.site !== c.site) {
        ctx.flags.phishBlocked = true;
        ctx.log('sign-refused', { device: d.id, keySite: k.site, challengeSite: c.site });
        return res(`署名しませんでした。この秘密鍵は「${k.site}」専用で、「${c.site}」には反応しません。そっくりな偽サイトでも、パスキーは使われないのです。`, 'warn', true);
      }
      if (c.used) return res('このチャレンジはもう使いました。サイトから新しいチャレンジをもらいましょう。', 'warn');
      c.used = true;
      ctx.give(d, { kind: 'sig', pair: k.pair, cid: c.cid, nonce: c.nonce, site: c.site }, false);
      ctx.log('sign', { device: d.id, pair: k.pair, cid: c.cid });
      return res(`チャレンジ #${c.nonce} に署名しました。この返事をサイトに送りましょう。`, 'ok', true);
    }
    case 'verify': {
      const p = items.find((i) => i.kind === 'pubkey');
      const s = items.find((i) => i.kind === 'sig');
      if (!p || !s || p.kind !== 'pubkey' || s.kind !== 'sig') return res('検証台には、公開鍵と署名つき返事を1つずつ入れます。', 'warn');
      let r: [string, Result['tone']];
      // reason：失敗の理由（課題の判定用。success のときは付けない）
      let reason: 'site' | 'pair' | 'unissued' | 'replay' | undefined;
      if (p.site !== d.config.site) { r = ['このサイト用の公開鍵ではありません。', 'warn']; reason = 'site'; }
      else if (p.pair !== s.pair) { r = ['登録された公開鍵と合わない署名です。ログインできません。', 'bad']; reason = 'pair'; }
      else if (!d.state.issued.includes(s.cid)) { r = ['このサイトが出したチャレンジへの返事ではありません。', 'bad']; reason = 'unissued'; }
      else if (d.state.used.includes(s.cid)) { r = ['この返事はもう使われています。盗み見た返事を使い回しても、ログインはできません。', 'warn']; reason = 'replay'; }
      else {
        d.state.used.push(s.cid);
        d.state.loggedIn = true;
        r = ['検証成功！ログインできました。パスワードも秘密鍵も、通信路には一度も流れていません。', 'ok'];
      }
      ctx.log('verify', { device: d.id, result: r[1] === 'ok' ? 'success' : 'failure', cid: s.cid, ...(reason ? { reason } : {}) });
      return res(r[0], r[1], true);
    }
    case 'keymake': {
      if (d.items.some((i) => i.kind === 'privkey' && i.owner === d.id)) return res(`${d.name}はもう鍵ペアを持っています。`, 'warn');
      const pair = 'pk-' + ctx.seq();
      const who = d.config.site || d.name;
      ctx.give(d, { kind: 'privkey', pair, site: who, owner: d.id }, false);
      ctx.give(d, { kind: 'pubkey', pair, site: who }, false);
      ctx.log('keymake', { device: d.id, pair });
      return res(`${d.name}の秘密鍵と公開鍵ができました。公開鍵は配ってよく、秘密鍵は手元から出しません。`, 'ok');
    }
    case 'docsign': {
      const k = items.find((i) => i.kind === 'privkey');
      const doc = items.find((i) => i.kind === 'doc');
      if (!k || !doc || k.kind !== 'privkey' || doc.kind !== 'doc') return res('秘密鍵と文書を1つずつ入れてください。', 'warn');
      ctx.give(d, { kind: 'doc', text: doc.text, sig: { pair: k.pair, by: k.site, h: hash(doc.text) } }, false);
      ctx.log('docsign', { device: d.id, text: doc.text, pair: k.pair });
      return res(`${d.name}が文書「${doc.text}」に署名しました。署名は、この中身と${k.site}の秘密鍵の両方から作られています。`, 'ok', true);
    }
    case 'docverify': {
      const p = items.find((i) => i.kind === 'pubkey');
      const doc = items.find((i) => i.kind === 'doc');
      if (!p || !doc || p.kind !== 'pubkey' || doc.kind !== 'doc') return res('公開鍵と文書を1つずつ入れてください。', 'warn');
      let r: [string, Result['tone']];
      // 持ち主名を伏せる設定で、受け取った公開鍵なら「この公開鍵の持ち主」と言う（だれの鍵かは分からない）
      const who = ctx.flags.hideKeyOwner && p.recv ? 'この公開鍵の持ち主' : p.site;
      if (!doc.sig) r = ['この文書には署名がありません。だれが書いたのか確かめられません。', 'warn'];
      else if (doc.sig.pair !== p.pair) r = [`この署名は「${who}」のものではありません。${who}が書いた文書とは言えません。`, 'bad'];
      else if (hash(doc.text) !== doc.sig.h) {
        ctx.flags.tamperDetected = true;
        r = [`改ざんを見つけました！署名したときと中身が違います。「${doc.text}」は${who}が書いた内容ではありません。`, 'bad'];
      } else {
        ctx.flags.docVerified = true;
        r = [`本物です。${who}が書いた文書で、途中で書き換えられていません。`, 'ok'];
      }
      ctx.log('docverify', {
        device: d.id, result: r[1] === 'ok' ? 'valid' : 'invalid',
        text: doc.text, keyPair: p.pair, ...(doc.sig ? { sigPair: doc.sig.pair } : {}),
      });
      return res(r[0], r[1], true);
    }
    case 'tamper': {
      const doc = items[0];
      if (doc.kind !== 'doc') return res('文書を入れてください。', 'warn');
      const t = (opts.tamperText ?? TAMPER_DEFAULT).trim() || TAMPER_DEFAULT;
      if (t === doc.text) return res('中身が同じです。書き換える文を入力してください。', 'warn');
      ctx.give(d, { kind: 'doc', text: t, ...(doc.sig ? { sig: doc.sig } : {}) }, false);
      ctx.log('tamper', { device: d.id, from: doc.text, to: t });
      return res(`${d.name}が文書を「${t}」に書き換えました。署名はそのまま付いています。これを相手に送るとどうなるでしょう。`, 'warn', true);
    }
    case 'issue': {
      const p = items[0];
      if (p.kind !== 'pubkey') return res('公開鍵を入れてください。', 'warn');
      const ck = d.items.find((i) => i.kind === 'privkey' && i.owner === d.id);
      if (!ck || ck.kind !== 'privkey') return res(`${d.name}が署名に使う秘密鍵を持っていません。`, 'warn');
      if (p.pair === ck.pair) return res('自分自身の公開鍵には証明書を出しません。', 'warn');
      ctx.give(d, { kind: 'cert', subject: p.site, pair: p.pair, issuer: d.name, caPair: ck.pair }, false);
      ctx.log('issue', { device: d.id, subject: p.site });
      return res(`${d.name}が、この公開鍵が本当に「${p.site}」のものだと確認して、証明書を発行しました。持ち主に返しましょう。`, 'ok', true);
    }
    case 'certcheck': {
      const c = items[0];
      if (c.kind !== 'cert') return res('証明書を入れてください。', 'warn');
      const root = d.items.find((i) => i.kind === 'pubkey' && i.root && i.pair === c.caPair);
      let r: [string, Result['tone']];
      if (!root) {
        ctx.flags.fakeCertRejected = true;
        r = [`この証明書は信用できません。発行者「${c.issuer}」は、ブラウザに入っている信頼できる認証局ではありません。偽サイトの可能性があります。`, 'bad'];
      } else if (c.subject !== d.config.visit) {
        ctx.flags.fakeCertRejected = true;
        r = [`この証明書は「${c.subject}」のものです。いま開こうとしている ${d.config.visit} のものではありません。`, 'bad'];
      } else {
        d.state.secure = true;
        r = [`🔒 本物の ${c.subject} だと確認できました。アドレスバーに鍵マークが付きます。`, 'ok'];
      }
      ctx.log('certcheck', { device: d.id, subject: c.subject, issuer: c.issuer, result: r[1] === 'ok' ? 'valid' : 'invalid' });
      return res(r[0], r[1], true);
    }
  }
}
