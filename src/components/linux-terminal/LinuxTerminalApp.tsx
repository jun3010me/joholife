import { useCallback, useMemo, useState } from 'react';
import {
  Shell,
  buildTree,
  clearSaved,
  loadShell,
  saveShell,
} from '../../utils/linux-terminal/engine/index.ts';
import type { LoadStatus, StorageLike } from '../../utils/linux-terminal/engine/index.ts';
import {
  DEFAULT_ENVIRONMENT_ID,
  getEnvironment,
} from '../../utils/linux-terminal/environments/index.ts';
import Terminal from './Terminal.tsx';
import DirectoryTree from './DirectoryTree.tsx';

interface Props {
  /** 章ごとの初期環境。省略すると自由練習用の環境 */
  environmentId?: string;
}

/** 使えるときだけ localStorage を返す（プライベートモードなどでは null） */
function getStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = 'joholife:linux-terminal:probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

interface Session {
  shell: Shell;
  status: LoadStatus;
  /** Terminal を作り直すためのキー */
  generation: number;
}

export default function LinuxTerminalApp({ environmentId = DEFAULT_ENVIRONMENT_ID }: Props) {
  const storage = useMemo(getStorage, []);
  const makeEnv = useCallback(() => {
    const env = getEnvironment(environmentId) ?? getEnvironment(DEFAULT_ENVIRONMENT_ID);
    if (!env) throw new Error('初期環境が見つかりません');
    return env;
  }, [environmentId]);

  const [session, setSession] = useState<Session>(() => {
    const { shell, status } = loadShell(storage, makeEnv());
    return { shell, status, generation: 0 };
  });
  const [tick, setTick] = useState(0);
  const [saveFailed, setSaveFailed] = useState(storage === null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const { shell } = session;

  const onExecuted = useCallback(() => {
    setSaveFailed(!saveShell(storage, shell));
    setTick((t) => t + 1);
  }, [storage, shell]);

  const doReset = () => {
    clearSaved(storage, shell.env.id);
    setSession((s) => ({
      shell: new Shell(makeEnv()),
      status: 'fresh',
      generation: s.generation + 1,
    }));
    setConfirmingReset(false);
    setTick((t) => t + 1);
  };

  const intro = useMemo(() => {
    const lines = [...shell.env.welcome];
    if (session.status === 'restored') {
      lines.push('前回の続きから再開しました。（最初からやり直したいときは、右上のボタンを押します）');
    } else if (session.status === 'corrupt') {
      lines.push('保存されていたデータを読み込めなかったため、最初の状態から始めます。');
    }
    return lines;
    // 画面を作り直すとき（generation が変わるとき）だけ作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.generation]);

  // tick が変わるたびにツリーを作り直す（ファイルシステムは Shell の中で書き換わるため）
  const tree = useMemo(
    () => buildTree(shell.state.root, shell.state.user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shell, tick],
  );

  return (
    <div className="lt-app">
      <div className="lt-toolbar">
        <p className="lt-toolbar-text">
          <strong>{shell.env.title}</strong>　ブラウザの中だけで動く練習用ターミナルです。
        </p>
        {confirmingReset ? (
          <div className="lt-confirm" role="alertdialog" aria-label="最初からやり直す確認">
            <span>ファイルや履歴がすべて初期状態に戻ります。よろしいですか？</span>
            <button type="button" className="lt-btn lt-btn-danger" onClick={doReset}>
              やり直す
            </button>
            <button type="button" className="lt-btn" onClick={() => setConfirmingReset(false)}>
              キャンセル
            </button>
          </div>
        ) : (
          <button type="button" className="lt-btn" onClick={() => setConfirmingReset(true)}>
            🔄 最初からやり直す
          </button>
        )}
      </div>

      {saveFailed && (
        <p className="lt-warning" role="status">
          ⚠️ このブラウザでは進み具合を保存できません。ページを再読み込みすると最初の状態に戻ります。
        </p>
      )}

      <div className="lt-layout">
        <Terminal key={session.generation} shell={shell} intro={intro} onExecuted={onExecuted} />
        <DirectoryTree tree={tree} cwd={shell.cwd} home={shell.env.home} />
      </div>
    </div>
  );
}
