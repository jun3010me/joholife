// 自由モード課題⑧⑨⑩（key-exchange-three-min / key-exchange-replay / key-exchange-swap）：テンプレートと提出判定のテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KeyLab } from '../engine/world.ts';
import { validateFreeSubmission, THREE_MIN_SENDS } from '../submission-free.ts';
import {
  buildReplayTemplate, buildSwapTemplate, buildThreePersonTemplate, FREE_TEMPLATES, SWAP_DOC_TEXT,
} from '../templates.ts';
import { block, find, has, newLab } from './helpers.ts';
import type { Item } from '../engine/types.ts';

const dump = (w: KeyLab) => JSON.parse(JSON.stringify(w.toJSON()));
const load = (tpl: () => Record<string, unknown>): KeyLab => { const w = newLab(); w.load(tpl()); return w; };

// ---------- 課題⑧ ----------
const A = 'person-001', B = 'person-002', C = 'person-003';
const SA = 'S:person-001', SB = 'S:person-002', SC = 'S:person-003';
const comb = (w: KeyLab, id: string, x: string[], y: string[]) => w.runMachine(id, 'combine', [block(w, id, x).uid, block(w, id, y).uid]);
const snd = (w: KeyLab, from: string, parts: string[], to: string) => w.send(from, block(w, from, parts).uid, to);

/** 7回の送信で3人が共有鍵を作る手順。extra を指定すると、無駄な送信を足す */
function threeMin(extra = 0): KeyLab {
  const w = load(buildThreePersonTemplate);
  comb(w, A, ['P'], [SA]);
  snd(w, A, ['P'], B);                       // 1
  snd(w, A, ['P', SA], B);                   // 2
  snd(w, A, ['P', SA], C);                   // 3
  for (let i = 0; i < extra; i++) snd(w, A, ['P'], C);
  comb(w, B, ['P'], [SB]);
  comb(w, B, ['P', SA], [SB]);
  snd(w, B, ['P', SB], C);                   // 4
  snd(w, B, ['P', SA, SB], C);               // 5
  comb(w, C, ['P', SA], [SC]);
  comb(w, C, ['P', SB], [SC]);
  snd(w, C, ['P', SA, SC], B);               // 6
  snd(w, C, ['P', SB, SC], A);               // 7
  comb(w, A, ['P', SB, SC], [SA]);
  comb(w, B, ['P', SA, SC], [SB]);
  comb(w, C, ['P', SA, SB], [SC]);
  return w;
}

test('⑧ テンプレートは⑥と同じ初期配置で、ファイル名だけ別', () => {
  const strip = (t: Record<string, unknown>) => ({ ...t, timestamp: null });
  assert.deepEqual(strip(FREE_TEMPLATES['key-exchange-three-min'].build()), strip(buildThreePersonTemplate()));
  assert.equal(FREE_TEMPLATES['key-exchange-three-min'].fileName, 'key-exchange-three-min-template.json');
});

test('⑧ 上限ちょうどの7回で作れたファイルは合格', () => {
  const w = threeMin();
  assert.equal(w.log.filter((e) => e.action === 'send').length, THREE_MIN_SENDS);
  const r = validateFreeSubmission(dump(w), 'key-exchange-three-min');
  assert.equal(r.valid, true, r.message);
  // ⑥の条件も満たしている
  assert.equal(validateFreeSubmission(dump(w), 'key-exchange-three').valid, true);
});

test('⑧ 共有鍵ができても、8回送ったファイルは不合格（回数を伝える）', () => {
  const w = threeMin(1);
  const r = validateFreeSubmission(dump(w), 'key-exchange-three-min');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('8回') && r.message.includes('7回以内'), r.message);
  // ⑥としては合格する
  assert.equal(validateFreeSubmission(dump(w), 'key-exchange-three').valid, true);
});

test('⑧ 共有鍵がまだのファイルは、回数より先に⑥の判定で不合格', () => {
  const w = load(buildThreePersonTemplate);
  const r = validateFreeSubmission(dump(w), 'key-exchange-three-min');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('共有鍵を持っていません'), r.message);
});

// ---------- 課題⑨ ----------
const PH = 'phone-001', SITE = 'server-001', EVE = 'eve-001';

/** スマホで正しくログインするまで。返事（sig）は送らずに止めることもできる */
function login(w: KeyLab, sendSig = true): void {
  w.runMachine(SITE, 'challenge', []);
  w.send(SITE, find(w, SITE, 'challenge').uid, PH);
  w.runMachine(PH, 'sign', [find(w, PH, 'privkey').uid, find(w, PH, 'challenge').uid]);
  if (!sendSig) return;
  w.send(PH, find(w, PH, 'sig').uid, SITE);
  w.runMachine(SITE, 'verify', [find(w, SITE, 'pubkey').uid, find(w, SITE, 'sig').uid]);
}

