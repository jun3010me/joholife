import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, stdoutOf, errorsOf, hintsOf, texts } from './helpers.ts';
import { makeAccessLog, newLogShell } from './fixtures.ts';

const H = '/home/student';
const LOG = makeAccessLog();
const LOG_LINES = LOG.trimEnd().split('\n');
const file = (sh: ReturnType<typeof newLogShell>, path: string): string => {
  const r = sh.readFile(path);
  assert.equal(r.ok, true, `${path} が読めること`);
  return r.ok ? r.content : '';
};

// ---------------------------------------------------------------- 受け入れ条件
test('受け入れ条件: ログ調査', () => {
  const sh = newLogShell();
  const size = Buffer.byteLength(LOG);
  const w = String(size).length;
  assert.equal(w, 5);
  assert.deepEqual(texts(run(sh, 'wc -l server/logs/access.log')), [`  300 server/logs/access.log`]);
  assert.deepEqual(texts(run(sh, 'head -n 5 server/logs/access.log')), LOG_LINES.slice(0, 5));
  assert.deepEqual(texts(run(sh, 'tail -3 server/logs/access.log')), LOG_LINES.slice(-3));
  assert.deepEqual(
    texts(run(sh, 'grep " 404 " server/logs/access.log')),
    LOG_LINES.filter((l) => l.includes(' 404 ')),
  );
  assert.deepEqual(texts(run(sh, 'grep -c " 404 " server/logs/access.log')), ['10']);
  assert.deepEqual(
    texts(run(sh, 'grep -n "admin" server/logs/access.log')).slice(0, 2),
    LOG_LINES.map((l, i) => `${i + 1}:${l}`).filter((l) => l.includes('admin')).slice(0, 2),
  );
  assert.deepEqual(
    texts(run(sh, 'grep -v "200" server/logs/access.log | wc -l')),
    [String(LOG_LINES.filter((l) => !l.includes('200')).length)],
  );
  run(sh, 'grep "192.168.0.12" server/logs/access.log | wc -l > kekka.txt');
  assert.equal(file(sh, `${H}/kekka.txt`), `${LOG_LINES.filter((l) => l.includes('192.168.0.12')).length}\n`);
  // 件数が同じものは、sort -r により行全体の逆順（192 → 172 → 10）になる
  assert.deepEqual(texts(run(sh, 'cut -d " " -f 1 server/logs/access.log | sort | uniq -c | sort -rn | head -n 3')), [
    '    120 192.168.0.12',
    '     60 192.168.0.34',
    '     60 172.16.1.9',
  ]);
  assert.deepEqual(texts(run(sh, 'cut -d " " -f 7 server/logs/access.log | sort -u')), [
    '/about.html',
    '/admin/login',
    '/css/style.css',
    '/img/logo.png',
    '/index.html',
  ]);
  run(sh, 'grep " 500 " server/logs/access.log > errors.txt');
  assert.equal(file(sh, `${H}/errors.txt`), LOG_LINES.filter((l) => l.includes(' 500 ')).join('\n') + '\n');
});

test('受け入れ条件: お片付けと履歴', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'ls server/inbox | wc -l')), ['11'], '隠しファイルは数えない');
  assert.deepEqual(texts(run(sh, 'ls server/inbox/*.jpg')), ['server/inbox/a.jpg  server/inbox/b.jpg']);
  run(sh, 'mv server/inbox/*.jpg server/inbox/*.png photos/');
  run(sh, 'cp server/inbox/report_*.txt docs/');
  run(sh, 'rm server/inbox/*.tmp');
  assert.deepEqual(texts(run(sh, 'ls server/inbox/data_??.csv')), ['server/inbox/data_01.csv  server/inbox/data_02.csv']);
  assert.deepEqual(texts(run(sh, 'cat server/logs/*.log | grep -i error')), [
    '[error] disk almost full',
    '[Error] failed to open',
  ]);
  assert.deepEqual(texts(run(sh, 'echo "*.jpg"')), ['*.jpg']);
  const h = texts(run(sh, 'history | grep mv'));
  assert.equal(h[0], '    3  mv server/inbox/*.jpg server/inbox/*.png photos/');
  assert.ok(h.some((l) => l.endsWith('history | grep mv')), 'history 自身の行も含まれる');
  run(sh, 'history | tail -5 > rireki.txt');
  const lines = file(sh, `${H}/rireki.txt`).trimEnd().split('\n');
  assert.equal(lines.length, 5);
  assert.ok(lines[4]?.endsWith('history | tail -5 > rireki.txt'));
});

