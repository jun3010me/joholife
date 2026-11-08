/**
 * 入力を読むコマンド（cat・grep・wc など）の共通処理。
 * ファイル名が省略されたときは stdin（パイプで渡された出力）を読む。
 */
import type { CommandOutput, OutputLine, ShellState } from './types.ts';
import { error, hint, stdout } from './output.ts';
import { PERMISSION_HINT } from './hints.ts';
import { NO_SUCH_HINT, caseMismatchHint } from './common.ts';
import { canAccess, isDir, lookup } from './fs.ts';
import { resolvePath } from './path.ts';

export interface Source {
  /** 入力されたとおりの名前。stdin（ファイル名の省略）のときは null */
  name: string | null;
  text: string;
}

/** テキストを行に分ける（最後の改行は区切りとして扱い、空の行は増やさない） */
export function textToLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** 行を stdout の出力にする */
export const linesToOutput = (lines: string[]): OutputLine[] => lines.map((l) => stdout(l));

/** stdout の行を、パイプやファイルに流すテキストにする */
export function outputToText(lines: OutputLine[]): string {
  return lines
    .filter((l) => l.kind === 'stdout')
    .map((l) => l.text + (l.noNewline ? '' : '\n'))
    .join('');
}

/** ファイル名がなく、stdin もないとき（本物はキーボード入力を待ち続ける） */
export function missingInput(cmd: string, example: string): CommandOutput {
  return {
    lines: [
      error(`${cmd}: missing file operand`),
      hint(
        `本物の ${cmd} は引数がないとキーボード入力を待ち続けます。${cmd} ファイル名 の形で使うか、パイプ（|）で他のコマンドの出力を渡しましょう。例：${example}`,
      ),
    ],
  };
}

export interface ReadOptions {
  /** 読むファイルが、出力先のファイルと同じとき */
  sameFile?: (arg: string) => OutputLine[];
}

/**
 * 操作対象を読み込む。読めなかったファイルは errors に入り、残りは読み続ける。
 * operands が空なら stdin を読む（stdin もなければ undefined を返す）。
 */
export function readSources(
  state: ShellState,
  cmd: string,
  operands: string[],
  stdin: string | undefined,
  options: ReadOptions = {},
): { sources: Source[]; errors: OutputLine[] } | undefined {
  if (operands.length === 0) {
    return stdin === undefined ? undefined : { sources: [{ name: null, text: stdin }], errors: [] };
  }
  const sources: Source[] = [];
  const errors: OutputLine[] = [];
  for (const arg of operands) {
    if (arg === '-' && stdin !== undefined) {
      sources.push({ name: '-', text: stdin });
      continue;
    }
    const abs = resolvePath(state.cwd, arg);
    if (state.stdoutFile !== null && abs === state.stdoutFile && options.sameFile) {
      errors.push(...options.sameFile(arg));
      continue;
    }
    const res = lookup(state.root, state.user, abs);
    if (!res.ok) {
      if (res.code === 'EACCES') errors.push(error(`${cmd}: ${arg}: Permission denied`), PERMISSION_HINT);
      else if (res.code === 'ENOTDIR') errors.push(error(`${cmd}: ${arg}: Not a directory`));
      else {
        errors.push(error(`${cmd}: ${arg}: No such file or directory`));
        errors.push(caseMismatchHint(res) ?? NO_SUCH_HINT);
      }
      continue;
    }
    if (isDir(res.node)) {
      errors.push(
        error(`${cmd}: ${arg}: Is a directory`),
        hint(
          cmd === 'cat'
            ? 'cat はファイルの中身を表示するコマンドです。ディレクトリの中身を見るには ls を使います。'
            : `${cmd} で読めるのはファイルです。ディレクトリの中のファイルを指定しましょう（ls で確認できます）。`,
        ),
      );
      continue;
    }
    if (!canAccess(res.node, state.user, 'r')) {
      errors.push(error(`${cmd}: ${arg}: Permission denied`), PERMISSION_HINT);
      continue;
    }
    sources.push({ name: arg, text: res.node.content });
  }
  return { sources, errors };
}
