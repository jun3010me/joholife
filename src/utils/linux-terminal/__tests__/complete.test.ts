import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newShell, run } from './helpers.ts';

test('コマンド名の補完: 1つに決まる / 共通部分 / 候補一覧', () => {
  const sh = newShell();
  assert.deepEqual(sh.complete('pw'), { line: 'pwd ', candidates: [] });
  assert.deepEqual(sh.complete('mk'), { line: 'mkdir ', candidates: [] });
  const c = sh.complete('c');
  assert.equal(c.line, 'c'); // cat / cd / clear / cp の共通部分は c のまま
  assert.deepEqual(c.candidates, ['cat', 'cd', 'clear', 'cp']);
  assert.deepEqual(sh.complete('xyz'), { line: 'xyz', candidates: [] });
  assert.deepEqual(sh.complete('na'), { line: 'nano ', candidates: [] });
});

test('パスの補完: ディレクトリは / が付き、ファイルは空白が付く', () => {
  const sh = newShell();
  assert.deepEqual(sh.complete('cd Doc'), { line: 'cd Documents/', candidates: [] });
  assert.deepEqual(sh.complete('cat README'), { line: 'cat README.txt ', candidates: [] });
  assert.deepEqual(sh.complete('ls Documents/me'), { line: 'ls Documents/memo.txt ', candidates: [] });
  assert.deepEqual(sh.complete('ls ~/Pic'), { line: 'ls ~/Pictures/', candidates: [] });
  assert.deepEqual(sh.complete('ls /et'), { line: 'ls /etc/', candidates: [] });
  assert.deepEqual(sh.complete('ls ../stu'), { line: 'ls ../student/', candidates: [] });
});

test('パスの補完: 候補が複数なら共通部分まで補完し、候補を返す', () => {
  const sh = newShell();
  const r = sh.complete('cd D');
  assert.equal(r.line, 'cd Do'); // Documents / Downloads → 共通部分は Do
  assert.deepEqual(r.candidates, ['Documents/', 'Downloads/']);
  // Memo.txt は大文字なので m の候補にならず、memo.txt に決まる
  assert.deepEqual(sh.complete('cat practice/m'), { line: 'cat practice/memo.txt ', candidates: [] });
  const r2 = sh.complete('cat practice/');
  assert.deepEqual(r2.candidates, ['hello.txt', 'Memo.txt', 'memo.txt', 'sample/']);
});

test('パスの補完: 共通部分が伸びる', () => {
  const sh = newShell();
  run(sh, 'mkdir ~/photo_a ~/photo_b');
  const r = sh.complete('ls pho');
  assert.equal(r.line, 'ls photo_');
  assert.deepEqual(r.candidates, ['photo_a/', 'photo_b/']);
});

test('補完は大文字小文字を区別する', () => {
  const sh = newShell();
  assert.deepEqual(sh.complete('cd doc'), { line: 'cd doc', candidates: [] });
});

test('cd の補完はディレクトリだけ / 隠しファイルは . を打ったときだけ', () => {
  const sh = newShell();
  assert.deepEqual(sh.complete('cd R'), { line: 'cd R', candidates: [] });
  assert.deepEqual(sh.complete('cat .b'), { line: 'cat .bashrc ', candidates: [] });
  assert.deepEqual(sh.complete('cat '), sh.complete('cat '));
  assert.ok(!sh.complete('ls ').candidates.some((c) => c.startsWith('.')));
});

test('権限のないディレクトリの中身は補完に出ない', () => {
  const sh = newShell();
  assert.deepEqual(sh.complete('ls /home/teacher/'), { line: 'ls /home/teacher/', candidates: [] });
  assert.deepEqual(sh.complete('ls /home/te'), { line: 'ls /home/teacher/', candidates: [] });
});

test('スペースを含む名前はエスケープして補完する', () => {
  const sh = newShell();
  run(sh, 'mkdir "my dir"');
  assert.deepEqual(sh.complete('cd my'), { line: 'cd my\\ dir/', candidates: [] });
});

test('rmdir の補完はディレクトリだけ', () => {
  const sh = newShell();
  assert.deepEqual(sh.complete('rmdir R'), { line: 'rmdir R', candidates: [] });
  assert.deepEqual(sh.complete('rmdir pra'), { line: 'rmdir practice/', candidates: [] });
  assert.deepEqual(sh.complete('rm R'), { line: 'rm README.txt ', candidates: [] });
});
