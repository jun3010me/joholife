/**
 * 入力行を単語に分ける。シングル／ダブルクォートとバックスラッシュに対応。
 * パイプ・リダイレクト・変数・ワイルドカードなどは未対応として検出する。
 */

export interface Word {
  text: string;
  /** クォートされていない ~ で始まる単語（ホーム展開の対象） */
  tilde: boolean;
}

export type Problem =
  | { kind: 'operator'; token: string }
  | { kind: 'glob'; token: string }
  | { kind: 'variable'; token: string }
  | { kind: 'quote'; token: string };

export type TokenizeResult = { ok: true; words: Word[] } | { ok: false; problem: Problem };

const isSpace = (c: string) => c === ' ' || c === '\t';
const isVarStart = (c: string | undefined) => c !== undefined && /[A-Za-z_{(0-9?!@#*$]/.test(c);

export function tokenize(line: string): TokenizeResult {
  const words: Word[] = [];
  let cur = '';
  let inWord = false;
  let tilde = false;
  let mode: 'none' | 'single' | 'double' = 'none';

  const push = () => {
    if (inWord) words.push({ text: cur, tilde });
    cur = '';
    inWord = false;
    tilde = false;
  };

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    const next = line[i + 1];

    if (mode === 'single') {
      if (ch === "'") mode = 'none';
      else cur += ch;
      continue;
    }
    if (mode === 'double') {
      if (ch === '"') mode = 'none';
      else if (ch === '\\' && next !== undefined && '"\\$`'.includes(next)) {
        cur += next;
        i++;
      } else if (ch === '$' && isVarStart(next)) {
        return { ok: false, problem: { kind: 'variable', token: '$' } };
      } else if (ch === '`') {
        return { ok: false, problem: { kind: 'variable', token: '`' } };
      } else cur += ch;
      continue;
    }

    if (isSpace(ch)) {
      push();
      continue;
    }
    if ('|&;<>()'.includes(ch)) {
      const two = ch + (next ?? '');
      const token = ['||', '&&', '>>', ';;'].includes(two) ? two : ch;
      return { ok: false, problem: { kind: 'operator', token } };
    }
    if (ch === '*' || ch === '?') {
      return { ok: false, problem: { kind: 'glob', token: ch } };
    }
    if (ch === '$' && isVarStart(next)) {
      return { ok: false, problem: { kind: 'variable', token: '$' } };
    }
    if (ch === '`') {
      return { ok: false, problem: { kind: 'variable', token: '`' } };
    }
    if (ch === "'") {
      mode = 'single';
      inWord = true;
      continue;
    }
    if (ch === '"') {
      mode = 'double';
      inWord = true;
      continue;
    }
    if (ch === '\\') {
      if (next === undefined) {
        cur += '\\';
      } else {
        cur += next;
        i++;
      }
      inWord = true;
      continue;
    }
    if (!inWord && ch === '~') tilde = true;
    cur += ch;
    inWord = true;
  }
  if (mode !== 'none') {
    return { ok: false, problem: { kind: 'quote', token: mode === 'single' ? "'" : '"' } };
  }
  push();
  return { ok: true, words };
}
