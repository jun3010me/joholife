import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, newShell, run, stdoutOf, errorsOf, texts } from './helpers.ts';
import { createDefaultEnvironment } from '../environments/default.ts';
import { loadShell, saveShell } from '../engine/persistence.ts';
import { decodeUploadedText, NOT_UTF8_MESSAGE, uploadSummary } from '../engine/upload.ts';
import { MAX_FILE_CONTENT, MAX_NODES, MAX_PATH_DEPTH, MAX_TOTAL_CONTENT, usage } from '../engine/fs.ts';
import type { DirNode, FsNode } from '../engine/types.ts';

const H = '/home/student';
const find = (sh: ReturnType<typeof newShell>, path: string): FsNode | undefined => {
  let cur: FsNode = sh.state.root;
  for (const seg of path.split('/').filter(Boolean)) {
    if (cur.type !== 'dir') return undefined;
    const next: FsNode | undefined = cur.children.find((c) => c.name === seg);
    if (!next) return undefined;
    cur = next;
  }
  return cur;
};
const content = (sh: ReturnType<typeof newShell>, path: string): string => {
  const n = find(sh, path);
  assert.ok(n && n.type === 'file', `${path} がファイルとしてある`);
  return n.type === 'file' ? n.content : '';
};
const f = (relativePath: string, text = 'x\n') => ({ relativePath, content: text });

test('アップロード: ファイルを作る。持ち主は student、権限は 644', () => {
  const sh = newShell();
  const r = sh.uploadFiles(`${H}/practice`, [f('a.csv', '1,2\n'), f('b.txt', 'bb\n')]);
  assert.deepEqual(r, { ok: true, dirPath: `${H}/practice`, uploaded: 2, overwritten: 0, skipped: [] });
  assert.equal(content(sh, `${H}/practice/a.csv`), '1,2\n');
  const node = find(sh, `${H}/practice/a.csv`);
  assert.ok(node && node.owner === 'student' && node.mode === 0o644);
  // ターミナルからも普通に使える
  assert.deepEqual(texts(run(sh, 'cat practice/a.csv')), ['1,2']);
  assert.deepEqual(texts(run(sh, 'wc -l practice/b.txt')), ['1 practice/b.txt']);
});

test('アップロード: フォルダごと。中の構造を保ち、ディレクトリは 755・student の持ち物', () => {
  const sh = newShell();
  const r = sh.uploadFiles(H, [
    f('server/a.txt', 'A\n'),
    f('server/logs/x.log', 'X\n'),
    f('server/logs/deep/y.log', 'Y\n'),
  ]);
  assert.ok(r.ok && r.uploaded === 3);
  assert.equal(content(sh, `${H}/server/logs/deep/y.log`), 'Y\n');
  for (const dir of ['server', 'server/logs', 'server/logs/deep']) {
    const n = find(sh, `${H}/${dir}`) as DirNode;
    assert.ok(n.type === 'dir' && n.owner === 'student' && n.mode === 0o755, dir);
  }
  // 既存のディレクトリの下にも足せる
  const r2 = sh.uploadFiles(H, [f('server/logs/z.log', 'Z\n')]);
  assert.ok(r2.ok && r2.uploaded === 1);
  assert.deepEqual(texts(run(sh, 'ls server/logs | cat')), ['deep', 'x.log', 'z.log']);
});

test('アップロード: 日本語の名前・空のファイル・パスの ./ と // は整理される', () => {
  const sh = newShell();
  const r = sh.uploadFiles(`${H}/practice/`, [f('./成績//表.txt', ''), f('メモ.txt', 'めも\n')]);
  assert.ok(r.ok && r.uploaded === 2);
  assert.equal(content(sh, `${H}/practice/成績/表.txt`), '');
  assert.equal(content(sh, `${H}/practice/メモ.txt`), 'めも\n');
});

test('アップロード: 書き込み権限のないディレクトリにはできない（cp と同じ判定）', () => {
  const sh = newShell();
  const before = JSON.stringify(sh.snapshot().fs);
  for (const dir of ['/', '/etc', '/home', '/home/teacher', '/home/teacher/private']) {
    const r = sh.uploadFiles(dir, [f('a.txt')]);
    assert.equal(r.ok, false, dir);
    assert.ok(!r.ok && r.message.includes('Permission denied'), dir);
  }
  assert.equal(JSON.stringify(sh.snapshot().fs), before, '何も書き込まれない');
  assert.deepEqual(errorsOf(run(sh, 'cp README.txt /etc/')), ["cp: cannot create regular file '/etc/README.txt': Permission denied"]);
  // 書き込めるが x がない・w がない
  run(sh, 'mkdir ro');
  (find(sh, `${H}/ro`) as DirNode).mode = 0o555;
  assert.equal(sh.uploadFiles(`${H}/ro`, [f('a.txt')]).ok, false);
  run(sh, 'mkdir wo');
  (find(sh, `${H}/wo`) as DirNode).mode = 0o666;
  assert.equal(sh.uploadFiles(`${H}/wo`, [f('a.txt')]).ok, false, 'x がないと入れない');
});

