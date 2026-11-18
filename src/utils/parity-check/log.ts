// 操作ログの型と、保存JSON・localStorageの読み書き（UI非依存）。
import type { Bit, Cell, Grid, Mode, Noise } from './parity.ts';

export const STORAGE_KEY = 'joholife:parity-check:v1';
export const SIMULATOR_ID = 'parity-check';
export const VERSION = 1;

export type Step12 =
  | { step: 'count'; value: number; ok: boolean }
  | { step: 'judge'; pick: 'ok' | 'error'; ok: boolean };

export type Step3 =
  | { step: 'row'; pick: number; ok: boolean }
  | { step: 'col'; pick: number; ok: boolean }
  | { step: 'fix'; cell: Cell; ok: boolean };

interface Common {
  /** 問題の識別子（複数のタブの記録を合わせるために使う。古い記録にはない） */
  id?: string;
  hintUsed?: boolean;
  answerShown: boolean;
  cleared: boolean;
}
/** ステージ1（偶数）・ステージ2（奇数）の1問 */
export interface Problem12 extends Common {
  stage: 1 | 2;
  mode: Mode;
  noise: Noise;
  sent: Bit[];
  flipped: number[];
  steps: Step12[];
}
/** ステージ3の1問 */
export interface Problem3 extends Common {
  stage: 3;
  sent: Grid;
  flipped: Cell[];
  steps: Step3[];
}
export type Problem = Problem12 | Problem3;

export interface SaveFile {
  simulator: typeof SIMULATOR_ID;
  version: typeof VERSION;
  savedAt: string;
  problems: Problem[];
}

export const buildSave = (problems: Problem[], now: Date = new Date()): SaveFile => ({
  simulator: SIMULATOR_ID, version: VERSION, savedAt: now.toISOString(), problems,
});

interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
const browserStore = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** localStorageから読む。壊れていたり使えないときは空にする */
export function loadProblems(store: Store | null = browserStore()): Problem[] {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw);
    if (!j || j.simulator !== SIMULATOR_ID || !Array.isArray(j.problems)) return [];
    // 識別子のない古い記録には、順番から決めた識別子を付ける（同じ保存データなら、どのタブでも同じ識別子になる）
    return (j.problems as Problem[]).map((p, i) => (p.id ? p : { ...p, id: `legacy-${i}` }));
  } catch { return []; }
}
export function saveProblems(problems: Problem[], store: Store | null = browserStore()): void {
  try { store?.setItem(STORAGE_KEY, JSON.stringify(buildSave(problems))); } catch { /* 容量不足などは無視 */ }
}
export function clearProblems(store: Store | null = browserStore()): void {
  try { store?.removeItem(STORAGE_KEY); } catch { /* 無視 */ }
}

export const newProblemId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * 2つ以上のタブで同時に開いても、記録が消えないように合わせる。
 * 自分のタブで作った問題（own）は自分の内容を、ほかのタブで作った問題は保存データの内容を使い、
 * 自分が知らない問題は後ろに足す。
 */
export function mergeProblems(mine: readonly Problem[], stored: readonly Problem[], own: ReadonlySet<string>): Problem[] {
  const byId = new Map(stored.filter((p) => p.id).map((p) => [p.id as string, p]));
  const out = mine.map((p) => (p.id && !own.has(p.id) ? byId.get(p.id) ?? p : p));
  const known = new Set(mine.map((p) => p.id));
  for (const p of stored) if (!p.id || !known.has(p.id)) out.push(p);
  return out;
}
