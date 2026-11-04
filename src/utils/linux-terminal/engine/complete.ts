import type { CompletionResult, ShellState } from './types.ts';
import { canAccess, compareNames, isDir, lookup } from './fs.ts';
import { resolvePath } from './path.ts';

/** バックスラッシュのエスケープをはずす */
function unescapeWord(w: string): string {
  return w.replace(/\\(.)/g, '$1');
}

/** 補完で挿入する名前をエスケープする（スペースなど） */
function escapeName(name: string): string {
  return name.replace(/([\s"'\\$&;|<>()*?[\]{}!#`])/g, '\\$1');
}

function commonPrefix(names: string[]): string {
  let p = names[0] ?? '';
  for (const n of names) {
    while (!n.startsWith(p)) p = p.slice(0, -1);
  }
  return p;
}

interface Candidate {
  name: string;
  dir: boolean;
}

/**
 * Tab補完。入力行の末尾の単語を補完する。
 * - 1行目の単語はコマンド名、それ以外はパス
 * - 候補が複数あるときは共通部分まで補完し、一覧を candidates で返す
 */
export function completeLine(
  state: ShellState,
  commandNames: string[],
  line: string,
): CompletionResult {
  const none: CompletionResult = { line, candidates: [] };

  // 末尾の単語の開始位置（エスケープされていない空白の直後）
  let wordStart = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (ch === '\\') i++;
    else if (ch === ' ' || ch === '\t') wordStart = i + 1;
  }
  const head = line.slice(0, wordStart);
  const word = line.slice(wordStart);
  if (/['"]/.test(word)) return none; // クォート中の補完は未対応
  const isCommandPosition = head.trim() === '';

  let candidates: Candidate[];
  let prefixText: string; // 入力された単語のうち、補完しない前半（ディレクトリ部分）
  let typedPrefix: string; // 補完対象の接頭辞（エスケープ解除済み）

  if (isCommandPosition && !word.includes('/')) {
    typedPrefix = unescapeWord(word);
    prefixText = '';
    candidates = commandNames
      .filter((n) => n.startsWith(typedPrefix))
      .map((n) => ({ name: n, dir: false }));
  } else {
    const slash = word.lastIndexOf('/');
    prefixText = slash === -1 ? '' : word.slice(0, slash + 1);
    typedPrefix = unescapeWord(word.slice(slash + 1));
    const dirPart = unescapeWord(prefixText);

    if (slash === -1 && word === '~') {
      return { line: `${head}~/`, candidates: [] };
    }
    let absDir: string;
    if (dirPart === '') absDir = state.cwd;
    else if (dirPart === '~/' || dirPart.startsWith('~/')) {
      absDir = resolvePath(state.home, dirPart.slice(2));
    } else if (dirPart.startsWith('~')) {
      return none;
    } else absDir = resolvePath(state.cwd, dirPart);

    const res = lookup(state.root, state.user, absDir);
    if (!res.ok || !isDir(res.node)) return none;
    if (!canAccess(res.node, state.user, 'r')) return none;

    const onlyDirs = /^\s*cd(\s|$)/.test(head);
    const showHidden = typedPrefix.startsWith('.');
    candidates = res.node.children
      .filter((c) => c.name.startsWith(typedPrefix))
      .filter((c) => showHidden || !c.name.startsWith('.'))
      .filter((c) => !onlyDirs || c.type === 'dir')
      .map((c) => ({ name: c.name, dir: c.type === 'dir' }));
    if (typedPrefix === '..' && !candidates.some((c) => c.name === '..')) {
      candidates.push({ name: '..', dir: true });
    }
  }

  if (candidates.length === 0) return none;
  candidates.sort((a, b) => compareNames(a.name, b.name)); // ls と同じ並び順

  if (candidates.length === 1) {
    const c = candidates[0] as Candidate;
    const suffix = c.dir ? '/' : ' ';
    return { line: `${head}${prefixText}${escapeName(c.name)}${suffix}`, candidates: [] };
  }
  const common = commonPrefix(candidates.map((c) => c.name));
  return {
    line: `${head}${prefixText}${escapeName(common)}`,
    candidates: candidates.map((c) => (c.dir ? `${c.name}/` : c.name)),
  };
}
