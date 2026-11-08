import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, newShell, run, stdoutOf, errorsOf, hintsOf, texts } from './helpers.ts';
import { loadShell, saveShell } from '../engine/persistence.ts';
import { createDefaultEnvironment } from '../environments/default.ts';

const file = (sh: ReturnType<typeof newShell>, path: string): string => {
  const r = sh.readFile(path);
  assert.equal(r.ok, true, `${path} が読めること`);
  return r.ok ? r.content : '';
};
const H = '/home/student';

// ---- history / cat で使う
test('history > ファイル: 履歴がファイルに書かれ、画面には何も出ない', () => {
  const sh = newShell();
  run(sh, 'ls');
  run(sh, 'pwd');
  const r = run(sh, 'history > rireki.txt');
  assert.deepEqual(r.lines, []);
  // 本物の bash と同じく、history > rireki.txt 自身も含まれる
  assert.equal(file(sh, `${H}/rireki.txt`), '    1  ls\n    2  pwd\n    3  history > rireki.txt\n');
  assert.deepEqual(texts(run(sh, 'cat rireki.txt')), ['    1  ls', '    2  pwd', '    3  history > rireki.txt', '    4  cat rireki.txt'].slice(0, 3));
});
test('history >> ファイル: 追記される / > は上書きされる', () => {
  const sh = newShell();
  run(sh, 'history >> h.txt');
  run(sh, 'history >> h.txt');
  assert.equal(file(sh, `${H}/h.txt`), '    1  history >> h.txt\n    1  history >> h.txt\n    2  history >> h.txt\n');
  run(sh, 'history > h.txt');
  assert.equal(file(sh, `${H}/h.txt`), '    1  history >> h.txt\n    2  history >> h.txt\n    3  history > h.txt\n');
});
test('history 3 > ファイル: 件数指定も使える', () => {
  const sh = newShell();
  for (const c of ['ls', 'pwd', 'cd ..', 'cd']) run(sh, c);
  run(sh, 'history 2 > last.txt');
  assert.equal(file(sh, `${H}/last.txt`), '    5  cd\n'.replace('5  cd', '4  cd') + '    5  history 2 > last.txt\n');
});
test('cat > ファイル: コピー・連結・追記', () => {
  const sh = newShell();
  run(sh, 'cat practice/hello.txt > copy.txt');
  assert.equal(file(sh, `${H}/copy.txt`), 'Hello, Linux!\n');
  run(sh, 'cat practice/hello.txt Documents/todo.txt > both.txt');
  assert.equal(file(sh, `${H}/both.txt`), 'Hello, Linux!\n1. ls を使う\n2. cd で移動する\n3. mkdir でディレクトリを作る\n');
  run(sh, 'cat practice/memo.txt >> copy.txt');
  assert.equal(file(sh, `${H}/copy.txt`), 'Hello, Linux!\nこれは小文字の memo.txt です。\n');
  assert.deepEqual(run(sh, 'cat practice/hello.txt > copy.txt').lines, []);
  assert.equal(file(sh, `${H}/copy.txt`), 'Hello, Linux!\n');
});

// ---- 書き方いろいろ
test('スペースの有無・クォート・~・パス指定', () => {
  const sh = newShell();
  run(sh, 'pwd>a1');
  run(sh, 'pwd >a2');
  run(sh, 'pwd> a3');
  run(sh, 'pwd >> a4');
  run(sh, 'pwd>>a5');
  run(sh, 'pwd   >   a6');
  for (const n of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) assert.equal(file(sh, `${H}/${n}`), `${H}\n`, n);
  run(sh, 'pwd > "my file.txt"');
  assert.equal(file(sh, `${H}/my file.txt`), `${H}\n`);
  run(sh, 'cd /tmp');
  run(sh, 'pwd > ~/from-tmp.txt');
  assert.equal(file(sh, `${H}/from-tmp.txt`), '/tmp\n');
  run(sh, 'pwd > /tmp/abs.txt');
  assert.equal(file(sh, '/tmp/abs.txt'), '/tmp\n');
  run(sh, 'pwd > ../tmp/rel.txt');
  assert.equal(file(sh, '/tmp/rel.txt'), '/tmp\n');
  // リダイレクトを先に書いても同じ
  run(sh, '> first.txt pwd');
  assert.equal(file(sh, '/tmp/first.txt'), '/tmp\n');
});
test('クォートの中の > は普通の文字', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'mkdir "a>b"').lines, []);
  assert.ok(stdoutOf(run(sh, 'ls'))[0]?.includes("'a>b'"));
});
test('コマンドなしの > ファイル は、空のファイルを作る／空にする', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, '> new.txt').lines, []);
  assert.equal(file(sh, `${H}/new.txt`), '');
  assert.ok(file(sh, `${H}/README.txt`).length > 0);
  run(sh, '> README.txt');
  assert.equal(file(sh, `${H}/README.txt`), '');
  run(sh, '>> README.txt');
  assert.equal(file(sh, `${H}/README.txt`), '');
});
test('複数のリダイレクト: すべて作られ、出力は最後のファイルへ', () => {
  const sh = newShell();
  run(sh, 'pwd > a > b');
  assert.equal(file(sh, `${H}/a`), '');
  assert.equal(file(sh, `${H}/b`), `${H}\n`);
});