test('アップロード: 先がない・ファイルのときは失敗する', () => {
  const sh = newShell();
  const r = sh.uploadFiles(`${H}/nothing`, [f('a.txt')]);
  assert.ok(!r.ok && r.message.includes('No such file or directory'));
  const r2 = sh.uploadFiles(`${H}/README.txt`, [f('a.txt')]);
  assert.ok(!r2.ok && r2.message.includes('Not a directory'));
  const r3 = sh.uploadFiles(`${H}/README.txt/sub`, [f('a.txt')]);
  assert.equal(r3.ok, false);
});

test('アップロード: 途中のディレクトリに書き込めないものだけ取り込まない', () => {
  const sh = newShell();
  run(sh, 'mkdir -p up/locked');
  (find(sh, `${H}/up/locked`) as DirNode).mode = 0o555;
  const r = sh.uploadFiles(`${H}/up`, [f('locked/a.txt'), f('ok/b.txt'), f('c.txt')]);
  assert.ok(r.ok);
  assert.equal(r.ok && r.uploaded, 2);
  assert.deepEqual(r.ok && r.skipped.map((s) => [s.relativePath, s.reason]), [['locked/a.txt', 'EACCES']]);
  assert.equal(content(sh, `${H}/up/ok/b.txt`), 'x\n');
  assert.equal(find(sh, `${H}/up/locked/a.txt`), undefined);
  // 中に入れない（x がない）ディレクトリ
  (find(sh, `${H}/up/locked`) as DirNode).mode = 0o444;
  const r2 = sh.uploadFiles(`${H}/up`, [f('locked/a.txt')]);
  assert.ok(r2.ok && r2.skipped[0]?.reason === 'EACCES');
});

test('アップロード: 同じ名前のファイルは、上書きの確認が必要', () => {
  const sh = newShell();
  const files = [f('README.txt', 'new\n'), f('new.txt', 'n\n')];
  const check = sh.checkUpload(H, files);
  assert.deepEqual(check, { ok: true, dirPath: H, conflicts: ['README.txt'] });
  assert.ok(content(sh, `${H}/README.txt`).includes('ようこそ'), '確認だけでは書き換わらない');
  assert.equal(find(sh, `${H}/new.txt`), undefined, '確認だけでは作られない');

  // 上書きしない: そのファイルだけ取り込まない
  const keep = sh.uploadFiles(H, files);
  assert.ok(keep.ok && keep.uploaded === 1 && keep.overwritten === 0);
  assert.deepEqual(keep.ok && keep.skipped.map((s) => s.reason), ['EEXIST']);
  assert.ok(content(sh, `${H}/README.txt`).includes('ようこそ'));
  assert.equal(content(sh, `${H}/new.txt`), 'n\n');

  // 上書きする
  const over = sh.uploadFiles(H, files, { overwrite: true });
  assert.ok(over.ok && over.uploaded === 2 && over.overwritten === 2 && over.skipped.length === 0);
  assert.equal(content(sh, `${H}/README.txt`), 'new\n');
});

test('アップロード: 上書きでも、元のファイルの持ち主と権限は変わらない（cp と同じ）', () => {
  const sh = newShell();
  run(sh, 'echo old > mine.txt');
  (find(sh, `${H}/mine.txt`) as DirNode & { mode: number }).mode = 0o600;
  const r = sh.uploadFiles(H, [f('mine.txt', 'new\n')], { overwrite: true });
  assert.ok(r.ok && r.overwritten === 1);
  const n = find(sh, `${H}/mine.txt`);
  assert.ok(n && n.mode === 0o600 && n.owner === 'student');
});

test('アップロード: 書き込めない既存ファイルは上書きできない', () => {
  const sh = newShell();
  run(sh, 'echo old > ro.txt');
  (find(sh, `${H}/ro.txt`) as FsNode).mode = 0o444;
  const r = sh.uploadFiles(H, [f('ro.txt', 'new\n')], { overwrite: true });
  assert.ok(r.ok && r.uploaded === 0 && r.skipped[0]?.reason === 'EACCES');
  assert.equal(content(sh, `${H}/ro.txt`), 'old\n');
  // 持ち主が違うファイル（root の 644）は、student には書き込めない
  const r2 = sh.uploadFiles('/etc', [f('hostname')], { overwrite: true });
  assert.equal(r2.ok, false, '/etc 自体に書き込めない');
});

