// 自由モード課題「key-exchange-mitm」（中間者攻撃を成功させる）：テンプレートと提出判定のテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KeyLab } from '../engine/world.ts';
import { sameParts } from '../engine/items.ts';
import { validateFreeSubmission } from '../submission-free.ts';
import { validateSubmission } from '../submission.ts';
import { buildMitmTemplate, FREE_TEMPLATES } from '../templates.ts';
import { block, has, newLab } from './helpers.ts';

const A = 'person-001', B = 'person-002', EVE = 'eve-001';
const TASK = 'key-exchange-mitm';
const SA = 'S:person-001', SB = 'S:person-002', SE = 'S:eve-001';

const fresh = (): KeyLab => { const w = newLab(); w.load(buildMitmTemplate()); return w; };
const dump = (w: KeyLab) => JSON.parse(JSON.stringify(w.toJSON()));
const combine = (w: KeyLab, id: string, x: string[], y: string[]) =>
  w.runMachine(id, 'combine', [block(w, id, x).uid, block(w, id, y).uid]);
const send = (w: KeyLab, from: string, parts: string[], to: string) => w.send(from, block(w, from, parts).uid, to);

/** 模範的な中間者攻撃。stage で途中まで進められる */
function attack(stage: 'full' | 'noEveBob' | 'bobPending' = 'full'): KeyLab {
  const w = fresh();
  send(w, A, ['P'], B);                    // 横取りされる
  send(w, EVE, ['P'], B);                  // イブが転送（Pは公開）
  combine(w, A, ['P'], [SA]);
  send(w, A, ['P', SA], B);                // 横取りされる
  combine(w, B, ['P'], [SB]);
  send(w, B, ['P', SB], A);                // 横取りされる
  combine(w, EVE, ['P'], [SE]);            // イブ自身の鍵 P＋E
  send(w, EVE, ['P', SE], A);
  send(w, EVE, ['P', SE], B);
  combine(w, EVE, ['P', SA], [SE]);        // P＋A＋E
  if (stage !== 'noEveBob') combine(w, EVE, ['P', SB], [SE]); // P＋B＋E
  combine(w, A, ['P', SE], [SA]);
  if (stage !== 'bobPending') combine(w, B, ['P', SE], [SB]);
  return w;
}

test('テンプレート：自由モードで、イブは「中間者」。持ち物は最小限', () => {
  const t = buildMitmTemplate() as any;
  assert.equal(t.simulator, 'key-exchange');
  assert.equal(t.mode, 'free');
  assert.equal(t.scenario, null);
  assert.deepEqual(t.devices.map((d: any) => d.id), ['person-001', 'internet-001', 'person-002', 'eve-001']);
  assert.equal(t.devices.find((d: any) => d.id === EVE).config.mitm, true);
  assert.deepEqual(t.log, []);
  assert.equal(FREE_TEMPLATES[TASK].fileName, 'key-exchange-mitm-template.json');
  const w = fresh();
  assert.deepEqual(w.dev(A)!.items.map((i: any) => i.parts).sort(), [['P'], [SA]]);
  assert.deepEqual(w.dev(B)!.items.map((i: any) => i.parts), [[SB]]);
  assert.deepEqual(w.dev(EVE)!.items.map((i: any) => i.parts), [[SE]]);
  for (const id of [A, B, EVE]) assert.deepEqual(w.route(id, 'internet-001'), [id, 'internet-001']);
});

test('テンプレート：吹き出しを全員ぶん開いても重ならず、画面内に収まる', () => {
  const w = fresh();
  const pops = [A, B, EVE].map((id) => w.dev(id)!).map((d) => ({ id: d.id, l: d.x + 50 - 130, r: d.x + 50 + 130 })).sort((p, q) => p.l - q.l);
  assert.ok(pops[0].l >= 6);
  for (let i = 1; i < pops.length; i++) assert.ok(pops[i].l >= pops[i - 1].r, `${pops[i].id} が重なる`);
  for (const d of w.devices) assert.ok(d.x + d.width <= 990 && d.y + d.height <= 520, d.id);
});

test('テンプレート：イブが中間者なので、アリスの送ったものはボブに届かず、イブが送れば届く', () => {
  const w = fresh();
  const r = send(w, A, ['P'], B);
  assert.ok(r.text.includes('横取り'));
  assert.ok(!has(w, B, 'block', (i) => sameParts(i.parts, ['P'])));
  assert.ok(has(w, EVE, 'block', (i) => sameParts(i.parts, ['P'])));
  send(w, EVE, ['P'], B);
  assert.ok(has(w, B, 'block', (i) => sameParts(i.parts, ['P'])));
});