// ---------------------------------------------------------------- grep
test('grep: オプション -i -v -c -n', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/fruit.txt`, 'Apple\nbanana\napple pie\ncherry\n');
  assert.deepEqual(texts(run(sh, 'grep apple fruit.txt')), ['apple pie']);
  assert.deepEqual(texts(run(sh, 'grep -i apple fruit.txt')), ['Apple', 'apple pie']);
  assert.deepEqual(texts(run(sh, 'grep -v an fruit.txt')), ['Apple', 'apple pie', 'cherry']);
  assert.deepEqual(texts(run(sh, 'grep -c a fruit.txt')), ['2']);
  assert.deepEqual(texts(run(sh, 'grep -n e fruit.txt')), ['1:Apple', '3:apple pie', '4:cherry']);
  assert.deepEqual(texts(run(sh, 'grep -in APPLE fruit.txt')), ['1:Apple', '3:apple pie']);
  assert.deepEqual(texts(run(sh, 'grep -vc a fruit.txt')), ['2']);
  assert.deepEqual(texts(run(sh, 'grep -c zzz fruit.txt')), ['0']);
  assert.deepEqual(texts(run(sh, 'grep -i -n -v apple fruit.txt')), ['2:banana', '4:cherry']);
  assert.deepEqual(texts(run(sh, 'grep --ignore-case --count APPLE fruit.txt')), ['2']);
});

test('grep: 1件も一致しなければ何も出力しない', () => {
  const sh = newLogShell();
  const r = run(sh, 'grep zzz server/logs/access.log');
  assert.deepEqual(r.lines, []);
  assert.deepEqual(run(sh, 'echo hello | grep zzz').lines, []);
});

test('grep: 基本正規表現（^ $ . [...] *）', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/r.txt`, 'abc\naxc\nabbbc\nac\nxabc\nabcx\na.c\nA+B\n1+2\n[x]\n');
  assert.deepEqual(texts(run(sh, "grep '^a' r.txt")), ['abc', 'axc', 'abbbc', 'ac', 'abcx', 'a.c']);
  assert.deepEqual(texts(run(sh, "grep 'c$' r.txt")), ['abc', 'axc', 'abbbc', 'ac', 'xabc', 'a.c']);
  assert.deepEqual(texts(run(sh, "grep '^abc$' r.txt")), ['abc']);
  assert.deepEqual(texts(run(sh, "grep 'a.c' r.txt")), ['abc', 'axc', 'xabc', 'abcx', 'a.c']);
  assert.deepEqual(texts(run(sh, "grep 'ab*c' r.txt")), ['abc', 'abbbc', 'ac', 'xabc', 'abcx']);
  assert.deepEqual(texts(run(sh, "grep '^a[bx]c' r.txt")), ['abc', 'axc', 'abcx']);
  assert.deepEqual(texts(run(sh, "grep '[^a-c]' r.txt")).slice(0, 3), ['axc', 'xabc', 'abcx']);
  assert.deepEqual(texts(run(sh, "grep 'a\\.c' r.txt")), ['a.c'], '\\. は文字の .');
  assert.deepEqual(texts(run(sh, "grep '1+2' r.txt")), ['1+2'], '基本正規表現では + は文字');
  assert.deepEqual(texts(run(sh, "grep '[[:digit:]]' r.txt")), ['1+2']);
  assert.deepEqual(texts(run(sh, "grep '^$' r.txt")), []);
  assert.deepEqual(texts(run(sh, "grep '*' r.txt")), [], '先頭の * は文字');
  assert.deepEqual(texts(run(sh, "grep '\\[x\\]' r.txt")), ['[x]']);
  assert.deepEqual(texts(run(sh, "grep '[]x[]' r.txt")), ['axc', 'xabc', 'abcx', '[x]']);
});