test('アップロード: 同じ名前のディレクトリにファイルは上書きしない', () => {
  const sh = newShell();
  const check = sh.checkUpload(H, [f('Documents')]);
  assert.ok(check.ok && check.conflicts.length === 0, 'ファイルの上書きではない');
  const r = sh.uploadFiles(H, [f('Documents', 'x\n'), f('practice/sample', 'y\n')], { overwrite: true });
  assert.ok(r.ok && r.uploaded === 0);
  assert.deepEqual(r.ok && r.skipped.map((s) => s.reason), ['EISDIR', 'EISDIR']);
  assert.ok(find(sh, `${H}/Documents`)?.type === 'dir');
  // ファイルがある場所にディレクトリは作れない
  const r2 = sh.uploadFiles(H, [f('README.txt/inner.txt')], { overwrite: true });
  assert.ok(r2.ok && r2.skipped[0]?.reason === 'ENOTDIR');
  assert.ok(content(sh, `${H}/README.txt`).includes('ようこそ'));
});

test('アップロード: 使えない名前（.. や空）は取り込まない', () => {
  const sh = newShell();
  const r = sh.uploadFiles(`${H}/practice`, [f('../escape.txt'), f('a/../b.txt'), f(''), f('/'), f('ok.txt')]);
  assert.ok(r.ok && r.uploaded === 1);
  assert.deepEqual(r.ok && r.skipped.map((s) => s.reason), ['ENAMETOOLONG', 'ENAMETOOLONG', 'ENAMETOOLONG', 'ENAMETOOLONG']);
  assert.equal(find(sh, `${H}/escape.txt`), undefined);
  assert.equal(find(sh, `${H}/practice/b.txt`), undefined);
  const long = 'x'.repeat(256);
  const r2 = sh.uploadFiles(H, [f(long)]);
  assert.ok(r2.ok && r2.skipped[0]?.reason === 'ENAMETOOLONG');
});

test('アップロード: 上限（1ファイル・合計・数・深さ）を守る。失敗しても空のディレクトリは残らない', () => {
  const sh = newShell();
  // 1ファイルの大きさ
  const big = sh.uploadFiles(H, [f('big/a.txt', 'x'.repeat(MAX_FILE_CONTENT + 1)), f('big/b.txt', 'x'.repeat(MAX_FILE_CONTENT))]);
  assert.ok(big.ok && big.uploaded === 1);
  assert.deepEqual(big.ok && big.skipped.map((s) => [s.relativePath, s.reason]), [['big/a.txt', 'TOOLARGE']]);

  // 深さ
  const deepPath = Array.from({ length: MAX_PATH_DEPTH }, (_, i) => `d${i}`).join('/') + '/f.txt';
  const deep = sh.uploadFiles(H, [f(deepPath)]);
  assert.ok(deep.ok && deep.skipped[0]?.reason === 'ENAMETOOLONG');
  assert.equal(find(sh, `${H}/d0`), undefined, '途中のディレクトリも作られない');

  // 合計の大きさ: 1ファイル 100,000 文字を、上限まで
  const sh2 = newShell();
  const used = usage(sh2.state.root).chars;
  const many = Array.from({ length: 12 }, (_, i) => f(`m${i}.txt`, 'x'.repeat(MAX_FILE_CONTENT)));
  const r = sh2.uploadFiles(H, many);
  assert.ok(r.ok);
  assert.equal(r.ok && r.uploaded, Math.floor((MAX_TOTAL_CONTENT - used) / MAX_FILE_CONTENT));
  assert.ok(r.ok && r.skipped.every((s) => s.reason === 'ENOSPC'));
  assert.ok(usage(sh2.state.root).chars <= MAX_TOTAL_CONTENT);
});

test('アップロード: ノード数の上限（途中のディレクトリを作れない場合は何も残らない）', () => {
  const sh = newShell();
  const dir = find(sh, `${H}/practice`) as DirNode;
  const room = 4900 - usage(sh.state.root).nodes; // これだけ足せる
  for (let i = 0; i < room - 2; i++) dir.children.push({ type: 'file', name: `f${i}`, owner: 'student', mode: 0o644, content: '' });
  assert.ok(usage(sh.state.root).nodes <= MAX_NODES);
  // あと2つ。ディレクトリ + ファイルで2つ使うので、1件目は入り、2件目は入らない
  const r = sh.uploadFiles(H, [f('newdir/a.txt'), f('newdir2/b.txt'), f('c.txt')]);
  assert.ok(r.ok && r.uploaded === 1);
  assert.deepEqual(r.ok && r.skipped.map((s) => s.reason), ['ENOSPC', 'ENOSPC']);
  assert.equal(find(sh, `${H}/newdir2`), undefined, '空のディレクトリが残らない');
  assert.ok(usage(sh.state.root).nodes <= 4900);
});

