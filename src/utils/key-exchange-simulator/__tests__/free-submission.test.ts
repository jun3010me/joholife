// 自由モード課題「key-exchange-three」（3人で共有鍵を作る）：テンプレートと提出判定のテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyLab } from '../engine/world.ts';
import { sameParts } from '../engine/items.ts';
import { validateFreeSubmission } from '../submission-free.ts';
import { validateSubmission } from '../submission.ts';
import { buildThreePersonTemplate, FREE_TEMPLATES } from '../templates.ts';
import { block, newLab, has } from './helpers.ts';
import { solve } from './playthroughs.ts';

const A = 'person-001', B = 'person-002', C = 'person-003', EVE = 'eve-001';
const FINAL = ['P', 'S:person-001', 'S:person-002', 'S:person-003'];
const TASK = 'key-exchange-three';

const fresh = (): KeyLab => { const w = newLab(); w.load(buildThreePersonTemplate()); return w; };
const dump = (w: KeyLab) => JSON.parse(JSON.stringify(w.toJSON()));

/** 模範的な手順（途中まで進める用に、段階を指定できる） */
function play(stage: 'sendOnly' | 'full' = 'full'): KeyLab {
  const w = fresh();
  w.send(A, block(w, A, ['P']).uid, B);
  w.runMachine(A, 'combine', [block(w, A, ['P']).uid, block(w, A, ['S:person-001']).uid]);
  w.send(A, block(w, A, ['P', 'S:person-001']).uid, B);
  w.send(A, block(w, A, ['P', 'S:person-001']).uid, C);
  w.runMachine(B, 'combine', [block(w, B, ['P']).uid, block(w, B, ['S:person-002']).uid]);
  w.send(B, block(w, B, ['P', 'S:person-002']).uid, C);
  w.runMachine(B, 'combine', [block(w, B, ['P', 'S:person-001']).uid, block(w, B, ['S:person-002']).uid]);
  w.send(B, block(w, B, ['P', 'S:person-001', 'S:person-002']).uid, C);
  w.runMachine(C, 'combine', [block(w, C, ['P', 'S:person-001']).uid, block(w, C, ['S:person-003']).uid]);
  w.send(C, block(w, C, ['P', 'S:person-001', 'S:person-003']).uid, B);
  w.runMachine(C, 'combine', [block(w, C, ['P', 'S:person-002']).uid, block(w, C, ['S:person-003']).uid]);
  w.send(C, block(w, C, ['P', 'S:person-002', 'S:person-003']).uid, A);
  w.runMachine(B, 'combine', [block(w, B, ['P', 'S:person-001', 'S:person-003']).uid, block(w, B, ['S:person-002']).uid]);
  w.runMachine(A, 'combine', [block(w, A, ['P', 'S:person-002', 'S:person-003']).uid, block(w, A, ['S:person-001']).uid]);
  if (stage === 'full') {
    w.runMachine(C, 'combine', [block(w, C, ['P', 'S:person-001', 'S:person-002']).uid, block(w, C, ['S:person-003']).uid]);
  }
  return w;
}

test('テンプレート：自由モードの保存形式で、3人・インターネット・イブがそろっている', () => {
  const t = buildThreePersonTemplate() as any;
  assert.equal(t.simulator, 'key-exchange');
  assert.equal(t.mode, 'free');
  assert.equal(t.scenario, null);
  assert.deepEqual(t.devices.map((d: any) => d.id), ['person-001', 'internet-001', 'person-002', 'person-003', 'eve-001']);
  assert.deepEqual(t.devices.map((d: any) => d.name), ['アリス', 'インターネット', 'ボブ', 'キャロル', 'イブ']);
  assert.equal(t.devices.find((d: any) => d.id === EVE).config.mitm, false);
  assert.deepEqual(t.log, []);
  assert.equal(FREE_TEMPLATES[TASK].fileName, 'key-exchange-three-template.json');
});

