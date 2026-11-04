import type { DirNode, FileNode, FsNode } from './types.ts';
import { segmentsOf } from './path.ts';

export const isDir = (n: FsNode): n is DirNode => n.type === 'dir';
export const isFile = (n: FsNode): n is FileNode => n.type === 'file';

export function findChild(dir: DirNode, name: string): FsNode | undefined {
  return dir.children.find((c) => c.name === name);
}

/** ユーザー user が node に対して r/w/x の権限を持つか（グループは other と同じ扱い） */
export function canAccess(node: FsNode, user: string, bit: 'r' | 'w' | 'x'): boolean {
  const shift = node.owner === user ? 6 : 0;
  const mask = bit === 'r' ? 4 : bit === 'w' ? 2 : 1;
  return ((node.mode >> shift) & mask) !== 0;
}

export type LookupResult =
  | { ok: true; node: FsNode }
  | {
      ok: false;
      code: 'ENOENT' | 'ENOTDIR' | 'EACCES';
      /** ENOENT のとき: 見つからなかった名前と、その親ディレクトリ */
      missing?: string;
      parent?: DirNode;
    };

/**
 * 正規化済みの絶対パスを探す。途中のディレクトリには実行権限(x)が必要。
 * 最終ノード自体の権限はここでは確認しない（コマンドごとに必要な権限が違うため）。
 */
export function lookup(root: DirNode, user: string, absPath: string): LookupResult {
  let cur: FsNode = root;
  for (const seg of segmentsOf(absPath)) {
    if (!isDir(cur)) return { ok: false, code: 'ENOTDIR' };
    if (!canAccess(cur, user, 'x')) return { ok: false, code: 'EACCES' };
    const next = findChild(cur, seg);
    if (!next) return { ok: false, code: 'ENOENT', missing: seg, parent: cur };
    cur = next;
  }
  return { ok: true, node: cur };
}

/** ls と同じ並び順（大文字小文字・先頭のドットを無視して比較） */
export function compareNames(a: string, b: string): number {
  const ka = a.replace(/^\.+/, '').toLowerCase();
  const kb = b.replace(/^\.+/, '').toLowerCase();
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function cloneNode<T extends FsNode>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

/** 名前が正しいファイル名か（保存データの検証・mkdirで使う） */
export function isValidName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 255 &&
    name !== '.' &&
    name !== '..' &&
    !name.includes('/') &&
    !name.includes('\0')
  );
}
