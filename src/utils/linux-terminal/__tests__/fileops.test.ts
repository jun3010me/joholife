import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newShell, run, stdoutOf, errorsOf, hintsOf, texts } from './helpers.ts';

const ls = (sh: ReturnType<typeof newShell>, path = '.') => stdoutOf(run(sh, `ls ${path}`))[0] ?? '';

// ---- touch
test('touch: 空のファイルを作る / すでにあれば何もしない', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'touch a.txt b.txt').lines, []);
  assert.ok(ls(sh).includes('a.txt') && ls(sh).includes('b.txt'));
  assert.deepEqual(run(sh, 'cat a.txt').lines, []);
  assert.deepEqual(run(sh, 'touch README.txt').lines, []);
  assert.deepEqual(texts(run(sh, 'cat README.txt'))[0]?.includes('ようこそ'), true); // 中身は変わらない
});
test('touch: エラー系', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'touch')), ['touch: missing operand', "Try 'touch --help' for more information."]);
  assert.deepEqual(errorsOf(run(sh, 'touch nodir/a.txt')), ["touch: cannot touch 'nodir/a.txt': No such file or directory"]);
  assert.deepEqual(errorsOf(run(sh, 'touch /etc/new.txt')), ["touch: cannot touch '/etc/new.txt': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'touch /home/teacher/x')), ["touch: cannot touch '/home/teacher/x': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'touch README.txt/x')), ["touch: cannot touch 'README.txt/x': Not a directory"]);
  assert.deepEqual(errorsOf(run(sh, 'touch -a x')), ["touch: option '-a' is not supported in this simulator"]);
});

// ---- rm
test('rm: ファイルを削除する', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'rm README.txt').lines, []);
  assert.ok(!ls(sh).includes('README.txt'));
  assert.deepEqual(errorsOf(run(sh, 'cat README.txt')), ['cat: README.txt: No such file or directory']);
});
test('rm: エラー系と -f', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'rm')), ['rm: missing operand', "Try 'rm --help' for more information."]);
  assert.deepEqual(errorsOf(run(sh, 'rm nothing')), ["rm: cannot remove 'nothing': No such file or directory"]);
  assert.deepEqual(run(sh, 'rm -f nothing').lines, []);
  assert.deepEqual(run(sh, 'rm -f').lines, []);
  const d = run(sh, 'rm Documents');
  assert.deepEqual(errorsOf(d), ["rm: cannot remove 'Documents': Is a directory"]);
  assert.ok(hintsOf(d)[0]?.includes('rm -r'));
  assert.deepEqual(errorsOf(run(sh, 'rm /etc/hostname')), ["rm: cannot remove '/etc/hostname': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'rm /home/teacher/grades.txt')), ["rm: cannot remove '/home/teacher/grades.txt': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'rm -i x')), ["rm: option '-i' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'rm .')).length, 1);
  assert.deepEqual(errorsOf(run(sh, 'rm ..')).length, 1);
  // 1つ失敗しても残りは消す
  const r = run(sh, 'rm nothing README.txt');
  assert.equal(errorsOf(r).length, 1);
  assert.ok(!ls(sh).includes('README.txt'));
});
test('rm -r: ディレクトリを中身ごと削除する', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'rm -r practice').lines, []);
  assert.ok(!ls(sh).includes('practice'));
  assert.deepEqual(run(sh, 'rm -rf Documents Pictures').lines, []);
  assert.ok(!ls(sh).includes('Documents') && !ls(sh).includes('Pictures'));
  assert.deepEqual(errorsOf(run(sh, 'rm -r /etc')), ["rm: cannot remove '/etc': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'rm -r /home/teacher')), ["rm: cannot remove '/home/teacher': Permission denied"]);
  assert.ok(stdoutOf(run(sh, 'ls /etc'))[0]?.includes('passwd'));
});
test('rm: / と、今いる場所を含むディレクトリは消せない', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'rm -rf /')), ["rm: it is dangerous to operate recursively on '/'"]);
  assert.deepEqual(errorsOf(run(sh, 'rm /')), ["rm: cannot remove '/': Is a directory"]);
  assert.ok(stdoutOf(run(sh, 'ls /'))[0]?.includes('etc'));
  run(sh, 'cd practice/sample');
  assert.deepEqual(errorsOf(run(sh, 'rm -r ~/practice')), ["rm: cannot remove '~/practice': Device or resource busy"].map(() => "rm: cannot remove '/home/student/practice': Device or resource busy"));
  assert.deepEqual(errorsOf(run(sh, 'rm -r .')).length, 1);
  assert.equal(sh.cwd, '/home/student/practice/sample');
  assert.deepEqual(errorsOf(run(sh, 'rm -r /home/student')).length, 1);
  // cwd の外は消せる
  assert.deepEqual(run(sh, 'rm -r ../../Documents').lines, []);
});

