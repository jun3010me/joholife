import { useEffect, useRef, useState } from 'react';
import { applyNoise, countOnes, encode, judge, type Bit, type Mode, type Noise } from '../../utils/parity-check/parity.ts';
import type { Problem12 } from '../../utils/parity-check/log.ts';
import Card from './Card.tsx';
import { useLog } from './context.tsx';

const NOISES: { id: Noise; label: string }[] = [
  { id: 'none', label: 'なし' },
  { id: 'one', label: '1枚反転' },
  { id: 'two', label: '2枚反転' },
  { id: 'zero', label: '全部0が届く' },
];
type Phase = 'edit' | 'sending' | 'count' | 'judge' | 'done';
interface Recv { received: Bit[]; flipped: number[]; idx: number; noise: Noise }

const RULE: Record<Mode, string> = { even: '1の数が偶数', odd: '1の数が奇数' };

/** ステージ1（偶数パリティ）・ステージ2（奇数パリティ）。モードだけがちがう同じ部品 */
export default function Stage12({ stage, mode }: { stage: 1 | 2; mode: Mode }) {
  const { add, patch } = useLog();
  const [data, setData] = useState<Bit[]>(Array(7).fill(0));
  const [noise, setNoise] = useState<Noise>('one');
  const [phase, setPhase] = useState<Phase>('edit');
  const [recv, setRecv] = useState<Recv | null>(null);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const [reveal, setReveal] = useState(false);
  const [shown, setShown] = useState(false);
  // 送信後は、送信側を隠して受信側だけで考えさせる。「確かめる」「答えを見る」で再表示する
  const [peek, setPeek] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const sent = encode(data, mode);
  const dataOnes = countOnes(data);
  const total = countOnes(sent);
  const noOnes = total === 0;
  const senderHidden = !!recv && (phase === 'count' || phase === 'judge' || phase === 'done') && !peek;
  const parityLabel = mode === 'even' ? '偶数' : '奇数';

  const update = (f: (p: Problem12) => Problem12) => recv && patch(recv.idx, (p) => f(p as Problem12));

  const send = () => {
    if (noise === 'zero' && noOnes) return;
    const { received, flipped } = applyNoise(sent, noise);
    const idx = add({ stage, mode, noise, sent, flipped, steps: [], answerShown: false, cleared: false });
    setRecv({ received, flipped, idx, noise });
    setInput(''); setMsg(''); setReveal(false); setShown(false); setPeek(false);
    setPhase('sending');
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(() => setPhase('count'), reduced ? 50 : 750);
  };

  const checkCount = () => {
    if (!recv || input.trim() === '') return;
    setPeek(true);
    const v = Number(input);
    const ok = Number.isInteger(v) && v === countOnes(recv.received);
    update((p) => ({ ...p, steps: [...p.steps, { step: 'count', value: Number.isFinite(v) ? v : -1, ok }] }));
    if (ok) { setPhase('judge'); setMsg(''); } else setMsg('1の数がちがうようです。表（黒）のカードをもう一度数えてみよう。');
  };

  const choose = (pick: 'ok' | 'error') => {
    if (!recv) return;
    const truth = judge(recv.received, mode);
    const ok = pick === truth;
    update((p) => ({ ...p, steps: [...p.steps, { step: 'judge', pick, ok }], cleared: ok && !p.answerShown }));
    if (ok) { setPhase('done'); setMsg(''); }
    else setMsg(`${parityLabel}パリティの約束は「${RULE[mode]}」です。受け取った1の数と見比べて、もう一度考えてみよう。`);
  };

  const showAnswer = () => {
    setReveal(true); setShown(true); setPeek(true);
    update((p) => ({ ...p, answerShown: true, cleared: false }));
  };

  const next = () => { setRecv(null); setPhase('edit'); setMsg(''); setReveal(false); setShown(false); };

  const truth = recv ? judge(recv.received, mode) : null;
  const resultText = recv && truth
    ? `1の数は${countOnes(recv.received)}枚 → ${truth === 'ok' ? '「正しく届いた」と判定するのが正解' : '「誤りあり」と気づけました'}`
    : '';

  return (
    <section className="pc-stage" id={`pc-stage${stage}`} aria-labelledby={`pc-h${stage}`}>
      <h2 id={`pc-h${stage}`} className="pc-h2">ステージ{stage}　{parityLabel}パリティ</h2>
      <p className="pc-lead">
        データ7枚をめくって、最後の1枚（オレンジの枠）で<strong>{RULE[mode]}</strong>にそろえて送ります。
      </p>

      {senderHidden && (
        <div className="pc-block pc-hidden-sender" role="status">
          <h3 className="pc-h3">送信側</h3>
          <p>🙈 送ったカードは隠しました。受信したカードだけを見て、考えよう。（「確かめる」か「答えを見る」で、また見られます）</p>
        </div>
      )}
      <div className="pc-block" hidden={senderHidden}>
        <h3 className="pc-h3">送信側</h3>
        <div className={`pc-row ${phase === 'sending' ? 'pc-flying' : ''}`}>
          {data.map((b, i) => (
            <Card key={i} value={b} label={`データ${i + 1}枚目`}
              onClick={phase === 'edit' ? () => setData(data.map((x, k) => (k === i ? ((1 - x) as Bit) : x))) : undefined} />
          ))}
          <Card value={sent[7]} label="パリティ" parity />
        </div>
        <p className="pc-count" aria-live="polite">
          1の数：データ{dataOnes}枚＋パリティ{sent[7]}枚＝合計{total}（{total % 2 === 0 ? '偶数' : '奇数'}）
        </p>

        {phase === 'edit' && (
          <>
            <fieldset className="pc-noise">
              <legend>ノイズ</legend>
              {NOISES.map((n) => (
                <label key={n.id} className={noise === n.id ? 'pc-on' : ''}>
                  <input type="radio" name={`pc-noise-${stage}`} checked={noise === n.id} onChange={() => setNoise(n.id)} />
                  {n.label}
                </label>
              ))}
            </fieldset>
            <button type="button" className="pc-btn pc-btn-main" onClick={send} disabled={noise === 'zero' && noOnes}>送信 ▶</button>
            {noise === 'zero' && noOnes && <p className="pc-note">「全部0が届く」を試すには、データを1枚以上めくって1を作ろう。</p>}
          </>
        )}
      </div>

      {phase === 'sending' && <p className="pc-channel" role="status">📡 通信路を送信中…</p>}

      {recv && phase !== 'sending' && (
        <div className="pc-block pc-recv">
          <h3 className="pc-h3">受信側</h3>
          <div className="pc-row" aria-label="受信したカード">
            {recv.received.map((b, i) => (
              <Card key={i} value={b} label={i < 7 ? `受信データ${i + 1}枚目` : '受信パリティ'} parity={i === 7}
                flipped={reveal && recv.flipped.includes(i)} />
            ))}
          </div>

          {phase === 'count' && (
            <div className="pc-ask">
              <label htmlFor={`pc-in-${stage}`}>表（1）のカードは何枚？</label>
              <div className="pc-inline">
                <input id={`pc-in-${stage}`} type="number" inputMode="numeric" min={0} max={8} value={input}
                  onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkCount()} />
                <button type="button" className="pc-btn pc-btn-main" onClick={checkCount} disabled={input.trim() === ''}>確かめる</button>
              </div>
            </div>
          )}

          {phase === 'judge' && (
            <div className="pc-ask">
              <p>1の数は{countOnes(recv.received)}枚。{parityLabel}パリティなら、このカードは？</p>
              <div className="pc-inline">
                <button type="button" className="pc-btn" onClick={() => choose('ok')}>正しく届いた</button>
                <button type="button" className="pc-btn" onClick={() => choose('error')}>誤りあり</button>
              </div>
            </div>
          )}

          <p className="pc-msg" role="status" aria-live="polite">{msg}</p>

          {phase === 'done' && truth && (
            // 色は「正解かどうか」で決める（「誤りあり」と判定して正解したときも緑）
            <div className={`pc-result ${shown ? 'pc-result-neutral' : 'pc-result-ok'}`} role="status" aria-live="polite">
              <strong>{shown ? '答えを見た問題' : '✔ 正解！'}</strong>　{resultText}
              {!shown && <span className="pc-cleared">　🎉 クリア</span>}
            </div>
          )}
          {reveal && (
            <p className="pc-reveal" role="status" aria-live="polite">
              {recv.noise === 'none' && 'ノイズなしなので、反転したカードはありません。'}
              {recv.noise === 'one' && '赤い点線の枠が、反転した1枚です。'}
              {recv.noise === 'two' && (truth === 'ok' ? '実は2枚反転していました（赤い点線の枠）。1の数が元に戻ったので、パリティでは気づけません。' : '赤い点線の枠が、反転した2枚です。')}
              {recv.noise === 'zero' && (truth === 'ok' ? '全部0が届きました（回線が切れた想定）。偶数パリティでは、1が0個＝偶数なので、見逃してしまいます。' : '全部0が届きました（回線が切れた想定）。奇数パリティなら、1が0個では約束とちがうので気づけます。')}
            </p>
          )}

          <div className="pc-inline pc-actions">
            {phase === 'done' && !reveal && <button type="button" className="pc-btn" onClick={() => setReveal(true)}>答え合わせ</button>}
            {phase !== 'done' && !shown && <button type="button" className="pc-btn pc-btn-sub" onClick={showAnswer}>答えを見る（クリアに数えません）</button>}
            {(phase === 'done' || shown) && <button type="button" className="pc-btn pc-btn-main" onClick={next}>次の問題 ▶</button>}
          </div>
        </div>
      )}
    </section>
  );
}
