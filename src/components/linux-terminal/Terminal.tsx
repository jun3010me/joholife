import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import type { OutputLine, Shell } from '../../utils/linux-terminal/engine/index.ts';

type Entry =
  | { id: number; type: 'prompt'; user: string; host: string; path: string; text: string }
  | { id: number; type: 'out'; line: OutputLine };

interface Props {
  shell: Shell;
  /** 起動時に表示するメッセージ（info 表示） */
  intro: string[];
  /** コマンド実行（空入力を除く）や、入力の取り消しのあとに呼ばれる */
  onExecuted: () => void;
}

const MAX_ENTRIES = 2000;

function renderLine(line: OutputLine): ReactNode {
  if (!line.spans) return line.text;
  return line.spans.map((s, i) => (
    <span key={i} className={s.style === 'dir' ? 'lt-dir' : undefined}>
      {s.text}
    </span>
  ));
}

/** 画面上で選択されているテキスト（コピー操作を邪魔しないための判定） */
function hasTextSelection(): boolean {
  try {
    return (window.getSelection()?.toString() ?? '') !== '';
  } catch {
    return false;
  }
}

export default function Terminal({ shell, intro, onExecuted }: Props) {
  const nextId = useRef(0);
  const makeEntries = (): Entry[] =>
    intro.map((text) => ({
      id: nextId.current++,
      type: 'out' as const,
      line: { kind: 'info' as const, text },
    }));

  const [entries, setEntries] = useState<Entry[]>(makeEntries);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  // 履歴の位置（history.length のときは新しい入力）と、移動前に入力していた内容
  const histIdx = useRef(shell.history.length);
  const draft = useRef('');
  // 直前の Tab で補完した結果の行。入力が変わっていなければ、もう一度の Tab で候補を表示する
  const lastTab = useRef<string | null>(null);

  const append = (add: Entry[]) =>
    setEntries((prev) => {
      const all = [...prev, ...add];
      return all.length > MAX_ENTRIES ? all.slice(all.length - MAX_ENTRIES) : all;
    });

  const promptEntry = (text: string): Entry => {
    const p = shell.prompt();
    return { id: nextId.current++, type: 'prompt', user: p.user, host: p.host, path: p.path, text };
  };
  const outEntries = (lines: OutputLine[]): Entry[] =>
    lines.map((line) => ({ id: nextId.current++, type: 'out', line }));

  // 新しい出力があったら一番下までスクロール
  useLayoutEffect(() => {
    const el = screenRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const resetPointer = () => {
    histIdx.current = shell.history.length;
    draft.current = '';
  };

  const submit = () => {
    const line = value;
    const echo = promptEntry(line);
    const result = shell.execute(line);
    if (result.empty) {
      append([echo]); // 空入力: 何も実行せず、新しいプロンプトだけ出す
    } else if (result.clear) {
      setEntries([]);
    } else {
      append([echo, ...outEntries(result.lines)]);
    }
    setValue('');
    lastTab.current = null;
    resetPointer();
    if (!result.empty) onExecuted();
  };

  const cancelLine = () => {
    append([promptEntry(`${value}^C`)]);
    setValue('');
    lastTab.current = null;
    resetPointer();
  };

  const clearScreen = () => {
    setEntries([]);
    lastTab.current = null;
  };

  const complete = () => {
    const r = shell.complete(value);
    if (r.candidates.length > 1) {
      if (lastTab.current === value) {
        // 2回目の Tab: 候補を一覧表示
        const spans = r.candidates.flatMap((c, i) => {
          const s = [{ text: c.replace(/\/$/, ''), ...(c.endsWith('/') ? { style: 'dir' as const } : {}) }];
          if (c.endsWith('/')) s.push({ text: '/' });
          if (i < r.candidates.length - 1) s.push({ text: '  ' });
          return s;
        });
        const text = spans.map((s) => s.text).join('');
        append([
          promptEntry(value),
          { id: nextId.current++, type: 'out', line: { kind: 'stdout', text, spans } },
        ]);
        return;
      }
      lastTab.current = r.line;
    } else {
      lastTab.current = null;
    }
    setValue(r.line);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 日本語入力の変換中（確定の Enter など）はコマンドとして扱わない
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.ctrlKey && !e.altKey && !e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'c') {
        const input = e.currentTarget;
        // 文字を選択しているときは、普通のコピーとして扱う
        if (input.selectionStart !== input.selectionEnd || hasTextSelection()) return;
        e.preventDefault();
        cancelLine();
        return;
      }
      if (k === 'l') {
        e.preventDefault();
        clearScreen();
        return;
      }
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        submit();
        break;
      case 'ArrowUp': {
        e.preventDefault();
        const h = shell.history;
        if (h.length === 0 || histIdx.current === 0) break;
        if (histIdx.current === h.length) draft.current = value;
        histIdx.current -= 1;
        lastTab.current = null;
        setValue(h[histIdx.current] ?? '');
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        const h = shell.history;
        if (histIdx.current >= h.length) break;
        histIdx.current += 1;
        lastTab.current = null;
        setValue(histIdx.current === h.length ? draft.current : (h[histIdx.current] ?? ''));
        break;
      }
      case 'Tab':
        e.preventDefault();
        complete();
        break;
    }
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    lastTab.current = null;
    setValue(e.target.value);
  };

  const p = shell.prompt();

  return (
    <div
      className="lt-terminal"
      onClick={() => {
        // 文字を選択している最中（コピー操作）は、フォーカスを奪わない
        if (!hasTextSelection()) inputRef.current?.focus({ preventScroll: true });
      }}
    >
      <div
        className="lt-screen"
        ref={screenRef}
        role="log"
        aria-label="ターミナルの出力"
        aria-live="polite"
      >
        {entries.map((en) =>
          en.type === 'prompt' ? (
            <div className="lt-line lt-echo" key={en.id}>
              <span className="lt-prompt">
                <span className="lt-prompt-user">
                  {en.user}@{en.host}
                </span>
                :<span className="lt-prompt-path">{en.path}</span>$
              </span>{' '}
              {en.text}
            </div>
          ) : (
            <div className={`lt-line lt-${en.line.kind}`} key={en.id}>
              {renderLine(en.line)}
            </div>
          ),
        )}
        <div className="lt-input-row">
          <span className="lt-prompt" aria-hidden="true">
            <span className="lt-prompt-user">
              {p.user}@{p.host}
            </span>
            :<span className="lt-prompt-path">{p.path}</span>$
          </span>
          <input
            ref={inputRef}
            className="lt-input"
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            aria-label={`コマンド入力（${p.text}）`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
          />
        </div>
      </div>
    </div>
  );
}
