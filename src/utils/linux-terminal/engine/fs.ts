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

// ---- 容量の上限（保存データの検証と同じ値。超えると保存データを読み込めなくなるため）

export const MAX_NODES = 5000;
export const MAX_DEPTH = 40;
export const MAX_FILE_CONTENT = 100_000;
export const MAX_TOTAL_CONTENT = 1_000_000;
/** 新しく作るものの深さの上限（保存データの検証より少し余裕を持たせる） */
export const MAX_PATH_DEPTH = 30;

export function usage(root: DirNode): { nodes: number; chars: number } {
  let nodes = 0;
  let chars = 0;
  const walk = (n: FsNode) => {
    nodes++;
    if (n.type === 'file') chars += n.content.length;
    else n.children.forEach(walk);
  };
  walk(root);
  return { nodes, chars };
}

/** ノードを addNodes 個、文字を addChars 文字ぶん増やせるか */
export function hasRoom(root: DirNode, addNodes: number, addChars = 0): boolean {
  const u = usage(root);
  return u.nodes + addNodes <= MAX_NODES - 100 && u.chars + addChars <= MAX_TOTAL_CONTENT;
}

/** そのノードの下の深さ（自分だけなら 0） */
export function heightOf(node: FsNode): number {
  return node.type === 'file' ? 0 : 1 + Math.max(-1, ...node.children.map(heightOf));
}

export function countNodes(node: FsNode): number {
  return node.type === 'file' ? 1 : 1 + node.children.reduce((a, c) => a + countNodes(c), 0);
}

export function countChars(node: FsNode): number {
  return node.type === 'file' ? node.content.length : node.children.reduce((a, c) => a + countChars(c), 0);
}

/** abs が dir と同じか、dir より下にあるか */
export function isSameOrInside(abs: string, dir: string): boolean {
  return abs === dir || dir === '/' || abs.startsWith(dir + '/');
}
