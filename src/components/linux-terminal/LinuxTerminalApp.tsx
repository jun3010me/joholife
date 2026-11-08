import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Shell,
  buildTree,
  clearSaved,
  loadShell,
  saveShell,
  uploadSummary,
} from '../../utils/linux-terminal/engine/index.ts';
import type {
  LoadStatus,
  OutputLine,
  StorageLike,
  UploadFile,
  UploadRejected,
} from '../../utils/linux-terminal/engine/index.ts';
import {
  DEFAULT_ENVIRONMENT_ID,
  getEnvironment,
} from '../../utils/linux-terminal/environments/index.ts';
import Terminal from './Terminal.tsx';
import DirectoryTree from './DirectoryTree.tsx';
import type { TreeNotice } from './DirectoryTree.tsx';
import { downloadTextFile } from './download.ts';
import { readUploadFiles } from './upload.ts';

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

/** 同じ名前のファイルがあって、上書きの確認を待っているアップロード */
interface PendingUpload {
  dirPath: string;
  items: UploadFile[];
  rejected: UploadRejected[];
  conflicts: string[];
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
  const [notice, setNotice] = useState<TreeNotice | null>(null);
  const [announce, setAnnounce] = useState<{ id: number; lines: OutputLine[] } | null>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [reading, setReading] = useState(false);

  const { shell } = session;

  const onExecuted = useCallback(() => {
    setSaveFailed(!saveShell(storage, shell));
    setTick((t) => t + 1);
  }, [storage, shell]);

  /** ツリーのファイル名がクリックされたら、そのファイルをダウンロードする */
  const onDownload = useCallback(
    (path: string) => {
      const r = shell.readFile(path);
      if (!r.ok) {
        setNotice({ kind: 'error', text: `ダウンロードできませんでした：${r.message}` });
        return;
      }
      try {
        downloadTextFile(r.name, r.content);
        setNotice({
          kind: 'info',
          text: `「${r.name}」をダウンロードしました。ブラウザの「ダウンロード」フォルダを確認してください。`,
        });
      } catch {
        setNotice({ kind: 'error', text: 'ダウンロードできませんでした。ブラウザの設定を確認してください。' });
      }
    },
    [shell],
  );

  const say = useCallback((lines: OutputLine[]) => {
    setAnnounce((a) => ({ id: (a?.id ?? 0) + 1, lines }));
  }, []);

  /** 確認が済んだアップロードを実行して、結果をターミナルに表示する */
  const finishUpload = useCallback(
    (dirPath: string, items: UploadFile[], rejected: UploadRejected[], overwrite: boolean) => {
      const result = shell.uploadFiles(dirPath, items, { overwrite });
      say(uploadSummary(dirPath, result, rejected));
      if (result.ok) {
        setSaveFailed(!saveShell(storage, shell));
        setTick((t) => t + 1);
      }
      if (!result.ok) {
        setNotice({ kind: 'error', text: `アップロードできませんでした：${result.message}` });
      } else if (result.uploaded === 0) {
        setNotice({ kind: 'error', text: 'アップロードできたファイルはありませんでした。ターミナルの表示を確認してください。' });
      } else {
        const skipped = result.skipped.length + rejected.length;
        setNotice({
          kind: skipped > 0 ? 'error' : 'info',
          text: `${result.uploaded}件のファイルを ${result.dirPath} にアップロードしました${
            skipped > 0 ? `（${skipped}件は取り込めませんでした）` : ''
          }`,
        });
      }
    },
    [shell, storage, say],
  );

  /** ツリーの「ここへアップロード」で選ばれたファイルを読み込む */
  const onUpload = useCallback(
    async (dirPath: string, files: File[]) => {
      setReading(true);
      setPending(null);
      try {
        const read = await readUploadFiles(files);
        if (read.fatal) {
          say([{ kind: 'error', text: `upload: ${read.fatal}` }]);
          setNotice({ kind: 'error', text: `アップロードできませんでした：${read.fatal}` });
          return;
        }
        const check = shell.checkUpload(dirPath, read.items);
        if (!check.ok) {
          say(uploadSummary(dirPath, { ok: false, message: check.message }));
          setNotice({ kind: 'error', text: `アップロードできませんでした：${check.message}` });
          return;
        }
        if (check.conflicts.length > 0) {
          setPending({ dirPath: check.dirPath, items: read.items, rejected: read.rejected, conflicts: check.conflicts });
          return;
        }
        finishUpload(check.dirPath, read.items, read.rejected, false);
      } finally {
        setReading(false);
      }
    },
    [shell, say, finishUpload],
  );

  // お知らせは数秒で消す
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  const doReset = () => {
    clearSaved(storage, shell.env.id);
    setSession((s) => ({
      shell: new Shell(makeEnv()),
      status: 'fresh',
      generation: s.generation + 1,
    }));
    setConfirmingReset(false);
    setNotice(null);
    setPending(null);
    setAnnounce(null);
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

      {pending && (
        <div className="lt-confirm lt-confirm-upload" role="alertdialog" aria-label="上書きの確認">
          <span>
            同じ名前のファイルがあります（{pending.conflicts.slice(0, 3).join('、')}
            {pending.conflicts.length > 3 ? ` など${pending.conflicts.length}件` : ''}）。上書きしますか？
          </span>
          <button
            type="button"
            className="lt-btn lt-btn-danger"
            onClick={() => {
              const p = pending;
              setPending(null);
              finishUpload(p.dirPath, p.items, p.rejected, true);
            }}
          >
            上書きする
          </button>
          <button
            type="button"
            className="lt-btn"
            onClick={() => {
              setPending(null);
              say([{ kind: 'info', text: 'アップロードを中止しました' }]);
            }}
          >
            やめる
          </button>
        </div>
      )}

      {saveFailed && (
        <p className="lt-warning" role="status">
          ⚠️ このブラウザでは進み具合を保存できません。ページを再読み込みすると最初の状態に戻ります。
        </p>
      )}

      <div className="lt-layout">
        <Terminal
          key={session.generation}
          shell={shell}
          intro={intro}
          onExecuted={onExecuted}
          announce={announce}
        />
        <DirectoryTree
          tree={tree}
          cwd={shell.cwd}
          home={shell.env.home}
          onDownload={onDownload}
          notice={notice}
          onUpload={onUpload}
          busy={reading || pending !== null}
        />
      </div>
    </div>
  );
}