// ---- rmdir
test('rmdir: 空のディレクトリだけ削除できる', () => {
  const sh = newShell();
  run(sh, 'mkdir empty');
  assert.deepEqual(run(sh, 'rmdir empty').lines, []);
  assert.ok(!ls(sh).includes('empty'));
  const r = run(sh, 'rmdir Documents');
  assert.deepEqual(errorsOf(r), ["rmdir: failed to remove 'Documents': Directory not empty"]);
  assert.ok(hintsOf(r)[0]?.includes('rm -r'));
  assert.deepEqual(errorsOf(run(sh, 'rmdir README.txt')), ["rmdir: failed to remove 'README.txt': Not a directory"]);
  assert.deepEqual(errorsOf(run(sh, 'rmdir nothing')), ["rmdir: failed to remove 'nothing': No such file or directory"]);
  assert.deepEqual(errorsOf(run(sh, 'rmdir /tmp')), ["rmdir: failed to remove '/tmp': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'rmdir')).length, 2);
  run(sh, 'mkdir e2'); run(sh, 'cd e2');
  assert.deepEqual(errorsOf(run(sh, 'rmdir .')).length >= 1, true);
  assert.deepEqual(errorsOf(run(sh, 'rmdir ../e2'))[0], "rmdir: failed to remove '../e2': Device or resource busy");
});

// ---- mv
test('mv: 名前の変更', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'mv README.txt readme2.txt').lines, []);
  assert.ok(!ls(sh).includes('README.txt') && ls(sh).includes('readme2.txt'));
  assert.ok(texts(run(sh, 'cat readme2.txt'))[0]?.includes('ようこそ'));
  run(sh, 'mv practice drill');
  assert.ok(ls(sh, 'drill').includes('hello.txt'));
});
test('mv: ディレクトリの中へ移動（複数も可）', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'mv README.txt Documents').lines, []);
  assert.ok(ls(sh, 'Documents').includes('README.txt'));
  run(sh, 'touch a b');
  assert.deepEqual(run(sh, 'mv a b Pictures/').lines, []);
  assert.ok(ls(sh, 'Pictures').includes('a') && ls(sh, 'Pictures').includes('b'));
  run(sh, 'mv Pictures Documents');
  assert.ok(ls(sh, 'Documents/Pictures').includes('list.txt'));
  run(sh, 'cd Documents/Pictures');
  assert.equal(sh.cwd, '/home/student/Documents/Pictures');
});
test('mv: ファイルの上書き', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'mv practice/hello.txt practice/memo.txt').lines, []);
  assert.deepEqual(texts(run(sh, 'cat practice/memo.txt')), ['Hello, Linux!']);
  assert.ok(!ls(sh, 'practice').includes('hello.txt'));
});
test('mv: エラー系', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'mv')), ['mv: missing file operand', "Try 'mv --help' for more information."]);
  assert.deepEqual(errorsOf(run(sh, 'mv README.txt')), ["mv: missing destination file operand after 'README.txt'", "Try 'mv --help' for more information."]);
  assert.deepEqual(errorsOf(run(sh, 'mv nothing x')), ["mv: cannot stat 'nothing': No such file or directory"]);
  assert.deepEqual(errorsOf(run(sh, 'mv README.txt nodir/x')), ["mv: cannot move 'README.txt' to 'nodir/x': No such file or directory"]);
  assert.deepEqual(errorsOf(run(sh, 'mv README.txt /etc')), ["mv: cannot move 'README.txt' to '/etc/README.txt': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'mv /etc/hostname .')), ["mv: cannot move '/etc/hostname' to './hostname': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'mv README.txt README.txt')), ["mv: 'README.txt' and 'README.txt' are the same file"]);
  assert.deepEqual(errorsOf(run(sh, 'mv Documents Documents/x')), ["mv: cannot move 'Documents' to a subdirectory of itself, 'Documents/x'"]);
  assert.deepEqual(errorsOf(run(sh, 'mv Documents Documents')).length, 1);
  assert.deepEqual(errorsOf(run(sh, 'mv Documents README.txt')), ["mv: cannot overwrite non-directory 'README.txt' with directory 'Documents'"]);
  assert.deepEqual(errorsOf(run(sh, 'mv README.txt Documents/')).length, 0);
  assert.deepEqual(errorsOf(run(sh, 'mv Pictures Downloads nothing')), ["mv: target 'nothing' is not a directory"]);
  assert.deepEqual(errorsOf(run(sh, 'mv Pictures nothing/')), ["mv: target 'nothing/' is not a directory"]);
  assert.deepEqual(errorsOf(run(sh, 'mv -f a b')), ["mv: option '-f' is not supported in this simulator"]);
  // 失敗したときは何も変わらない
  assert.ok(ls(sh).includes('Pictures'));
});
test('mv: 今いる場所を含むディレクトリは動かせない', () => {
  const sh = newShell();
  run(sh, 'cd practice');
  assert.deepEqual(errorsOf(run(sh, 'mv . ../x'))[0], "mv: cannot move '.' to '../x': Device or resource busy");
  assert.deepEqual(errorsOf(run(sh, 'mv ../practice ../x'))[0], "mv: cannot move '../practice' to '../x': Device or resource busy");
  assert.equal(sh.cwd, '/home/student/practice');
});
test('mv: ディレクトリは空のディレクトリにだけ上書きできる', () => {
  const sh = newShell();
  run(sh, 'mkdir e');
  assert.deepEqual(run(sh, 'mv Pictures e').lines, []); // e の中へ移動
  assert.ok(ls(sh, 'e').includes('Pictures'));
  run(sh, 'mkdir x1'); run(sh, 'mkdir -p x2/Pictures'); run(sh, 'touch x2/Pictures/f');
  assert.deepEqual(errorsOf(run(sh, 'mv e/Pictures x2')), ["mv: cannot move 'e/Pictures' to 'x2/Pictures': Directory not empty"]);
});

