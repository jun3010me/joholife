import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, stdoutOf, errorsOf, hintsOf, texts } from './helpers.ts';
import { newLogShell } from './fixtures.ts';

const H = '/home/student';
const names = (sh: ReturnType<typeof newLogShell>, dir: string): string[] => {
  const out = stdoutOf(run(sh, `ls ${dir} | cat`));
  return out;
};

test('glob: * は名前順に展開され、ディレクトリをまたげる', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'ls server/inbox/*.jpg')), ['server/inbox/a.jpg  server/inbox/b.jpg']);
  assert.deepEqual(texts(run(sh, 'echo server/*/*.log')), ['server/logs/access.log server/logs/error.log']);
  assert.deepEqual(texts(run(sh, 'echo server/*/')), ['server/inbox/ server/logs/']);
  assert.deepEqual(texts(run(sh, `echo ${H}/server/logs/*.log`)), [
    `${H}/server/logs/access.log ${H}/server/logs/error.log`,
  ]);
  assert.deepEqual(texts(run(sh, 'echo ~/server/inbox/*.png')), [`${H}/server/inbox/c.png`]);
});

test('glob: 結果は名前順（ls と同じ並び）', () => {
  const sh = newLogShell();
  run(sh, 'mkdir z');
  run(sh, 'touch z/c.txt z/B.txt z/a.txt z/10.txt z/9.txt');
  assert.deepEqual(texts(run(sh, 'echo z/*')), ['z/10.txt z/9.txt z/a.txt z/B.txt z/c.txt']);
});

test('glob: 隠しファイルは * に一致しない（. で始まるパターンなら一致する）', () => {
  const sh = newLogShell();
  assert.ok(!texts(run(sh, 'echo server/inbox/*')).join(' ').includes('.hidden'));
  assert.deepEqual(texts(run(sh, 'echo server/inbox/*.jpg')), ['server/inbox/a.jpg server/inbox/b.jpg']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/.*.jpg')), ['server/inbox/.hidden.jpg']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/.h*')), ['server/inbox/.hidden.jpg']);
  assert.deepEqual(texts(run(sh, 'echo .b*')), ['.bashrc']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/?hidden.jpg')), ['server/inbox/?hidden.jpg'], '? も . には一致しない');
});

test('glob: ? と [...] ', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'echo server/inbox/data_??.csv')), ['server/inbox/data_01.csv server/inbox/data_02.csv']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/data_???.csv')), ['server/inbox/data_100.csv']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/[ab].jpg')), ['server/inbox/a.jpg server/inbox/b.jpg']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/[a-b].*')), ['server/inbox/a.jpg server/inbox/b.jpg']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/[!ab].jpg')), ['server/inbox/[!ab].jpg'], '一致なしは文字のまま');
  assert.deepEqual(texts(run(sh, 'echo server/inbox/[!a]*.jpg')), ['server/inbox/b.jpg']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/data_0[12].csv')), ['server/inbox/data_01.csv server/inbox/data_02.csv']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/[c-z].png')), ['server/inbox/c.png']);
  assert.deepEqual(texts(run(sh, 'echo a[')), ['a['], '閉じていない [ は文字');
});

test('glob: 一致しないときは文字のまま残し、失敗したときだけヒントを添える', () => {
  const sh = newLogShell();
  const ok = run(sh, 'echo *.xyz');
  assert.deepEqual(texts(ok), ['*.xyz'], 'echo は成功するのでヒントなし');
  const r = run(sh, 'mv *.xyz photos/');
  assert.deepEqual(errorsOf(r), ["mv: cannot stat '*.xyz': No such file or directory"]);
  assert.ok(hintsOf(r).some((h) => h.includes('「*.xyz」に一致するファイルがありませんでした')));
  const r2 = run(sh, 'ls server/inbox/*.xyz');
  assert.deepEqual(errorsOf(r2), ["ls: cannot access 'server/inbox/*.xyz': No such file or directory"]);
  assert.ok(hintsOf(r2).some((h) => h.includes('一致するファイルがありませんでした')));
  const r3 = run(sh, 'cat nothing/*.txt');
  assert.ok(hintsOf(r3).some((h) => h.includes('nothing/*.txt')));
  // 同じパターンのヒントは1回だけ
  const r4 = run(sh, 'rm *.xyz *.xyz');
  assert.equal(hintsOf(r4).filter((h) => h.includes('一致するファイル')).length, 1);
  // 一部だけ一致しないとき、一致したものは使われる
  const r5 = run(sh, 'cat server/inbox/a.* server/inbox/*.xyz');
  assert.deepEqual(stdoutOf(r5), ['jpg-a']);
  assert.equal(errorsOf(r5).length, 1);
});

