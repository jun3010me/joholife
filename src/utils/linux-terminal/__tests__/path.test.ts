import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandTilde, normalizePath, resolvePath } from '../engine/path.ts';
import { newShell, run, stdoutOf, errorsOf } from './helpers.ts';

test('resolvePath: 絶対パス・相対パス・. ・ ..', () => {
  assert.equal(resolvePath('/home/student', '/etc'), '/etc');
  assert.equal(resolvePath('/home/student', 'Documents'), '/home/student/Documents');
  assert.equal(resolvePath('/home/student', './Documents/'), '/home/student/Documents');
  assert.equal(resolvePath('/home/student', '..'), '/home');
  assert.equal(resolvePath('/home/student', '../teacher/./x'), '/home/teacher/x');
  assert.equal(resolvePath('/home/student', ''), '/home/student');
});

test('resolvePath: / より上には行けない', () => {
  assert.equal(resolvePath('/home', '../../../..'), '/');
  assert.equal(normalizePath('/../..'), '/');
});

test('expandTilde: ~ / ~/x / ~name', () => {
  const exists = (n: string) => n === 'teacher';
  assert.equal(expandTilde('~', '/home/student', exists), '/home/student');
  assert.equal(expandTilde('~/a', '/home/student', exists), '/home/student/a');
  assert.equal(expandTilde('~teacher/x', '/home/student', exists), '/home/teacher/x');
  assert.equal(expandTilde('~nobody', '/home/student', exists), '~nobody');
  assert.equal(expandTilde('a~', '/home/student', exists), 'a~');
});

test('cd: 各種パス表記で移動できる', () => {
  const sh = newShell();
  run(sh, 'cd /etc');
  assert.equal(sh.cwd, '/etc');
  run(sh, 'cd ~');
  assert.equal(sh.cwd, '/home/student');
  run(sh, 'cd Documents');
  assert.equal(sh.cwd, '/home/student/Documents');
  run(sh, 'cd ..');
  assert.equal(sh.cwd, '/home/student');
  run(sh, 'cd ./practice/sample');
  assert.equal(sh.cwd, '/home/student/practice/sample');
  run(sh, 'cd ~/Pictures');
  assert.equal(sh.cwd, '/home/student/Pictures');
  run(sh, 'cd .');
  assert.equal(sh.cwd, '/home/student/Pictures');
});

test('cd: 引数なしはホームへ', () => {
  const sh = newShell();
  run(sh, 'cd /tmp');
  assert.equal(sh.cwd, '/tmp');
  const r = run(sh, 'cd');
  assert.equal(sh.cwd, '/home/student');
  assert.deepEqual(r.lines, []);
});

test('cd: / より上へは行けず、エラーも出ない', () => {
  const sh = newShell();
  run(sh, 'cd /');
  const r = run(sh, 'cd ..');
  assert.equal(sh.cwd, '/');
  assert.deepEqual(r.lines, []);
  run(sh, 'cd ../../..');
  assert.equal(sh.cwd, '/');
  assert.equal(run(sh, 'pwd').lines[0]?.text, '/');
});

test('ls ~ や ls .. / の解決', () => {
  const sh = newShell();
  assert.deepEqual(stdoutOf(run(sh, 'ls ~/practice/sample')), ['a.txt  b.txt  deep']);
  run(sh, 'cd /home');
  assert.deepEqual(stdoutOf(run(sh, 'ls ..')).join(' ').includes('home'), true);
  assert.deepEqual(errorsOf(run(sh, 'ls /nonexistent')), [
    "ls: cannot access '/nonexistent': No such file or directory",
  ]);
});
