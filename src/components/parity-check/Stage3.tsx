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
  // 調べて「おかしい」と分かった行・列（ノイズ1枚は1本ずつ、ノイズ2枚は2本ずつ）
  const [rowsOk, setRowsOk] = useState<number[]>([]);
  const [colsOk, setColsOk] = useState<number[]>([]);
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
    setRowsOk([]); setColsOk([]); setFixed(false); setShown(false); setPeek(false); setMsg('');
    setPhase('sending');
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(() => setPhase('work'), reduced ? 50 : 750);
  };

  const toggleHint = (on: boolean) => {
    setHint(on);
    if (on && prob) update((p) => ({ ...p, hintUsed: true }));
  };

  const pickRow = (r: number) => {
    if (!prob || fixed || rowsOk.length >= need || rowsOk.includes(r)) return;
    const ok = oddRows(prob.received).includes(r);
    log({ step: 'row', pick: r, ok });
    if (!ok) { setMsg(`${rowName(r)}は正常です。ほかの行を調べよう。`); return; }
    const next = [...rowsOk, r];
    setRowsOk(next);
    if (need === 2 && next.length >= 2 && colsOk.length >= 2) setPeek(true);
    setMsg(`${rowName(r)}は1の数が奇数。おかしい！${need === 2 && next.length < 2 ? '（おかしい行は、あと1本あります）' : ''}`);
  };
  const pickCol = (c: number) => {
    if (!prob || fixed || colsOk.length >= need || colsOk.includes(c)) return;
    const ok = oddCols(prob.received).includes(c);
    log({ step: 'col', pick: c, ok });
    if (!ok) { setMsg(`${colName(c)}は正常です。ほかの列を調べよう。`); return; }
    const next = [...colsOk, c];
    setColsOk(next);
    if (need === 2 && next.length >= 2 && rowsOk.length >= 2) setPeek(true);
    setMsg(`${colName(c)}は1の数が奇数。おかしい！${need === 2 && next.length < 2 ? '（おかしい列は、あと1本あります）' : ''}`);
  };
  const tapCell = (r: number, c: number) => {
    if (!prob || !grid || fixed) return;
    if (prob.noise === 2) {
      setMsg(complete2 ? '交点が4か所あって、どれが反転したカードなのか決められません。' : '先に、おかしい行と列を、すべて見つけよう');
      return;
    }
    if (row === null || col === null) { setMsg('先に、おかしい行と列を選ぼう'); return; }
    if (r !== row || c !== col) { setMsg('選んだ行と列が交わるカードをタップしよう'); return; }
    log({ step: 'fix', cell: [r, c], ok: true });
    setGrid(grid.map((g, i) => g.map((b, k) => (i === r && k === c ? ((1 - b) as Bit) : b))));
    setFixed(true); setPeek(true);
    update((p) => ({ ...p, cleared: !p.answerShown }));
    setMsg('訂正成功！');
  };
  const showAnswer = () => {
    setShown(true); setPeek(true);
    update((p) => ({ ...p, answerShown: true, cleared: false }));
  };
  const next = () => { setProb(null); setGrid(null); setPhase('edit'); setMsg(''); setShown(false); setFixed(false); };

  const need = prob?.noise === 2 ? 2 : 1;
  const row = rowsOk[0] ?? null;
  const col = colsOk[0] ?? null;
  /** ノイズ2枚：おかしい行・列を2本ずつ見つけ終えた状態（これ以上は場所を決められない） */
  const complete2 = prob?.noise === 2 && rowsOk.length >= 2 && colsOk.length >= 2;
  const senderHidden = !!prob && phase === 'work' && !peek;
  const oneNoise = prob?.noise === 1;
  const done = fixed; // ノイズ1枚で直し終えた
  const rowHead = (r: number) => hint && prob && grid ? `${rowShort(r)}（${countOnes(grid[r])}）` : rowShort(r);
  const colHead = (c: number) => hint && prob && grid ? `${colShort(c)}（${countOnes(grid.map((x) => x[c]))}）` : colShort(c);

  /** 見出し付きの6×6のマス */
  const board = (g: Grid, mode: 'edit' | 'recv') => (
    <div className="pc-grid" role="group" aria-label={mode === 'edit' ? '送信するマス' : '受信したマス'}>
      <span className="pc-corner" aria-hidden="true" />
      {Array.from({ length: GRID }, (_, c) => (mode === 'recv'
        ? <button key={c} type="button" className={`pc-hbtn ${colsOk.includes(c) ? 'pc-hdone' : ''}`} onClick={() => pickCol(c)}
            disabled={colsOk.includes(c) || colsOk.length >= need || fixed} aria-label={`${colName(c)}を調べる`}>{colHead(c)}</button>
        : <span key={c} className={`pc-hlabel ${c === GRID - 1 ? 'pc-hpar' : ''}`}>{colShort(c)}</span>))}
      {g.map((line, r) => (
        <div key={r} className="pc-gridrow">
          {mode === 'recv'
            ? <button type="button" className={`pc-hbtn ${rowsOk.includes(r) ? 'pc-hdone' : ''}`} onClick={() => pickRow(r)}
                disabled={rowsOk.includes(r) || rowsOk.length >= need || fixed} aria-label={`${rowName(r)}を調べる`}>{rowHead(r)}</button>
            : <span className={`pc-hlabel ${r === GRID - 1 ? 'pc-hpar' : ''}`}>{rowShort(r)}</span>}
          {line.map((b, c) => {
            const par = r === GRID - 1 || c === GRID - 1;
            return mode === 'edit'
              ? <Card key={c} value={b} label={`データ${cellName(r, c)}`} parity={par}
                  onClick={par || phase !== 'edit' ? undefined : () => setData(data.map((dr, i) => dr.map((x, k) => (i === r && k === c ? ((1 - x) as Bit) : x))))} />
              : <Card key={c} value={b} label={cellName(r, c)} parity={par}
                  flipped={shown && !!prob?.flipped.some((f) => same(f, [r, c]))}
                  selected={oneNoise ? row === r && col === c && !fixed : !!complete2 && rowsOk.includes(r) && colsOk.includes(c)}
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
          <p>🙈 送ったマスは隠しました。受信したマスだけを見て、考えよう。（「答えを見る」を押すか、調べ終わると、また見られます）</p>
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
          {oneNoise ? (
            <ol className="pc-check" aria-label="3つのステップ">
              <li className={row !== null ? 'pc-done' : ''}>{row !== null ? '✓' : '①'} おかしい行を選ぶ</li>
              <li className={col !== null ? 'pc-done' : ''}>{col !== null ? '✓' : '②'} おかしい列を選ぶ</li>
              <li className={fixed ? 'pc-done' : ''}>{fixed ? '✓' : '③'} 交点のカードを直す</li>
            </ol>
          ) : (
            <ol className="pc-check" aria-label="3つのステップ">
              <li className={rowsOk.length >= 2 ? 'pc-done' : ''}>{rowsOk.length >= 2 ? '✓' : '①'} おかしい行を2本見つける（{rowsOk.length}/2）</li>
              <li className={colsOk.length >= 2 ? 'pc-done' : ''}>{colsOk.length >= 2 ? '✓' : '②'} おかしい列を2本見つける（{colsOk.length}/2）</li>
              <li className={complete2 ? 'pc-done' : ''}>{complete2 ? '✓' : '③'} 反転した場所を決める</li>
            </ol>
          )}
          <p className="pc-note">
            {oneNoise
              ? '行や列の見出しをタップして、1の数が奇数か調べよう。2つ見つかったら、交わるカードをタップ。'
              : 'ノイズが2枚です。行や列の見出しをタップして、1の数が奇数のものを、2本ずつ見つけよう。'}
          </p>
          {board(grid, 'recv')}
          <p className={`pc-msg ${done && oneNoise ? 'pc-msg-ok' : ''}`} role="status" aria-live="polite">{msg}</p>
          {done && oneNoise && !shown && <div className="pc-result pc-result-ok" role="status">✔ 訂正成功！　🎉 クリア</div>}
          {complete2 && (
            <div className="pc-result pc-result-neutral" role="status" aria-live="polite">
              <strong>おかしい行は{rowsOk.map(rowName).join('・')}、おかしい列は{colsOk.map(colName).join('・')}</strong>が見つかりました。
              でも、行と列の組み合わせは4通りあって（枠で示した4か所）、反転したのはどの2か所なのか、パリティだけでは決められません。
              これが、2次元パリティの限界です。
            </div>
          )}
          {shown && prob && (
            <p className="pc-reveal" role="status" aria-live="polite">
              反転したマス：{prob.flipped.map((f) => cellName(f[0], f[1])).join('、')}（赤い点線の枠）。おかしい行は{rows}本、おかしい列は{cols}本です。
              {!oneNoise && 'もう一方の対角の2か所が反転していても、おかしい行・列は同じになります。'}
            </p>
          )}
          <label className="pc-hintbox">
            <input type="checkbox" checked={hint} onChange={(e) => toggleHint(e.target.checked)} /> 1の数を表示（ヒント。使ったことは記録されます）
          </label>
          <div className="pc-inline pc-actions">
            {!shown && !done && <button type="button" className="pc-btn pc-btn-sub" onClick={showAnswer}>答えを見る（クリアに数えません）</button>}
            {(done || shown || complete2) && <button type="button" className="pc-btn pc-btn-main" onClick={next}>次の問題 ▶</button>}
          </div>
        </div>
      )}
    </section>
  );
}