test('テンプレート：全員（イブも）がインターネットにつながり、キャンバス内で重ならない', () => {
  const w = fresh();
  for (const id of [A, B, C, EVE]) assert.deepEqual(w.route(id, 'internet-001'), [id, 'internet-001'], id);
  assert.equal(w.connections.length, 4);
  for (const d of w.devices) {
    assert.ok(d.x >= 0 && d.x + d.width <= 1000 && d.y >= 0 && d.y + d.height <= 520, `${d.id} がキャンバス内`);
  }
  // 吹き出し（幅260）を同時に開いても重ならないよう、同じ段の横の間隔は260px以上
  const top = w.devices.filter((d) => d.y < 100).sort((a, b) => a.x - b.x);
  for (let i = 1; i < top.length; i++) assert.ok(top[i].x - top[i - 1].x >= 260, `${top[i - 1].id}→${top[i].id}`);
});

test('テンプレート：初期の持ち物は、アリスがPと自分の秘密、ボブとキャロルが自分の秘密だけ', () => {
  const w = fresh();
  assert.equal(w.mode, 'free');
  assert.equal(w.dev(A)!.items.length, 2);
  assert.ok(has(w, A, 'block', (i) => sameParts(i.parts, ['P'])) && has(w, A, 'block', (i) => sameParts(i.parts, ['S:person-001'])));
  assert.deepEqual(w.dev(B)!.items.map((i: any) => i.parts), [['S:person-002']]);
  assert.deepEqual(w.dev(C)!.items.map((i: any) => i.parts), [['S:person-003']]);
  assert.equal(w.dev(EVE)!.items.length, 0);
});

test('テンプレート：読み込んだあとも自由モードとして操作を続けられる', () => {
  const w = fresh();
  const r = w.send(A, block(w, A, ['P']).uid, B);
  assert.ok(r.tone === 'info', r.text);
  assert.ok(has(w, B, 'block', (i) => sameParts(i.parts, ['P'])));
  assert.ok(has(w, EVE, 'block', (i) => sameParts(i.parts, ['P'])), '盗み見で、イブにもコピーされる');
  // 保存して読み直しても同じ
  const w2 = newLab(); w2.load(dump(w));
  assert.equal(w2.mode, 'free');
  assert.ok(has(w2, B, 'block', (i) => sameParts(i.parts, ['P'])));
  // 新しいデバイスもつくれる（自由モードの機能）
  assert.ok(w2.makeDevice('person', 10, 300));
  // 合成の表示名は「P＋A＋B＋C」
  assert.equal(w2.label({ kind: 'block', parts: [...FINAL] }), '合成鍵（P＋A＋B＋C）');
});

test('提出判定：模範的な手順で完了した保存ファイルは合格し、イブは共有鍵を持たない', () => {
  const w = play();
  for (const id of [A, B, C]) assert.ok(has(w, id, 'block', (i) => sameParts(i.parts, FINAL)), id);
  assert.ok(!has(w, EVE, 'block', (i) => sameParts(i.parts, FINAL)));
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, true, r.message);
  assert.ok(!r.message.includes('S:person'));
});

test('提出判定：キャロルがまだのファイルは不合格（誰が持っていないかを示す）', () => {
  const r = validateFreeSubmission(dump(play('sendOnly')), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('キャロルがまだ共有鍵を持っていません'), r.message);
  assert.ok(!r.message.includes('ボブ'));
});

test('提出判定：テンプレートのまま（何もしていない）ファイルは不合格', () => {
  const r = validateFreeSubmission(dump(fresh()), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('アリス・ボブ・キャロルがまだ共有鍵を持っていません'), r.message);
});

test('提出判定：イブが共有鍵を持っているファイルは不合格', () => {
  const w = play();
  w.give(w.dev(EVE)!, { kind: 'block', parts: [...FINAL] });
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('イブも共有鍵を持っています'), r.message);
});

test('提出判定：秘密の素材を通信路に送ったファイルは不合格', () => {
  const w = play();
  w.send(B, block(w, B, ['S:person-002']).uid, C);
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('秘密の素材'), r.message);
});

