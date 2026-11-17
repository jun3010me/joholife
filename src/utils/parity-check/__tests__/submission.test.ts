import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFlips, applyFlips2D, countOnes, encode, encode2D, judge, oddCols, oddRows, type Bit, type Cell, type Mode, type Noise } from '../parity.ts';
import { buildSave, clearProblems, loadProblems, saveProblems, STORAGE_KEY, type Problem, type Problem12, type Problem3 } from '../log.ts';
import { progressOf, validateParity1, validateParity2 } from '../submission.ts';

const DATA: Bit[] = [1, 0, 1, 1, 0, 1, 0];
const FLIPS: Record<Noise, number[]> = { none: [], one: [2], two: [1, 5], zero: [] };

function make12(mode: Mode, noise: Noise, over: Partial<Problem12> = {}): Problem12 {
  const sent = encode(DATA, mode);
  const flipped = noise === 'zero' ? sent.flatMap((b, i) => (b ? [i] : [])) : FLIPS[noise];
  const received = applyFlips(sent, flipped).received;
  return {
    stage: mode === 'even' ? 1 : 2, mode, noise, sent, flipped, hintUsed: false, answerShown: false, cleared: true,
    steps: [
      { step: 'count', value: countOnes(received), ok: true },
      { step: 'judge', pick: judge(received, mode), ok: true },
    ], ...over,
  };
}
function make3(flip: Cell, over: Partial<Problem3> = {}): Problem3 {
  const sent = encode2D([[1, 0, 1, 1], [0, 1, 1, 0], [0, 1, 1, 1], [1, 0, 0, 0]]);
  const g = applyFlips2D(sent, [flip]);
  return {
    stage: 3, sent, flipped: [flip], hintUsed: false, answerShown: false, cleared: true,
    steps: [{ step: 'row', pick: oddRows(g)[0], ok: true }, { step: 'col', pick: oddCols(g)[0], ok: true }, { step: 'fix', cell: flip, ok: true }], ...over,
  };
}
const file = (problems: Problem[]) => JSON.parse(JSON.stringify(buildSave(problems)));
const all6 = () => (['even', 'odd'] as Mode[]).flatMap((m) => (['one', 'two', 'zero'] as Noise[]).map((n) => make12(m, n)));

test('課題①：6種類をクリアしていれば合格', () => {
  const r = validateParity1(file(all6()));
  assert.equal(r.valid, true, r.message);
  assert.equal(r.clearedCount, 6);
});
test('課題①：足りないものを具体的に返す', () => {
  const r = validateParity1(file(all6().filter((p) => !(p.mode === 'odd' && p.noise === 'zero'))));
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('奇数パリティの全部0がまだです'), r.message);
});
test('課題①：「答えを見る」を押した問題は数えない', () => {
  const ps = all6();
  ps[0] = make12('even', 'one', { answerShown: true, cleared: false });
  const r = validateParity1(file(ps));
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('偶数パリティの1枚反転'));
});
test('課題①：ログと合わない「クリア」は不合格', () => {
  const ps = all6();
  // 2枚反転なのに「誤りあり」と答えている（偽のok）
  ps[1] = make12('even', 'two', { steps: [{ step: 'count', value: countOnes(applyFlips(ps[1].sent, ps[1].flipped).received), ok: true }, { step: 'judge', pick: 'error', ok: true }] });
  assert.equal(validateParity1(file(ps)).valid, false);
  // 1の数を偽る
  const ps2 = all6();
  ps2[0] = make12('even', 'one', { steps: [{ step: 'count', value: 99, ok: true }, { step: 'judge', pick: 'error', ok: true }] });
  assert.equal(validateParity1(file(ps2)).valid, false);
  // 手順なしでcleared:true
  const ps3 = all6();
  ps3[2] = make12('even', 'zero', { steps: [] });
  assert.equal(validateParity1(file(ps3)).valid, false);
});
test('課題①：全部0は、1が1枚以上あるものだけ数える。偶数で全部0を送ったものは数えない', () => {
  const ps = all6().filter((p) => !(p.mode === 'even' && p.noise === 'zero'));
  const sent = encode([0, 0, 0, 0, 0, 0, 0], 'even');
  ps.push({ stage: 1, mode: 'even', noise: 'zero', sent, flipped: [], hintUsed: false, answerShown: false, cleared: true,
    steps: [{ step: 'count', value: 0, ok: true }, { step: 'judge', pick: 'ok', ok: true }] });
  assert.equal(validateParity1(file(ps)).valid, false);
});
test('提出：別のファイル・壊れたファイルは不合格', () => {
  assert.equal(validateParity1(null).valid, false);
  assert.equal(validateParity1({ simulator: 'other' }).valid, false);
  assert.equal(validateParity2({ simulator: 'parity-check', version: 1, problems: 'x' }).valid, false);
});

