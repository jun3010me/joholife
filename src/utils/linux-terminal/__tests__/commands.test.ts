import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newShell, run, stdoutOf, errorsOf, hintsOf, texts } from './helpers.ts';

// ---- pwd
test('pwd: 現在地を表示する', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'pwd')), ['/home/student']);
  run(sh, 'cd Documents');
  assert.deepEqual(texts(run(sh, 'pwd')), ['/home/student/Documents']);
});
test('pwd: 不明なオプションはエラー', () => {
  assert.deepEqual(errorsOf(run(newShell(), 'pwd -x')), ['bash: pwd: -x: invalid option']);
});

// ---- ls
test('ls: 隠しファイルは通常表示しない / -a で表示する', () => {
  const sh = newShell();
  const normal = stdoutOf(run(sh, 'ls'))[0] ?? '';
  assert.ok(!normal.includes('.bashrc'));
  assert.ok(normal.includes('Documents') && normal.includes('README.txt'));
  const all = stdoutOf(run(sh, 'ls -a'))[0] ?? '';
  assert.ok(all.startsWith('.  ..'));
  assert.ok(all.includes('.bashrc') && all.includes('.profile'));
  assert.equal(stdoutOf(run(sh, 'ls --all'))[0], all);
});
test('ls: ディレクトリは dir スタイルで色分けされる', () => {
  const line = run(newShell(), 'ls').lines[0];
  const dirs = line?.spans?.filter((s) => s.style === 'dir').map((s) => s.text);
  assert.deepEqual(dirs, ['Documents', 'Downloads', 'Pictures', 'practice']);
});
test('ls: 場所を指定 / 複数指定 / ファイル指定', () => {
  const sh = newShell();
  assert.deepEqual(stdoutOf(run(sh, 'ls Documents')), ['memo.txt  todo.txt']);
  assert.deepEqual(stdoutOf(run(sh, 'ls Documents/memo.txt')), ['Documents/memo.txt']);
  assert.deepEqual(texts(run(sh, 'ls Documents Pictures')), [
    'Documents:',
    'memo.txt  todo.txt',
    '',
    'Pictures:',
    'list.txt',
  ]);
});
test('ls: 空のディレクトリは何も出さない', () => {
  assert.deepEqual(run(newShell(), 'ls /tmp').lines, []);
});
test('ls: 存在しない・未対応オプション', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'ls nothing')), [
    "ls: cannot access 'nothing': No such file or directory",
  ]);
  const r = run(sh, 'ls -l');
  assert.deepEqual(errorsOf(r), ["ls: option '-l' is not supported in this simulator"]);
  assert.equal(r.lines.some((l) => l.kind === 'stdout'), false);
  assert.deepEqual(errorsOf(run(sh, 'ls -la')), ["ls: option '-l' is not supported in this simulator"]);
});

// ---- cd
test('cd: エラー系', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'cd nothing')), ['bash: cd: nothing: No such file or directory']);
  assert.deepEqual(errorsOf(run(sh, 'cd README.txt')), ['bash: cd: README.txt: Not a directory']);
  assert.deepEqual(errorsOf(run(sh, 'cd a b')), ['bash: cd: too many arguments']);
  assert.deepEqual(errorsOf(run(sh, 'cd -')), ["bash: cd: '-' is not supported in this simulator"]);
  assert.equal(sh.cwd, '/home/student');
});

