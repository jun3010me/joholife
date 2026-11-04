import { Shell } from '../engine/shell.ts';
import { createDefaultEnvironment } from '../environments/default.ts';
import type { ExecResult } from '../engine/types.ts';

export const newShell = (): Shell => new Shell(createDefaultEnvironment());

/** 出力を「種別: テキスト」の文字列配列にする */
export function run(shell: Shell, line: string): ExecResult {
  return shell.execute(line);
}
export const texts = (r: ExecResult): string[] => r.lines.map((l) => l.text);
export const stdoutOf = (r: ExecResult): string[] =>
  r.lines.filter((l) => l.kind === 'stdout').map((l) => l.text);
export const errorsOf = (r: ExecResult): string[] =>
  r.lines.filter((l) => l.kind === 'error').map((l) => l.text);
export const hintsOf = (r: ExecResult): string[] =>
  r.lines.filter((l) => l.kind === 'hint').map((l) => l.text);

/** 偽の localStorage */
export class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}