test('grep: -E と -F', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/r.txt`, 'abc\nabbc\nac\na.c\n1+2\nfoo|bar\n(x)\n');
  assert.deepEqual(texts(run(sh, "grep -E 'ab+c' r.txt")), ['abc', 'abbc']);
  assert.deepEqual(texts(run(sh, "grep -E 'ab?c' r.txt")), ['abc', 'ac']);
  assert.deepEqual(texts(run(sh, "grep -E 'abc|ac' r.txt")), ['abc', 'ac']);
  assert.deepEqual(texts(run(sh, "grep -E '^(abc|ac)$' r.txt")), ['abc', 'ac']);
  assert.deepEqual(texts(run(sh, "grep -E 'ab{2}c' r.txt")), ['abbc']);
  assert.deepEqual(texts(run(sh, "grep -E '1\\+2' r.txt")), ['1+2']);
  assert.deepEqual(texts(run(sh, "grep -F 'a.c' r.txt")), ['a.c'], '-F では . は文字');
  assert.deepEqual(texts(run(sh, "grep -F '1+2' r.txt")), ['1+2']);
  assert.deepEqual(texts(run(sh, "grep -F 'foo|bar' r.txt")), ['foo|bar']);
  assert.deepEqual(texts(run(sh, "grep -F '(x)' r.txt")), ['(x)']);
  assert.deepEqual(texts(run(sh, "grep -Fi 'A.C' r.txt")), ['a.c']);
});

test('grep: 正規表現が正しくないとき', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/r.txt`, 'a\n');
  const r = run(sh, "grep '[a' r.txt");
  assert.deepEqual(errorsOf(r), ['grep: Unmatched [, [^, [:, [., or [=']);
  assert.ok(hintsOf(r)[0]?.includes('grep -F'));
  assert.deepEqual(errorsOf(run(sh, "grep -E '(a' r.txt")), ['grep: Invalid regular expression']);
  assert.deepEqual(errorsOf(run(sh, "grep 'a\\' r.txt")), ['grep: Trailing backslash']);
});

test('grep: 複数ファイルのときは ファイル名:行 の形', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'grep -i error server/logs/error.log server/logs/access.log')), [
    'server/logs/error.log:[error] disk almost full',
    'server/logs/error.log:[Error] failed to open',
  ]);
  assert.deepEqual(texts(run(sh, 'grep -n warn server/logs/*.log')), ['server/logs/error.log:2:[warn] slow query']);
  assert.deepEqual(texts(run(sh, 'grep -c error server/logs/*.log')), [
    'server/logs/access.log:0',
    'server/logs/error.log:1',
  ]);
  assert.deepEqual(texts(run(sh, 'grep warn server/logs/error.log')), ['[warn] slow query'], '1つのときは名前なし');
});

test('grep: ファイル名を省略すると stdin を読む。なければエラー', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'ls server/inbox | grep csv')), ['data_01.csv', 'data_02.csv', 'data_100.csv']);
  assert.deepEqual(texts(run(sh, 'cat server/logs/error.log | grep -c e')), ['3']);
  const r = run(sh, 'grep abc');
  assert.deepEqual(errorsOf(r), ['grep: missing file operand']);
  assert.ok(hintsOf(r)[0]?.includes('パイプ'));
  const r2 = run(sh, 'grep');
  assert.equal(errorsOf(r2)[0], 'Usage: grep [OPTION]... PATTERNS [FILE]...');
  assert.deepEqual(errorsOf(run(sh, 'echo hello | grep -H hello')), ["grep: option '-H' is not supported in this simulator"]);
});

test('grep: 読めないファイル・ディレクトリ・存在しないファイル', () => {
  const sh = newLogShell();
  assert.deepEqual(errorsOf(run(sh, 'grep a /etc/shadow')), ['grep: /etc/shadow: Permission denied']);
  assert.ok(hintsOf(run(sh, 'grep a /etc/shadow'))[0]?.includes('権限'));
  assert.deepEqual(errorsOf(run(sh, 'grep a server')), ['grep: server: Is a directory']);
  assert.deepEqual(errorsOf(run(sh, 'grep a nothing.txt')), ['grep: nothing.txt: No such file or directory']);
  assert.deepEqual(errorsOf(run(sh, 'grep a /home/teacher/grades.txt')), ['grep: /home/teacher/grades.txt: Permission denied']);
  // 読めるものが残っていれば、続けて処理する
  const r = run(sh, 'grep -h a README.txt');
  assert.deepEqual(errorsOf(r), ["grep: option '-h' is not supported in this simulator"]);
  const r2 = run(sh, 'grep warn nothing server/logs/error.log');
  assert.deepEqual(errorsOf(r2), ['grep: nothing: No such file or directory']);
  assert.deepEqual(stdoutOf(r2), ['server/logs/error.log:[warn] slow query']);
});