// ---- mkdir
test('mkdir: ディレクトリを作る（相対・絶対・複数）', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'mkdir test').lines, []);
  assert.deepEqual(stdoutOf(run(sh, 'ls'))[0]?.includes('test'), true);
  run(sh, 'mkdir /tmp/x ~/y');
  assert.deepEqual(stdoutOf(run(sh, 'ls /tmp')), ['x']);
  assert.ok(stdoutOf(run(sh, 'ls'))[0]?.includes('y'));
  run(sh, 'cd test');
  assert.equal(sh.cwd, '/home/student/test');
});
test('mkdir: エラー系', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'mkdir')), [
    'mkdir: missing operand',
    "Try 'mkdir --help' for more information.",
  ]);
  assert.deepEqual(errorsOf(run(sh, 'mkdir Documents')), [
    'mkdir: cannot create directory ‘Documents’: File exists',
  ]);
  assert.deepEqual(errorsOf(run(sh, 'mkdir README.txt')), [
    'mkdir: cannot create directory ‘README.txt’: File exists',
  ]);
  assert.deepEqual(errorsOf(run(sh, 'mkdir a/b')), [
    'mkdir: cannot create directory ‘a/b’: No such file or directory',
  ]);
  assert.deepEqual(errorsOf(run(sh, 'mkdir /etc/x')), [
    'mkdir: cannot create directory ‘/etc/x’: Permission denied',
  ]);
  assert.deepEqual(errorsOf(run(sh, 'mkdir /home/teacher/x')), [
    'mkdir: cannot create directory ‘/home/teacher/x’: Permission denied',
  ]);
  assert.deepEqual(errorsOf(run(sh, 'mkdir README.txt/x')), [
    'mkdir: cannot create directory ‘README.txt/x’: Not a directory',
  ]);
  assert.deepEqual(errorsOf(run(sh, 'mkdir -v a')), ["mkdir: option '-v' is not supported in this simulator"]);
});
test('mkdir -p: 途中のディレクトリも作る / 既存はエラーにしない', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'mkdir -p a/b/c').lines, []);
  run(sh, 'cd a/b/c');
  assert.equal(sh.cwd, '/home/student/a/b/c');
  assert.deepEqual(run(sh, 'mkdir -p ~/a/b').lines, []);
  assert.deepEqual(errorsOf(run(sh, 'mkdir -p /etc/x/y')), [
    'mkdir: cannot create directory ‘/etc/x/y’: Permission denied',
  ]);
});
test('mkdir: 一部が失敗しても残りは作る', () => {
  const sh = newShell();
  const r = run(sh, 'mkdir Documents newdir');
  assert.equal(errorsOf(r).length, 1);
  assert.ok(stdoutOf(run(sh, 'ls'))[0]?.includes('newdir'));
});
test('mkdir: __proto__ のような名前でも安全', () => {
  const sh = newShell();
  assert.deepEqual(run(sh, 'mkdir __proto__ constructor').lines, []);
  assert.ok(stdoutOf(run(sh, 'ls'))[0]?.includes('__proto__'));
  run(sh, 'cd __proto__');
  assert.equal(sh.cwd, '/home/student/__proto__');
});

