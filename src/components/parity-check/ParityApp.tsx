import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildSave, clearProblems, loadProblems, mergeProblems, newProblemId, saveProblems, STORAGE_KEY, type Problem } from '../../utils/parity-check/log.ts';
import { progressOf } from '../../utils/parity-check/submission.ts';
import { STAGES } from '../../utils/parity-check/stages.ts';
import { LogContext, type LogApi } from './context.tsx';
import Stage12 from './Stage12.tsx';
import Stage3 from './Stage3.tsx';
import { WhyStage1, WhyStage2, WhyStage3 } from './Why.tsx';

/** ステージ番号 → 画面。ステージ4・5は、stages.ts に足して、ここに部品を足す */
const STAGE_VIEWS: Record<number, () => ReactNode> = {
  1: () => <><Stage12 stage={1} mode="even" /><WhyStage1 /></>,
  2: () => <><Stage12 stage={2} mode="odd" /><WhyStage2 /></>,
  3: () => <><Stage3 /><WhyStage3 /></>,
};

const ACTIVE = STAGES.filter((s) => STAGE_VIEWS[s.id]);

export default function ParityApp() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const ref = useRef<Problem[]>([]);
  /** このタブで作った問題の識別子 */
  const own = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState('');

  // 続きからできるよう、端末（localStorage）から読む。ほかのタブで記録が変わったときも、取り込む
  useEffect(() => {
    ref.current = loadProblems(); setProblems(ref.current); setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      if (e.newValue === null) { ref.current = []; own.current.clear(); setProblems([]); return; } // ほかのタブで記録を消した
      ref.current = mergeProblems(ref.current, loadProblems(), own.current);
      setProblems(ref.current);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 保存の前に、ほかのタブが保存した分と合わせる（後から保存したタブが、先の記録を消してしまわないように）
  const commit = useCallback((next: Problem[]) => {
    const merged = mergeProblems(next, loadProblems(), own.current);
    ref.current = merged; setProblems(merged); saveProblems(merged);
  }, []);
  const api = useMemo<LogApi>(() => ({
    problems,
    add: (p) => { const id = newProblemId(); own.current.add(id); commit([...ref.current, { ...p, id }]); return id; },
    patch: (id, f) => commit(ref.current.map((p) => (p.id === id ? f(p) : p))),
  }), [problems, commit]);

  const cleared = problems.filter((p) => p.cleared).length;
  const prog = useMemo(() => progressOf(problems), [problems]);

  const save = () => {
    const blob = new Blob([JSON.stringify(buildSave(problems), null, 2)], { type: 'application/json' });
    const name = `parity-check_${new Date().toISOString().slice(0, 10)}.json`;
    const w = window as unknown as { downloadFileShared?: (b: Blob, n: string) => Promise<void> };
    if (w.downloadFileShared) { void w.downloadFileShared(blob, name); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const erase = () => { clearProblems(); ref.current = []; own.current.clear(); setProblems([]); setConfirming(false); setNotice('記録を消しました。'); };

  return (
    <LogContext.Provider value={api}>
      <div className="pc-page">
        <header className="pc-head">
          <h1>パリティチェックを体験しよう</h1>
          <p>カードを送って、ノイズで壊れたことに気づけるか、確かめよう。</p>
          <nav aria-label="ステージ" className="pc-toc">
            {ACTIVE.map((s) => (
              <a key={s.id} href={`#${s.anchor}`}><strong>{s.title}</strong><span>{s.summary}</span></a>
            ))}
          </nav>
          <div className="pc-tools">
            <span aria-live="polite">クリアした問題：{ready ? cleared : '…'}問</span>
            <button type="button" className="pc-btn" onClick={save} disabled={problems.length === 0}>💾 保存</button>
            <button type="button" className="pc-btn pc-btn-sub" onClick={() => { setConfirming(true); setNotice(''); }} disabled={problems.length === 0}>記録を消す</button>
          </div>
          <div className="pc-progress" aria-label="課題の進み具合">
            <div className={prog.task1Done ? 'pc-prog-done' : ''}>
              <strong>課題① 偶数・奇数パリティ（ステージ1・2）　{prog.task1.filter((x) => x.done).length}/6　{prog.task1Done ? '✔ 提出できます' : 'あと' + prog.task1.filter((x) => !x.done).length + '種類'}</strong>
              <ul>
                {prog.task1.map((x) => <li key={x.label} className={x.done ? 'pc-ok' : ''}>{x.done ? '✔' : '□'} {x.label}</li>)}
              </ul>
            </div>
            <div className={prog.task2Done ? 'pc-prog-done' : ''}>
              <strong>課題② 2次元パリティ（ステージ3）　{prog.task2Done ? '✔ 提出できます' : `ノイズ1枚 ${Math.min(prog.task2.cleared, 3)}/3問`}</strong>
              <ul>
                <li className={prog.task2.cleared >= 3 ? 'pc-ok' : ''}>{prog.task2.cleared >= 3 ? '✔' : '□'} ノイズ1枚を3問クリア（今は{prog.task2.cleared}問）</li>
                <li className={prog.task2.parityDone ? 'pc-ok' : ''}>{prog.task2.parityDone ? '✔' : '□'} パリティのマス（右端の列・下端の行）が反転した問題をクリア</li>
              </ul>
            </div>
            <p className="pc-note">「答えを見る」を押した問題は数えません。この記録のファイルは、両方の課題にそのまま提出できます。</p>
          </div>
          {confirming && (
            <div className="pc-confirm" role="alertdialog" aria-label="記録を消す確認">
              <p>この端末に保存した操作の記録（{problems.length}問）を、すべて消します。元に戻せません。よろしいですか？</p>
              <div className="pc-inline">
                <button type="button" className="pc-btn pc-btn-danger" onClick={erase}>消す</button>
                <button type="button" className="pc-btn" onClick={() => setConfirming(false)}>やめる</button>
              </div>
            </div>
          )}
          <p className="pc-note" role="status" aria-live="polite">{notice}</p>
          <p className="pc-note">記録はこの端末の中だけに保存されます。課題の提出には「💾 保存」で出力したファイルを使います。</p>
        </header>
        {ready && ACTIVE.map((s) => <div key={s.id}>{STAGE_VIEWS[s.id]?.()}</div>)}
      </div>
    </LogContext.Provider>
  );
}