function replay(): KeyLab {
  const w = load(buildReplayTemplate);
  login(w);
  w.send(EVE, find(w, EVE, 'sig').uid, SITE);
  w.runMachine(SITE, 'verify', [find(w, SITE, 'pubkey').uid, find(w, SITE, 'sig').uid]);
  return w;
}

test('⑨ テンプレート：スマホは登録ずみ、イブは盗み見だけ（中間者ではない）', () => {
  const t = buildReplayTemplate() as any;
  assert.equal(t.mode, 'free');
  assert.deepEqual(t.devices.map((d: any) => d.id), ['phone-001', 'internet-001', 'server-001', 'eve-001']);
  assert.equal(t.devices.find((d: any) => d.id === EVE).config.mitm, false);
  assert.deepEqual(t.log, []);
  const w = load(buildReplayTemplate);
  assert.ok(has(w, PH, 'privkey'));
  assert.ok(has(w, SITE, 'pubkey'));
  assert.deepEqual(w.dev(EVE)!.items, []);
});

test('⑨ ログインのあと、イブの使い回しが拒否されたファイルは合格', () => {
  const w = replay();
  assert.ok(w.dev(SITE)!.state.loggedIn);
  const last = w.log.at(-1)!;
  assert.equal(last.action, 'verify');
  assert.equal(last.result, 'failure');
  assert.equal(last.reason, 'replay');
  const r = validateFreeSubmission(dump(w), 'key-exchange-replay');
  assert.equal(r.valid, true, r.message);
});

test('⑨ 何もしていないテンプレートは不合格', () => {
  const r = validateFreeSubmission(dump(load(buildReplayTemplate)), 'key-exchange-replay');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('ログインした記録がありません'), r.message);
});

test('⑨ ログインしただけ（イブが試していない）は不合格', () => {
  const w = load(buildReplayTemplate);
  login(w);
  const r = validateFreeSubmission(dump(w), 'key-exchange-replay');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('イブが、盗み見た返事'), r.message);
});

test('⑨ イブが送っただけで、検証台で確かめていないファイルは不合格', () => {
  const w = load(buildReplayTemplate);
  login(w);
  w.send(EVE, find(w, EVE, 'sig').uid, SITE);
  const r = validateFreeSubmission(dump(w), 'key-exchange-replay');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('検証台で確かめた記録'), r.message);
});

test('⑨ イブがサイトの確認より先に返事を送ったファイルは不合格（対象外の操作）', () => {
  const w = load(buildReplayTemplate);
  login(w, false);
  w.send(PH, find(w, PH, 'sig').uid, SITE);          // イブにコピーされる
  w.send(EVE, find(w, EVE, 'sig').uid, SITE);        // 先回り
  w.runMachine(SITE, 'verify', [find(w, SITE, 'pubkey').uid, find(w, SITE, 'sig').uid]);
  w.runMachine(SITE, 'verify', [find(w, SITE, 'pubkey').uid, find(w, SITE, 'sig').uid]);
  const r = validateFreeSubmission(dump(w), 'key-exchange-replay');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('確かめる前に'), r.message);
});

test('⑨ 秘密鍵を送ったファイルは不合格', () => {
  const w = replay();
  w.send(PH, find(w, PH, 'privkey').uid, SITE);
  const r = validateFreeSubmission(dump(w), 'key-exchange-replay');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('秘密鍵'), r.message);
});

// ---------- 課題⑩ ----------
const AL = 'person-001', BOB = 'person-002';
const FORGED = 'イブに10,000円払います';

