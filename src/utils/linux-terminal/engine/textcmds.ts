/** テキスト処理のコマンド: grep / wc / sort / uniq / head / tail / cut（ファイル名を省略すると stdin を読む） */
import type { CommandDef, CommandOutput, OutputLine, ShellState } from './types.ts';
import { error, hint, stdout } from './output.ts';
import { unsupportedOption } from './common.ts';
import { linesToOutput, missingInput, readSources, textToLines } from './input.ts';
import type { Source } from './input.ts';

// ---------------------------------------------------------------- オプションの解析

interface OptSpec {
  cmd: string;
  /** 値をとらない短いオプション: 文字 → 名前 */
  flags?: Record<string, string>;
  /** 値をとる短いオプション（-n 5 / -n5） */
  values?: Record<string, string>;
  longFlags?: Record<string, string>;
  longValues?: Record<string, string>;
  /** -5 のような数字だけのオプションの名前 */
  digits?: string;
  advice: string;
}

interface Parsed {
  flags: Set<string>;
  values: Map<string, string>;
  operands: string[];
}

const isOutput = (v: unknown): v is CommandOutput => typeof v === 'object' && v !== null && 'lines' in v;

function parseOptions(spec: OptSpec, args: string[]): Parsed | CommandOutput {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const operands: string[] = [];
  const missing = (opt: string): CommandOutput => ({
    lines: [
      error(`${spec.cmd}: option requires an argument -- '${opt.replace(/^-+/, '')}'`),
      error(`Try '${spec.cmd} --help' for more information.`),
      hint(spec.advice),
    ],
  });
  let end = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (end || !a.startsWith('-') || a === '-') {
      operands.push(a);
    } else if (a === '--') {
      end = true;
    } else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = eq === -1 ? a : a.slice(0, eq);
      const flag = spec.longFlags?.[name];
      const valueKey = spec.longValues?.[name];
      if (flag && eq === -1) {
        flags.add(flag);
      } else if (valueKey) {
        const v = eq === -1 ? args[++i] : a.slice(eq + 1);
        if (v === undefined) return missing(name);
        values.set(valueKey, v);
      } else {
        return unsupportedOption(spec.cmd, a, spec.advice);
      }
    } else if (spec.digits && /^-\d+$/.test(a)) {
      values.set(spec.digits, a.slice(1));
    } else {
      for (let k = 1; k < a.length; k++) {
        const letter = a[k] as string;
        const flag = spec.flags?.[letter];
        const valueKey = spec.values?.[letter];
        if (flag) {
          flags.add(flag);
        } else if (valueKey) {
          const rest = a.slice(k + 1);
          const v = rest !== '' ? rest : args[++i];
          if (v === undefined) return missing(letter);
          values.set(valueKey, v);
          break;
        } else {
          return unsupportedOption(spec.cmd, `-${letter}`, spec.advice);
        }
      }
    }
  }
  return { flags, values, operands };
}

/** 読み込み。入力がなければ missingInput、読めなかったファイルのエラーは errors に入る */
function load(
  state: ShellState,
  cmd: string,
  operands: string[],
  stdin: string | undefined,
  example: string,
  sameFile?: (arg: string) => OutputLine[],
): { sources: Source[]; errors: OutputLine[] } | CommandOutput {
  const r = readSources(state, cmd, operands, stdin, sameFile ? { sameFile } : {});
  return r ?? missingInput(cmd, example);
}

// ---------------------------------------------------------------- grep

const POSIX_CLASSES: Record<string, string> = {
  alpha: 'A-Za-z',
  digit: '0-9',
  alnum: 'A-Za-z0-9',
  upper: 'A-Z',
  lower: 'a-z',
  space: '\\s',
  blank: ' \\t',
  punct: '!-\\/:-@\\[-`{-~',
  xdigit: '0-9A-Fa-f',
};

class RegexError extends Error {}

const escapeLiteral = (c: string): string => c.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');