// ---- 出力と、エラー・ヒントの分け方
test('エラーとヒントは画面に出て、ファイルには入らない', () => {
  const sh = newShell();
  const r = run(sh, 'cat README.txt nothing > out.txt');
  assert.deepEqual(errorsOf(r), ['cat: nothing: No such file or directory']);
  assert.ok(hintsOf(r).length > 0);
  assert.deepEqual(stdoutOf(r), []);
  assert.ok(file(sh, `${H}/out.txt`).includes('ようこそ'));
  assert.ok(!file(sh, `${H}/out.txt`).includes('nothing'));
});
test('コマンドが失敗・存在しなくても、書き込み先は作られる（本物と同じ）', () => {
  const sh = newShell();
  const r = run(sh, 'foo > e.txt');
  assert.deepEqual(errorsOf(r), ['bash: foo: command not found']);
  assert.equal(file(sh, `${H}/e.txt`), '');
  run(sh, 'cat nothing > e2.txt');
  assert.equal(file(sh, `${H}/e2.txt`), '');
});
test('ls > ファイル: 1行に1つ・引用符なし。ファイル自身も含まれる', () => {
  const sh = newShell();
  run(sh, 'mkdir "my dir"');
  const r = run(sh, 'ls > list.txt');
  assert.deepEqual(r.lines, []);
  assert.equal(
    file(sh, `${H}/list.txt`),
    'Documents\nDownloads\nlist.txt\nmy dir\nPictures\npractice\nREADME.txt\n',
  );
  run(sh, 'ls -a > all.txt');
  assert.ok(file(sh, `${H}/all.txt`).startsWith('.\n..\n'));
  assert.ok(file(sh, `${H}/all.txt`).includes('\n.bashrc\n') && file(sh, `${H}/all.txt`).includes('\nall.txt\n'));
  run(sh, 'ls Documents Pictures > two.txt');
  assert.equal(file(sh, `${H}/two.txt`), 'Documents:\nmemo.txt\ntodo.txt\n\nPictures:\nlist.txt\n');
  // 画面に出すときは、元どおり横に並ぶ
  assert.deepEqual(stdoutOf(run(sh, 'ls Documents')), ['memo.txt  todo.txt']);
});
test('help > ファイル / 出力のないコマンド', () => {
  const sh = newShell();
  run(sh, 'help > help.txt');
  assert.ok(file(sh, `${H}/help.txt`).includes('history'));
  const r = run(sh, 'mkdir newdir > m.txt');
  assert.deepEqual(r.lines, []);
  assert.equal(file(sh, `${H}/m.txt`), '');
  assert.ok(stdoutOf(run(sh, 'ls'))[0]?.includes('newdir'));
});
test('clear > ファイル は画面をクリアしない / nano は使えない', () => {
  const sh = newShell();
  assert.equal(run(sh, 'clear > c.txt').clear, false);
  assert.equal(run(sh, 'clear').clear, true);
  const r = run(sh, 'nano x.txt > y.txt');
  assert.equal(r.edit, undefined);
  assert.deepEqual(errorsOf(r), ['nano: cannot be used with output redirection']);
});
test('/dev/null に書くと出力が捨てられる', () => {
  const sh = newShell();
  const r = run(sh, 'ls > /dev/null');
  assert.deepEqual(r.lines, []);
  assert.deepEqual(errorsOf(run(sh, 'ls /dev')), ["ls: cannot access '/dev': No such file or directory"]);
  const e = run(sh, 'cat nothing > /dev/null');
  assert.equal(errorsOf(e).length, 1); // エラーは画面に出る
});

// ---- 書き込み先が使えないとき: コマンドは実行しない
test('書き込み先が開けないとき、コマンドは実行されない', () => {
  const sh = newShell();
  const cases: Array<[string, string]> = [
    ['mkdir zz > Documents', 'bash: Documents: Is a directory'],
    ['mkdir zz > nodir/x.txt', 'bash: nodir/x.txt: No such file or directory'],
    ['mkdir zz > /etc/new.txt', 'bash: /etc/new.txt: Permission denied'],
    ['mkdir zz > /etc/hostname', 'bash: /etc/hostname: Permission denied'],
    ['mkdir zz > /home/teacher/x', 'bash: /home/teacher/x: Permission denied'],
    ['mkdir zz > README.txt/x', 'bash: README.txt/x: Not a directory'],
  ];
  for (const [line, msg] of cases) {
    const r = run(sh, line);
    assert.deepEqual(errorsOf(r), [msg], line);
  }
  assert.ok(!stdoutOf(run(sh, 'ls'))[0]?.includes('zz'), 'mkdir は実行されていない');
  assert.equal(file(sh, '/etc/hostname'), 'joho\n');
});
test('cat で読むファイルと書き込み先が同じとき', () => {
  const sh = newShell();
  const r = run(sh, 'cat README.txt > README.txt');
  assert.deepEqual(errorsOf(r), ['cat: README.txt: input file is output file']);
  assert.equal(file(sh, `${H}/README.txt`), '', '本物と同じく、> で先に空になる');
  run(sh, 'cat practice/hello.txt >> practice/hello.txt');
  assert.equal(file(sh, `${H}/practice/hello.txt`), 'Hello, Linux!\n', '>> は壊れない');
});

