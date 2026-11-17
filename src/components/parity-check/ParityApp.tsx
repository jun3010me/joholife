import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildSave, clearProblems, loadProblems, saveProblems, type Problem } from '../../utils/parity-check/log.ts';
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
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState('');

  // 続きからできるよう、端末（localStorage）から読む
  useEffect(() => { ref.current = loadProblems(); setProblems(ref.current); setReady(true); }, []);

  const commit = useCallback((next: Problem[]) => { ref.current = next; setProblems(next); saveProblems(next); }, []);
  const api = useMemo<LogApi>(() => ({
    problems,
    add: (p) => { const i = ref.current.length; commit([...ref.current, p]); return i; },
    patch: (i, f) => commit(ref.current.map((p, k) => (k === i ? f(p) : p))),
  }), [problems, commit]);

  const cleared = problems.filter((p) => p.cleared).length;

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
  const erase = () => { clearProblems(); ref.current = []; setProblems([]); setConfirming(false); setNotice('記録を消しました。'); };

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
