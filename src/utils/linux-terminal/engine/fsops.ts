/**
 * ファイルシステムを書き換える共通処理（touch・nano の保存・mkdir などから使う）。
 * 権限・容量・深さの確認をここにまとめる。
 */
import type { DirNode, FileNode, FsNode } from './types.ts';
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
import { parentPath, segmentsOf } from './path.ts';

export type FsErr =
  | 'ENOENT'
  | 'ENOTDIR'
  | 'EACCES'
  | 'EISDIR'
  | 'ENAMETOOLONG'
  | 'ENOSPC'
  | 'EBUSY';

/** bash が表示するのと同じ文言 */
export const ERR_TEXT: Record<FsErr, string> = {
  ENOENT: 'No such file or directory',
  ENOTDIR: 'Not a directory',
  EACCES: 'Permission denied',
  EISDIR: 'Is a directory',
  ENAMETOOLONG: 'File name too long',
  ENOSPC: 'No space left on device',
  EBUSY: 'Device or resource busy',
};

export type ParentResult =
  | { ok: true; parent: DirNode; name: string }
  | { ok: false; code: FsErr };

/** abs の親ディレクトリと、abs の名前を返す。親は存在するディレクトリで、途中に入れる必要がある。 */
export function resolveParent(root: DirNode, user: string, abs: string): ParentResult {
  const segs = segmentsOf(abs);
  const name = segs[segs.length - 1];
  if (name === undefined) return { ok: false, code: 'EBUSY' };
  const res = lookup(root, user, parentPath(abs));
  if (!res.ok) return { ok: false, code: res.code };
  if (!isDir(res.node)) return { ok: false, code: 'ENOTDIR' };
  return { ok: true, parent: res.node, name };
}

/** ディレクトリの中身を増やしたり減らしたりできるか（w と x が必要） */
export const canModify = (dir: DirNode, user: string): boolean =>
  canAccess(dir, user, 'w') && canAccess(dir, user, 'x');

/** 新しいファイルを作る。エラーなら FsErr を返す。 */
export function createFile(
  root: DirNode,
  user: string,
  abs: string,
  content = '',
): { ok: true; node: FileNode } | { ok: false; code: FsErr } {
  const segs = segmentsOf(abs);
  if (segs.length > MAX_PATH_DEPTH || segs.some((s) => !isValidName(s))) {
    return { ok: false, code: 'ENAMETOOLONG' };
  }
  const p = resolveParent(root, user, abs);
  if (!p.ok) return p;
  if (findChild(p.parent, p.name)) return { ok: false, code: 'EISDIR' };
  if (!canModify(p.parent, user)) return { ok: false, code: 'EACCES' };
  if (!hasRoom(root, 1, content.length)) return { ok: false, code: 'ENOSPC' };
  const node: FileNode = { type: 'file', name: p.name, owner: user, mode: 0o644, content };
  p.parent.children.push(node);
  return { ok: true, node };
}

/** ファイルの内容を保存する（なければ新規作成）。nano の保存で使う。 */
export function saveFileContent(
  root: DirNode,
  user: string,
  abs: string,
  content: string,
): { ok: true; created: boolean } | { ok: false; code: FsErr } {
  if (content.length > MAX_FILE_CONTENT) return { ok: false, code: 'ENOSPC' };
  const res = lookup(root, user, abs);
  if (!res.ok) {
    if (res.code !== 'ENOENT') return { ok: false, code: res.code };
    const created = createFile(root, user, abs, content);
    return created.ok ? { ok: true, created: true } : { ok: false, code: created.code };
  }
  const node: FsNode = res.node;
  if (node.type === 'dir') return { ok: false, code: 'EISDIR' };
  if (!canAccess(node, user, 'w')) return { ok: false, code: 'EACCES' };
  if (!hasRoom(root, 0, content.length - node.content.length)) return { ok: false, code: 'ENOSPC' };
  node.content = content;
  return { ok: true, created: false };
}