test('grep: 書き込み先と同じファイルを読むときはエラー', () => {
  const sh = newLogShell();
  const r = run(sh, 'grep warn server/logs/error.log > server/logs/error.log');
  assert.deepEqual(errorsOf(r), ['grep: server/logs/error.log: input file is also the output']);
  assert.ok(hintsOf(r).length > 0);
});

// ---------------------------------------------------------------- wc
test('wc: 行・単語・バイト（UTF-8）', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/j.txt`, 'こんにちは 世界\nabc def ghi\n');
  // こんにちは(15) + 空白(1) + 世界(6) + 改行(1) + "abc def ghi"(11) + 改行(1) = 35 バイト（桁数は 2）
  assert.deepEqual(texts(run(sh, 'wc j.txt')), [' 2  5 35 j.txt']);
  assert.deepEqual(texts(run(sh, 'wc -l j.txt')), [' 2 j.txt']);
  assert.deepEqual(texts(run(sh, 'wc -w j.txt')), [' 5 j.txt']);
  assert.deepEqual(texts(run(sh, 'wc -c j.txt')), ['35 j.txt']);
  assert.deepEqual(texts(run(sh, 'wc -lw j.txt')), [' 2  5 j.txt']);
  assert.deepEqual(texts(run(sh, 'wc -c -l j.txt')), [' 2 35 j.txt'], '表示の順は行・単語・バイトで固定');
});

test('wc: stdin では数字だけ', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'cat server/logs/access.log | wc -l')), ['300']);
  assert.deepEqual(texts(run(sh, 'echo hello | wc -c')), ['6']);
  assert.deepEqual(texts(run(sh, 'echo hello | wc -w')), ['1']);
  assert.deepEqual(texts(run(sh, 'echo "a b" | wc')), ['      1       2       4']);
  assert.deepEqual(texts(run(sh, 'echo あ | wc -c')), ['4']);
  assert.deepEqual(texts(run(sh, 'echo -n | wc -l')), ['0']);
});

test('wc: 複数ファイルのときは total 行', () => {
  const sh = newLogShell();
  const r = texts(run(sh, 'wc -l server/logs/access.log server/logs/error.log'));
  assert.deepEqual(r, ['  300 server/logs/access.log', '    3 server/logs/error.log', '  303 total']);
  const all = texts(run(sh, 'wc server/logs/error.log server/logs/error.log'));
  assert.equal(all.length, 3);
  assert.ok(all[2]?.endsWith(' total'));
  // 1つだけなら total なし
  assert.equal(texts(run(sh, 'wc -l server/logs/error.log')).length, 1);
});

test('wc: エラー', () => {
  const sh = newLogShell();
  assert.deepEqual(errorsOf(run(sh, 'wc -x a')), ["wc: option '-x' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'wc nothing')), ['wc: nothing: No such file or directory']);
  assert.deepEqual(errorsOf(run(sh, 'wc server')), ['wc: server: Is a directory']);
  assert.deepEqual(errorsOf(run(sh, 'wc /etc/shadow')), ['wc: /etc/shadow: Permission denied']);
  assert.deepEqual(errorsOf(run(sh, 'wc')), ['wc: missing file operand']);
  const r = run(sh, 'wc -l nothing server/logs/error.log');
  assert.deepEqual(errorsOf(r), ['wc: nothing: No such file or directory']);
  assert.deepEqual(stdoutOf(r), [' 3 server/logs/error.log']);
});

// ---------------------------------------------------------------- sort / uniq
test('sort: 既定はバイト順（LC_ALL=C）。-r -n -u', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/s.txt`, 'banana\nApple\ncherry\napple\nBanana\napple\n10\n9\n100\n');
  assert.deepEqual(texts(run(sh, 'sort s.txt')), ['10', '100', '9', 'Apple', 'Banana', 'apple', 'apple', 'banana', 'cherry']);
  assert.deepEqual(texts(run(sh, 'sort -r s.txt')), ['cherry', 'banana', 'apple', 'apple', 'Banana', 'Apple', '9', '100', '10']);
  assert.deepEqual(texts(run(sh, 'sort -u s.txt')), ['10', '100', '9', 'Apple', 'Banana', 'apple', 'banana', 'cherry']);
  assert.deepEqual(texts(run(sh, 'sort -n s.txt')).slice(-3), ['9', '10', '100']);
  assert.deepEqual(texts(run(sh, 'sort -n s.txt')).slice(0, 6), ['Apple', 'Banana', 'apple', 'apple', 'banana', 'cherry']);
  assert.deepEqual(texts(run(sh, 'sort -rn s.txt')).slice(0, 3), ['100', '10', '9']);
  assert.deepEqual(texts(run(sh, 'sort -nr s.txt')).slice(0, 3), ['100', '10', '9']);
  assert.deepEqual(texts(run(sh, 'sort -nu s.txt')), ['banana', '9', '10', '100'], '数としては同じ（0）なので、最初の行だけ残る');
  assert.deepEqual(texts(run(sh, 'sort -ru s.txt')).slice(0, 2), ['cherry', 'banana']);
  assert.deepEqual(texts(run(sh, 'sort -n -r s.txt')).slice(0, 3), ['100', '10', '9']);
});