/** [...] を JS の正規表現の文字クラスにする。戻り値は [クラス, 次の位置] */
function parseBracket(p: string, start: number): [string, number] {
  let i = start + 1;
  let negate = false;
  if (p[i] === '^') {
    negate = true;
    i++;
  }
  let body = '';
  let first = true;
  const unmatched = () => new RegexError('Unmatched [, [^, [:, [., or [=');
  for (; ; i++) {
    const c = p[i];
    if (c === undefined) throw unmatched();
    if (c === ']' && !first) break;
    first = false;
    if (c === '[' && p[i + 1] === ':') {
      const close = p.indexOf(':]', i + 2);
      if (close === -1) throw unmatched();
      const cls = POSIX_CLASSES[p.slice(i + 2, close)];
      if (!cls) throw new RegexError('Invalid character class name');
      body += cls;
      i = close + 1;
    } else if (c === '-') {
      const isEdge = body === '' || p[i + 1] === ']';
      body += isEdge ? '\\-' : '-';
    } else if (c === '\\' || c === ']' || c === '[' || c === '^') {
      body += `\\${c}`;
    } else {
      body += c;
    }
  }
  return [`[${negate ? '^' : ''}${body}]`, i];
}

/** grep のパターンを JS の正規表現の文字列にする（基本正規表現 / 拡張正規表現） */
function toRegexSource(p: string, extended: boolean): string {
  let out = '';
  // 直前が「繰り返しの記号を文字として扱う位置」（先頭や ( の直後）か
  let atStart = true;
  for (let i = 0; i < p.length; i++) {
    const c = p[i] as string;
    let startNext = false;
    if (c === '\\') {
      const n = p[i + 1];
      if (n === undefined) throw new RegexError('Trailing backslash');
      i++;
      if (!extended && n === '(') {
        out += '(';
        startNext = true;
      } else if (!extended && (n === ')' || n === '|')) {
        out += n;
        startNext = n === '|';
      } else if (!extended && (n === '+' || n === '?')) {
        out += atStart ? `\\${n}` : n;
      } else if (!extended && n === '{') {
        const close = p.indexOf('\\}', i + 1);
        if (close === -1) throw new RegexError('Unmatched \\{');
        out += `{${p.slice(i + 1, close)}}`;
        i = close + 1;
      } else if (/[1-9]/.test(n)) {
        out += `\\${n}`;
      } else if ('wWsSbB'.includes(n)) {
        out += `\\${n}`;
      } else if (n === '<' || n === '>') {
        out += '\\b';
      } else {
        out += escapeLiteral(n);
      }
    } else if (c === '[') {
      const [cls, end] = parseBracket(p, i);
      out += cls;
      i = end;
    } else if (c === '.') {
      out += '.';
    } else if (c === '*') {
      out += atStart ? '\\*' : '*';
      if (atStart) {
        atStart = false;
        continue;
      }
    } else if (c === '^') {
      if (extended || atStart) {
        out += '^';
        startNext = true;
      } else out += '\\^';
    } else if (c === '$') {
      const rest = p.slice(i + 1);
      if (extended || rest === '' || rest.startsWith('\\)') || rest.startsWith('\\|')) out += '$';
      else out += '\\$';
    } else if (extended && (c === '(' || c === '|')) {
      out += c;
      startNext = true;
    } else if (extended && (c === ')' || c === '+' || c === '?')) {
      out += atStart && c !== ')' ? `\\${c}` : c;
    } else if (extended && c === '{') {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(p.slice(i));
      if (m && !atStart) {
        out += m[0];
        i += m[0].length - 1;
      } else out += '\\{';
    } else {
      out += escapeLiteral(c);
    }
    atStart = startNext;
  }
  return out;
}