// ---- cp
test('cp: ファイルのコピー', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'cp README.txt copy.txt').lines, []);
  assert.ok(ls(sh).includes('README.txt') && ls(sh).includes('copy.txt'));
  assert.deepEqual(texts(run(sh, 'cat copy.txt')), texts(run(sh, 'cat README.txt')));
  assert.deepEqual(run(sh, 'cp README.txt Documents').lines, []);
  assert.ok(ls(sh, 'Documents').includes('README.txt'));
  // コピーはあとから書き換えても元に影響しない
  run(sh, 'cp practice/hello.txt practice/memo.txt'); // 上書き
  assert.deepEqual(texts(run(sh, 'cat practice/memo.txt')), ['Hello, Linux!']);
});
test('cp: コピーは独立している（内容を書き換えても元は変わらない）', () => {
  const sh = newShell();
  run(sh, 'cp README.txt c.txt');
  assert.equal(sh.saveFile('/home/student/c.txt', 'changed\n').ok, true);
  assert.ok(texts(run(sh, 'cat README.txt'))[0]?.includes('ようこそ'));
  assert.deepEqual(texts(run(sh, 'cat c.txt')), ['changed']);
});
test('cp -r: ディレクトリのコピー', () => {
  const sh = newShell();
  const r = run(sh, 'cp practice practice2');
  assert.deepEqual(errorsOf(r), ["cp: -r not specified; omitting directory 'practice'"]);
  assert.deepEqual(run(sh, 'cp -r practice practice2').lines, []);
  assert.ok(ls(sh, 'practice2/sample/deep').includes('secret.txt'));
  assert.deepEqual(run(sh, 'cp -r practice Documents').lines, []);
  assert.ok(ls(sh, 'Documents/practice').includes('hello.txt'));
  assert.deepEqual(errorsOf(run(sh, 'cp -r practice Documents')).length, 1); // すでにある
  assert.deepEqual(errorsOf(run(sh, 'cp -r practice practice/sample/x')), ["cp: cannot copy a directory, 'practice', into itself, 'practice/sample/x'"]);
});
test('cp: エラー系', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'cp README.txt')), ["cp: missing destination file operand after 'README.txt'", "Try 'cp --help' for more information."]);
  assert.deepEqual(errorsOf(run(sh, 'cp nothing x')), ["cp: cannot stat 'nothing': No such file or directory"]);
  assert.deepEqual(errorsOf(run(sh, 'cp /etc/shadow .')), ["cp: cannot open '/etc/shadow' for reading: Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'cp README.txt /etc')), ["cp: cannot create regular file '/etc/README.txt': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'cp /etc/hostname README.txt')).length, 0); // 自分のファイルへの上書きはできる
  assert.deepEqual(errorsOf(run(sh, 'cp README.txt /etc/hostname')), ["cp: cannot create regular file '/etc/hostname': Permission denied"]);
  assert.deepEqual(errorsOf(run(sh, 'cp README.txt README.txt')), ["cp: 'README.txt' and 'README.txt' are the same file"]);
  assert.deepEqual(errorsOf(run(sh, 'cp README.txt Documents nothing')), ["cp: target 'nothing' is not a directory"]);
  assert.deepEqual(errorsOf(run(sh, 'cp -p a b')), ["cp: option '-p' is not supported in this simulator"]);
});
test('cp: 他ユーザーのファイルは読めないのでコピーできない', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'cp /home/teacher/grades.txt .')).length, 1);
  assert.deepEqual(errorsOf(run(sh, 'cp -r /home/teacher .')).length, 1);
});

