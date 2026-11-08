/**
 * 入力行を単語に分ける。シングル／ダブルクォートとバックスラッシュに対応。
 * パイプ（|）で区切られたコマンドごとに、単語と出力のリダイレクト（> と >>）を取り出す。
 * クォートされていない * ? [...] は、ワイルドカード（パス名展開の対象）として印を付ける。
 * 入力のリダイレクト・変数・&& や ; などは未対応として検出する。
 */

export interface Word {
  text: string;
  /** クォートされていない ~ で始まる単語（ホーム展開の対象） */
  tilde: boolean;
  /**
   * ワイルドカード用のパターン。クォートやバックスラッシュで守られた * ? [ ] \ は
   * 「\」を前に付けて、文字そのものとして扱う。
   */
  pattern: string;
  /** クォートされていない * ? [...] を含む（パス名展開の対象） */
  glob: boolean;
}

/** 出力のリダイレクト（> は上書き、>> は追記） */
export interface Redirect {
  op: '>' | '>>';
  target: string;
  /** クォートされていない ~ で始まる書き込み先（ホーム展開の対象） */
  tilde: boolean;
}

/** パイプで区切られた、1つぶんのコマンド */
export interface SimpleCommand {
  words: Word[];
  redirects: Redirect[];
}

export type Problem =
  | { kind: 'operator'; token: string }
  /** 書き方の誤り（> の後ろにファイル名がない、| の前後が空、など） */
  | { kind: 'syntax'; token: string; ctx: 'redirect' | 'pipe' }
  | { kind: 'variable'; token: string }
  | { kind: 'quote'; token: string };

export type TokenizeResult =
  | { ok: true; commands: SimpleCommand[] }
  | { ok: false; problem: Problem };

const isSpace = (c: string) => c === ' ' || c === '\t';
const isVarStart = (c: string | undefined) => c !== undefined && /[A-Za-z_{(0-9?!@#*$]/.test(c);

/** パターンに、守られていない * ? [...] があるか */
export function isGlobPattern(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i] as string;
    if (ch === '\\') {
      i++;
    } else if (ch === '*' || ch === '?') {
      return true;
    } else if (ch === '[') {
      // 閉じる ] があるときだけワイルドカード（[!a] や []a] の最初の ] は文字）
      let j = i + 1;
      if (pattern[j] === '!' || pattern[j] === '^') j++;
      if (pattern[j] === ']') j++;
      for (; j < pattern.length; j++) {
        if (pattern[j] === '\\') j++;
        else if (pattern[j] === ']') return true;
      }
    }
  }
  return false;
}

export function tokenize(line: string): TokenizeResult {
  const commands: SimpleCommand[] = [];
  let words: Word[] = [];
  let redirects: Redirect[] = [];
  /** > の直後で、書き込み先の単語を待っているとき */
  let pending: Redirect['op'] | null = null;
  let cur = '';
  let pat = '';
  let inWord = false;
  let tilde = false;
  let mode: 'none' | 'single' | 'double' = 'none';

  const push = () => {
    if (inWord) {
      if (pending) {
        redirects.push({ op: pending, target: cur, tilde });
        pending = null;
      } else {
        words.push({ text: cur, tilde, pattern: pat, glob: isGlobPattern(pat) });
      }
    }
    cur = '';
    pat = '';
    inWord = false;
    tilde = false;
  };
  /** クォートやバックスラッシュで守られた文字を加える */
  const addQuoted = (c: string) => {
    cur += c;
    pat += '*?[]\\'.includes(c) ? `\\${c}` : c;
  };
  const addPlain = (c: string) => {
    cur += c;
    pat += c;
  };

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    const next = line[i + 1];

    if (mode === 'single') {
      if (ch === "'") mode = 'none';
      else addQuoted(ch);
      continue;
    }
    if (mode === 'double') {
      if (ch === '"') mode = 'none';
      else if (ch === '\\' && next !== undefined && '"\\$`'.includes(next)) {
        addQuoted(next);
        i++;
      } else if (ch === '$' && isVarStart(next)) {
        return { ok: false, problem: { kind: 'variable', token: '$' } };
      } else if (ch === '`') {
        return { ok: false, problem: { kind: 'variable', token: '`' } };
      } else addQuoted(ch);
      continue;
    }

    if (isSpace(ch)) {
      push();
      continue;
    }
    if (ch === '>') {
      // 2> のような番号つきのリダイレクトは未対応
      if (inWord && /^[0-9]+$/.test(cur) && /[0-9]/.test(line[i - 1] ?? '')) {
        return { ok: false, problem: { kind: 'operator', token: `${cur}>` } };
      }
      push();
      if (pending) return { ok: false, problem: { kind: 'syntax', token: '>', ctx: 'redirect' } };
      let op: Redirect['op'] = '>';
      if (next === '>') {
        op = '>>';
        i++;
      }
      const after = line[i + 1];
      if (after === '>') return { ok: false, problem: { kind: 'syntax', token: '>', ctx: 'redirect' } };
      if (after === '&' || after === '|') {
        return { ok: false, problem: { kind: 'operator', token: `${op}${after}` } };
      }
      pending = op;
      continue;
    }
    if (ch === '|' && next !== '|' && next !== '&') {
      // パイプ。前後にコマンドが必要
      push();
      if (pending) return { ok: false, problem: { kind: 'syntax', token: '|', ctx: 'redirect' } };
      if (words.length === 0 && redirects.length === 0) {
        return { ok: false, problem: { kind: 'syntax', token: '|', ctx: 'pipe' } };
      }
      commands.push({ words, redirects });
      words = [];
      redirects = [];
      continue;
    }
    if ('|&;<()'.includes(ch)) {
      if (pending) return { ok: false, problem: { kind: 'syntax', token: ch, ctx: 'redirect' } };
      const two = ch + (next ?? '');
      const token = ['||', '&&', ';;', '<<', '&>', '|&'].includes(two) ? two : ch;
      return { ok: false, problem: { kind: 'operator', token } };
    }
    if ('*?'.includes(ch)) {
      addPlain(ch);
      inWord = true;
      continue;
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
        addQuoted('\\');
      } else {
        addQuoted(next);
        i++;
      }
      inWord = true;
      continue;
    }
    if (!inWord && ch === '~') tilde = true;
    addPlain(ch);
    inWord = true;
  }
  if (mode !== 'none') {
    return { ok: false, problem: { kind: 'quote', token: mode === 'single' ? "'" : '"' } };
  }
  push();
  if (pending) return { ok: false, problem: { kind: 'syntax', token: 'newline', ctx: 'redirect' } };
  if (commands.length > 0 && words.length === 0 && redirects.length === 0) {
    // ls | のように、| の後ろにコマンドがない
    return { ok: false, problem: { kind: 'syntax', token: 'newline', ctx: 'pipe' } };
  }
  commands.push({ words, redirects });
  return { ok: true, commands };
}
