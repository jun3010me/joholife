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

interface Common { hintUsed?: boolean; answerShown: boolean; cleared: boolean }
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
    return j && j.simulator === SIMULATOR_ID && Array.isArray(j.problems) ? (j.problems as Problem[]) : [];
  } catch { return []; }
}
export function saveProblems(problems: Problem[], store: Store | null = browserStore()): void {
  try { store?.setItem(STORAGE_KEY, JSON.stringify(buildSave(problems))); } catch { /* 容量不足などは無視 */ }
}
export function clearProblems(store: Store | null = browserStore()): void {
  try { store?.removeItem(STORAGE_KEY); } catch { /* 無視 */ }
}