// ---- nano / saveFile
test('nano: 既存ファイルを開く依頼を返す', () => {
  const sh = newShell();
  const r = run(sh, 'nano README.txt');
  assert.deepEqual(r.lines, []);
  assert.equal(r.edit?.path, '/home/student/README.txt');
  assert.equal(r.edit?.isNew, false);
  assert.equal(r.edit?.readOnly, false);
  assert.ok(r.edit?.content.includes('ようこそ'));
  assert.deepEqual([...sh.history], ['nano README.txt']);
});
test('nano: 新規ファイル・読み取り専用・エラー', () => {
  const sh = newShell();
  const n = run(sh, 'nano new.txt').edit;
  assert.equal(n?.isNew, true);
  assert.equal(n?.content, '');
  assert.ok(!ls(sh).includes('new.txt'), '保存するまでファイルは作られない');
  assert.equal(run(sh, 'nano /etc/hostname').edit?.readOnly, true);
  assert.equal(run(sh, 'nano /etc/newfile').edit?.readOnly, true);
  assert.equal(run(sh, 'nano ~/Documents/x.txt').edit?.readOnly, false);
  assert.deepEqual(errorsOf(run(sh, 'nano Documents')), ['Error reading Documents: Is a directory']);
  assert.deepEqual(errorsOf(run(sh, 'nano /etc/shadow')), ['Error reading /etc/shadow: Permission denied']);
  assert.deepEqual(errorsOf(run(sh, 'nano /home/teacher/grades.txt')), ['Error reading /home/teacher/grades.txt: Permission denied']);
  assert.deepEqual(errorsOf(run(sh, 'nano nodir/x.txt')), ['Error reading nodir/x.txt: No such file or directory']);
  assert.deepEqual(errorsOf(run(sh, 'nano')), ['nano: missing file name']);
  assert.deepEqual(errorsOf(run(sh, 'nano a b')).length, 1);
  assert.deepEqual(errorsOf(run(sh, 'nano -w a')), ["nano: option '-w' is not supported in this simulator"]);
  assert.equal(run(sh, 'nano Documents').edit, undefined);
});
test('saveFile: 既存の更新と新規作成', () => {
  const sh = newShell();
  assert.deepEqual(sh.saveFile('/home/student/README.txt', 'new text\n'), { ok: true, created: false });
  assert.deepEqual(texts(run(sh, 'cat README.txt')), ['new text']);
  assert.deepEqual(sh.saveFile('/home/student/memo2.txt', 'abc\nxyz\n'), { ok: true, created: true });
  assert.deepEqual(texts(run(sh, 'cat memo2.txt')), ['abc', 'xyz']);
  assert.ok(ls(sh).includes('memo2.txt'));
  assert.deepEqual(sh.saveFile('/home/student/memo2.txt', ''), { ok: true, created: false });
  assert.deepEqual(run(sh, 'cat memo2.txt').lines, []);
});
test('saveFile: 権限・場所・大きさのエラー', () => {
  const sh = newShell();
  const bad = (path: string, content = 'x') => {
    const r = sh.saveFile(path, content);
    assert.equal(r.ok, false, path);
    return r.ok ? '' : r.message;
  };
  assert.ok(bad('/etc/hostname').includes('Permission denied'));
  assert.ok(bad('/etc/new.txt').includes('Permission denied'));
  assert.ok(bad('/home/teacher/grades.txt').includes('Permission denied'));
  assert.ok(bad('/home/student/nodir/x.txt').includes('No such file or directory'));
  assert.ok(bad('/home/student/Documents').includes('Is a directory'));
  assert.ok(bad('/home/student/big.txt', 'a'.repeat(100_001)).includes('No space left'));
  assert.ok(!ls(sh).includes('big.txt'));
  // 失敗しても元のファイルは変わらない
  assert.ok(texts(run(sh, 'cat /etc/hostname'))[0] === 'joho');
});