test('課題②：ノイズ1枚を3問（うち1問はパリティのマス）で合格。ヒント使用数も数える', () => {
  const ps = [make3([0, 1], { hintUsed: true }), make3([2, 3]), make3([4, 2])];
  const r = validateParity2(file(ps));
  assert.equal(r.valid, true, r.message);
  assert.equal(r.clearedCount, 3);
  assert.equal(r.hintCount, 1);
});
test('課題②：パリティのマスが無いと不合格', () => {
  const r = validateParity2(file([make3([0, 1]), make3([2, 3]), make3([1, 1])]));
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('パリティのマス'));
});
test('課題②：問題数が足りないと、あと何問か返す', () => {
  const r = validateParity2(file([make3([4, 4])]));
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('あと2問'));
});
test('課題②：偶数の行を「おかしい」としているクリアは不合格', () => {
  const bad = make3([4, 2], { steps: [{ step: 'row', pick: 0, ok: true }, { step: 'col', pick: 2, ok: true }, { step: 'fix', cell: [4, 2], ok: true }] });
  assert.equal(validateParity2(file([make3([0, 1]), make3([2, 3]), bad])).valid, false);
});
test('課題②：答えを見た問題・先に誤った選択をした記録は、正しければ数える／答えを見たら数えない', () => {
  const retry = make3([4, 2]);
  retry.steps.splice(1, 0, { step: 'col', pick: 0, ok: false });
  assert.equal(validateParity2(file([make3([0, 1]), make3([2, 3]), retry])).valid, true);
  const shown = make3([4, 2], { answerShown: true, cleared: false });
  const r = validateParity2(file([make3([0, 1]), make3([2, 3]), shown]));
  assert.equal(r.valid, false);
});
test('課題②：ノイズ2枚の問題はクリアに数えない', () => {
  const two = make3([4, 2]);
  two.flipped = [[4, 2], [0, 0]];
  assert.equal(validateParity2(file([make3([0, 1]), make3([2, 3]), two])).valid, false);
});

test('保存・読込：localStorageに保存して読み直せる。壊れたデータは空', () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  assert.deepEqual(loadProblems(store), []);
  const ps = [make12('even', 'one')];
  saveProblems(ps, store);
  assert.deepEqual(loadProblems(store), ps);
  mem.set(STORAGE_KEY, '{broken');
  assert.deepEqual(loadProblems(store), []);
  saveProblems(ps, store); clearProblems(store);
  assert.deepEqual(loadProblems(store), []);
  assert.deepEqual(loadProblems(null), []);
});

test('進捗：できた種類・足りない種類が分かり、提出判定と同じ結果になる', () => {
  const ps = all6().filter((p) => !(p.mode === 'odd' && p.noise === 'zero'));
  const g = progressOf(ps);
  assert.equal(g.task1.filter((x) => x.done).length, 5);
  assert.equal(g.task1.find((x) => !x.done)?.label, '奇数パリティの全部0');
  assert.equal(g.task1Done, false);
  assert.equal(progressOf(all6()).task1Done, true);

  const p3 = [make3([0, 1]), make3([2, 3])];
  assert.deepEqual(progressOf(p3).task2, { cleared: 2, parityDone: false });
  const done = progressOf([...p3, make3([4, 2])]);
  assert.equal(done.task2Done, true);
  // 答えを見た問題は数えない
  assert.equal(progressOf([make3([4, 2], { answerShown: true, cleared: false })]).task2.cleared, 0);
  // 判定と進捗は一致する
  assert.equal(validateParity2(file([...p3, make3([4, 2])])).valid, done.task2Done);
});
