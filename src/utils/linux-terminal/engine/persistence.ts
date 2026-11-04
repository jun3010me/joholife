/**
 * 保存・復元。ブラウザの localStorage を直接使わず、StorageLike を受け取るので
 * テストでは偽物を渡せる。保存データが壊れていても初期状態に戻れる。
 */
import type { DirNode, Environment, FsNode, ShellSnapshot } from './types.ts';
import { MAX_HISTORY, Shell } from './shell.ts';
import {
  MAX_DEPTH,
  MAX_FILE_CONTENT,
  MAX_NODES,
  findChild,
  isDir,
  isValidName,
  lookup,
} from './fs.ts';
import { normalizePath } from './path.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEY_PREFIX = 'joholife:linux-terminal:v1:';
/** 環境（章）ごとに別々に保存する */
export const storageKey = (envId: string): string => STORAGE_KEY_PREFIX + envId;

function validMode(m: unknown): m is number {
  return typeof m === 'number' && Number.isInteger(m) && m >= 0 && m <= 0o777;
}

/** 保存データのファイルシステムを検証する。不正なら null。 */
function validateFs(raw: unknown): DirNode | null {
  let count = 0;
  const walk = (n: unknown, depth: number, isRoot: boolean): FsNode | null => {
    if (typeof n !== 'object' || n === null || depth > MAX_DEPTH) return null;
    if (++count > MAX_NODES) return null;
    const o = n as Record<string, unknown>;
    if (typeof o.name !== 'string' || (isRoot ? o.name !== '' : !isValidName(o.name))) return null;
    if (typeof o.owner !== 'string' || o.owner === '' || o.owner.length > 32) return null;
    if (!validMode(o.mode)) return null;
    if (o.type === 'file') {
      if (typeof o.content !== 'string' || o.content.length > MAX_FILE_CONTENT) return null;
      return { type: 'file', name: o.name, owner: o.owner, mode: o.mode, content: o.content };
    }
    if (o.type === 'dir') {
      if (!Array.isArray(o.children)) return null;
      const seen = new Set<string>();
      const children: FsNode[] = [];
      for (const c of o.children) {
        const v = walk(c, depth + 1, false);
        if (!v || seen.has(v.name)) return null;
        seen.add(v.name);
        children.push(v);
      }
      return { type: 'dir', name: o.name, owner: o.owner, mode: o.mode, children };
    }
    return null;
  };
  const root = walk(raw, 0, true);
  return root && isDir(root) ? root : null;
}

/** 保存データの文字列から Shell を作る。壊れていれば null。 */
export function parseSaved(raw: string, env: Environment): Shell | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Partial<ShellSnapshot>;
  if (d.version !== 1 || d.envId !== env.id) return null;
  if (typeof d.cwd !== 'string' || !d.cwd.startsWith('/') || normalizePath(d.cwd) !== d.cwd) return null;
  if (!Array.isArray(d.history) || d.history.length > MAX_HISTORY) return null;
  if (!d.history.every((h) => typeof h === 'string' && h.length <= 1000)) return null;
  const root = validateFs(d.fs);
  if (!root) return null;

  const cwd = lookup(root, env.user, d.cwd);
  if (!cwd.ok || !isDir(cwd.node)) return null;
  const home = lookup(root, env.user, env.home);
  if (!home.ok || !isDir(home.node)) return null;
  const homeParent = findChild(root, 'home');
  if (!homeParent || !isDir(homeParent)) return null;

  return new Shell(env, { cwd: d.cwd, root, history: d.history });
}

export type LoadStatus = 'fresh' | 'restored' | 'corrupt';

/** 保存データから復元する。無い・壊れている・読めないときは初期状態で始める。 */
export function loadShell(
  storage: StorageLike | null,
  env: Environment,
): { shell: Shell; status: LoadStatus } {
  let raw: string | null = null;
  try {
    raw = storage ? storage.getItem(storageKey(env.id)) : null;
  } catch {
    raw = null;
  }
  if (raw === null) return { shell: new Shell(env), status: 'fresh' };
  const shell = parseSaved(raw, env);
  if (shell) return { shell, status: 'restored' };
  return { shell: new Shell(env), status: 'corrupt' };
}

/** 保存する。保存できない環境では false を返す（例外は投げない）。 */
export function saveShell(storage: StorageLike | null, shell: Shell): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(shell.env.id), JSON.stringify(shell.snapshot()));
    return true;
  } catch {
    return false;
  }
}

export function clearSaved(storage: StorageLike | null, envId: string): void {
  try {
    storage?.removeItem(storageKey(envId));
  } catch {
    /* 保存できない環境では何もしない */
  }
}