test('sort: 日本語もバイト順・複数ファイル・stdin', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/j.txt`, 'う\nあ\nい\nz\n');
  assert.deepEqual(texts(run(sh, 'sort j.txt')), ['z', 'あ', 'い', 'う']);
  sh.saveFile(`${H}/s1.txt`, 'b\na\n');
  sh.saveFile(`${H}/s2.txt`, 'c\n0\n');
  assert.deepEqual(texts(run(sh, 'sort s1.txt s2.txt')), ['0', 'a', 'b', 'c']);
  assert.deepEqual(texts(run(sh, 'echo c | cat s1.txt - | sort')), ['a', 'b', 'c']);
  assert.deepEqual(errorsOf(run(sh, 'sort -x s1.txt')), ["sort: option '-x' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'sort')), ['sort: missing file operand']);
});

test('uniq: 隣り合う同じ行だけまとめる。-c は GNU と同じ幅', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/u.txt`, 'a\na\na\nb\na\nc\nc\n');
  assert.deepEqual(texts(run(sh, 'uniq u.txt')), ['a', 'b', 'a', 'c']);
  assert.deepEqual(texts(run(sh, 'uniq -c u.txt')), ['      3 a', '      1 b', '      1 a', '      2 c']);
  assert.deepEqual(texts(run(sh, 'sort u.txt | uniq -c')), ['      4 a', '      1 b', '      2 c']);
  assert.deepEqual(texts(run(sh, 'uniq --count u.txt')).length, 4);
  sh.saveFile(`${H}/big.txt`, 'x\n'.repeat(12));
  assert.deepEqual(texts(run(sh, 'uniq -c big.txt')), ['     12 x']);
  assert.deepEqual(errorsOf(run(sh, 'uniq -d u.txt')), ["uniq: option '-d' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'uniq')), ['uniq: missing file operand']);
});

