import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, newShell, run, stdoutOf, errorsOf, hintsOf, texts } from './helpers.ts';
import { loadShell, saveShell } from '../engine/persistence.ts';
import { createDefaultEnvironment } from '../environments/default.ts';

const H = '/home/student';
const file = (sh: ReturnType<typeof newShell>, path: string): string => {
  const r = sh.readFile(path);
  assert.equal(r.ok, true, `${path} が読めること`);
  return r.ok ? r.content : '';
};

test('echo: 引数を空白1つでつないで表示する', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'echo Hello')), ['Hello']);
  assert.deepEqual(texts(run(sh, 'echo Hello   Linux  World')), ['Hello Linux World']);
  assert.deepEqual(texts(run(sh, 'echo こんにちは 世界')), ['こんにちは 世界']);
  assert.deepEqual(texts(run(sh, 'echo')), ['']);
});
test('echo: クォートの中の空白は保たれる', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'echo "a    b"')), ['a    b']);
  assert.deepEqual(texts(run(sh, "echo 'a   b' c")), ['a   b c']);
  assert.deepEqual(texts(run(sh, 'echo "ls | cat > x"')), ['ls | cat > x']);
  assert.deepEqual(texts(run(sh, 'echo ~')), [H]);
  assert.deepEqual(texts(run(sh, "echo '~'")), ['~']);
});
test('echo: オプションは先頭の -n -e -E だけ。それ以外はただの文字', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'echo -x hello')), ['-x hello']);
  assert.deepEqual(texts(run(sh, 'echo hello -n')), ['hello -n']);
  assert.deepEqual(texts(run(sh, 'echo --help')), ['--help']);
  assert.deepEqual(texts(run(sh, 'echo -')), ['-']);
  assert.deepEqual(texts(run(sh, 'echo -n -e a')), ['a']);
});
test('echo -e: \\n と \\t を特別な文字として扱う / -e なしでは文字のまま', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'echo -e "1行目\\n2行目"')), ['1行目', '2行目']);
  assert.deepEqual(texts(run(sh, 'echo -e "a\\tb"')), ['a\tb']);
  // ダブルクォートの中の \\ はシェルが \ 1つにするので、echo には \n が渡り、改行になる
  assert.deepEqual(texts(run(sh, 'echo -e "a\\\\nb"')), ['a', 'b']);
  // シングルクォートなら \\ がそのまま echo に渡り、\ と n になる
  assert.deepEqual(texts(run(sh, "echo -e 'a\\\\nb'")), ['a\\nb']);
  assert.deepEqual(texts(run(sh, 'echo -e "a\\qb"')), ['a\\qb']); // 未対応のエスケープはそのまま
  assert.deepEqual(texts(run(sh, 'echo -e "stop\\cnot shown"')), ['stop']);
  assert.deepEqual(texts(run(sh, 'echo "1行目\\n2行目"')), ['1行目\\n2行目']);
  assert.deepEqual(texts(run(sh, 'echo -e -E "a\\nb"')), ['a\\nb']); // -E が後なら変換しない
  assert.deepEqual(texts(run(sh, 'echo -E -e "a\\nb"')), ['a', 'b']); // -e が後なら変換する
  assert.deepEqual(texts(run(sh, 'echo -eE "a\\nb"')), ['a\\nb']);
});
test('echo -e: 改行で終わる文字列は、空行が1つ増える（本物と同じ）', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'echo -e "a\\n"')), ['a', '']);
  assert.deepEqual(texts(run(sh, 'echo -e "\\n"')), ['', '']);
});

// ---- リダイレクトと組み合わせる
test('echo > ファイル: 内容を書き込める（課題で使う基本形）', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'echo "こんにちは、Linux" > hello.txt').lines, []);
  assert.equal(file(sh, `${H}/hello.txt`), 'こんにちは、Linux\n');
  assert.deepEqual(texts(run(sh, 'cat hello.txt')), ['こんにちは、Linux']);
  run(sh, 'echo 2行目 >> hello.txt');
  assert.equal(file(sh, `${H}/hello.txt`), 'こんにちは、Linux\n2行目\n');
  run(sh, 'echo やり直し > hello.txt');
  assert.equal(file(sh, `${H}/hello.txt`), 'やり直し\n');
});
test('echo -e で複数行のファイルを作れる', () => {
  const sh = newShell();
  run(sh, 'echo -e "名前：テスト\\n学籍番号：12345" > profile.txt');
  assert.equal(file(sh, `${H}/profile.txt`), '名前：テスト\n学籍番号：12345\n');
});
test('echo -n: 改行なしで書き込める（追記でつながる）', () => {
  const sh = newShell();
  run(sh, 'echo -n abc > n.txt');
  assert.equal(file(sh, `${H}/n.txt`), 'abc');
  run(sh, 'echo -n def >> n.txt');
  assert.equal(file(sh, `${H}/n.txt`), 'abcdef');
  run(sh, 'echo ghi >> n.txt');
  assert.equal(file(sh, `${H}/n.txt`), 'abcdefghi\n');
  run(sh, 'echo -n > empty.txt');
  assert.equal(file(sh, `${H}/empty.txt`), '');
  run(sh, 'echo > blank.txt');
  assert.equal(file(sh, `${H}/blank.txt`), '\n');
});
test('echo: 書き込み先が使えないときは実行されない / 画面にはファイルの内容が出ない', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'echo hi > /etc/hostname')), ['bash: /etc/hostname: Permission denied']);
  assert.equal(file(sh, '/etc/hostname'), 'joho\n');
  assert.deepEqual(errorsOf(run(sh, 'echo hi > Documents')), ['bash: Documents: Is a directory']);
  assert.deepEqual(run(sh, 'echo hi > /dev/null').lines, []);
});
test('echo: 変数やワイルドカード・パイプは未対応と表示する', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'echo $HOME')), ["bash: '$' expansion is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'echo *.txt')), ["bash: wildcard '*' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'echo a | cat')), ["bash: syntax '|' is not supported in this simulator"]);
  assert.ok(hintsOf(run(sh, 'echo $HOME'))[0]?.includes('変数'));
  assert.deepEqual(texts(run(sh, "echo '$HOME'")), ['$HOME']); // シングルクォートの中は文字のまま
});
test('echo: help・Tab補完・history・保存と復元', () => {
  const sh = newShell();
  assert.ok(texts(run(sh, 'help')).join('\n').includes('echo'));
  assert.ok(texts(run(sh, 'help echo')).join('\n').includes('echo [-n] [-e]'));
  assert.deepEqual(sh.complete('ech'), { line: 'echo ', candidates: [] });
  const fresh = newShell();
  run(fresh, 'echo 保存テスト > save.txt');
  const st = new MemoryStorage();
  saveShell(st, fresh);
  const { shell } = loadShell(st, createDefaultEnvironment());
  assert.equal(file(shell, `${H}/save.txt`), '保存テスト\n');
  assert.deepEqual([...shell.history], ['echo 保存テスト > save.txt']);
  assert.deepEqual(stdoutOf(run(shell, 'ls Documents')), ['memo.txt  todo.txt']);
});
test('echo: 大きなファイルにならないよう上限が効く', () => {
  const sh = newShell();
  sh.saveFile(`${H}/big.txt`, 'x'.repeat(99_990) + '\n');
  const r = run(sh, 'echo 0123456789abcdef >> big.txt');
  assert.ok(errorsOf(r)[0]?.includes('No space left on device'));
  assert.equal(file(sh, `${H}/big.txt`).length, 99_991);
});
