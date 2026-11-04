import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { EditRequest, Shell } from '../../utils/linux-terminal/engine/index.ts';

interface Props {
  request: EditRequest;
  shell: Shell;
  /** ファイルを保存したあと（保存と、ツリーの更新に使う） */
  onSaved: () => void;
  onClose: () => void;
}

type Message = { kind: 'info' | 'error'; text: string };

const countLines = (s: string): number => (s === '' ? 0 : s.replace(/\n$/, '').split('\n').length);

/** nano 風のエディタ。保存は仮想ファイルシステムに書き込むだけで、パソコンのファイルには影響しない。 */
export default function Editor({ request, shell, onSaved, onClose }: Props) {
  const [text, setText] = useState(request.content);
  const [baseline, setBaseline] = useState(request.content);
  const [message, setMessage] = useState<Message | null>(
    request.readOnly
      ? { kind: 'error', text: '[ 読み取り専用です：このファイルには書き込み権限がありません ]' }
      : request.isNew
        ? { kind: 'info', text: '[ 新しいファイル：保存すると作られます ]' }
        : null,
  );
  const [confirming, setConfirming] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const modified = text !== baseline;

  useEffect(() => {
    const el = areaRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      el.setSelectionRange(0, 0);
    }
  }, []);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else areaRef.current?.focus({ preventScroll: true });
  }, [confirming]);

  /** 保存する。成功したら true */
  const save = (): boolean => {
    // 本物の nano と同じく、最後に改行を付けて保存する
    const content = text === '' || text.endsWith('\n') ? text : text + '\n';
    const r = shell.saveFile(request.path, content);
    if (!r.ok) {
      setMessage({ kind: 'error', text: `[ ${r.message} ]` });
      return false;
    }
    setBaseline(text);
    const n = countLines(content);
    setMessage({
      kind: 'info',
      text: r.created ? `[ 新しいファイルを作りました（${n} 行） ]` : `[ 保存しました（${n} 行） ]`,
    });
    onSaved();
    return true;
  };

  const requestExit = () => {
    if (modified) setConfirming(true);
    else onClose();
  };

  const onTextKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 日本語入力の変換中
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'o' || k === 's') {
      e.preventDefault();
      save();
    } else if (k === 'x') {
      e.preventDefault();
      requestExit();
    }
  };

  const onConfirmKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key.toLowerCase();
    if (k === 'y') {
      e.preventDefault();
      if (save()) onClose();
      else setConfirming(false);
    } else if (k === 'n') {
      e.preventDefault();
      onClose();
    } else if (k === 'c' || k === 'escape') {
      e.preventDefault();
      setConfirming(false);
    }
  };

  const status = request.readOnly ? '読み取り専用' : request.isNew ? '新規' : null;

  return (
    <div className="lt-editor" role="dialog" aria-label={`エディタ：${request.displayName}`}>
      <div className="lt-editor-bar">
        <span>nano 風エディタ</span>
        <span className="lt-editor-name">{request.displayName}</span>
        <span className="lt-editor-flags">
          {status && <span className="lt-editor-flag">{status}</span>}
          {modified && <span className="lt-editor-flag">変更あり</span>}
        </span>
      </div>

      <textarea
        ref={areaRef}
        className="lt-editor-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onTextKeyDown}
        aria-label={`ファイルの内容：${request.displayName}`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        wrap="soft"
      />

      <div className={`lt-editor-status ${message?.kind === 'error' ? 'lt-editor-error' : ''}`} role="status">
        {message?.text ?? ' '}
      </div>

      {confirming ? (
        <div className="lt-editor-footer" role="alertdialog" aria-label="終了の確認" onKeyDown={onConfirmKeyDown}>
          <span className="lt-editor-question">変更を保存しますか？</span>
          <button
            type="button"
            ref={confirmRef}
            className="lt-editor-key"
            onClick={() => {
              if (save()) onClose();
              else setConfirming(false);
            }}
          >
            <b>Y</b> 保存して終了
          </button>
          <button type="button" className="lt-editor-key" onClick={onClose}>
            <b>N</b> 保存せず終了
          </button>
          <button type="button" className="lt-editor-key" onClick={() => setConfirming(false)}>
            <b>C</b> 編集に戻る
          </button>
        </div>
      ) : (
        <div className="lt-editor-footer">
          <button type="button" className="lt-editor-key" onClick={() => save()}>
            <b>Ctrl+O</b> 保存
          </button>
          <button type="button" className="lt-editor-key" onClick={requestExit}>
            <b>Ctrl+X</b> 終了
          </button>
          <span className="lt-editor-note">Ctrl+S でも保存できます</span>
        </div>
      )}
    </div>
  );
}