function grep(state: ShellState, args: string[], stdin?: string): CommandOutput {
  const advice =
    'この grep で使えるオプションは -i（大文字小文字を区別しない）、-v（一致しない行）、-c（行数を数える）、-n（行番号）、-F（固定文字列）、-E（拡張正規表現）です。';
  const parsed = parseOptions(
    {
      cmd: 'grep',
      flags: { i: 'i', v: 'v', c: 'c', n: 'n', F: 'F', E: 'E' },
      longFlags: {
        '--ignore-case': 'i',
        '--invert-match': 'v',
        '--count': 'c',
        '--line-number': 'n',
        '--fixed-strings': 'F',
        '--extended-regexp': 'E',
      },
      advice,
    },
    args,
  );
  if (isOutput(parsed)) return parsed;
  const pattern = parsed.operands[0];
  if (pattern === undefined) {
    return {
      lines: [
        error('Usage: grep [OPTION]... PATTERNS [FILE]...'),
        error("Try 'grep --help' for more information."),
        hint('grep の後ろに、探す文字（パターン）とファイル名を書きます。例：grep error access.log'),
      ],
    };
  }
  const files = parsed.operands.slice(1);

  let source: string;
  try {
    source = parsed.flags.has('F') ? escapeLiteral(pattern) : toRegexSource(pattern, parsed.flags.has('E'));
  } catch (e) {
    return regexError(e);
  }
  let re: RegExp;
  try {
    re = new RegExp(source, parsed.flags.has('i') ? 'i' : '');
  } catch {
    return regexError(new RegexError('Invalid regular expression'));
  }

  const loaded = load(state, 'grep', files, stdin, 'ls | grep txt', (arg) => [
    error(`grep: ${arg}: input file is also the output`),
    hint('読み込むファイルと、書き込み先のファイルが同じです。書き込み先は別の名前にしましょう。'),
  ]);
  if (isOutput(loaded)) return loaded;

  const invert = parsed.flags.has('v');
  const countOnly = parsed.flags.has('c');
  const numbered = parsed.flags.has('n');
  const multiple = files.length > 1;
  const lines: OutputLine[] = [...loaded.errors];
  for (const src of loaded.sources) {
    const prefix = multiple ? `${src.name === null || src.name === '-' ? '(standard input)' : src.name}:` : '';
    let count = 0;
    textToLines(src.text).forEach((line, i) => {
      if (re.test(line) === invert) return;
      count++;
      if (!countOnly) lines.push(stdout(`${prefix}${numbered ? `${i + 1}:` : ''}${line}`));
    });
    if (countOnly) lines.push(stdout(`${prefix}${count}`));
  }
  return { lines };
}

function regexError(e: unknown): CommandOutput {
  const msg = e instanceof RegexError ? e.message : 'Invalid regular expression';
  return {
    lines: [
      error(`grep: ${msg}`),
      hint('パターンの [ や ( などの記号が閉じているか確認しましょう。記号を文字として探したいときは grep -F を使います。'),
    ],
  };
}

// ---------------------------------------------------------------- wc

/** UTF-8 でのバイト数 */
function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

function wc(state: ShellState, args: string[], stdin?: string): CommandOutput {
  const parsed = parseOptions(
    {
      cmd: 'wc',
      flags: { l: 'l', w: 'w', c: 'c' },
      longFlags: { '--lines': 'l', '--words': 'w', '--bytes': 'c' },
      advice: 'この wc で使えるオプションは -l（行数）、-w（単語数）、-c（バイト数）です。',
    },
    args,
  );
  if (isOutput(parsed)) return parsed;
  const loaded = load(state, 'wc', parsed.operands, stdin, 'ls | wc -l');
  if (isOutput(loaded)) return loaded;

  const none = !parsed.flags.has('l') && !parsed.flags.has('w') && !parsed.flags.has('c');
  const cols = {
    l: none || parsed.flags.has('l'),
    w: none || parsed.flags.has('w'),
    c: none || parsed.flags.has('c'),
  };
  const columnCount = Number(cols.l) + Number(cols.w) + Number(cols.c);
  const rows = loaded.sources.map((s) => ({
    name: s.name,
    l: (s.text.match(/\n/g) ?? []).length,
    w: (s.text.match(/\S+/g) ?? []).length,
    c: utf8Length(s.text),
  }));

  // 桁数は本物の wc と同じ。ファイルだけなら全ファイルのバイト数の桁数、stdin があれば（数字が1つなら詰めて）7桁
  const fromStdin = loaded.sources.some((s) => s.name === null || s.name === '-');
  let width: number;
  if (fromStdin) {
    width = columnCount === 1 ? 1 : 7;
  } else {
    width = String(rows.reduce((a, r) => a + r.c, 0)).length;
  }
  const format = (r: { l: number; w: number; c: number }, name: string | null): string => {
    const nums = [cols.l ? r.l : null, cols.w ? r.w : null, cols.c ? r.c : null]
      .filter((v): v is number => v !== null)
      .map((v) => String(v).padStart(width, ' '));
    return nums.join(' ') + (name === null ? '' : ` ${name}`);
  };
  const lines: OutputLine[] = [...loaded.errors];
  for (const r of rows) lines.push(stdout(format(r, r.name)));
  if (rows.length > 1) {
    const total = rows.reduce((a, r) => ({ l: a.l + r.l, w: a.w + r.w, c: a.c + r.c }), { l: 0, w: 0, c: 0 });
    lines.push(stdout(format(total, 'total')));
  }
  return { lines };
}

// ---------------------------------------------------------------- sort

