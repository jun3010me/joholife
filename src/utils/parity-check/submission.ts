// パリティ課題の提出判定（UI非依存）。保存JSONの操作ログから、各問題の状態を計算し直して確かめる。
// ブラウザ内で作られるJSONなので、手作業の改ざんを完全には防げない（鍵交換課題と同じ前提）。
import {
  applyFlips, applyFlips2D, countOnes, GRID, isParityCell, isValidGrid, judge, oddCols, oddRows,
  type Bit, type Cell, type Grid, type Mode, type Noise,
} from './parity.ts';
import { SIMULATOR_ID, VERSION, type Problem, type Problem12, type Problem3 } from './log.ts';

export interface SubmissionResult {
  valid: boolean;
  message: string;
  /** 合格時：クリアした問題数 */
  clearedCount?: number;
  /** 合格時：ヒントを使ったがクリアに数えた問題数 */
  hintCount?: number;
}
const bad = (message: string): SubmissionResult => ({ valid: false, message });

const isBits = (a: unknown, n: number): a is Bit[] => Array.isArray(a) && a.length === n && a.every((x) => x === 0 || x === 1);
const isGrid = (a: unknown): a is Grid => Array.isArray(a) && a.length === GRID && a.every((r) => isBits(r, GRID));
const isInt = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;

/** 1問を再計算した結果。error があれば、ログが仕様と合っていない */
interface Verdict { error?: string; cleared: boolean }

const NOISES: Noise[] = ['none', 'one', 'two', 'zero'];
const MODE_NAME: Record<Mode, string> = { even: '偶数パリティ', odd: '奇数パリティ' };
export const NOISE_NAME: Record<Noise, string> = { none: 'ノイズなし', one: '1枚反転', two: '2枚反転', zero: '全部0' };

function verify12(p: Problem12): Verdict {
  const fail = (error: string): Verdict => ({ error, cleared: false });
  if (p.mode !== 'even' && p.mode !== 'odd') return fail('モードが正しくありません。');
  if (p.stage !== (p.mode === 'even' ? 1 : 2)) return fail('ステージとモードが合っていません。');
  if (!NOISES.includes(p.noise)) return fail('ノイズの種類が正しくありません。');
  if (!isBits(p.sent, 8)) return fail('送信したカードが8枚ではありません。');
  if (judge(p.sent, p.mode) !== 'ok') return fail('送信したカードのパリティが、モードと合っていません。');
  if (!Array.isArray(p.flipped) || !p.flipped.every((i) => isInt(i, 0, 7)) || new Set(p.flipped).size !== p.flipped.length) {
    return fail('反転したカードの記録が正しくありません。');
  }
  const kind = p.noise;
  const k = p.flipped.length;
  if ((kind === 'none' && k !== 0) || (kind === 'one' && k !== 1) || (kind === 'two' && k !== 2)) {
    return fail('ノイズの種類と、反転したカードの数が合っていません。');
  }
  if (kind === 'zero' && p.flipped.length !== countOnes(p.sent)) return fail('「全部0」の記録が正しくありません。');
  const received = applyFlips(p.sent, p.flipped).received;
  if (kind === 'zero' && countOnes(received) !== 0) return fail('「全部0」の記録が正しくありません。');
  if (!Array.isArray(p.steps)) return fail('操作の記録がありません。');

  let counted = false, judged = false;
  for (const s of p.steps) {
    if (s.step === 'count') {
      const ok = s.value === countOnes(received);
      if (s.ok !== ok) return fail('「1の数」の記録が、実際の数と合っていません。');
      if (ok) counted = true;
    } else if (s.step === 'judge') {
      if (s.pick !== 'ok' && s.pick !== 'error') return fail('判定の記録が正しくありません。');
      const ok = s.pick === judge(received, p.mode);
      if (s.ok !== ok) return fail('判定の記録が、実際の結果と合っていません。');
      if (ok && counted) judged = true;
    } else return fail('操作の記録に、知らない手順があります。');
  }
  const cleared = !p.answerShown && counted && judged;
  if (p.cleared && !cleared) return fail('クリアと記録されていますが、操作のログと一致しません。');
  return { cleared };
}

