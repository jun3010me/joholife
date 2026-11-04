import type { CommandOutput, DirNode, OutputLine } from './types.ts';
import { error, hint } from './output.ts';

/** 未対応オプションの表示 */
export function unsupportedOption(cmd: string, opt: string, advice: string): CommandOutput {
  return {
    lines: [error(`${cmd}: option '${opt}' is not supported in this simulator`), hint(advice)],
  };
}

/** 大文字小文字だけが違う名前が隣にあれば、そのヒントを返す */
export function caseMismatchHint(res: { missing?: string; parent?: DirNode }): OutputLine | null {
  if (!res.missing || !res.parent) return null;
  const lower = res.missing.toLowerCase();
  const similar = res.parent.children.find((c) => c.name.toLowerCase() === lower);
  if (!similar) return null;
  return hint(
    `ファイル名・ディレクトリ名は大文字と小文字を区別します。「${similar.name}」のことではありませんか？`,
  );
}

export const NO_SUCH_HINT = hint(
  'ls で今いる場所にあるものを確認しましょう。綴りや大文字・小文字も確認してください。',
);