/** UTF-8 のバイト順（LC_ALL=C と同じ）で文字列を比べる */
function compareBytes(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a.codePointAt(i) as number;
    const cb = b.codePointAt(j) as number;
    if (ca !== cb) return ca < cb ? -1 : 1;
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
  }
  if (i < a.length) return 1;
  if (j < b.length) return -1;
  return 0;
}

/** -n: 行頭の数字を数値として読む（数字でなければ 0） */
function leadingNumber(line: string): number {
  const m = /^[ \t]*([+-]?\d*\.?\d*)/.exec(line);
  const v = m ? Number.parseFloat(m[1] as string) : 0;
  return Number.isNaN(v) ? 0 : v;
}

function sort(state: ShellState, args: string[], stdin?: string): CommandOutput {
  const parsed = parseOptions(
    {
      cmd: 'sort',
      flags: { r: 'r', n: 'n', u: 'u' },
      longFlags: { '--reverse': 'r', '--numeric-sort': 'n', '--unique': 'u' },
      advice: 'この sort で使えるオプションは -r（逆順）、-n（数字として比べる）、-u（同じ行をまとめる）です。',
    },
    args,
  );
  if (isOutput(parsed)) return parsed;
  const loaded = load(state, 'sort', parsed.operands, stdin, 'ls | sort');
  if (isOutput(loaded)) return loaded;

  const reverse = parsed.flags.has('r');
  const numeric = parsed.flags.has('n');
  const unique = parsed.flags.has('u');
  const rows = loaded.sources.flatMap((s) => textToLines(s.text)).map((line) => ({
    line,
    num: numeric ? leadingNumber(line) : 0,
  }));
  const key = (a: { line: string; num: number }, b: { line: string; num: number }): number =>
    numeric ? (a.num < b.num ? -1 : a.num > b.num ? 1 : 0) : compareBytes(a.line, b.line);
  // 本物と同じく、-u でないときは最後に行全体でも比べる（-r は全体にかかる）
  const full = (a: { line: string; num: number }, b: { line: string; num: number }): number => {
    const k = key(a, b);
    const r = k !== 0 || unique ? k : compareBytes(a.line, b.line);
    return reverse ? -r : r;
  };
  rows.sort(full); // Array.prototype.sort は安定なので、-u では最初に現れた行が残る
  const kept = unique ? rows.filter((r, i) => i === 0 || key(rows[i - 1] as typeof r, r) !== 0) : rows;
  return { lines: [...loaded.errors, ...linesToOutput(kept.map((r) => r.line))] };
}

// ---------------------------------------------------------------- uniq

function uniq(state: ShellState, args: string[], stdin?: string): CommandOutput {
  const parsed = parseOptions(
    {
      cmd: 'uniq',
      flags: { c: 'c' },
      longFlags: { '--count': 'c' },
      advice: 'この uniq で使えるオプションは -c（同じ行が何回続いたかを数える）だけです。',
    },
    args,
  );
  if (isOutput(parsed)) return parsed;
  if (parsed.operands.length > 1) {
    return {
      lines: [
        error(`uniq: extra operand '${parsed.operands[1]}'`),
        error("Try 'uniq --help' for more information."),
        hint(
          '本物の uniq は、2つ目のファイル名を「出力先」として扱い、中身を上書きしてしまいます。このシミュレーターでは、入力のファイルは1つだけ指定します。',
        ),
      ],
    };
  }
  const loaded = load(state, 'uniq', parsed.operands, stdin, 'sort kekka.txt | uniq -c');
  if (isOutput(loaded)) return loaded;

  const count = parsed.flags.has('c');
  const groups: Array<{ line: string; n: number }> = [];
  for (const line of loaded.sources.flatMap((s) => textToLines(s.text))) {
    const last = groups[groups.length - 1];
    if (last && last.line === line) last.n++;
    else groups.push({ line, n: 1 });
  }
  return {
    lines: [
      ...loaded.errors,
      ...groups.map((g) => stdout(count ? `${String(g.n).padStart(7, ' ')} ${g.line}` : g.line)),
    ],
  };
}

// ---------------------------------------------------------------- head / tail