test('glob: クォートとバックスラッシュの中は展開しない', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'echo "*.jpg"')), ['*.jpg']);
  assert.deepEqual(texts(run(sh, "echo '*.jpg'")), ['*.jpg']);
  assert.deepEqual(texts(run(sh, 'echo \\*')), ['*']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/"*".jpg')), ['server/inbox/*.jpg']);
  assert.deepEqual(texts(run(sh, 'echo server/inbox/\\?.jpg')), ['server/inbox/?.jpg']);
  assert.deepEqual(texts(run(sh, 'echo "[ab]" \'[ab]\'')), ['[ab] [ab]']);
  // 一部だけクォートしても、残りのワイルドカードは働く
  assert.deepEqual(texts(run(sh, 'echo server/in"box"/*.png')), ['server/inbox/c.png']);
  // 実在する * という名前のファイルも、クォートすればそれだけを指せる
  run(sh, "touch 'star*file'");
  assert.deepEqual(texts(run(sh, "echo 'star*file'")), ['star*file']);
  assert.deepEqual(texts(run(sh, 'echo star?file')), ['star*file'], '展開されると実在の名前になる');
});

test('glob: grep のパターンをクォートすれば * や . を正規表現として使える', () => {
  const sh = newLogShell();
  run(sh, 'echo "axxb" > t1.txt');
  run(sh, 'echo "ab" > t2.txt');
  run(sh, 'echo "ba" > t3.txt');
  assert.deepEqual(texts(run(sh, 'grep "a.*b" t1.txt t2.txt t3.txt')), ['t1.txt:axxb', 't2.txt:ab']);
  assert.deepEqual(texts(run(sh, "grep 'a.*b' t1.txt")), ['axxb']);
  // クォートしないと、シェルが先に展開してしまう（本物と同じ）
  assert.deepEqual(texts(run(sh, 'grep a.*b t1.txt')), ['axxb'], '一致するファイルがないので文字のまま');
});

test('glob: > の書き込み先は展開しない', () => {
  const sh = newLogShell();
  run(sh, 'echo hi > *.txt');
  assert.deepEqual(texts(run(sh, "cat '*.txt'")), ['hi']);
  run(sh, 'echo more > server/inbox/*.jpg');
  assert.deepEqual(stdoutOf(run(sh, 'cat server/inbox/a.jpg')), ['jpg-a'], 'a.jpg は書き換わらない');
  assert.deepEqual(stdoutOf(run(sh, "cat 'server/inbox/*.jpg'")), ['more']);
});

test('glob: 読み取り権限のないディレクトリは展開に使わない', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'echo /home/*')), ['/home/student /home/teacher']);
  assert.deepEqual(texts(run(sh, 'echo /home/teacher/*')), ['/home/teacher/*'], 'teacher は 700 で入れない');
  assert.deepEqual(texts(run(sh, 'echo /home/te*/private')), ['/home/te*/private'], '途中の teacher に入れない');
  assert.deepEqual(texts(run(sh, 'echo /*/hostname')), ['/etc/hostname']);
  assert.deepEqual(errorsOf(run(sh, 'cat /home/teacher/g*')), ['cat: /home/teacher/g*: Permission denied']);
  // 自分のディレクトリでも、r を外すと展開できない
  run(sh, 'mkdir locked');
  run(sh, 'touch locked/a.txt');
  const home = sh.state.root.children.find((c) => c.name === 'home');
  const student = home && home.type === 'dir' ? home.children.find((c) => c.name === 'student') : undefined;
  const locked = student && student.type === 'dir' ? student.children.find((c) => c.name === 'locked') : undefined;
  assert.ok(locked);
  locked.mode = 0o311; // x はあるが r がない
  assert.deepEqual(texts(run(sh, 'echo locked/*')), ['locked/*']);
  assert.deepEqual(texts(run(sh, 'echo locked/a.txt')), ['locked/a.txt'], '名前を直接書けば普通に使える');
});

