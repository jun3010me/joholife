import { useEffect, useRef, useState } from 'react';
import type { TreeNode } from '../../utils/linux-terminal/engine/index.ts';

export interface TreeNotice {
  kind: 'info' | 'error';
  text: string;
}

interface Props {
  tree: TreeNode;
  cwd: string;
  home: string;
  /** ファイル名がクリックされたとき（ダウンロード） */
  onDownload: (path: string) => void;
  /** ダウンロードの結果など */
  notice: TreeNotice | null;
  /** 選んだファイルをディレクトリにアップロードする */
  onUpload: (dirPath: string, files: File[]) => void;
  /** 読み込み中（アップロードの操作を止める） */
  busy?: boolean;
}

/** "/a/b" → ["/", "/a", "/a/b"] */
function ancestorsOf(path: string): string[] {
  const out = ['/'];
  let acc = '';
  for (const seg of path.split('/').filter(Boolean)) {
    acc += '/' + seg;
    out.push(acc);
  }
  return out;
}

export default function DirectoryTree({ tree, cwd, home, onDownload, notice, onUpload, busy = false }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(ancestorsOf(cwd)));
  const [hidden, setHidden] = useState(false);
  /** 「ここへアップロード」を押したディレクトリ */
  const [uploadDir, setUploadDir] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const picked = (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    input.value = ''; // 同じファイルをもう一度選べるようにする
    if (uploadDir !== null && files.length > 0) {
      onUpload(uploadDir, files);
      setUploadDir(null);
    }
  };

  // 現在地が変わったら、そこまでの道すじを開く
  useEffect(() => {
    setOpen((prev) => {
      const next = new Set(prev);
      for (const a of ancestorsOf(cwd)) next.add(a);
      return next;
    });
  }, [cwd]);

  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNode = (node: TreeNode): React.ReactNode => {
    const isCwd = node.path === cwd;
    const isDir = node.type === 'dir';
    const expanded = isDir && open.has(node.path) && !node.locked;
    const label = (
      <>
        <span aria-hidden="true">{node.locked ? '🔒' : isDir ? (expanded ? '📂' : '📁') : '📄'}</span>{' '}
        <span className="lt-tree-name">
          {node.name}
          {isDir && node.name !== '/' ? '/' : ''}
        </span>
        {node.path === home && <span className="lt-tree-badge">ホーム</span>}
        {isCwd && <span className="lt-tree-here">◀ 現在地</span>}
        {node.locked && <span className="lt-tree-badge">権限なし</span>}
      </>
    );
    return (
      <li
        key={node.path}
        role="treeitem"
        aria-expanded={isDir && !node.locked ? expanded : undefined}
        aria-current={isCwd ? 'location' : undefined}
        aria-selected={isCwd}
      >
        {isDir && !node.locked ? (
          <div className="lt-tree-line">
            <button
              type="button"
              className={`lt-tree-row ${isCwd ? 'lt-tree-current' : ''}`}
              onClick={() => toggle(node.path)}
            >
              {label}
            </button>
            <button
              type="button"
              className={`lt-tree-up ${uploadDir === node.path ? 'lt-tree-up-active' : ''}`}
              onClick={() => setUploadDir((d) => (d === node.path ? null : node.path))}
              title="ここへアップロード"
              aria-label={`${node.path} へアップロード`}
              aria-pressed={uploadDir === node.path}
              disabled={busy}
            >
              <span aria-hidden="true">⬆</span>
            </button>
          </div>
        ) : !isDir ? (
          <button
            type="button"
            className="lt-tree-row lt-tree-file"
            onClick={() => onDownload(node.path)}
            title="クリックでダウンロード"
            aria-label={`${node.name} をダウンロード`}
          >
            {label}
            <span className="lt-tree-dl" aria-hidden="true">
              ⬇
            </span>
          </button>
        ) : (
          <div className={`lt-tree-row ${isCwd ? 'lt-tree-current' : ''}`}>{label}</div>
        )}
        {expanded && node.children.length > 0 && (
          <ul role="group" className="lt-tree-list">
            {node.children.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="lt-tree" aria-label="ディレクトリツリー">
      <div className="lt-tree-header">
        <h2 className="lt-tree-title">ディレクトリツリー</h2>
        <button
          type="button"
          className="lt-btn lt-btn-small"
          onClick={() => setHidden((h) => !h)}
          aria-expanded={!hidden}
          aria-controls="lt-tree-body"
        >
          {hidden ? '表示する' : '折りたたむ'}
        </button>
      </div>
      {!hidden && (
        <div id="lt-tree-body" className="lt-tree-body">
          <p className="lt-tree-cwd">
            現在地：<code>{cwd}</code>
          </p>
          <div role="status" aria-live="polite">
            {notice && (
              <p className={`lt-tree-notice ${notice.kind === 'error' ? 'lt-tree-notice-error' : ''}`}>
                {notice.text}
              </p>
            )}
          </div>
          {uploadDir !== null && (
            <div className="lt-upload" role="group" aria-label="アップロード">
              <p className="lt-upload-title">
                <code>{uploadDir}</code> へアップロード
              </p>
              <div className="lt-upload-buttons">
                <button type="button" className="lt-btn lt-btn-small" onClick={() => fileInput.current?.click()} disabled={busy}>
                  📄 ファイルを選ぶ（複数OK）
                </button>
                <button type="button" className="lt-btn lt-btn-small" onClick={() => folderInput.current?.click()} disabled={busy}>
                  📁 フォルダごと選ぶ
                </button>
                <button type="button" className="lt-btn lt-btn-small" onClick={() => setUploadDir(null)}>
                  閉じる
                </button>
              </div>
              <p className="lt-upload-note">UTF-8 のテキストファイル（.txt .csv .log など）だけアップロードできます。</p>
            </div>
          )}
          <ul role="tree" className="lt-tree-list lt-tree-root">
            {renderNode(tree)}
          </ul>
          <p className="lt-tree-note">
            📄 ファイル名をクリックすると、そのファイルをダウンロードできます。⬆ を押すと、そのディレクトリにパソコンのファイルをアップロードできます。隠しファイル（. で始まるもの）は表示していません。
          </p>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => picked(e.currentTarget)}
      />
      <input
        ref={folderInput}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => picked(e.currentTarget)}
      />
    </section>
  );
}
