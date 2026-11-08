/**
 * ワイルドカード（パス名展開）: * ? [abc] [a-z] [!abc]
 * bash と同じく、シェルが単語をファイル名に展開してからコマンドに渡す。
 */
import type { DirNode, ShellState } from './types.ts';
import { canAccess, compareNames, findChild, isDir } from './fs.ts';
import { joinPath, resolvePath } from './path.ts';

/** 展開の途中で調べる名前の数の上限（巨大なファイルシステムで固まらないため） */
const MAX_MATCHES = 2000;

type Piece =
  | { kind: 'char'; c: string }
  | { kind: 'any' }
  | { kind: 'star' }
  | { kind: 'set'; negate: boolean; items: Array<string | [string, string]> };

/** パターンの1区間（/ を含まない）を部品に分ける */
function parseSegment(seg: string): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < seg.length; i++) {
    const ch = seg[i] as string;
    if (ch === '\\') {
      out.push({ kind: 'char', c: seg[i + 1] ?? '\\' });
      i++;
    } else if (ch === '*') {
      if (out[out.length - 1]?.kind !== 'star') out.push({ kind: 'star' });
    } else if (ch === '?') {
      out.push({ kind: 'any' });
    } else if (ch === '[') {
      let j = i + 1;
      let negate = false;
      if (seg[j] === '!' || seg[j] === '^') {
        negate = true;
        j++;
      }
      const items: Array<string | [string, string]> = [];
      let closed = false;
      let first = true;
      for (; j < seg.length; j++) {
        let c = seg[j] as string;
        if (c === ']' && !first) {
          closed = true;
          break;
        }
        first = false;
        if (c === '\\') {
          j++;
          c = seg[j] ?? '\\';
        }
        // a-z の範囲（- が最後のときは文字そのもの）
        if (seg[j + 1] === '-' && seg[j + 2] !== undefined && seg[j + 2] !== ']') {
          let hi = seg[j + 2] as string;
          let skip = 2;
          if (hi === '\\' && seg[j + 3] !== undefined) {
            hi = seg[j + 3] as string;
            skip = 3;
          }
          items.push([c, hi]);
          j += skip;
        } else {
          items.push(c);
        }
      }
      if (!closed) {
        out.push({ kind: 'char', c: '[' }); // 閉じていない [ は文字そのもの
      } else {
        out.push({ kind: 'set', negate, items });
        i = j;
      }
    } else {
      out.push({ kind: 'char', c: ch });
    }
  }
  return out;
}

function matchPieces(pieces: Piece[], pi: number, name: string, ni: number): boolean {
  while (pi < pieces.length) {
    const p = pieces[pi] as Piece;
    if (p.kind === 'star') {
      for (let k = ni; k <= name.length; k++) {
        if (matchPieces(pieces, pi + 1, name, k)) return true;
      }
      return false;
    }
    const c = name[ni];
    if (c === undefined) return false;
    if (p.kind === 'char') {
      if (p.c !== c) return false;
    } else if (p.kind === 'set') {
      const hit = p.items.some((it) => (typeof it === 'string' ? it === c : c >= it[0] && c <= it[1]));
      if (hit === p.negate) return false;
    }
    pi++;
    ni++;
  }
  return ni === name.length;
}

/** 名前 1つ分とパターン 1区間が一致するか。. で始まる名前は、パターンも . で始まるときだけ一致する */
export function matchSegment(seg: string, name: string): boolean {
  if (name.startsWith('.') && !(seg.startsWith('.') || seg.startsWith('\\.'))) return false;
  return matchPieces(parseSegment(seg), 0, name, 0);
}

const hasWildcard = (seg: string): boolean => {
  for (let i = 0; i < seg.length; i++) {
    const ch = seg[i] as string;
    if (ch === '\\') i++;
    else if (ch === '*' || ch === '?') return true;
    else if (ch === '[' && parseSegment(seg.slice(i)).some((p) => p.kind === 'set')) return true;
  }
  return false;
};

const unescape = (seg: string): string => seg.replace(/\\(.)/g, '$1');

/**
 * パターンに一致するパスを、名前順に返す。1件もなければ空配列。
 * 入力されたパスの形（相対／絶対）のまま返す。読み取り権限のないディレクトリは展開に使わない。
 */
export function expandGlob(state: ShellState, pattern: string): string[] {
  const absolute = pattern.startsWith('/');
  // 末尾の / は「ディレクトリだけ」を意味する
  const dirOnly = pattern.endsWith('/');
  const parts = pattern.split('/').filter((s) => s !== '');
  if (parts.length === 0) return [];

  interface Cur {
    shown: string; // 入力の形のパス
    abs: string;
    node: DirNode;
  }
  const startAbs = absolute ? '/' : state.cwd;
  const startNode = resolveDir(state, startAbs);
  if (!startNode) return [];
  let level: Cur[] = [{ shown: absolute ? '/' : '', abs: startAbs, node: startNode }];
  let leaves: Array<{ shown: string; isDir: boolean }> = [];

  for (let idx = 0; idx < parts.length; idx++) {
    const seg = parts[idx] as string;
    const last = idx === parts.length - 1;
    const next: Cur[] = [];
    leaves = [];
    for (const cur of level) {
      const join = (name: string) => (cur.shown === '' ? name : cur.shown === '/' ? `/${name}` : `${cur.shown}/${name}`);
      if (!hasWildcard(seg)) {
        const name = unescape(seg);
        if (name === '.' || name === '..') {
          // . と .. は、そのまま文字として扱う
          const abs = resolvePath(cur.abs, name);
          const node = resolveDir(state, abs);
          if (!node) continue;
          if (last) leaves.push({ shown: join(name), isDir: true });
          else next.push({ shown: join(name), abs, node });
          continue;
        }
        if (!canAccess(cur.node, state.user, 'x')) continue;
        const child = findChild(cur.node, name);
        if (!child) continue;
        if (last) leaves.push({ shown: join(name), isDir: isDir(child) });
        else if (isDir(child)) next.push({ shown: join(name), abs: joinPath(cur.abs, name), node: child });
        continue;
      }
      if (!canAccess(cur.node, state.user, 'r')) continue;
      const names = cur.node.children
        .filter((c) => matchSegment(seg, c.name))
        .sort((a, b) => compareNames(a.name, b.name));
      for (const child of names) {
        if (last) leaves.push({ shown: join(child.name), isDir: isDir(child) });
        else if (isDir(child) && canAccess(child, state.user, 'x')) {
          next.push({ shown: join(child.name), abs: joinPath(cur.abs, child.name), node: child });
        }
        if (leaves.length + next.length > MAX_MATCHES) break;
      }
    }
    level = next;
    if (!last && level.length === 0) return [];
  }
  const found = leaves.filter((l) => !dirOnly || l.isDir).map((l) => (dirOnly ? `${l.shown}/` : l.shown));
  return found.slice(0, MAX_MATCHES);
}

function resolveDir(state: ShellState, abs: string): DirNode | null {
  let cur: DirNode = state.root;
  for (const seg of abs.split('/').filter(Boolean)) {
    if (!canAccess(cur, state.user, 'x')) return null;
    const child = findChild(cur, seg);
    if (!child || !isDir(child)) return null;
    cur = child;
  }
  return cur;
}