test('提出判定：イブに横取りされた秘密素材も不合格（intercept）', () => {
  const w = play();
  w.dev(EVE)!.config.mitm = true;
  w.send(C, block(w, C, ['S:person-003']).uid, A);
  assert.ok(w.log.some((e) => e.action === 'intercept'));
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('秘密の素材'), r.message);
});

test('提出判定：共有鍵そのものを送ったファイルは不合格', () => {
  const w = play();
  w.send(A, block(w, A, FINAL).uid, B);
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('共有鍵そのもの'), r.message);
});

test('提出判定：ログを空にした手書きファイルは不合格', () => {
  const d = dump(play());
  d.log = [];
  const r = validateFreeSubmission(d, TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('操作ログ'), r.message);
  const d2 = dump(play());
  delete d2.log;
  assert.equal(validateFreeSubmission(d2, TASK).valid, false);
});

test('提出判定：デバイスを追加したファイルは不合格（ログの有無にかかわらず）', () => {
  const w = play();
  const d = w.makeDevice('person', 40, 300);
  w.addLog('add-device', { device: d.id, type: d.type });
  assert.equal(validateFreeSubmission(dump(w), TASK).valid, false);
  const w2 = play();
  w2.makeDevice('person', 40, 300);
  const r = validateFreeSubmission(dump(w2), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('デバイス'), r.message);
});

test('提出判定：デバイスを削除した・つなぎ替えたファイルは不合格', () => {
  const w = play();
  w.removeDevice(EVE);
  w.addLog('remove-device', { device: EVE });
  assert.equal(validateFreeSubmission(dump(w), TASK).valid, false);
  const w2 = play();
  w2.unlink(w2.connections.find((c) => c.from.deviceId === EVE || c.to.deviceId === EVE)!.id);
  const r = validateFreeSubmission(dump(w2), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('つながり'), r.message);
});

test('提出判定：add-item で持ち物を足したファイルは不合格', () => {
  const w = fresh();
  w.send(A, block(w, A, ['P']).uid, B);
  for (const id of [A, B, C]) w.addItem(w.dev(id)!, { kind: 'block', parts: [...FINAL] });
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('持ち物を手で足した'), r.message);
});

test('提出判定：持ち物を直接書き足したが、合成の記録が無いファイルは不合格', () => {
  const w = fresh();
  for (const id of [A, B, C]) w.give(w.dev(id)!, { kind: 'block', parts: [...FINAL] });
  const r = validateFreeSubmission(dump(w), TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('合成した記録がありません'), r.message);
});

test('提出判定：シナリオモードのファイルは不合格（逆向きも）', () => {
  const sc = dump(solve('dh'));
  const r = validateFreeSubmission(sc, TASK);
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('自由モード'), r.message);
  // 自由モードのファイルを、シナリオ課題として出しても通らない（既存の判定は壊れていない）
  assert.equal(validateSubmission(dump(play()), 'dh').valid, false);
});

test('提出判定：壊れたデータ・別のシミュレータのファイル・不明な課題は不合格', () => {
  for (const bad of [null, undefined, 'x', 1, [], {}, { simulator: 'key-exchange' }, { simulator: 'network' },
    { simulator: 'key-exchange', mode: 'free', scenario: null }, { simulator: 'key-exchange', mode: 'free', version: '1.0', devices: 'x' }]) {
    const r = validateFreeSubmission(bad, TASK);
    assert.equal(r.valid, false, JSON.stringify(bad));
    assert.ok(r.message.length > 0);
  }
  assert.equal(validateFreeSubmission(dump(play()), 'nothing').valid, false);
  const d = dump(play());
  d.devices = d.devices.map((x: any) => ({ ...x, items: 'oops' }));
  assert.doesNotThrow(() => validateFreeSubmission(d, TASK));
});

test('提出判定：不合格メッセージに模範解答の手順は書かれていない', () => {
  const msgs = [
    validateFreeSubmission(dump(fresh()), TASK).message,
    validateFreeSubmission(dump(play('sendOnly')), TASK).message,
  ];
  for (const m of msgs) assert.ok(!/P＋[ABC]|S:person|受け取|回し/.test(m), m);
});