// ---- 容量の上限
test('ファイル・ディレクトリを作りすぎない（保存データを壊さないため）', () => {
  const sh = newShell();
  let lastErr = '';
  for (let i = 0; i < 5200; i++) {
    const r = run(sh, `touch f${i}`);
    if (r.lines.length > 0) {
      lastErr = errorsOf(r)[0] ?? '';
      break;
    }
  }
  assert.ok(lastErr.includes('No space left on device'), lastErr);
  assert.ok(errorsOf(run(sh, 'mkdir more'))[0]?.includes('No space left on device'));
  assert.ok(errorsOf(run(sh, 'cp -r practice p2'))[0]?.includes('No space left on device'));
  // 保存データは復元できる大きさに収まっている
  const snap = JSON.stringify(sh.snapshot());
  assert.ok(snap.length < 1_500_000);
  run(sh, 'rm -f f0 f1 f2');
  assert.deepEqual(run(sh, 'mkdir more').lines, []); // 空きができれば作れる
});
test('深すぎるパスは作れない', () => {
  const sh = newShell();
  const deep = Array.from({ length: 40 }, () => 'd').join('/');
  assert.ok(errorsOf(run(sh, `mkdir -p ${deep}`))[0]?.includes('File name too long'));
  assert.ok(errorsOf(run(sh, `touch ${deep}/x`))[0]?.includes('File name too long'));
});

// ---- 保存データとの組み合わせ
test('編集・削除・移動した結果が保存→復元で保たれる', async () => {
  const { saveShell, loadShell } = await import('../engine/persistence.ts');
  const { createDefaultEnvironment } = await import('../environments/default.ts');
  const { MemoryStorage } = await import('./helpers.ts');
  const st = new MemoryStorage();
  const sh = newShell();
  run(sh, 'touch note.txt');
  sh.saveFile('/home/student/note.txt', 'hello\n');
  run(sh, 'mv note.txt Documents');
  run(sh, 'rm -r practice');
  saveShell(st, sh);
  const r = loadShell(st, createDefaultEnvironment());
  assert.equal(r.status, 'restored');
  assert.deepEqual(texts(run(r.shell, 'cat Documents/note.txt')), ['hello']);
  assert.ok(!ls(r.shell).includes('practice'));
});

// ---- ダウンロード用の読み出し
test('readFile: 作った・編集したファイルの内容をそのまま取り出せる', () => {
  const sh = newShell();
  assert.deepEqual(sh.readFile('/home/student/practice/hello.txt'), {
    ok: true,
    name: 'hello.txt',
    content: 'Hello, Linux!\n',
  });
  sh.saveFile('/home/student/report.txt', '提出用\n2行目\n');
  assert.deepEqual(sh.readFile('/home/student/report.txt'), {
    ok: true,
    name: 'report.txt',
    content: '提出用\n2行目\n',
  });
  run(sh, 'mv report.txt Documents');
  assert.equal(sh.readFile('/home/student/report.txt').ok, false);
  assert.equal(sh.readFile('/home/student/Documents/report.txt').ok, true);
});
test('readFile: 読めないもの・ないもの・ディレクトリはエラー', () => {
  const sh = newShell();
  const msg = (p: string) => {
    const r = sh.readFile(p);
    return r.ok ? '' : r.message;
  };
  assert.ok(msg('/etc/shadow').includes('Permission denied'));
  assert.ok(msg('/home/teacher/grades.txt').includes('Permission denied'));
  assert.ok(msg('/home/student/nothing.txt').includes('No such file or directory'));
  assert.ok(msg('/home/student/Documents').includes('Is a directory'));
  assert.deepEqual([...sh.history], [], '読み出しは履歴に残らない');
});