test('uniq: 2つ目のファイル名は（本物と同じく）出力先なので、エラーにして上書きしない', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/u.txt`, 'a\na\n');
  sh.saveFile(`${H}/v.txt`, 'keep\n');
  const r = run(sh, 'uniq u.txt v.txt');
  assert.deepEqual(errorsOf(r), ["uniq: extra operand 'v.txt'", "Try 'uniq --help' for more information."]);
  assert.ok(hintsOf(r)[0]?.includes('上書き'));
  assert.equal(file(sh, `${H}/v.txt`), 'keep\n');
});

// ---------------------------------------------------------------- head / tail
test('head / tail: 既定は10行。-n N と -N', () => {
  const sh = newLogShell();
  const l = LOG_LINES;
  assert.deepEqual(texts(run(sh, 'head server/logs/access.log')), l.slice(0, 10));
  assert.deepEqual(texts(run(sh, 'tail server/logs/access.log')), l.slice(-10));
  assert.deepEqual(texts(run(sh, 'head -n 2 server/logs/access.log')), l.slice(0, 2));
  assert.deepEqual(texts(run(sh, 'head -n2 server/logs/access.log')), l.slice(0, 2));
  assert.deepEqual(texts(run(sh, 'head -2 server/logs/access.log')), l.slice(0, 2));
  assert.deepEqual(texts(run(sh, 'head --lines=2 server/logs/access.log')), l.slice(0, 2));
  assert.deepEqual(texts(run(sh, 'tail -n 2 server/logs/access.log')), l.slice(-2));
  assert.deepEqual(texts(run(sh, 'tail -2 server/logs/access.log')), l.slice(-2));
  assert.deepEqual(texts(run(sh, 'head -n 0 server/logs/access.log')), []);
  assert.deepEqual(texts(run(sh, 'tail -n 0 server/logs/access.log')), []);
  assert.equal(texts(run(sh, 'head -n 1000 server/logs/access.log')).length, 300);
  assert.equal(texts(run(sh, 'tail -n +299 server/logs/access.log')).length, 2);
});

test('head / tail: stdin・複数ファイル・エラー', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'ls server/inbox | head -n 2')), ['a.jpg', 'b.jpg']);
  assert.deepEqual(texts(run(sh, 'ls server/inbox | tail -n 1')), ['swap.tmp']);
  assert.deepEqual(texts(run(sh, 'head -n 1 server/logs/error.log server/inbox/memo.txt')), [
    '==> server/logs/error.log <==',
    '[error] disk almost full',
    '',
    '==> server/inbox/memo.txt <==',
    'memo',
  ]);
  const r = run(sh, 'head -n x server/logs/error.log');
  assert.deepEqual(errorsOf(r), ["head: invalid number of lines: 'x'"]);
  assert.ok(hintsOf(r)[0]?.includes('半角'));
  assert.deepEqual(errorsOf(run(sh, 'tail -n')), ["tail: option requires an argument -- 'n'", "Try 'tail --help' for more information."]);
  assert.deepEqual(errorsOf(run(sh, 'head -c 3 a')), ["head: option '-c' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'head nothing')), ['head: nothing: No such file or directory']);
  assert.deepEqual(errorsOf(run(sh, 'tail server')), ['tail: server: Is a directory']);
  assert.deepEqual(errorsOf(run(sh, 'head /etc/shadow')), ['head: /etc/shadow: Permission denied']);
  assert.deepEqual(errorsOf(run(sh, 'head')), ['head: missing file operand']);
});

// ---------------------------------------------------------------- cut
test('cut: -d と -f（番号・カンマ・範囲）', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/c.csv`, 'a,b,c,d,e\n1,2,3,4,5\nnodelim\n');
  assert.deepEqual(texts(run(sh, 'cut -d , -f 2 c.csv')), ['b', '2', 'nodelim']);
  assert.deepEqual(texts(run(sh, 'cut -d, -f2 c.csv')), ['b', '2', 'nodelim']);
  assert.deepEqual(texts(run(sh, 'cut -d "," -f 1,3 c.csv')), ['a,c', '1,3', 'nodelim']);
  assert.deepEqual(texts(run(sh, 'cut -d , -f 2-4 c.csv')), ['b,c,d', '2,3,4', 'nodelim']);
  assert.deepEqual(texts(run(sh, 'cut -d , -f -2 c.csv')), ['a,b', '1,2', 'nodelim']);
  assert.deepEqual(texts(run(sh, 'cut -d , -f 4- c.csv')), ['d,e', '4,5', 'nodelim']);
  assert.deepEqual(texts(run(sh, 'cut -d , -f 1,3-4,9 c.csv')), ['a,c,d', '1,3,4', 'nodelim']);
  assert.deepEqual(texts(run(sh, 'cut -d , -f 3,1 c.csv')), ['a,c', '1,3', 'nodelim'], '番号の順ではなく元の順');
  assert.deepEqual(texts(run(sh, 'cut --delimiter=, --fields=2 c.csv')), ['b', '2', 'nodelim']);
  assert.deepEqual(texts(run(sh, 'cut -d , -f 9 c.csv')), ['', '', 'nodelim']);
});

