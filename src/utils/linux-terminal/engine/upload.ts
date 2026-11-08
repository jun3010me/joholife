/**
 * アップロード（パソコン → ターミナル）。本物の Linux で scp を使って手元のファイルを送る操作にあたる。
 * 画面側がファイルを読み込み、ここでは権限・容量・名前の判定と書き込みだけを行う。
 */
import type { DirNode, FileNode, OutputLine, ShellState } from './types.ts';
import { info, error } from './output.ts';
import {
  MAX_FILE_CONTENT,
  MAX_PATH_DEPTH,
  canAccess,
  findChild,
  hasRoom,
  isDir,
  isValidName,
  lookup,
} from './fs.ts';
import { ERR_TEXT, canModify } from './fsops.ts';
import { resolvePath, segmentsOf } from './path.ts';

export interface UploadFile {
  /** 選んだディレクトリからの相対パス（"a.txt" や "photos/a.txt"）。区切りは / */
  relativePath: string;
  content: string;
}

export interface UploadOptions {
  /** 同じ名前のファイルを上書きする（false のときは、そのファイルだけ取り込まない） */
  overwrite?: boolean;
}

/** 取り込めなかった理由 */
export type UploadSkipReason =
  | 'EACCES' // 権限がない
  | 'EEXIST' // 同じ名前のファイルがあり、上書きしない
  | 'EISDIR' // 同じ名前のディレクトリがある
  | 'ENOTDIR' // 途中の名前がファイル
  | 'ENAMETOOLONG' // 名前が正しくない・パスが深すぎる
  | 'TOOLARGE' // 1ファイルが大きすぎる
  | 'ENOSPC'; // ファイルの数・合計が多すぎる

export interface UploadSkipped {
  relativePath: string;
  reason: UploadSkipReason;
  message: string;
}

export type UploadResult =
  | {
      ok: true;
      /** 絶対パス（正規化済み） */
      dirPath: string;
      /** 作った（上書きも含む）ファイルの数 */
      uploaded: number;
      /** そのうち、上書きした数 */
      overwritten: number;
      skipped: UploadSkipped[];
    }
  | { ok: false; message: string };

export type UploadCheck =
  | { ok: true; dirPath: string; conflicts: string[] }
  | { ok: false; message: string };

const SKIP_MESSAGE: Record<UploadSkipReason, string> = {
  EACCES: '書き込み権限がないため、アップロードできません',
  EEXIST: '同じ名前のファイルがあるため、取り込みませんでした',
  EISDIR: '同じ名前のディレクトリがあるため、上書きできません',
  ENOTDIR: '途中の名前がファイルのため、ディレクトリを作れません',
  ENAMETOOLONG: '名前が正しくないか、パスが深すぎます',
  TOOLARGE: `ファイルが大きすぎます（${MAX_FILE_CONTENT.toLocaleString('en-US')} 文字まで）`,
  ENOSPC: 'ファイルの数か合計の大きさが上限を超えるため、取り込めません',
};

/** アップロード先のディレクトリを確かめる（存在・ディレクトリか・書き込めるか） */
function openTarget(
  state: ShellState,
  dirPath: string,
): { ok: true; dir: DirNode; abs: string } | { ok: false; message: string } {
  const abs = resolvePath('/', dirPath);
  const res = lookup(state.root, state.user, abs);
  if (!res.ok) return { ok: false, message: `${abs}: ${ERR_TEXT[res.code]}` };
  if (!isDir(res.node)) return { ok: false, message: `${abs}: ${ERR_TEXT.ENOTDIR}` };
  if (!canModify(res.node, state.user)) {
    return { ok: false, message: `${abs}: ${ERR_TEXT.EACCES}（このディレクトリには書き込めません）` };
  }
  return { ok: true, dir: res.node, abs };
}

/** "a/b/c.txt" を ["a","b","c.txt"] にする。使えない名前（.. や空）が混じっていれば null */
function splitRelative(relativePath: string): string[] | null {
  const segs = relativePath.split('/').filter((s) => s !== '' && s !== '.');
  if (segs.length === 0) return null;
  return segs.every(isValidName) ? segs : null;
}

/** 上書きになる（すでにファイルがある）ものの相対パス。何も書き込まない。 */
export function checkUpload(state: ShellState, dirPath: string, files: UploadFile[]): UploadCheck {
  const target = openTarget(state, dirPath);
  if (!target.ok) return target;
  const conflicts: string[] = [];
  for (const f of files) {
    const segs = splitRelative(f.relativePath);
    if (!segs) continue;
    let cur: DirNode | FileNode | undefined = target.dir;
    for (const seg of segs) {
      cur = cur && isDir(cur) ? findChild(cur, seg) : undefined;
      if (!cur) break;
    }
    if (cur && !isDir(cur) && !conflicts.includes(f.relativePath)) conflicts.push(f.relativePath);
  }
  return { ok: true, dirPath: target.abs, conflicts };
}