test('glob: ファイル操作コマンドで使える（mv / cp / rm / cat / ls / wc）', () => {
  const sh = newLogShell();
  // mv で複数の元を1つのディレクトリへ
  assert.deepEqual(run(sh, 'mv server/inbox/*.jpg server/inbox/*.png photos/').lines, []);
  assert.deepEqual(names(sh, 'photos'), ['a.jpg', 'b.jpg', 'c.png']);
  assert.ok(!names(sh, 'server/inbox').includes('a.jpg'));
  assert.deepEqual(run(sh, 'cp server/inbox/report_*.txt docs/').lines, []);
  assert.deepEqual(names(sh, 'docs'), ['report_1.txt', 'report_2.txt']);
  assert.ok(names(sh, 'server/inbox').includes('report_1.txt'), 'cp なので元は残る');
  assert.deepEqual(run(sh, 'rm server/inbox/*.tmp').lines, []);
  assert.ok(!names(sh, 'server/inbox').some((n) => n.endsWith('.tmp')));
  assert.deepEqual(names(sh, 'server/inbox').filter((n) => n.startsWith('data')), ['data_01.csv', 'data_02.csv', 'data_100.csv']);
  assert.deepEqual(texts(run(sh, 'ls server/inbox/data_??.csv')), ['server/inbox/data_01.csv  server/inbox/data_02.csv']);
  assert.deepEqual(texts(run(sh, 'cat server/inbox/report_*.txt')), ['r1', 'r2']);
  assert.deepEqual(texts(run(sh, 'wc -l server/inbox/report_*.txt')), ['1 server/inbox/report_1.txt', '1 server/inbox/report_2.txt', '2 total']);
});

test('mv a.jpg b.jpg c.png photos/ のように、複数の元を1つのディレクトリへ移す', () => {
  const sh = newLogShell();
  run(sh, 'cd server/inbox');
  assert.deepEqual(run(sh, 'mv a.jpg b.jpg c.png ../../photos/').lines, []);
  assert.deepEqual(names(sh, '../../photos'), ['a.jpg', 'b.jpg', 'c.png']);
  // 先が存在しないとき・ファイルのときは失敗する
  const r = run(sh, 'mv report_1.txt report_2.txt nowhere');
  assert.deepEqual(errorsOf(r), ["mv: target 'nowhere' is not a directory"]);
  assert.deepEqual(errorsOf(run(sh, 'mv *.xyz ../../photos/')), ["mv: cannot stat '*.xyz': No such file or directory"]);
});

test('glob: ワイルドカードで展開した結果が、権限エラーも正しく扱う', () => {
  const sh = newLogShell();
  assert.deepEqual(errorsOf(run(sh, 'rm /etc/h*')), ["rm: cannot remove '/etc/hostname': Permission denied"]);
});

test('glob: Tab補完はパイプのあとのコマンド名にも効く', () => {
  const sh = newLogShell();
  assert.deepEqual(sh.complete('ls | wc'), { line: 'ls | wc ', candidates: [] });
  assert.deepEqual(sh.complete('ls | gre'), { line: 'ls | grep ', candidates: [] });
  assert.deepEqual(sh.complete('ls |gre'), { line: 'ls |grep ', candidates: [] });
  assert.deepEqual(sh.complete('ls|gre'), { line: 'ls|grep ', candidates: [] });
  assert.deepEqual(sh.complete('cat server/lo | gre'), { line: 'cat server/lo | grep ', candidates: [] });
  assert.deepEqual(sh.complete('cat server/lo'), { line: 'cat server/logs/', candidates: [] });
  assert.deepEqual(sh.complete('ls | cat README'), { line: 'ls | cat README.txt ', candidates: [] });
  assert.deepEqual(sh.complete('ls | cd Doc'), { line: 'ls | cd Documents/', candidates: [] });
  assert.deepEqual(sh.complete('gr'), { line: 'grep ', candidates: [] });
  assert.deepEqual(sh.complete('he').candidates, ['head', 'help']);
  assert.deepEqual(sh.complete('so'), { line: 'sort ', candidates: [] });
  assert.deepEqual(sh.complete('un'), { line: 'uniq ', candidates: [] });
});
