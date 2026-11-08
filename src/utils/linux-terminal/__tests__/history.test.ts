import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, newShell, run, stdoutOf, errorsOf, texts } from './helpers.ts';
import { loadShell, saveShell } from '../engine/persistence.ts';
import { createDefaultEnvironment } from '../environments/default.ts';

test('history: 入力した順に番号つきで表示し、history 自身も含まれる', () => {
  const sh = newShell();
  run(sh, 'ls');
  run(sh, 'cd Documents');
  run(sh, 'pwd');
  assert.deepEqual(texts(run(sh, 'history')), [
    '    1  ls',
    '    2  cd Documents',
    '    3  pwd',
    '    4  history',
  ]);
  // もう一度実行すると、前回の history も並ぶ
  assert.deepEqual(texts(run(sh, 'history')).slice(-2), ['    4  history', '    5  history']);
});

test('history: 空入力・空白のみは記録されず、番号も飛ばない', () => {
  const sh = newShell();
  run(sh, 'ls');
  run(sh, '');
  run(sh, '   ');
  run(sh, 'pwd');
  assert.deepEqual(texts(run(sh, 'history')), ['    1  ls', '    2  pwd', '    3  history']);
});

test('history: 失敗したコマンドや未対応の構文も記録される（入力した事実の記録）', () => {
  const sh = newShell();
  run(sh, 'foo');
  run(sh, 'ls | cat');
  run(sh, 'cd nothing');
  assert.deepEqual(texts(run(sh, 'history')), [
    '    1  foo',
    '    2  ls | cat',
    '    3  cd nothing',
    '    4  history',
  ]);
});

test('history N: 最近の N 件を、元の番号のまま表示する', () => {
  const sh = newShell();
  for (const c of ['ls', 'pwd', 'cd ..', 'ls -a']) run(sh, c);
  assert.deepEqual(texts(run(sh, 'history 2')), ['    4  ls -a', '    5  history 2']);
  assert.deepEqual(texts(run(sh, 'history 100')).length, 6);
  assert.deepEqual(run(sh, 'history 0').lines, []);
});

test('history: エラー系（履歴を消すオプションは使えない）', () => {
  const sh = newShell();
  run(sh, 'ls');
  assert.deepEqual(errorsOf(run(sh, 'history abc')), ['bash: history: abc: numeric argument required']);
  assert.deepEqual(errorsOf(run(sh, 'history 1 2')), ['bash: history: too many arguments']);
  assert.deepEqual(errorsOf(run(sh, 'history -c')), ["bash: history: option '-c' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'history -d 1')).length, 1);
  assert.deepEqual(errorsOf(run(sh, 'history -w')).length, 1);
  // -c が使えないので、履歴は消えていない
  const lines = texts(run(sh, 'history'));
  assert.equal(lines[0], '    1  ls');
  assert.ok(lines.length >= 7);
});

test('history: 保存→復元しても続きの番号で表示される', () => {
  const st = new MemoryStorage();
  const sh = newShell();
  run(sh, 'mkdir work');
  run(sh, 'cd work');
  saveShell(st, sh);
  const { shell } = loadShell(st, createDefaultEnvironment());
  run(shell, 'ls');
  assert.deepEqual(texts(run(shell, 'history')), [
    '    1  mkdir work',
    '    2  cd work',
    '    3  ls',
    '    4  history',
  ]);
});

test('history: 上限(1000件)を超えたら古いものから消える', () => {
  const sh = newShell();
  for (let i = 0; i < 1005; i++) run(sh, 'pwd');
  const out = stdoutOf(run(sh, 'history'));
  assert.equal(out.length, 1000);
  assert.ok(out[out.length - 1]?.endsWith('history'));
});

test('history: nano や mv の操作も、入力したコマンドとして残る', () => {
  const sh = newShell();
  run(sh, 'nano memo.txt');
  run(sh, 'mv memo.txt Documents');
  assert.deepEqual(texts(run(sh, 'history')), ['    1  nano memo.txt', '    2  mv memo.txt Documents', '    3  history']);
});

test('history: help・Tab補完に載る / 履歴は history コマンド実行で書き換わらない', () => {
  const sh = newShell();
  assert.ok(texts(run(sh, 'help')).join('\n').includes('history'));
  assert.ok(texts(run(sh, 'help history')).join('\n').includes('history [件数]'));
  assert.deepEqual(sh.complete('hist'), { line: 'history ', candidates: [] });
  assert.deepEqual(sh.complete('h').candidates, ['head', 'help', 'history']);
  const before = [...sh.history];
  run(sh, 'history');
  assert.deepEqual([...sh.history], [...before, 'history']);
  assert.deepEqual(sh.snapshot().history.slice(-1), ['history']);
});
