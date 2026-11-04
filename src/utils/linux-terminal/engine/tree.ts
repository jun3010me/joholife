import type { DirNode } from './types.ts';
import { canAccess, compareNames } from './fs.ts';
import { joinPath } from './path.ts';

export interface TreeNode {
  name: string;
  /** 絶対パス */
  path: string;
  type: 'dir' | 'file';
  /** 権限がなくて中身を表示できないディレクトリ */
  locked: boolean;
  children: TreeNode[];
}

/**
 * ディレクトリツリー表示用のデータを作る。
 * 隠しファイルは ls と同じく表示しない。権限のないディレクトリは中身を出さない。
 */
export function buildTree(root: DirNode, user: string): TreeNode {
  const walk = (dir: DirNode, path: string): TreeNode => {
    const readable = canAccess(dir, user, 'r') && canAccess(dir, user, 'x');
    const children: TreeNode[] = [];
    if (readable) {
      const sorted = dir.children
        .filter((c) => !c.name.startsWith('.'))
        .sort((a, b) =>
          a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : compareNames(a.name, b.name),
        );
      for (const c of sorted) {
        const p = joinPath(path, c.name);
        children.push(
          c.type === 'dir'
            ? walk(c, p)
            : { name: c.name, path: p, type: 'file', locked: false, children: [] },
        );
      }
    }
    return { name: dir.name === '' ? '/' : dir.name, path, type: 'dir', locked: !readable, children };
  };
  return walk(root, '/');
}