function headTail(cmd: 'head' | 'tail', state: ShellState, args: string[], stdin?: string): CommandOutput {
  const parsed = parseOptions(
    {
      cmd,
      values: { n: 'n' },
      longValues: { '--lines': 'n' },
      digits: 'n',
      advice: `この ${cmd} で使えるオプションは -n 行数（例：-n 5）と -5 のような書き方だけです。`,
    },
    args,
  );
  if (isOutput(parsed)) return parsed;

  const raw = parsed.values.get('n');
  let n = 10;
  let fromLine = false; // tail -n +3（3行目から最後まで）
  if (raw !== undefined) {
    const m = /^(\+?)(\d+)$/.exec(raw);
    if (!m || (m[1] === '+' && cmd === 'head')) {
      return {
        lines: [
          error(`${cmd}: invalid number of lines: '${raw}'`),
          hint('行数は半角の数字で指定します。例：-n 5'),
        ],
      };
    }
    n = Number(m[2]);
    fromLine = m[1] === '+';
  }

  const loaded = load(state, cmd, parsed.operands, stdin, `ls | ${cmd} -n 3`);
  if (isOutput(loaded)) return loaded;

  const lines: OutputLine[] = [...loaded.errors];
  const showHeaders = parsed.operands.length > 1;
  loaded.sources.forEach((src, i) => {
    const all = textToLines(src.text);
    let picked: string[];
    if (cmd === 'head') picked = all.slice(0, n);
    else if (fromLine) picked = all.slice(Math.max(n - 1, 0));
    else picked = n === 0 ? [] : all.slice(-n);
    if (showHeaders) {
      if (i > 0) lines.push(stdout(''));
      lines.push(stdout(`==> ${src.name === null || src.name === '-' ? 'standard input' : src.name} <==`));
    }
    lines.push(...linesToOutput(picked));
  });
  return { lines };
}

// ---------------------------------------------------------------- cut

type Range = [number, number];

/** "1,3" "2-4" "-3" "3-" を範囲の配列にする。正しくなければメッセージ */
function parseFieldList(list: string): Range[] | string {
  const ranges: Range[] = [];
  for (const part of list.split(',')) {
    const m = /^(\d*)(-?)(\d*)$/.exec(part);
    if (part === '' || !m || (m[1] === '' && m[3] === '') || (m[2] === '' && m[3] !== '')) {
      return part === '-' || part === '' ? 'invalid field range' : `invalid field value '${part}'`;
    }
    const lo = m[1] === '' ? 1 : Number(m[1]);
    const hi = m[2] === '' ? lo : m[3] === '' ? Infinity : Number(m[3]);
    if (lo === 0 || (m[3] !== '' && hi === 0)) return 'fields are numbered from 1';
    if (lo > hi) return 'invalid decreasing range';
    ranges.push([lo, hi]);
  }
  return ranges;
}

function cut(state: ShellState, args: string[], stdin?: string): CommandOutput {
  const parsed = parseOptions(
    {
      cmd: 'cut',
      values: { d: 'd', f: 'f' },
      longValues: { '--delimiter': 'd', '--fields': 'f' },
      advice: 'この cut で使えるオプションは -d 区切り文字 と -f 番号（例：-d " " -f 1、-f 1,3、-f 2-4）です。',
    },
    args,
  );
  if (isOutput(parsed)) return parsed;
  const fieldList = parsed.values.get('f');
  if (fieldList === undefined) {
    return {
      lines: [
        error('cut: you must specify a list of bytes, characters, or fields'),
        error("Try 'cut --help' for more information."),
        hint('取り出す列の番号を -f で指定します。例：cut -d " " -f 1 access.log（空白で区切った1番目）'),
      ],
    };
  }
  const delim = parsed.values.get('d') ?? '\t';
  if ([...delim].length !== 1) {
    return {
      lines: [
        error('cut: the delimiter must be a single character'),
        error("Try 'cut --help' for more information."),
        hint('区切り文字は1文字だけ指定します。空白で区切るときは -d " " のように書きます。'),
      ],
    };
  }
  const ranges = parseFieldList(fieldList);
  if (typeof ranges === 'string') {
    return {
      lines: [
        error(`cut: ${ranges}`),
        error("Try 'cut --help' for more information."),
        hint('列の番号は 1 から数えます。例：-f 1、-f 1,3、-f 2-4'),
      ],
    };
  }
  const loaded = load(state, 'cut', parsed.operands, stdin, 'cut -d " " -f 1 access.log');
  if (isOutput(loaded)) return loaded;

  const lines: OutputLine[] = [...loaded.errors];
  for (const src of loaded.sources) {
    for (const line of textToLines(src.text)) {
      if (!line.includes(delim)) {
        lines.push(stdout(line)); // 区切り文字がない行は、そのまま出す（本物と同じ）
        continue;
      }
      const fields = line.split(delim);
      const picked = fields.filter((_, i) => ranges.some(([lo, hi]) => i + 1 >= lo && i + 1 <= hi));
      lines.push(stdout(picked.join(delim)));
    }
  }
  return { lines };
}