/** 1ファイルを書き込む。書き込めないときは理由を返す。 */
function writeOne(
  state: ShellState,
  target: DirNode,
  targetAbs: string,
  f: UploadFile,
  overwrite: boolean,
): { ok: true; overwritten: boolean } | { ok: false; reason: UploadSkipReason } {
  const segs = splitRelative(f.relativePath);
  if (!segs || segmentsOf(targetAbs).length + segs.length > MAX_PATH_DEPTH) {
    return { ok: false, reason: 'ENAMETOOLONG' };
  }
  if (f.content.length > MAX_FILE_CONTENT) return { ok: false, reason: 'TOOLARGE' };

  // まず書き込まずに、たどれるか・作れるかを調べる（途中で失敗して空のディレクトリが残らないように）
  const fileName = segs[segs.length - 1] as string;
  let cur: DirNode = target;
  let i = 0;
  for (; i < segs.length - 1; i++) {
    const child = findChild(cur, segs[i] as string);
    if (!child) break;
    if (!isDir(child)) return { ok: false, reason: 'ENOTDIR' };
    if (!canAccess(child, state.user, 'x')) return { ok: false, reason: 'EACCES' };
    cur = child;
  }
  const missingDirs = segs.slice(i, -1);
  if (missingDirs.length === 0) {
    const existing = findChild(cur, fileName);
    if (existing) {
      if (isDir(existing)) return { ok: false, reason: 'EISDIR' };
      if (!overwrite) return { ok: false, reason: 'EEXIST' };
      // cp と同じく、上書きはファイル自身に書き込めればよい（持ち主と権限は変わらない）
      if (!canAccess(existing, state.user, 'w')) return { ok: false, reason: 'EACCES' };
      if (!hasRoom(state.root, 0, f.content.length - existing.content.length)) {
        return { ok: false, reason: 'ENOSPC' };
      }
      existing.content = f.content;
      return { ok: true, overwritten: true };
    }
  }
  if (!canModify(cur, state.user)) return { ok: false, reason: 'EACCES' };
  if (!hasRoom(state.root, missingDirs.length + 1, f.content.length)) return { ok: false, reason: 'ENOSPC' };

  for (const name of missingDirs) {
    const dir: DirNode = { type: 'dir', name, owner: state.user, mode: 0o755, children: [] };
    cur.children.push(dir);
    cur = dir;
  }
  cur.children.push({ type: 'file', name: fileName, owner: state.user, mode: 0o644, content: f.content });
  return { ok: true, overwritten: false };
}

export function performUpload(
  state: ShellState,
  dirPath: string,
  files: UploadFile[],
  options: UploadOptions = {},
): UploadResult {
  const target = openTarget(state, dirPath);
  if (!target.ok) return target;
  const overwrite = options.overwrite === true;
  let uploaded = 0;
  let overwritten = 0;
  const skipped: UploadSkipped[] = [];
  for (const f of files) {
    const r = writeOne(state, target.dir, target.abs, f, overwrite);
    if (r.ok) {
      uploaded++;
      if (r.overwritten) overwritten++;
    } else {
      skipped.push({ relativePath: f.relativePath, reason: r.reason, message: SKIP_MESSAGE[r.reason] });
    }
  }
  return { ok: true, dirPath: target.abs, uploaded, overwritten, skipped };
}

/** 画面側で読み込めなかった（UTF-8 ではないなど）ファイル */
export interface UploadRejected {
  relativePath: string;
  message: string;
}

/** ターミナルに表示する、アップロード結果の行 */
export function uploadSummary(
  dirPath: string,
  result: UploadResult,
  rejected: UploadRejected[] = [],
): OutputLine[] {
  if (!result.ok) return [error(`upload: ${result.message}`)];
  const lines: OutputLine[] = [];
  if (result.uploaded > 0) {
    const extra = result.overwritten > 0 ? `（うち ${result.overwritten} 件は上書き）` : '';
    lines.push(info(`${result.uploaded}件のファイルを ${result.dirPath} にアップロードしました${extra}`));
  } else if (result.skipped.length > 0 || rejected.length > 0) {
    lines.push(info(`${result.dirPath} にアップロードしたファイルはありません`));
  }
  for (const r of rejected) lines.push(error(`upload: ${r.relativePath}: ${r.message}`));
  for (const s of result.skipped) lines.push(error(`upload: ${s.relativePath}: ${s.message}`));
  return lines;
}

// ---------------------------------------------------------------- 文字コード

export type DecodeResult = { ok: true; text: string } | { ok: false; message: string };

export const NOT_UTF8_MESSAGE = 'UTF-8 のテキストファイルだけアップロードできます';

/**
 * 読み込んだファイルの中身を UTF-8 のテキストにする。
 * BOM は取り除き、改行の CRLF は LF にする。UTF-8 として読めないもの（Shift_JIS・画像など）は取り込まない。
 */
export function decodeUploadedText(bytes: Uint8Array): DecodeResult {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); // BOM は自動で取り除かれる
  } catch {
    return { ok: false, message: NOT_UTF8_MESSAGE };
  }
  if (text.includes('\0')) return { ok: false, message: NOT_UTF8_MESSAGE };
  return { ok: true, text: text.replace(/\r\n/g, '\n') };
}