test('cut: -d " "（空白で区切る）とタブ', () => {
  const sh = newLogShell();
  assert.deepEqual(texts(run(sh, 'head -n 2 server/logs/access.log | cut -d " " -f 1')), ['192.168.0.12', '192.168.0.12']);
  assert.deepEqual(texts(run(sh, "head -n 1 server/logs/access.log | cut -d ' ' -f 6,9")), ['"GET 200']);
  assert.deepEqual(texts(run(sh, 'head -n 1 server/logs/access.log | cut -d" " -f9')), ['200']);
  sh.saveFile(`${H}/t.tsv`, 'a\tb\tc\n');
  assert.deepEqual(texts(run(sh, 'cut -f 2 t.tsv')), ['b'], '-d を省略するとタブ');
  sh.saveFile(`${H}/j.txt`, 'あ、い、う\n');
  assert.deepEqual(texts(run(sh, 'cut -d "、" -f 2 j.txt')), ['い']);
});

test('cut: エラー', () => {
  const sh = newLogShell();
  sh.saveFile(`${H}/c.csv`, 'a,b\n');
  assert.deepEqual(errorsOf(run(sh, 'cut -d , c.csv')), [
    'cut: you must specify a list of bytes, characters, or fields',
    "Try 'cut --help' for more information.",
  ]);
  assert.deepEqual(errorsOf(run(sh, 'cut -d ab -f 1 c.csv')), [
    'cut: the delimiter must be a single character',
    "Try 'cut --help' for more information.",
  ]);
  assert.deepEqual(errorsOf(run(sh, 'cut -d , -f 0 c.csv'))[0], 'cut: fields are numbered from 1');
  assert.deepEqual(errorsOf(run(sh, 'cut -d , -f x c.csv'))[0], "cut: invalid field value 'x'");
  assert.deepEqual(errorsOf(run(sh, 'cut -d , -f 3-1 c.csv'))[0], 'cut: invalid decreasing range');
  assert.deepEqual(errorsOf(run(sh, 'cut -c 1 c.csv')), ["cut: option '-c' is not supported in this simulator"]);
  assert.deepEqual(errorsOf(run(sh, 'cut -d , -f 1 nothing')), ['cut: nothing: No such file or directory']);
  assert.deepEqual(errorsOf(run(sh, 'cut -d , -f 1')), ['cut: missing file operand']);
  assert.deepEqual(errorsOf(run(sh, 'cut -d , -f 1 /etc/shadow')), ['cut: /etc/shadow: Permission denied']);
});

// ---------------------------------------------------------------- 共通
test('help: 新しいコマンドが一覧と個別の説明に載る', () => {
  const sh = newLogShell();
  const all = texts(run(sh, 'help')).join('\n');
  for (const c of ['grep', 'wc', 'sort', 'uniq', 'head', 'tail', 'cut']) {
    assert.ok(all.includes(`  ${c} `), `${c} が一覧にある`);
    assert.ok(texts(run(sh, `help ${c}`))[0]?.startsWith(`${c}: `), `help ${c}`);
  }
  assert.ok(all.includes('|'));
  assert.ok(all.includes('ワイルドカード'));
  assert.ok(texts(run(sh, 'help grep')).join('\n').includes('-E'));
  assert.ok(texts(run(sh, 'help cut')).join('\n').includes('-d " "'));
});

test('未実装コマンドの一覧: 実装したものは「まだ使えない」と言わない', () => {
  const sh = newLogShell();
  for (const c of ['grep', 'head', 'tail', 'wc', 'sort']) {
    assert.ok(!errorsOf(run(sh, `${c} /nonexistent`)).some((e) => e.includes('not available')), c);
  }
  assert.deepEqual(errorsOf(run(sh, 'find .')), ['bash: find: command not available in this simulator']);
  assert.deepEqual(errorsOf(run(sh, 'sed s/a/b/ x')), ['bash: sed: command not available in this simulator']);
});

test('出力をファイルに書くとき、画面に出るのは error と hint だけ', () => {
  const sh = newLogShell();
  const r = run(sh, 'grep nothing-here nofile.txt > out.txt');
  assert.deepEqual(stdoutOf(r), []);
  assert.equal(errorsOf(r).length, 1);
  assert.equal(file(sh, `${H}/out.txt`), '');
});
