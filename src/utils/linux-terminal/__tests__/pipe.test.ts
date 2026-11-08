import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, newShell, run, stdoutOf, errorsOf, hintsOf, texts } from './helpers.ts';
import { newLogShell } from './fixtures.ts';
import { loadShell, saveShell } from '../engine/persistence.ts';
import { createLogEnvironment } from './fixtures.ts';

const H = '/home/student';
const file = (sh: ReturnType<typeof newShell>, path: string): string => {
  const r = sh.readFile(path);
  assert.equal(r.ok, true, `${path} が読めること`);
  return r.ok ? r.content : '';
};

test('パイプ: 何段でもつなげられる', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'echo hello | cat')), ['hello']);
  assert.deepEqual(texts(run(sh, 'echo hello | cat | cat | cat')), ['hello']);
  assert.deepEqual(texts(run(sh, 'ls Documents | wc -l')), ['2']);
  assert.deepEqual(texts(run(sh, 'ls|wc -l')), ['5'], '空白なしでも書ける');
});

test('パイプ: error と hint は画面に残り、パイプには流れない', () => {
  const sh = newShell();
  const r = run(sh, 'cat nothing | wc -l');
  assert.deepEqual(errorsOf(r), ['cat: nothing: No such file or directory']);
  assert.equal(hintsOf(r).length, 1);
  assert.deepEqual(stdoutOf(r), ['0'], 'wc には何も流れず 0 行');
  const r2 = run(sh, 'foo | cat');
  assert.deepEqual(errorsOf(r2), ['bash: foo: command not found']);
  assert.deepEqual(stdoutOf(r2), []);
  // 途中のコマンドの error と、最後のコマンドの error が両方出る
  const r3 = run(sh, 'cat nothing | grep');
  assert.equal(errorsOf(r3).filter((e) => e.startsWith('cat:')).length, 1);
  assert.ok(errorsOf(r3).some((e) => e.startsWith('Usage: grep')));
});

test('パイプ: > は最後のコマンドに付けたものが有効', () => {
  const sh = newLogShell();
  const r = run(sh, 'grep 192.168.0.12 server/logs/access.log | wc -l > kekka.txt');
  assert.deepEqual(r.lines, []);
  assert.equal(file(sh, `${H}/kekka.txt`), '120\n');
  run(sh, 'echo x | cat >> kekka.txt');
  assert.equal(file(sh, `${H}/kekka.txt`), '120\nx\n');
  // error は画面に残り、書き込みはされる
  const r2 = run(sh, 'cat nothing | cat > e.txt');
  assert.deepEqual(errorsOf(r2), ['cat: nothing: No such file or directory']);
  assert.equal(file(sh, `${H}/e.txt`), '');
});

test('パイプ: 途中のコマンドに > を付けるとエラーとヒントを出し、何も実行しない', () => {
  const sh = newShell();
  const before = JSON.stringify(sh.snapshot().fs);
  const r = run(sh, 'ls > a.txt | wc -l');
  assert.equal(errorsOf(r).length, 1);
  assert.ok(hintsOf(r)[0]?.includes('一番最後'));
  assert.equal(JSON.stringify(sh.snapshot().fs), before, 'a.txt も作られない');
  assert.equal(errorsOf(run(sh, 'echo a >> b.txt | cat | wc')).length, 1);
});

test('パイプ: 書き込み先を開けないときは、何も実行しない', () => {
  const sh = newShell();
  const r = run(sh, 'mkdir zz | cat > /etc/hostname');
  assert.deepEqual(errorsOf(r), ['bash: /etc/hostname: Permission denied']);
  assert.deepEqual(errorsOf(run(sh, 'cat zz')), ['cat: zz: No such file or directory']);
});