test('提出判定：模範的な中間者攻撃は合格。アリスとボブの鍵は別物で、イブが両方を持つ', () => {
  const w = attack();
  assert.ok(has(w, A, 'block', (i) => sameParts(i.parts, ['P', SA, SE])));
  assert.ok(has(w, B, 'block', (i) => sameParts(i.parts, ['P', SB, SE])));
  assert.ok(!has(w, A, 'block', (i) => sameParts(i.parts, ['P', SA, SB])), 'アリスは本物の共有鍵を持たない');
  assert.ok(has(w, EVE, 'block', (i) => sameParts(i.parts, ['P', SA, SE])) && has(w, EVE, 'block', (i) => sameParts(i.parts, ['P', SB, SE])));
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, true, r.message);
  assert.ok(!r.message.includes('S:'));
});

test('提出判定：何もしていないテンプレートは不合格（横取りの記録がない）', () => {
  const r = validateFreeSubmission(dump(fresh()), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('横取りした記録'), r.message);
});

test('提出判定：イブが素通しして、本物の共有鍵ができたファイルは不合格', () => {
  const w = fresh();
  send(w, A, ['P'], B); send(w, EVE, ['P'], B);
  combine(w, A, ['P'], [SA]); send(w, A, ['P', SA], B); send(w, EVE, ['P', SA], B);
  combine(w, B, ['P', SA], [SB]);
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('本物の共有鍵'), r.message);
});

test('提出判定：ボブの鍵がまだのファイルは不合格（誰がまだかを示す）', () => {
  const r = validateFreeSubmission(dump(attack('bobPending')), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('ボブが') && r.message.includes('P＋B＋E'), r.message);
  assert.ok(!r.message.includes('アリスが、自分'));
});

test('提出判定：イブがボブの鍵をまだ作っていないファイルは不合格', () => {
  const r = validateFreeSubmission(dump(attack('noEveBob')), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('イブが、ボブの鍵をまだ持っていません'), r.message);
});

test('提出判定：イブの秘密素材を送ったファイルは不合格', () => {
  const w = attack();
  send(w, EVE, [SE], A);
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('秘密の素材'), r.message);
});

test('提出判定：完成した鍵そのものを送ったファイルは不合格', () => {
  const w = attack();
  send(w, EVE, ['P', SA, SE], A);
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('完成した鍵そのもの'), r.message);
});

test('提出判定：イブを「盗み見」に切り替えて作業したファイルは不合格（横取りの記録が足りない）', () => {
  const w = fresh();
  w.dev(EVE)!.config.mitm = false;
  send(w, A, ['P'], B);
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('横取りした記録'), r.message);
});

test('提出判定：持ち物を手で足した・デバイスを増やしたファイルは不合格', () => {
  const w = attack();
  w.addItem(w.dev(A)!, { kind: 'block', parts: ['P'] });
  assert.ok(validateFreeSubmission(dump(w), TASK).message.includes('持ち物を手で足した'));
  const v = attack();
  const d = v.makeDevice('person', 10, 300); v.addLog('add-device', { device: d.id });
  assert.equal(validateFreeSubmission(dump(v), TASK).valid, false);
});

test('提出判定：鍵を持ち物に書き足して、操作ログを消した手書きのファイルは不合格', () => {
  const d = dump(attack());
  d.log = [];
  const r = validateFreeSubmission(d, TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('横取りした記録'), r.message);
  // 横取りの記録だけ書き足しても、合成の記録がなければ不合格
  const w = attack();
  const d2 = dump(w);
  d2.log = d2.log.filter((e: any) => e.action !== 'combine');
  const r2 = validateFreeSubmission(d2, TASK);
  assert.equal(r2.valid, false);
  assert.ok(r2.message.includes('合成した記録'), r2.message);
});

test('提出判定：シナリオモードのファイル・他シミュレータ・壊れたデータ・別課題用の関数は不合格', () => {
  const sc = newLab(); sc.startScenario('dh');
  assert.equal(validateFreeSubmission(dump(sc), TASK).valid, false);
  assert.equal(validateFreeSubmission({ version: '1.0', devices: [] }, TASK).valid, false);
  assert.equal(validateFreeSubmission(null, TASK).valid, false);
  assert.equal(validateFreeSubmission(dump(attack()), 'nothing').valid, false);
  assert.equal(validateSubmission(dump(attack()), 'dh').valid, false, 'シナリオ用の判定には通らない');
});

test('提出判定：3人課題のテンプレートで作業したファイルは、この課題では不合格', () => {
  const w = newLab();
  w.load(JSON.parse(JSON.stringify(FREE_TEMPLATES['key-exchange-three'].build())));
  assert.equal(validateFreeSubmission(dump(w), TASK).valid, false);
});
