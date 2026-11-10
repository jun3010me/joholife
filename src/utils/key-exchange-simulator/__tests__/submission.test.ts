import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from './playthroughs.ts';
import { newLab } from './helpers.ts';
import { validateSubmission } from '../submission.ts';
import { SCENARIO_LIST } from '../scenarios/index.ts';

const saved = (id: string) => JSON.parse(JSON.stringify(solve(id).toJSON()));

for (const sc of SCENARIO_LIST) {
  test(`提出判定：${sc.id} を完了した保存ファイルは合格`, () => {
    const w = solve(sc.id);
    assert.equal(w.scenario?.completed, true, '操作で完了している');
    const r = validateSubmission(JSON.parse(JSON.stringify(w.toJSON())), sc.id);
    assert.deepEqual(r.valid, true, r.message);
  });
}

test('提出判定：別のシナリオのファイルは不合格', () => {
  const r = validateSubmission(saved('dh'), 'passkey');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('ディフィー・ヘルマン鍵交換'));
});

test('提出判定：未完了のファイルは不合格で、残りの手順を示す', () => {
  const w = newLab();
  w.startScenario('dh');
  const r = validateSubmission(JSON.parse(JSON.stringify(w.toJSON())), 'dh');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('ボブにも公開鍵Pを届ける'));
});

test('提出判定：失敗したファイルは不合格', () => {
  const d = saved('passkey');
  d.scenario.failed = true;
  assert.equal(validateSubmission(d, 'passkey').valid, false);
});

test('提出判定：completed だけ true にした手書きのファイルは不合格', () => {
  const w = newLab();
  w.startScenario('cert');
  const d = JSON.parse(JSON.stringify(w.toJSON()));
  d.scenario.completed = true;
  assert.equal(validateSubmission(d, 'cert').valid, false);
});

test('提出判定：持ち物と flags を書き足しても、操作ログが無ければ不合格', () => {
  const d = saved('sig');
  d.log = [];
  const r = validateSubmission(d, 'sig');
  assert.equal(r.valid, false);
  assert.ok(r.message.includes('操作ログ'));
});

test('提出判定：自由モード・他のシミュレータ・壊れたデータは不合格', () => {
  const free = newLab();
  free.startFree();
  assert.equal(validateSubmission(JSON.parse(JSON.stringify(free.toJSON())), 'dh').valid, false);
  assert.equal(validateSubmission({ version: '1.0', devices: [], connections: [] }, 'dh').valid, false);
  assert.equal(validateSubmission(null, 'dh').valid, false);
  assert.equal(validateSubmission('x', 'dh').valid, false);
  assert.equal(validateSubmission(saved('dh'), 'nothing').valid, false);
});
