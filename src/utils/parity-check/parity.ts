// パリティチェックの計算（UI非依存の純粋関数）。乱数は差し替えられる。
export type Bit = 0 | 1;
export type Mode = 'even' | 'odd';
export type Noise = 'none' | 'one' | 'two' | 'zero';
/** 0以上1未満の乱数（テストでは差し替える） */
export type Rng = () => number;
export type Grid = Bit[][];

export const DATA_LEN = 7;
export const CARD_LEN = 8;
export const GRID = 5; // 4×4のデータ＋パリティ

export const countOnes = (bits: readonly number[]): number => bits.reduce<number>((a, b) => a + b, 0);
const flip = (b: Bit): Bit => (b === 1 ? 0 : 1);

/** パリティビット：偶数パリティは1の数を偶数に、奇数パリティは奇数にそろえる */
export function parityBit(data: readonly number[], mode: Mode): Bit {
  const odd = countOnes(data) % 2 === 1;
  return (mode === 'even' ? (odd ? 1 : 0) : (odd ? 0 : 1)) as Bit;
}

/** データ7枚＋パリティ1枚の8枚にする */
export function encode(data: readonly Bit[], mode: Mode): Bit[] {
  if (data.length !== DATA_LEN) throw new Error('データは7枚です');
  return [...data, parityBit(data, mode)];
}

/** 受信側の判定：1の数が約束どおりなら 'ok'、そうでなければ 'error' */
export function judge(received: readonly number[], mode: Mode): 'ok' | 'error' {
  const even = countOnes(received) % 2 === 0;
  return (mode === 'even') === even ? 'ok' : 'error';
}

const pick = (n: number, rng: Rng) => Math.min(n - 1, Math.floor(rng() * n));

/** ランダムにk個の異なる位置を選ぶ */
export function pickDistinct(n: number, k: number, rng: Rng): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < k; i++) out.push(pool.splice(pick(pool.length, rng), 1)[0]);
  return out.sort((a, b) => a - b);
}

/** 送信した8枚にノイズを加える。反転したカードの位置（小さい順）も返す */
export function applyNoise(sent: readonly Bit[], noise: Noise, rng: Rng = Math.random): { received: Bit[]; flipped: number[] } {
  if (noise === 'zero') {
    return { received: sent.map(() => 0 as Bit), flipped: sent.flatMap((b, i) => (b === 1 ? [i] : [])) };
  }
  const k = noise === 'none' ? 0 : noise === 'one' ? 1 : 2;
  return applyFlips(sent, pickDistinct(sent.length, k, rng));
}

export function applyFlips(sent: readonly Bit[], flipped: readonly number[]): { received: Bit[]; flipped: number[] } {
  const received = [...sent];
  for (const i of flipped) received[i] = flip(received[i]);
  return { received, flipped: [...flipped].sort((a, b) => a - b) };
}

// ---------- 2次元パリティ（偶数パリティのみ） ----------

/** 4×4のデータから、5×5（右端が行パリティ、下端が列パリティ、右下が全体）を作る */
export function encode2D(data: readonly (readonly Bit[])[]): Grid {
  if (data.length !== GRID - 1 || data.some((r) => r.length !== GRID - 1)) throw new Error('データは4×4です');
  const g: Grid = data.map((r) => [...r, parityBit(r, 'even')]);
  const last: Bit[] = [];
  for (let c = 0; c < GRID; c++) last.push(parityBit(g.map((r) => r[c]), 'even'));
  g.push(last);
  return g;
}

export function randomData4(rng: Rng = Math.random): Bit[][] {
  return Array.from({ length: GRID - 1 }, () => Array.from({ length: GRID - 1 }, () => (rng() < 0.5 ? 0 : 1) as Bit));
}

/** 5×5が、行・列とも偶数パリティになっているか */
export function isValidGrid(g: readonly (readonly number[])[]): boolean {
  return oddRows(g).length === 0 && oddCols(g).length === 0 && g.length === GRID && g.every((r) => r.length === GRID);
}

export const oddRows = (g: readonly (readonly number[])[]): number[] =>
  g.flatMap((r, i) => (countOnes(r) % 2 === 1 ? [i] : []));
export const oddCols = (g: readonly (readonly number[])[]): number[] =>
  (g[0] ?? []).flatMap((_, c) => (countOnes(g.map((r) => r[c])) % 2 === 1 ? [c] : []));

export type Cell = [number, number];
export const isParityCell = ([r, c]: Cell) => r === GRID - 1 || c === GRID - 1;

export function applyFlips2D(sent: Grid, flipped: readonly Cell[]): Grid {
  const g = sent.map((r) => [...r]);
  for (const [r, c] of flipped) g[r][c] = flip(g[r][c]);
  return g;
}

/**
 * 1枚反転する位置を選ぶ。kind：'any' は25マスから、'parity' はパリティのマス（9マス）から、'data' はデータのマス（16マス）から。
 */
export function pickFlip1(kind: 'any' | 'parity' | 'data', rng: Rng = Math.random): Cell {
  const cells: Cell[] = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) cells.push([r, c]);
  const pool = cells.filter((x) => (kind === 'any' ? true : kind === 'parity' ? isParityCell(x) : !isParityCell(x)));
  return pool[pick(pool.length, rng)];
}

/** 2枚反転する位置。行も列もちがう2マス（おかしい行・列が2本ずつ見える状態にする） */
export function pickFlip2(rng: Rng = Math.random): Cell[] {
  const first = pickFlip1('any', rng);
  const pool: Cell[] = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (r !== first[0] && c !== first[1]) pool.push([r, c]);
  return [first, pool[pick(pool.length, rng)]];
}

/** これまでのノイズ1枚の問題（古い順）：パリティのマスが反転した問題か、クリアしたか */
export interface FlipHistory { parity: boolean; cleared: boolean }

/**
 * ノイズ1枚の問題で、パリティのマスが反転する問題が必ず出るようにする。
 * パリティのマスの問題を「クリア」するまでは、①直前がパリティの問題で、クリアしなかった（答えを見たなど）ときと、
 * ②パリティでない問題が2問続いたときに、パリティのマスにする。クリアしたあとは、ランダム。
 */
export function flipKindFor(history: readonly FlipHistory[]): 'any' | 'parity' {
  if (history.some((h) => h.parity && h.cleared)) return 'any';
  const last = history[history.length - 1];
  if (last && last.parity) return 'parity';
  return history.length >= 2 && !history.slice(-2).some((h) => h.parity) ? 'parity' : 'any';
}
