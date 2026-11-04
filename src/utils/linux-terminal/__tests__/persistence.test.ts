import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearSaved, loadShell, parseSaved, saveShell, storageKey } from '../engine/persistence.ts';
import { createDefaultEnvironment } from '../environments/default.ts';
import { getEnvironment } from '../environments/index.ts';
import { MemoryStorage, newShell, run, stdoutOf } from './helpers.ts';

const env = () => createDefaultEnvironment();

test('保存→復元で、ファイルシステム・現在地・履歴が戻る', () => {
  const st = new MemoryStorage();
  const sh = newShell();
  run(sh, 'mkdir test');
  run(sh, 'cd test');
  run(sh, 'foo');
  assert.equal(saveShell(st, sh), true);

  const { shell, status } = loadShell(st, env());
  assert.equal(status, 'restored');
  assert.equal(shell.cwd, '/home/student/test');
  assert.deepEqual([...shell.history], ['mkdir test', 'cd test', 'foo']);
  run(shell, 'cd ..');
  assert.ok(stdoutOf(run(shell, 'ls'))[0]?.includes('test'));
});

test('保存データが無ければ初期状態', () => {
  const { shell, status } = loadShell(new MemoryStorage(), env());
  assert.equal(status, 'fresh');
  assert.equal(shell.cwd, '/home/student');
});

test('壊れた保存データからは初期状態で復帰する', () => {
  const good = JSON.stringify(newShell().snapshot());
  const mutate = (f: (o: any) => void) => {
    const o = JSON.parse(good);
    f(o);
    return JSON.stringify(o);
  };
  const broken: Record<string, string> = {
    'JSONではない': '{oops',
    'null': 'null',
    '配列': '[]',
    '数値': '42',
    'バージョン違い': mutate((o) => (o.version = 2)),
    '環境ID違い': mutate((o) => (o.envId = 'other')),
    'cwdが文字列でない': mutate((o) => (o.cwd = 5)),
    'cwdが存在しない': mutate((o) => (o.cwd = '/no/such')),
    'cwdがファイル': mutate((o) => (o.cwd = '/etc/hostname')),
    'cwdが非正規': mutate((o) => (o.cwd = '/home/../etc')),
    '履歴が配列でない': mutate((o) => (o.history = 'x')),
    '履歴に数値': mutate((o) => (o.history = [1])),
    'fsがない': mutate((o) => delete o.fs),
    'fsのtype不正': mutate((o) => (o.fs.type = 'file')),
    '子の名前が重複': mutate((o) => o.fs.children.push(o.fs.children[0])),
    '名前に/': mutate((o) => (o.fs.children[0].name = 'a/b')),
    '名前が..': mutate((o) => (o.fs.children[0].name = '..')),
    'modeが範囲外': mutate((o) => (o.fs.children[0].mode = 99999)),
    'ownerが空': mutate((o) => (o.fs.children[0].owner = '')),
    'fileのcontentが文字列でない': mutate((o) => {
      const etc = o.fs.children.find((c: any) => c.name === 'etc');
      etc.children[0].content = 1;
    }),
    'ホームが無い': mutate((o) => {
      o.fs.children = o.fs.children.filter((c: any) => c.name !== 'home');
      o.cwd = '/';
    }),
  };
  for (const [label, raw] of Object.entries(broken)) {
    const st = new MemoryStorage();
    st.setItem(storageKey('default'), raw);
    const r = loadShell(st, env());
    assert.equal(r.status, 'corrupt', label);
    assert.equal(r.shell.cwd, '/home/student', label);
    assert.deepEqual(stdoutOf(run(r.shell, 'ls'))[0]?.includes('Documents'), true, label);
  }
  assert.equal(parseSaved(good, env()) !== null, true);
});

test('深すぎる・大きすぎる保存データは拒否する', () => {
  const o = JSON.parse(JSON.stringify(newShell().snapshot()));
  let cur = o.fs;
  for (let i = 0; i < 60; i++) {
    const d = { type: 'dir', name: 'd', owner: 'student', mode: 0o755, children: [] };
    cur.children.push(d);
    cur = d;
  }
  assert.equal(parseSaved(JSON.stringify(o), env()), null);
});

test('localStorage が使えない環境でも動く', () => {
  const throwing = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
  const r = loadShell(throwing, env());
  assert.equal(r.status, 'fresh');
  assert.equal(saveShell(throwing, r.shell), false);
  assert.doesNotThrow(() => clearSaved(throwing, 'default'));
  assert.equal(loadShell(null, env()).status, 'fresh');
  assert.equal(saveShell(null, r.shell), false);
});

test('最初からやり直す: 保存を消すと初期状態に戻る', () => {
  const st = new MemoryStorage();
  const sh = newShell();
  run(sh, 'mkdir test');
  saveShell(st, sh);
  clearSaved(st, 'default');
  assert.equal(loadShell(st, env()).status, 'fresh');
});

test('環境（章）ごとに保存先が分かれる', () => {
  assert.notEqual(storageKey('default'), storageKey('chapter2'));
  assert.equal(getEnvironment('default')?.id, 'default');
  assert.equal(getEnvironment('constructor'), undefined);
  assert.equal(getEnvironment('__proto__'), undefined);
});

test('snapshot はコピーなので、あとから書き換えても Shell に影響しない', () => {
  const sh = newShell();
  const snap = sh.snapshot();
  snap.fs.children.length = 0;
  snap.history.push('x');
  assert.ok(stdoutOf(run(sh, 'ls /'))[0]?.includes('etc'));
});