/** 公開鍵のすり替え。passThrough なら、アリスの本物の公開鍵もボブへ素通しする */
function swap(opts: { passThrough?: boolean; forge?: boolean } = {}): KeyLab {
  const forge = opts.forge ?? true;
  const w = load(buildSwapTemplate);
  w.runMachine(AL, 'docsign', [find(w, AL, 'privkey').uid, find(w, AL, 'doc', (d) => !d.sig).uid]);
  w.send(AL, find(w, AL, 'pubkey').uid, BOB);                  // 横取り
  w.send(AL, find(w, AL, 'doc', (d) => !!d.sig).uid, BOB);     // 横取り
  w.runMachine(EVE, 'keymake', []);
  const evePub = find(w, EVE, 'pubkey', (p) => !p.recv) as Extract<Item, { kind: 'pubkey' }>;
  w.send(EVE, evePub.uid, BOB);
  if (opts.passThrough) w.send(EVE, find(w, EVE, 'pubkey', (p) => p.recv).uid, BOB);
  if (forge) {
    w.runMachine(EVE, 'tamper', [find(w, EVE, 'doc').uid], { tamperText: FORGED });
    w.runMachine(EVE, 'docsign', [find(w, EVE, 'privkey').uid, find(w, EVE, 'doc', (d) => d.text === FORGED).uid]);
    w.send(EVE, find(w, EVE, 'doc', (d) => d.text === FORGED && d.sig?.pair === evePub.pair).uid, BOB);
  } else {
    w.send(EVE, find(w, EVE, 'doc').uid, BOB);                 // アリスの文書をそのまま転送
  }
  w.runMachine(BOB, 'docverify', [find(w, BOB, 'pubkey', (p) => p.pair === evePub.pair).uid, find(w, BOB, 'doc').uid]);
  return w;
}

test('⑩ テンプレート：持ち主名を伏せる設定で、イブは中間者。ボブは公開鍵を持っていない', () => {
  const t = buildSwapTemplate() as any;
  assert.equal(t.flags.hideKeyOwner, true);
  assert.equal(t.devices.find((d: any) => d.id === EVE).config.mitm, true);
  assert.deepEqual(t.devices.find((d: any) => d.id === EVE).config.machines, ['keymake', 'tamper', 'docsign']);
  const w = load(buildSwapTemplate);
  assert.ok(has(w, AL, 'doc', (d) => d.text === SWAP_DOC_TEXT && !d.sig));
  assert.deepEqual(w.dev(BOB)!.items, []);
});

test('⑩ 受け取った公開鍵と署名つき文書は持ち主不明と表示され、自分の鍵は名前が出る', () => {
  const w = swap();
  const evePubAtBob = find(w, BOB, 'pubkey');
  assert.equal(w.label(evePubAtBob), '公開鍵（持ち主不明）');
  assert.equal(w.label(find(w, AL, 'pubkey')), '公開鍵（アリス）');
  assert.equal(w.label(find(w, EVE, 'pubkey', (p) => !p.recv)), '公開鍵（イブ）');
  assert.ok(w.label(find(w, BOB, 'doc')).endsWith('（署名つき）'));
  // 判定の文も、だれの鍵かを言わない
  const r = w.runMachine(BOB, 'docverify', [evePubAtBob.uid, find(w, BOB, 'doc').uid]);
  assert.ok(r.text.includes('この公開鍵の持ち主') && !r.text.includes('イブ'), r.text);
});

test('⑩ 持ち主名を伏せる設定がない世界（ほかの課題・シナリオ）では、今までどおり名前が出る', () => {
  const w = newLab();
  w.load(buildSwapTemplate());
  w.flags.hideKeyOwner = false;
  w.send(AL, find(w, AL, 'pubkey').uid, BOB);
  assert.equal(w.label(find(w, EVE, 'pubkey')), '公開鍵（アリス）');
});

test('⑩ すり替えた公開鍵で、偽の文書が本物と判定されたファイルは合格', () => {
  const w = swap();
  const last = w.log.at(-1)!;
  assert.equal(last.action, 'docverify');
  assert.equal(last.result, 'valid');
  assert.equal(last.text, FORGED);
  const r = validateFreeSubmission(dump(w), 'key-exchange-swap');
  assert.equal(r.valid, true, r.message);
});

test('⑩ 書き換えずにアリスの文書を確かめた（不一致）だけのファイルは不合格', () => {
  const r = validateFreeSubmission(dump(swap({ forge: false })), 'key-exchange-swap');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('本物です'), r.message);
});

test('⑩ アリスの本物の公開鍵もボブへ素通ししたファイルは不合格', () => {
  const r = validateFreeSubmission(dump(swap({ passThrough: true })), 'key-exchange-swap');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('本物のアリスの公開鍵'), r.message);
});

test('⑩ 持ち主名を伏せる設定が外れたファイルは不合格', () => {
  const data = dump(swap());
  data.flags.hideKeyOwner = false;
  const r = validateFreeSubmission(data, 'key-exchange-swap');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('テンプレート'), r.message);
});

test('⑩ 秘密鍵を送ったファイルは不合格', () => {
  const w = swap();
  w.send(EVE, find(w, EVE, 'privkey').uid, BOB);
  const r = validateFreeSubmission(dump(w), 'key-exchange-swap');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('秘密鍵'), r.message);
});