function verify3(p: Problem3): Verdict {
  const fail = (error: string): Verdict => ({ error, cleared: false });
  if (!isGrid(p.sent) || !isValidGrid(p.sent)) return fail('送信したマスのパリティが正しくありません。');
  if (!Array.isArray(p.flipped) || !p.flipped.every((c) => Array.isArray(c) && isInt(c[0], 0, 4) && isInt(c[1], 0, 4))) {
    return fail('反転したマスの記録が正しくありません。');
  }
  if (new Set(p.flipped.map((c) => c.join(','))).size !== p.flipped.length) return fail('反転したマスの記録が正しくありません。');
  if (!Array.isArray(p.steps)) return fail('操作の記録がありません。');
  // ノイズ1枚以外の問題は、クリアに数えない（手順の再計算もしない）
  if (p.flipped.length !== 1) return p.cleared ? fail('ノイズ1枚の問題ではないのに、クリアと記録されています。') : { cleared: false };
  const received = applyFlips2D(p.sent, p.flipped);
  const rows = oddRows(received), cols = oddCols(received);

  let row: number | null = null, col: number | null = null, fixed = false;
  for (const s of p.steps) {
    if (s.step === 'row') {
      if (!isInt(s.pick, 0, 4)) return fail('行の記録が正しくありません。');
      const ok = rows.includes(s.pick);
      if (s.ok !== ok) return fail('選んだ行の記録が、実際（奇数かどうか）と合っていません。');
      if (ok) row = s.pick;
    } else if (s.step === 'col') {
      if (!isInt(s.pick, 0, 4)) return fail('列の記録が正しくありません。');
      const ok = cols.includes(s.pick);
      if (s.ok !== ok) return fail('選んだ列の記録が、実際（奇数かどうか）と合っていません。');
      if (ok) col = s.pick;
    } else if (s.step === 'fix') {
      const c = s.cell as Cell;
      if (!Array.isArray(c) || !isInt(c[0], 0, 4) || !isInt(c[1], 0, 4)) return fail('直したマスの記録が正しくありません。');
      const ok = row !== null && col !== null && c[0] === row && c[1] === col && p.flipped.some((f) => f[0] === c[0] && f[1] === c[1]);
      if (s.ok !== ok) return fail('直したマスの記録が、実際と合っていません。');
      if (ok) fixed = true;
    } else return fail('操作の記録に、知らない手順があります。');
  }
  const cleared = !p.answerShown && p.flipped.length === 1 && fixed;
  if (p.cleared && !cleared) return fail('クリアと記録されていますが、操作のログと一致しません。');
  return { cleared };
}

const verifyOne = (p: Problem): Verdict =>
  p && p.stage === 3 ? verify3(p as Problem3)
    : p && (p.stage === 1 || p.stage === 2) ? verify12(p as Problem12)
    : { error: 'ステージが正しくありません。', cleared: false };

/** 保存JSONを読み、問題ごとの再計算結果を返す */
function verifyAll(data: unknown): { error?: string; problems: { p: Problem; cleared: boolean }[] } {
  const d = data as { simulator?: unknown; version?: unknown; problems?: unknown } | null;
  if (!d || typeof d !== 'object' || d.simulator !== SIMULATOR_ID) {
    return { error: 'パリティチェックの保存ファイルではありません。ページの「💾 保存」で出力したファイルを提出してください。', problems: [] };
  }
  if (d.version !== VERSION) return { error: 'ファイルのバージョンが違います。', problems: [] };
  if (!Array.isArray(d.problems)) return { error: '問題の記録がありません。', problems: [] };
  const out: { p: Problem; cleared: boolean }[] = [];
  for (const [i, raw] of (d.problems as Problem[]).entries()) {
    const p = raw as Problem;
    const v = verifyOne(p);
    if (v.error) return { error: `${i + 1}番目の問題：${v.error}`, problems: [] };
    out.push({ p, cleared: v.cleared });
  }
  return { problems: out };
}

