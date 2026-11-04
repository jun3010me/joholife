import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../engine/tree.ts';
import { newShell, run } from './helpers.ts';

test('ツリー: 隠しファイルは出さず、他ユーザーのホームは中身を隠す', () => {
  const sh = newShell();
  const tree = buildTree(sh.state.root, 'student');
  const home = tree.children.find((c) => c.name === 'home');
  const student = home?.children.find((c) => c.name === 'student');
  const teacher = home?.children.find((c) => c.name === 'teacher');
  assert.ok(student && teacher);
  assert.equal(student.children.some((c) => c.name.startsWith('.')), false);
  assert.equal(teacher.locked, true);
  assert.deepEqual(teacher.children, []);
  assert.equal(student.path, '/home/student');
});

test('ツリー: mkdir に合わせて更新される / ディレクトリが先に並ぶ', () => {
  const sh = newShell();
  run(sh, 'mkdir newdir');
  const tree = buildTree(sh.state.root, 'student');
  const student = tree.children.find((c) => c.name === 'home')?.children.find((c) => c.name === 'student');
  const names = student?.children.map((c) => c.name);
  assert.ok(names?.includes('newdir'));
  assert.equal(student?.children[student.children.length - 1]?.name, 'README.txt');
});
