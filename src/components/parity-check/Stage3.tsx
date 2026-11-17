import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyFlips2D, countOnes, encode2D, flipKindFor, GRID, isParityCell, oddCols, oddRows, pickFlip1, pickFlip2, randomData4,
  type Bit, type Cell, type Grid,
} from '../../utils/parity-check/parity.ts';
import type { Problem3, Step3 } from '../../utils/parity-check/log.ts';
import Card from './Card.tsx';
import { useLog } from './context.tsx';

type Phase = 'edit' | 'sending' | 'work';
interface Prob { idx: number; received: Grid; flipped: Cell[]; noise: 1 | 2 }

// 読み上げやメッセージでは「行P」「列P」、見出しの表示は「P」
const rowName = (r: number) => (r === GRID - 1 ? '行P' : `行${r + 1}`);
const colName = (c: number) => (c === GRID - 1 ? '列P' : `列${c + 1}`);
const rowShort = (r: number) => (r === GRID - 1 ? 'P' : rowName(r));
const colShort = (c: number) => (c === GRID - 1 ? 'P' : colName(c));
const cellName = (r: number, c: number) => `${rowName(r)}${colName(c)}`;
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

/** ステージ3：2次元パリティ（偶数パリティのみ）。行→列→交点の3ステップで誤りを直す */
export default function Stage3() {
  const { problems, add, patch } = useLog();
  const [data, setData] = useState<Bit[][]>(() => randomData4());
  const [noise, setNoise] = useState<1 | 2>(1);
  const [phase, setPhase] = useState<Phase>('edit');
  const [prob, setProb] = useState<Prob | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null); // 受信側の今の見た目（直すと変わる）
  const [row, setRow] = useState<number | null>(null);
  const [col, setCol] = useState<number | null>(null);
  const [fixed, setFixed] = useState(false);
  const [shown, setShown] = useState(false);
  // 送信後は送信側を隠す。「答えを見る」か、訂正を終えたら再表示する
  const [peek, setPeek] = useState(false);
  const [hint, setHint] = useState(false);
  const [msg, setMsg] = useState('');
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const sent = useMemo(() => encode2D(data), [data]);
  const update = (f: (p: Problem3) => Problem3) => prob && patch(prob.idx, (p) => f(p as Problem3));
  const log = (s: Step3) => update((p) => ({ ...p, steps: [...p.steps, s] }));

  const send = () => {
    const flipped: Cell[] = noise === 1
      // 過去のノイズ1枚の問題から、パリティのマスが3問に1問は必ず出るようにする
      ? [pickFlip1(flipKindFor(problems.filter((p): p is Problem3 => p.stage === 3 && p.flipped.length === 1).map((p) => isParityCell(p.flipped[0]))))]
      : pickFlip2();
    const received = applyFlips2D(sent, flipped);
    const idx = add({ stage: 3, sent, flipped, steps: [], hintUsed: hint, answerShown: false, cleared: false });
    setProb({ idx, received, flipped, noise }); setGrid(received);
    setRow(null); setCol(null); setFixed(false); setShown(false); setPeek(false); setMsg('');
    setPhase('sending');
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(() => setPhase('work'), reduced ? 50 : 750);
  };

  const toggleHint = (on: boolean) => {
    setHint(on);
    if (on && prob) update((p) => ({ ...p, hintUsed: true }));
  };

  const pickRow = (r: number) => {
    if (!prob || fixed || row !== null) return;
    const ok = oddRows(prob.received).includes(r);
    log({ step: 'row', pick: r, ok });
    if (ok) { setRow(r); setMsg(`${rowName(r)}は1の数が奇数。おかしい！`); }
    else setMsg(prob.noise === 2 && oddRows(prob.received).length === 0
      ? `${rowName(r)}は正常です。（行におかしいところがありません。ノイズが2枚だと、場所を決められないことも……）`
      : `${rowName(r)}は正常です。ほかの行を調べよう。`);
  };
  const pickCol = (c: number) => {
    if (!prob || fixed || col !== null) return;
    const ok = oddCols(prob.received).includes(c);
    log({ step: 'col', pick: c, ok });
    if (ok) { setCol(c); setMsg(`${colName(c)}は1の数が奇数。おかしい！`); }
    else setMsg(prob.noise === 2 && oddCols(prob.received).length === 0
      ? `${colName(c)}は正常です。（列におかしいところがありません。ノイズが2枚だと、場所を決められないことも……）`
      : `${colName(c)}は正常です。ほかの列を調べよう。`);
  };
  const tapCell = (r: number, c: number) => {
    if (!prob || !grid || fixed) return;
    if (row === null || col === null) { setMsg('先に、おかしい行と列を選ぼう'); return; }
    if (r !== row || c !== col) { setMsg('選んだ行と列が交わるカードをタップしよう'); return; }
    const hit = prob.flipped.some((f) => same(f, [r, c]));
    log({ step: 'fix', cell: [r, c], ok: hit });
    if (!hit) { setMsg('ノイズが2枚だと、場所を決められないことも……'); return; }
    setGrid(grid.map((g, i) => g.map((b, k) => (i === r && k === c ? ((1 - b) as Bit) : b))));
    setFixed(true); setPeek(true);
    if (prob.noise === 1) { update((p) => ({ ...p, cleared: !p.answerShown })); setMsg('訂正成功！'); }
    else setMsg('1枚は直せました。ノイズが2枚だと、残りの1枚の場所は決められないこともあります。');
  };
  const showAnswer = () => {
    setShown(true); setPeek(true);
    update((p) => ({ ...p, answerShown: true, cleared: false }));
  };
  const next = () => { setProb(null); setGrid(null); setPhase('edit'); setMsg(''); setShown(false); setFixed(false); };

  const senderHidden = !!prob && phase === 'work' && !peek;
  const oneNoise = prob?.noise === 1;
  const done = fixed;
  const rowHead = (r: number) => hint && prob && grid ? `${rowShort(r)}（${countOnes(grid[r])}）` : rowShort(r);
  const colHead = (c: number) => hint && prob && grid ? `${colShort(c)}（${countOnes(grid.map((x) => x[c]))}）` : colShort(c);

  /** 見出し付きの6×6のマス */
  const board = (g: Grid, mode: 'edit' | 'recv') => (
    <div className="pc-grid" role="group" aria-label={mode === 'edit' ? '送信するマス' : '受信したマス'}>
      <span className="pc-corner" aria-hidden="true" />
      {Array.from({ length: GRID }, (_, c) => (mode === 'recv'
        ? <button key={c} type="button" className={`pc-hbtn ${col === c ? 'pc-hdone' : ''}`} onClick={() => pickCol(c)}
            disabled={col !== null || fixed} aria-label={`${colName(c)}を調べる`}>{colHead(c)}</button>
        : <span key={c} className={`pc-hlabel ${c === GRID - 1 ? 'pc-hpar' : ''}`}>{colShort(c)}</span>))}
      {g.map((line, r) => (
        <div key={r} className="pc-gridrow">
          {mode === 'recv'
            ? <button type="button" className={`pc-hbtn ${row === r ? 'pc-hdone' : ''}`} onClick={() => pickRow(r)}
                disabled={row !== null || fixed} aria-label={`${rowName(r)}を調べる`}>{rowHead(r)}</button>
            : <span className={`pc-hlabel ${r === GRID - 1 ? 'pc-hpar' : ''}`}>{rowShort(r)}</span>}
          {line.map((b, c) => {
            const par = r === GRID - 1 || c === GRID - 1;
            return mode === 'edit'
              ? <Card key={c} value={b} label={`データ${cellName(r, c)}`} parity={par}
                  onClick={par || phase !== 'edit' ? undefined : () => setData(data.map((dr, i) => dr.map((x, k) => (i === r && k === c ? ((1 - x) as Bit) : x))))} />
              : <Card key={c} value={b} label={cellName(r, c)} parity={par}
                  flipped={shown && !!prob?.flipped.some((f) => same(f, [r, c]))}
                  selected={row === r && col === c && !fixed}
                  onClick={() => tapCell(r, c)} />;
          })}
        </div>
      ))}
    </div>
  );

  const rows = prob ? oddRows(prob.received).length : 0;
  const cols = prob ? oddCols(prob.received).length : 0;

  return (
    <section className="pc-stage" id="pc-stage3" aria-labelledby="pc-h3x">
      <h2 id="pc-h3x" className="pc-h2">ステージ3　2次元パリティ</h2>
      <p className="pc-lead">データ4×4に、縦と横の<strong>偶数パリティ</strong>（オレンジの枠）を付けて送ります。受信側で、誤りの場所を見つけて直そう。</p>

      {senderHidden && (
        <div className="pc-block pc-hidden-sender" role="status">
          <h3 className="pc-h3">送信側</h3>
          <p>🙈 送ったマスは隠しました。受信したマスだけを見て、考えよう。（「答えを見る」か、直し終わると、また見られます）</p>
        </div>
      )}
      <div className="pc-block" hidden={senderHidden}>
        <h3 className="pc-h3">送信側</h3>
        <div className={phase === 'sending' ? 'pc-flying' : ''}>{board(sent, 'edit')}</div>
        {phase === 'edit' && (
          <>
            <button type="button" className="pc-btn" onClick={() => setData(randomData4())}>🎲 ランダム</button>
            <fieldset className="pc-noise">
              <legend>ノイズ</legend>
              {([1, 2] as const).map((n) => (
                <label key={n} className={noise === n ? 'pc-on' : ''}>
                  <input type="radio" name="pc-noise-3" checked={noise === n} onChange={() => setNoise(n)} />ノイズ{n}枚
                </label>
              ))}
            </fieldset>
            <button type="button" className="pc-btn pc-btn-main" onClick={send}>送信 ▶</button>
          </>
        )}
      </div>

      {phase === 'sending' && <p className="pc-channel" role="status">📡 通信路を送信中…</p>}

      {prob && grid && phase === 'work' && (
        <div className="pc-block pc-recv">
          <h3 className="pc-h3">受信側</h3>
          <ol className="pc-check" aria-label="3つのステップ">
            <li className={row !== null ? 'pc-done' : ''}>{row !== null ? '✓' : '①'} おかしい行を選ぶ</li>
            <li className={col !== null ? 'pc-done' : ''}>{col !== null ? '✓' : '②'} おかしい列を選ぶ</li>
            <li className={fixed ? 'pc-done' : ''}>{fixed ? '✓' : '③'} 交点のカードを直す</li>
          </ol>
          <p className="pc-note">行や列の見出しをタップして、1の数が奇数か調べよう。2つ見つかったら、交わるカードをタップ。</p>
          {board(grid, 'recv')}
          <p className={`pc-msg ${done && oneNoise ? 'pc-msg-ok' : ''}`} role="status" aria-live="polite">{msg}</p>
          {done && oneNoise && !shown && <div className="pc-result pc-result-ok" role="status">✔ 訂正成功！　🎉 クリア</div>}
          {shown && prob && (
            <p className="pc-reveal" role="status" aria-live="polite">
              反転したマス：{prob.flipped.map((f) => cellName(f[0], f[1])).join('、')}（赤い点線の枠）。おかしい行は{rows}本、おかしい列は{cols}本です。
            </p>
          )}
          <label className="pc-hintbox">
            <input type="checkbox" checked={hint} onChange={(e) => toggleHint(e.target.checked)} /> 1の数を表示（ヒント。使ったことは記録されます）
          </label>
          <div className="pc-inline pc-actions">
            {!shown && !done && <button type="button" className="pc-btn pc-btn-sub" onClick={showAnswer}>答えを見る（クリアに数えません）</button>}
            {(done || shown) && <button type="button" className="pc-btn pc-btn-main" onClick={next}>次の問題 ▶</button>}
          </div>
        </div>
      )}
    </section>
  );
}