const finish = (cleared: { p: Problem }[], message: string): SubmissionResult => ({
  valid: true, message, clearedCount: cleared.length, hintCount: cleared.filter((x) => x.p.hintUsed).length,
});

/** 課題①：偶数・奇数それぞれで、1枚反転・2枚反転・全部0を、各1回以上クリア（計6種類） */
export function validateParity1(data: unknown): SubmissionResult {
  const { error, problems } = verifyAll(data);
  if (error) return bad(error);
  const cleared = problems.filter((x) => x.cleared && x.p.stage !== 3) as { p: Problem12; cleared: boolean }[];
  const missing: string[] = [];
  for (const mode of ['even', 'odd'] as Mode[]) {
    for (const noise of ['one', 'two', 'zero'] as Noise[]) {
      // 「全部0」は、送ったカードに1が1枚以上あるものだけを数える
      const has = cleared.some((x) => x.p.mode === mode && x.p.noise === noise && (noise !== 'zero' || x.p.flipped.length > 0));
      if (!has) missing.push(`${MODE_NAME[mode]}の${NOISE_NAME[noise]}`);
    }
  }
  if (missing.length) return bad(`あと、${missing.length}種類が足りません：${missing.join('、')}がまだです。（「答えを見る」を押した問題は数えません）`);
  return finish(cleared, '偶数・奇数パリティの6種類を、すべて自分の手順でクリアしました。');
}

/** 課題②：ノイズ1枚の問題を3問クリア。うち1問はパリティのマスが反転した問題 */
export function validateParity2(data: unknown): SubmissionResult {
  const { error, problems } = verifyAll(data);
  if (error) return bad(error);
  const cleared = problems.filter((x) => x.cleared && x.p.stage === 3) as { p: Problem3; cleared: boolean }[];
  const parity = cleared.filter((x) => isParityCell(x.p.flipped[0])).length;
  if (cleared.length < 3) return bad(`ノイズ1枚の問題のクリアが、あと${3 - cleared.length}問足りません。（今は${cleared.length}問）`);
  if (parity < 1) return bad('パリティのマスが反転した問題のクリアが、まだありません。右端の列か下端の行のマスが反転した問題を解いてください。');
  return finish(cleared, '2次元パリティで、ノイズ1枚の問題を3問クリアしました。');
}

// ---------- 画面に出す進捗（提出判定と同じ再計算を使う） ----------

export interface Progress {
  /** 課題①の6種類：できたか */
  task1: { mode: Mode; noise: Noise; label: string; done: boolean }[];
  /** 課題②：ノイズ1枚でクリアした問題数、パリティのマスの問題をクリアしたか */
  task2: { cleared: number; parityDone: boolean };
  task1Done: boolean;
  task2Done: boolean;
}

export function progressOf(problems: readonly Problem[]): Progress {
  const ok = problems.map((p) => ({ p, v: verifyOne(p) })).filter((x) => !x.v.error && x.v.cleared).map((x) => x.p);
  const c12 = ok.filter((p): p is Problem12 => p.stage !== 3);
  const c3 = ok.filter((p): p is Problem3 => p.stage === 3);
  const task1 = (['even', 'odd'] as Mode[]).flatMap((mode) => (['one', 'two', 'zero'] as Noise[]).map((noise) => ({
    mode, noise, label: `${MODE_NAME[mode]}の${NOISE_NAME[noise]}`,
    done: c12.some((p) => p.mode === mode && p.noise === noise && (noise !== 'zero' || p.flipped.length > 0)),
  })));
  const task2 = { cleared: c3.length, parityDone: c3.some((p) => isParityCell(p.flipped[0])) };
  return { task1, task2, task1Done: task1.every((x) => x.done), task2Done: task2.cleared >= 3 && task2.parityDone };
}
