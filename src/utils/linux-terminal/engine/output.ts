import type { OutputLine } from './types.ts';

export const stdout = (text: string, spans?: OutputLine['spans']): OutputLine =>
  spans ? { kind: 'stdout', text, spans } : { kind: 'stdout', text };
export const error = (text: string): OutputLine => ({ kind: 'error', text });
export const hint = (text: string): OutputLine => ({ kind: 'hint', text: `ヒント：${text}` });
export const info = (text: string): OutputLine => ({ kind: 'info', text });
