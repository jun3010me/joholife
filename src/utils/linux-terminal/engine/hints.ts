import type { OutputLine } from './types.ts';
import { error, hint } from './output.ts';

/** 全角文字・全角スペース・ハイフンに見間違えやすい文字を含むか */
const FULLWIDTH = /[　！-～‐-―−ー]/;
export const hasFullwidth = (s: string): boolean => FULLWIDTH.test(s);

export const FULLWIDTH_HINT = hint(
  '全角の文字や全角スペースが混ざっているようです。コマンドは半角（英数字・半角スペース）で入力しましょう。',
);

/** Windows のコマンドと、対応する Linux のコマンド */
const WINDOWS_TO_LINUX: Record<string, { linux: string; implemented: boolean }> = {
  dir: { linux: 'ls', implemented: true },
  cls: { linux: 'clear', implemented: true },
  type: { linux: 'cat', implemented: true },
  md: { linux: 'mkdir', implemented: true },
  copy: { linux: 'cp', implemented: true },
  del: { linux: 'rm', implemented: true },
  erase: { linux: 'rm', implemented: true },
  move: { linux: 'mv', implemented: true },
  ren: { linux: 'mv', implemented: true },
  rename: { linux: 'mv', implemented: true },
  rd: { linux: 'rmdir', implemented: true },
  notepad: { linux: 'nano', implemented: true },
  edit: { linux: 'nano', implemented: true },
};

/** 本物の Linux にはあるが、このシミュレーターにはまだないコマンド */
const NOT_IMPLEMENTED = new Set([
  'find', 'sed', 'awk', 'tr', 'xargs', 'tee',
  'man', 'vi', 'vim', 'emacs', 'chmod', 'chown', 'sudo', 'whoami', 'date', 'exit',
  'less', 'more', 'tree', 'ln', 'ps', 'top', 'kill', 'uname', 'id', 'which', 'file', 'diff',
]);

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] ?? 0;
      prev[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length] ?? 0;
}

/** 打ち間違いに近い、実在するコマンド名を探す */
function suggest(name: string, commandNames: string[]): string | null {
  const lower = name.toLowerCase();
  if (lower !== name && commandNames.includes(lower)) return lower;
  if (name.length < 2) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of commandNames) {
    const d = levenshtein(lower, c);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  const limit = name.length >= 5 ? 2 : 1;
  return best !== null && bestDist <= limit ? best : null;
}

/** 実装されていないコマンド名が入力されたときの出力 */
export function unknownCommandOutput(name: string, commandNames: string[]): OutputLine[] {
  const win = WINDOWS_TO_LINUX[name.toLowerCase()];
  if (win) {
    if (win.implemented) {
      return [
        error(`bash: ${name}: command not found`),
        hint(`Windows の ${name} にあたる Linux のコマンドは ${win.linux} です。`),
      ];
    }
    return [
      error(`bash: ${name}: command not available in this simulator`),
      hint(
        `Windows の ${name} にあたる Linux のコマンドは ${win.linux} ですが、このシミュレーターではまだ使えません。`,
      ),
    ];
  }
  if (name === 'vi' || name === 'vim' || name === 'emacs') {
    return [
      error(`bash: ${name}: command not available in this simulator`),
      hint(`${name} は本物の Linux にありますが、このシミュレーターのエディタは nano です。nano ファイル名 で編集できます。`),
    ];
  }
  if (NOT_IMPLEMENTED.has(name)) {
    return [
      error(`bash: ${name}: command not available in this simulator`),
      hint(
        `${name} は本物の Linux にありますが、このシミュレーターではまだ使えません。help で使えるコマンドを確認できます。`,
      ),
    ];
  }
  const lines: OutputLine[] = [error(`bash: ${name}: command not found`)];
  const m = /^(cd|ls|cat|mkdir)(\.\.|\\.*|\/.*)$/.exec(name);
  if (m) {
    lines.push(hint(`コマンドと引数の間には半角スペースが必要です。例：${m[1]} ${m[2]}`));
    return lines;
  }
  if (hasFullwidth(name)) {
    lines.push(FULLWIDTH_HINT);
    return lines;
  }
  const s = suggest(name, commandNames);
  if (s) {
    lines.push(hint(`もしかして ${s} ですか？（コマンドは小文字で、綴りも正確に入力します）`));
  } else {
    lines.push(hint('コマンド名を確認しましょう。help で使えるコマンドを確認できます。'));
  }
  return lines;
}

export const PERMISSION_HINT = hint(
  '権限がないため操作できません。他のユーザーのホームや、システムの大事なファイルは student では触れません。',
);
