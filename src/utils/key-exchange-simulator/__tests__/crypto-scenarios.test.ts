import { test } from 'node:test';
import assert from 'node:assert/strict';
import { find, has, newLab } from './helpers.ts';
import { solve } from './playthroughs.ts';
import { SCENARIO_LIST } from '../scenarios/index.ts';
import { SECRET_TEXT } from '../scenarios/sym.ts';
import { validateSubmission } from '../submission.ts';

const A = 'person-001', B = 'person-002', EVE = 'eve-001';
const dump = (w: ReturnType<typeof newLab>) => JSON.parse(JSON.stringify(w.toJSON()));

test('シナリオの並び：共通鍵 → 公開鍵 → ディフィー・ヘルマンの順で始まる', () => {
  assert.deepEqual(SCENARIO_LIST.slice(0, 3).map((s) => s.id), ['sym', 'pk', 'dh']);
});

test('sym: 暗号文だけ盗み見ても、イブは復号台を動かせない（鍵がない）', () => {
  const w = newLab();
  w.startScenario('sym');
  w.runMachine(A, 'encrypt', [find(w, A, 'symkey').uid, find(w, A, 'doc').uid]);
  const r = w.send(A, find(w, A, 'cipher').uid, B);
  assert.ok(r.text.includes('暗号文なので'));
  assert.ok(has(w, EVE, 'cipher'));
  assert.ok(!has(w, EVE, 'doc'), 'イブは元の文を持っていない');
  // ボブは鍵がないので、暗号文だけでは復号できない
  const r2 = w.runMachine(B, 'decrypt', [find(w, B, 'cipher').uid]);
  assert.equal(r2.tone, 'warn');
  assert.equal(w.flags.symRead, undefined);
});

test('sym: 共通鍵を送ると bad。最後まで進めると、イブにも読めて完了（鍵配送問題）', () => {
  const w = newLab();
  w.startScenario('sym');
  w.runMachine(A, 'encrypt', [find(w, A, 'symkey').uid, find(w, A, 'doc').uid]);
  w.send(A, find(w, A, 'cipher').uid, B);
  const r = w.send(A, find(w, A, 'symkey').uid, B);
  assert.equal(r.tone, 'bad');
  assert.ok(r.text.includes('共通鍵が届きました'));
  const rb = w.runMachine(B, 'decrypt', [find(w, B, 'symkey').uid, find(w, B, 'cipher').uid]);
  assert.equal(rb.tone, 'ok');
  assert.ok(has(w, B, 'doc', (d) => d.text === SECRET_TEXT));
  assert.equal(w.scenario?.completed, false);
  const re = w.runMachine(EVE, 'decrypt', [find(w, EVE, 'symkey').uid, find(w, EVE, 'cipher').uid]);
  assert.equal(re.tone, 'bad');
  assert.ok(re.text.includes('鍵配送問題'));
  assert.equal(w.scenario?.completed, true);
  assert.equal(w.scenario?.failed, false);
});

test('pk: 公開鍵では開けられず、ペアの秘密鍵でだけ開ける', () => {
  const w = newLab();
  w.startScenario('pk');
  w.runMachine(B, 'keymake', []);
  const s = w.send(B, find(w, B, 'pubkey').uid, A);
  assert.equal(s.tone, 'info', '公開鍵は送ってよい');
  w.runMachine(A, 'pkencrypt', [find(w, A, 'pubkey').uid, find(w, A, 'doc').uid]);
  // アリス本人も開けられない（秘密鍵がない）
  assert.ok(!has(w, A, 'privkey'));
  w.send(A, find(w, A, 'cipher').uid, B);
  const re = w.runMachine(EVE, 'decrypt', [find(w, EVE, 'pubkey').uid, find(w, EVE, 'cipher').uid]);
  assert.ok(re.text.includes('公開鍵は「閉める」'));
  assert.equal(w.flags.pubDecFail, true);
  assert.ok(!has(w, EVE, 'doc'));
  const rb = w.runMachine(B, 'decrypt', [find(w, B, 'privkey').uid, find(w, B, 'cipher').uid]);
  assert.equal(rb.tone, 'ok');
  assert.equal(w.scenario?.completed, true);
});

test('pk: ボブの秘密鍵を送ってしまうと失敗', () => {
  const w = newLab();
  w.startScenario('pk');
  w.runMachine(B, 'keymake', []);
  w.send(B, find(w, B, 'privkey').uid, A);
  assert.equal(w.scenario?.failed, true);
});

test('提出判定：sym・pk を最後まで進めたファイルは合格、途中のものは不合格', () => {
  for (const id of ['sym', 'pk']) {
    assert.equal(validateSubmission(dump(solve(id)), id).valid, true, id);
    const w = newLab();
    w.startScenario(id);
    assert.equal(validateSubmission(dump(w), id).valid, false, id);
  }
});

test('保存して読み込んでも、暗号文と共通鍵がそのまま残る', () => {
  const w = solve('sym');
  const r = newLab();
  r.load(dump(w));
  assert.ok(has(r, B, 'cipher') && has(r, B, 'symkey'));
  assert.equal(r.scenario?.completed, true);
});
