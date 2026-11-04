import { useEffect, useState } from 'react';
import type { TreeNode } from '../../utils/linux-terminal/engine/index.ts';

interface Props {
  tree: TreeNode;
  cwd: string;
  home: string;
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

export default function DirectoryTree({ tree, cwd, home }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(ancestorsOf(cwd)));
  const [hidden, setHidden] = useState(false);

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
          <button
            type="button"
            className={`lt-tree-row ${isCwd ? 'lt-tree-current' : ''}`}
            onClick={() => toggle(node.path)}
          >
            {label}
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
          <ul role="tree" className="lt-tree-list lt-tree-root">
            {renderNode(tree)}
          </ul>
          <p className="lt-tree-note">隠しファイル（. で始まるもの）は表示していません。</p>
        </div>
      )}
    </section>
  );
}