test('パイプ: | の前後が空だと bash と同じ構文エラー', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, '| wc')), ["bash: syntax error near unexpected token `|'"]);
  assert.deepEqual(errorsOf(run(sh, 'ls |')), ['bash: syntax error: unexpected end of file']);
  assert.deepEqual(errorsOf(run(sh, 'ls | | wc')), ["bash: syntax error near unexpected token `|'"]);
  assert.ok(hintsOf(run(sh, '| wc'))[0]?.includes('| の前'));
  assert.ok(hintsOf(run(sh, 'ls |'))[0]?.includes('| の後ろ'));
  assert.deepEqual(errorsOf(run(sh, 'ls |   ')), ['bash: syntax error: unexpected end of file']);
  // 構文エラーでも履歴には残る（入力した1行がそのまま）
  assert.deepEqual([...sh.history].slice(-1), ['ls |   ']);
});

test('パイプ: || や |& や && や ; は、これまでどおり未対応と表示する', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'ls || pwd')), ["bash: syntax '||' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'ls |& wc')), ["bash: syntax '|&' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'ls && pwd')), ["bash: syntax '&&' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'ls ; pwd')), ["bash: syntax ';' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'cat < README.txt')), ["bash: syntax '<' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'ls > | wc')), ["bash: syntax error near unexpected token `|'"]);
});

test('パイプ: クォートの中の | は文字のまま', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'echo "a | b"')), ['a | b']);
  assert.deepEqual(texts(run(sh, "echo 'a|b' | cat")), ['a|b']);
  assert.deepEqual(texts(run(sh, 'echo a\\|b')), ['a|b']);
});

test('パイプ: 履歴には入力した1行がそのまま残る', () => {
  const sh = newShell();
  run(sh, 'ls | wc -l');
  run(sh, 'history | grep wc');
  assert.deepEqual([...sh.history], ['ls | wc -l', 'history | grep wc']);
  assert.deepEqual(stdoutOf(run(sh, 'history | grep wc')), [
    '    1  ls | wc -l',
    '    2  history | grep wc',
    '    3  history | grep wc',
  ]);
});

test('パイプ: ls は出力先が画面でないとき1行に1つずつ出す', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'ls server/inbox | head -n 3')), ['a.jpg', 'b.jpg', 'c.png']);
  assert.deepEqual(stdoutOf(run(sh, 'ls server/inbox')).length, 1, '画面ではこれまでどおり横に並ぶ');
  assert.deepEqual(texts(run(sh, 'ls server/inbox | wc -l')), ['11']);
  assert.deepEqual(texts(run(sh, 'ls -a server/inbox | wc -l')), ['14']);
});

test('パイプ: nano と clear の扱い', () => {
  const sh = newShell();
  const r = run(sh, 'nano a.txt | cat');
  assert.equal(r.edit, undefined);
  assert.deepEqual(errorsOf(r), ['nano: cannot be used with a pipeline']);
  assert.equal(run(sh, 'clear | cat').clear, false);
  assert.equal(run(sh, 'clear').clear, true);
});

test('パイプ: 保存と復元のあとも状態が残らない', () => {
  const st = new MemoryStorage();
  const sh = newLogShell();
  run(sh, 'grep " 404 " server/logs/access.log | wc -l > n.txt');
  assert.equal(sh.state.stdoutRedirected, false);
  assert.equal(sh.state.stdoutFile, null);
  saveShell(st, sh);
  const { shell } = loadShell(st, createLogEnvironment());
  assert.equal(file(shell, `${H}/n.txt`), '10\n');
});

test('cat: stdin を読む / ファイル名を省略して stdin もないときはエラー', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'echo abc | cat')), ['abc']);
  assert.deepEqual(texts(run(sh, 'echo abc | cat -')), ['abc']);
  assert.deepEqual(texts(run(sh, 'echo abc | cat README.txt')).length, 2, 'ファイル名があれば stdin は読まない');
  assert.deepEqual(errorsOf(run(sh, 'cat')), ['cat: missing file operand']);
  // 改行なしの出力は、改行なしのまま流れる
  run(sh, 'echo -n abc | cat > n.txt');
  assert.equal(file(sh, `${H}/n.txt`), 'abc');
});