test('アップロード: 結果の表示は info の行（履歴には残らない）', () => {
  const sh = newShell();
  const r = sh.uploadFiles(`${H}/practice`, [f('a.txt'), f('b.txt'), f('c.txt')]);
  const lines = uploadSummary(`${H}/practice`, r);
  assert.deepEqual(lines, [{ kind: 'info', text: `3件のファイルを ${H}/practice にアップロードしました` }]);
  assert.deepEqual([...sh.history], []);
  // 上書きと取り込まなかったもの
  const r2 = sh.uploadFiles(`${H}/practice`, [f('a.txt'), f('x/../y')], { overwrite: true });
  const lines2 = uploadSummary(`${H}/practice`, r2);
  assert.equal(lines2[0]?.kind, 'info');
  assert.ok(lines2[0]?.text.includes('1件のファイル') && lines2[0].text.includes('上書き'));
  assert.equal(lines2[1]?.kind, 'error');
  // 失敗
  const bad = uploadSummary('/etc', sh.uploadFiles('/etc', [f('a')]));
  assert.equal(bad.length, 1);
  assert.equal(bad[0]?.kind, 'error');
  assert.ok(bad[0]?.text.includes('Permission denied'));
  // 全部取り込めなかったとき、アップロードしたとは言わない
  const none = uploadSummary(H, sh.uploadFiles(H, [f('Documents')], {}));
  assert.ok(!none.some((l) => l.text.includes('アップロードしました')));
});

test('アップロード: 保存→復元でアップロードしたファイルも残る', () => {
  const st = new MemoryStorage();
  const sh = newShell();
  sh.uploadFiles(H, [f('server/logs/access.log', 'line1\nline2\n'), f('メモ.txt', 'あ\n')]);
  assert.equal(saveShell(st, sh), true);
  const { shell, status } = loadShell(st, createDefaultEnvironment());
  assert.equal(status, 'restored');
  assert.equal(content(shell, `${H}/server/logs/access.log`), 'line1\nline2\n');
  assert.equal(content(shell, `${H}/メモ.txt`), 'あ\n');
  assert.deepEqual(stdoutOf(run(shell, 'wc -l server/logs/access.log')), [' 2 server/logs/access.log']);
});

test('アップロード: 履歴・カレントディレクトリは変わらない', () => {
  const sh = newShell();
  run(sh, 'cd practice');
  sh.uploadFiles(H, [f('x.txt')]);
  assert.equal(sh.cwd, `${H}/practice`);
  assert.deepEqual([...sh.history], ['cd practice']);
});

// ---------------------------------------------------------------- 文字コード
const enc = (s: string) => new TextEncoder().encode(s);

test('文字コード: UTF-8 はそのまま。BOM は取り除く。CRLF は LF にする', () => {
  assert.deepEqual(decodeUploadedText(enc('こんにちは\n')), { ok: true, text: 'こんにちは\n' });
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('a,b\r\n1,2\r\n')]);
  assert.deepEqual(decodeUploadedText(bom), { ok: true, text: 'a,b\n1,2\n' });
  assert.deepEqual(decodeUploadedText(enc('a\r\nb\rc\n')), { ok: true, text: 'a\nb\rc\n' }, '単独の CR は変えない');
  assert.deepEqual(decodeUploadedText(new Uint8Array()), { ok: true, text: '' });
});

test('文字コード: Shift_JIS・画像などは取り込まない', () => {
  // 「あいう」の Shift_JIS
  const sjis = new Uint8Array([0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4, 0x0a]);
  assert.deepEqual(decodeUploadedText(sjis), { ok: false, message: NOT_UTF8_MESSAGE });
  // PNG のヘッダー
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
  assert.deepEqual(decodeUploadedText(png), { ok: false, message: NOT_UTF8_MESSAGE });
  // UTF-8 として読めても、NUL を含むものはバイナリ
  assert.deepEqual(decodeUploadedText(new Uint8Array([0x41, 0x00, 0x42])), { ok: false, message: NOT_UTF8_MESSAGE });
  assert.ok(NOT_UTF8_MESSAGE.includes('UTF-8 のテキストファイルだけアップロードできます'));
});