// ---- cat
test('cat: ファイルの中身を表示する（複数も可）', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'cat practice/hello.txt')), ['Hello, Linux!']);
  assert.deepEqual(texts(run(sh, 'cat practice/hello.txt Documents/todo.txt')), [
    'Hello, Linux!',
    '1. ls を使う',
    '2. cd で移動する',
    '3. mkdir でディレクトリを作る',
  ]);
});
test('cat: エラー系', () => {
  const sh = newShell();
  assert.deepEqual(errorsOf(run(sh, 'cat nothing.txt')), ['cat: nothing.txt: No such file or directory']);
  assert.deepEqual(errorsOf(run(sh, 'cat Documents')), ['cat: Documents: Is a directory']);
  assert.deepEqual(errorsOf(run(sh, 'cat')), ['cat: missing file operand']);
  assert.deepEqual(errorsOf(run(sh, 'cat -n README.txt')), ["cat: option '-n' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'cat /etc/shadow')), ['cat: /etc/shadow: Permission denied']);
  // 1つ失敗しても残りは表示する
  const r = run(sh, 'cat nothing.txt practice/hello.txt');
  assert.deepEqual(stdoutOf(r), ['Hello, Linux!']);
  assert.equal(errorsOf(r).length, 1);
});

// ---- 大文字小文字
test('ファイル名・ディレクトリ名は大文字小文字を区別する', () => {
  const sh = newShell();
  assert.deepEqual(texts(run(sh, 'cat practice/memo.txt')), ['これは小文字の memo.txt です。']);
  assert.deepEqual(texts(run(sh, 'cat practice/Memo.txt')), [
    'これは大文字で始まる Memo.txt です。別のファイルです。',
  ]);
  const r = run(sh, 'cd documents');
  assert.deepEqual(errorsOf(r), ['bash: cd: documents: No such file or directory']);
  assert.ok(hintsOf(r)[0]?.includes('Documents'), '大文字小文字のヒントが出る');
  assert.equal(sh.cwd, '/home/student');
  assert.deepEqual(errorsOf(run(sh, 'LS')), ['bash: LS: command not found']);
  assert.ok(hintsOf(run(sh, 'LS'))[0]?.includes('ls'));
  run(sh, 'mkdir Test');
  run(sh, 'mkdir test'); // 別のディレクトリとして作れる
  assert.deepEqual(errorsOf(run(sh, 'mkdir test')), ['mkdir: cannot create directory ‘test’: File exists']);
});

// ---- clear / help
test('clear: clear フラグを返す', () => {
  const r = run(newShell(), 'clear');
  assert.equal(r.clear, true);
  assert.deepEqual(r.lines, []);
  assert.deepEqual(errorsOf(run(newShell(), 'clear x')).length, 1);
});
test('help: 一覧と個別説明', () => {
  const sh = newShell();
  const all = texts(run(sh, 'help')).join('\n');
  for (const c of ['pwd', 'ls', 'cd', 'mkdir', 'cat', 'echo', 'touch', 'nano', 'cp', 'mv', 'rm', 'rmdir', 'history', 'clear', 'help']) assert.ok(all.includes(c));
  assert.ok(texts(run(sh, 'help ls')).join('\n').includes('-a'));
  assert.deepEqual(errorsOf(run(sh, 'help foo')), ["bash: help: no help topics match 'foo'."]);
});

// ---- 他ユーザー
test('他ユーザーのホームは Permission denied', () => {
  const sh = newShell();
  const cdr = run(sh, 'cd /home/teacher');
  assert.deepEqual(errorsOf(cdr), ['bash: cd: /home/teacher: Permission denied']);
  assert.equal(sh.cwd, '/home/student');
  assert.deepEqual(errorsOf(run(sh, 'ls /home/teacher')), [
    "ls: cannot open directory '/home/teacher': Permission denied",
  ]);
  assert.deepEqual(errorsOf(run(sh, 'cat /home/teacher/grades.txt')), [
    'cat: /home/teacher/grades.txt: Permission denied',
  ]);
  assert.deepEqual(errorsOf(run(sh, 'cd ~teacher')), ['bash: cd: /home/teacher: Permission denied']);
  assert.deepEqual(errorsOf(run(sh, 'cd /home/teacher/private')), [
    'bash: cd: /home/teacher/private: Permission denied',
  ]);
  assert.deepEqual(errorsOf(run(sh, 'ls /home/teacher/private')), [
    "ls: cannot access '/home/teacher/private': Permission denied",
  ]);
  // /home 自体は見られ、teacher の存在は分かる
  assert.deepEqual(stdoutOf(run(sh, 'ls /home')), ['student  teacher']);
});

// ---- 空入力
test('空入力・空白のみ: 何も実行せず、履歴にも状態にも影響しない', () => {
  const sh = newShell();
  run(sh, 'cd Documents');
  const before = JSON.stringify(sh.snapshot());
  for (const input of ['', ' ', '   ', '\t', ' \t ']) {
    const r = run(sh, input);
    assert.equal(r.empty, true);
    assert.equal(r.recorded, false);
    assert.deepEqual(r.lines, []);
    assert.equal(r.clear, false);
  }
  assert.equal(JSON.stringify(sh.snapshot()), before);
  assert.deepEqual([...sh.history], ['cd Documents']);
});

// ---- 初心者向けヒント
test('Windows コマンドのヒント', () => {
  const sh = newShell();
  for (const [win, linux] of [['dir', 'ls'], ['cls', 'clear'], ['type', 'cat'], ['md', 'mkdir'], ['copy', 'cp'], ['del', 'rm'], ['move', 'mv'], ['ren', 'mv'], ['rd', 'rmdir'], ['notepad', 'nano']]) {
    const r = run(sh, `${win} x`);
    assert.deepEqual(errorsOf(r), [`bash: ${win}: command not found`]);
    assert.ok(hintsOf(r)[0]?.includes(linux as string), `${win} -> ${linux}`);
  }
  assert.ok(hintsOf(run(sh, 'cd..'))[0]?.includes('cd ..'));
});
test('未実装コマンドは実装済みに見せない', () => {
  const r = run(newShell(), 'grep a a.txt');
  assert.deepEqual(errorsOf(r), ['bash: grep: command not available in this simulator']);
  assert.ok(hintsOf(run(newShell(), 'vim a.txt'))[0]?.includes('nano'));
});
test('command not found と打ち間違いの提案', () => {
  const sh = newShell();
  const r = run(sh, 'foo');
  assert.deepEqual(errorsOf(r), ['bash: foo: command not found']);
  assert.ok(hintsOf(r)[0]?.includes('help'));
  assert.ok(hintsOf(run(sh, 'sl'))[0] !== undefined);
  assert.ok(hintsOf(run(sh, 'lss'))[0]?.includes('もしかして ls'));
});
test('全角文字が原因のエラーは半角入力を促す', () => {
  const sh = newShell();
  for (const line of ['ｌｓ', 'ls　-a', 'cd　Documents', 'ls −a', 'cat memo.txt　']) {
    const r = run(sh, line);
    assert.ok(errorsOf(r).length > 0, line);
    assert.ok(hintsOf(r).some((h) => h.includes('半角')), `半角ヒント: ${line}`);
  }
  // 全角を含んでいても成功したときはヒントを出さない
  const ok = run(sh, 'mkdir あいう');
  assert.deepEqual(ok.lines, []);
});
test('Windows の区切り文字 \\ を使ったとき', () => {
  const r = run(newShell(), 'cat practice\\hello.txt');
  assert.ok(errorsOf(r).length > 0);
  assert.ok(hintsOf(r).some((h) => h.includes('/')));
});

// ---- 未対応構文
test('パイプ・リダイレクト・ワイルドカード・変数は未対応と表示する', () => {
  const sh = newShell();
  const before = JSON.stringify(sh.snapshot().fs);
  const cases: Array<[string, string]> = [
    ['ls | cat', "bash: syntax '|' is not supported in this simulator"],
    ['ls < in.txt', "bash: syntax '<' is not supported in this simulator"],
    ['ls 2> err.txt', "bash: syntax '2>' is not supported in this simulator"],
    ['ls && pwd', "bash: syntax '&&' is not supported in this simulator"],
    ['ls ; pwd', "bash: syntax ';' is not supported in this simulator"],
    ['ls *.txt', "bash: wildcard '*' is not supported in this simulator"],
    ['cat $HOME', "bash: '$' expansion is not supported in this simulator"],
  ];
  for (const [line, msg] of cases) {
    const r = run(sh, line);
    assert.deepEqual(errorsOf(r), [msg], line);
    assert.equal(stdoutOf(r).length, 0, '実行されない');
  }
  assert.equal(JSON.stringify(sh.snapshot().fs), before);
  assert.equal(errorsOf(run(sh, 'ls "abc')).length, 1);
});
test('クォートで囲めばスペースを含む名前を扱える', () => {
  const sh = newShell();
  run(sh, 'mkdir "my dir"');
  assert.ok(stdoutOf(run(sh, 'ls'))[0]?.includes("'my dir'"));
  run(sh, "cd 'my dir'");
  assert.equal(sh.cwd, '/home/student/my dir');
  run(sh, 'cd ..');
  run(sh, 'cd my\\ dir');
  assert.equal(sh.cwd, '/home/student/my dir');
  assert.equal(sh.prompt().text, 'student@joho:~/my dir$');
  // クォートされた * は普通の文字
  assert.deepEqual(run(sh, 'mkdir "a*b"').lines, []);
});

// ---- プロンプト
test('プロンプトは現在地に応じて変化する', () => {
  const sh = newShell();
  assert.equal(sh.prompt().text, 'student@joho:~$');
  run(sh, 'cd Documents');
  assert.equal(sh.prompt().text, 'student@joho:~/Documents$');
  run(sh, 'cd /etc');
  assert.equal(sh.prompt().text, 'student@joho:/etc$');
  run(sh, 'cd /');
  assert.equal(sh.prompt().text, 'student@joho:/$');
});

// ---- 履歴・初期環境の独立性
test('履歴は空入力以外を順に記録する', () => {
  const sh = newShell();
  run(sh, 'ls');
  run(sh, '');
  run(sh, 'foo');
  run(sh, '   ');
  assert.deepEqual([...sh.history], ['ls', 'foo']);
});
test('Shell は初期環境のデータを書き換えない', async () => {
  const { createDefaultEnvironment } = await import('../environments/default.ts');
  const env = createDefaultEnvironment();
  const copy = JSON.stringify(env);
  const sh = new (await import('../engine/shell.ts')).Shell(env);
  sh.execute('mkdir zzz');
  assert.equal(JSON.stringify(env), copy);
});