// ---- 書き方の誤りと、未対応のもの
test('書き方の誤り', () => {
  const sh = newShell();
  const nl = run(sh, 'history >');
  assert.deepEqual(errorsOf(nl), ["bash: syntax error near unexpected token `newline'"]);
  assert.ok(hintsOf(nl)[0]?.includes('ファイル名'));
  assert.deepEqual(errorsOf(run(sh, 'history >>')), ["bash: syntax error near unexpected token `newline'"]);
  assert.deepEqual(errorsOf(run(sh, 'ls > > x')), ["bash: syntax error near unexpected token `>'"]);
  assert.deepEqual(errorsOf(run(sh, 'ls >>> x')), ["bash: syntax error near unexpected token `>'"]);
  assert.deepEqual(errorsOf(run(sh, 'ls > | x')), ["bash: syntax error near unexpected token `|'"]);
  assert.deepEqual(errorsOf(run(sh, 'ls >; x')), ["bash: syntax error near unexpected token `;'"]);
  // 失敗したときは何も実行・作成されない
  assert.equal(errorsOf(run(sh, 'cat x')).length, 1, 'x というファイルは作られていない');
});
test('未対応のリダイレクトは未対応と表示する', () => {
  const sh = newShell();
  for (const [line, token] of [
    ['ls 2> e', '2>'],
    ['ls >& e', '>&'],
    ['ls &> e', '&>'],
    ['ls >| e', '>|'],
    ['cat < README.txt', '<'],
    ['cat << EOF', '<<'],
  ] as const) {
    assert.deepEqual(errorsOf(run(sh, line)), [`bash: syntax '${token}' is not supported in this simulator`], line);
  }
  assert.ok(!stdoutOf(run(sh, 'ls'))[0]?.includes(' e'));
});
test('全角の ＞ は、半角を促すヒントが出る', () => {
  const r = run(newShell(), 'history ＞ a.txt');
  assert.ok(errorsOf(r).length > 0);
  assert.ok(hintsOf(r).some((h) => h.includes('半角')));
});
test('Tab補完は > の後ろのファイル名にも効く', () => {
  const sh = newShell();
  assert.deepEqual(sh.complete('ls > Doc'), { line: 'ls > Documents/', candidates: [] });
  assert.deepEqual(sh.complete('history > RE'), { line: 'history > README.txt ', candidates: [] });
});

// ---- 容量・保存・状態
test('大きすぎる出力は書き込めず、元のファイルは変わらない', () => {
  const sh = newShell();
  sh.saveFile(`${H}/big.txt`, 'x'.repeat(60_000) + '\n');
  run(sh, 'cat big.txt > b2.txt');
  const r = run(sh, 'cat big.txt big.txt > b3.txt');
  assert.ok(errorsOf(r)[0]?.includes('No space left on device'));
  assert.equal(file(sh, `${H}/b3.txt`), '', '書き込めなかったときは空のまま');
  const before = file(sh, `${H}/b2.txt`);
  const r2 = run(sh, 'cat big.txt >> b2.txt'); // 追記すると10万文字を超える
  assert.ok(errorsOf(r2)[0]?.includes('No space left on device'));
  assert.equal(file(sh, `${H}/b2.txt`), before, '追記に失敗しても元の内容は変わらない');
});
test('リダイレクトの結果が保存→復元で保たれ、状態が残らない', () => {
  const st = new MemoryStorage();
  const sh = newShell();
  run(sh, 'ls > list.txt');
  assert.equal(sh.state.stdoutFile, null, '実行後は画面出力に戻る');
  saveShell(st, sh);
  const { shell, status } = loadShell(st, createDefaultEnvironment());
  assert.equal(status, 'restored');
  assert.ok(file(shell, `${H}/list.txt`).includes('Documents\n'));
  assert.deepEqual(stdoutOf(run(shell, 'ls Documents')), ['memo.txt  todo.txt']);
});
test('history の記録: リダイレクトを含む行もそのまま残る', () => {
  const sh = newShell();
  run(sh, 'ls > a.txt');
  run(sh, 'history >');
  assert.deepEqual([...sh.history], ['ls > a.txt', 'history >']);
});