// ---------------------------------------------------------------- 一覧

export const TEXT_COMMANDS: CommandDef[] = [
  {
    name: 'head',
    summary: 'ファイルの先頭の行を表示します',
    usage: 'head [-n 行数] [ファイル名...]',
    details: [
      '行数を省略すると、先頭の10行を表示します。-n 5 や -5 で行数を指定できます。',
      'ファイル名を省略すると、パイプ（|）で渡された出力を読みます。',
      '例：head -n 5 access.log',
    ],
    run: (state, args, stdin) => headTail('head', state, args, stdin),
  },
  {
    name: 'tail',
    summary: 'ファイルの末尾の行を表示します',
    usage: 'tail [-n 行数] [ファイル名...]',
    details: [
      '行数を省略すると、末尾の10行を表示します。-n 3 や -3 で行数を指定できます。',
      '-n +3 は、3行目から最後までを表示します。',
      'ファイル名を省略すると、パイプ（|）で渡された出力を読みます。',
      '例：tail -3 access.log　　history | tail -5',
    ],
    run: (state, args, stdin) => headTail('tail', state, args, stdin),
  },
  {
    name: 'grep',
    summary: '文字を含む行を探して表示します',
    usage: 'grep [-i] [-v] [-c] [-n] [-F] [-E] パターン [ファイル名...]',
    details: [
      '-i  大文字と小文字を区別しません。',
      '-v  パターンに一致しない行を表示します。',
      '-c  一致した行の数だけを表示します。',
      '-n  行番号をつけて表示します。',
      '-F  パターンを、ただの文字として探します（. や * も文字として扱います）。',
      '-E  拡張正規表現を使います（+ ? | ( ) { } が使えます）。',
      'パターンには ^（行頭）$（行末）.（任意の1文字）[abc]（いずれかの1文字）*（直前の文字の繰り返し）が使えます。',
      'ファイルが複数のときは、ファイル名:行 の形で表示します。ファイル名を省略すると、パイプで渡された出力を読みます。',
      '例：grep " 404 " access.log　　ls | grep txt',
    ],
    run: grep,
  },
  {
    name: 'wc',
    summary: '行数・単語数・バイト数を数えます',
    usage: 'wc [-l] [-w] [-c] [ファイル名...]',
    details: [
      'オプションなしだと、行数・単語数・バイト数をこの順に表示します。',
      '-l  行数だけ　-w  単語数だけ　-c  バイト数だけ（日本語は1文字が3バイトです）',
      'ファイルが複数のときは、最後に total の行を表示します。',
      '例：wc -l access.log　　ls | wc -l',
    ],
    run: wc,
  },
  {
    name: 'sort',
    summary: '行を並べ替えます',
    usage: 'sort [-r] [-n] [-u] [ファイル名...]',
    details: [
      '-r  逆順に並べます。',
      '-n  行頭の数字を数として比べます（10 が 9 より後ろになります）。',
      '-u  同じ行を1つにまとめます。',
      '並び順は文字コード順です（大文字が小文字より先になります）。',
      '例：sort -u names.txt　　sort -rn',
    ],
    run: sort,
  },
  {
    name: 'uniq',
    summary: '隣り合う同じ行を1つにまとめます',
    usage: 'uniq [-c] [ファイル名]',
    details: [
      '離れた場所にある同じ行はまとまらないので、先に sort で並べ替えてから使います。',
      '-c  同じ行が何回続いたかを、行の前に表示します。',
      '例：sort names.txt | uniq -c',
    ],
    run: uniq,
  },
  {
    name: 'cut',
    summary: '行から決まった列を取り出します',
    usage: 'cut -d 区切り文字 -f 番号 [ファイル名...]',
    details: [
      '-d  列を区切る1文字を指定します。空白で区切るときは -d " " と書きます（省略するとタブ）。',
      '-f  取り出す列の番号（1から数えます）。1,3 は1列目と3列目、2-4 は2〜4列目です。',
      '例：cut -d " " -f 1 access.log',
    ],
    run: cut,
  },
];
