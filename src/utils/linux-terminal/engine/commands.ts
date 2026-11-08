import type { CommandDef, CommandOutput, DirNode, FsNode, OutputLine, ShellState } from './types.ts';
import { error, hint, stdout } from './output.ts';
import { PERMISSION_HINT } from './hints.ts';
import { NO_SUCH_HINT, caseMismatchHint, unsupportedOption } from './common.ts';
import { FILE_COMMANDS } from './fileops.ts';
import { TEXT_COMMANDS } from './textcmds.ts';
import { missingInput, readSources, textToLines } from './input.ts';
import {
  MAX_PATH_DEPTH,
  canAccess,
  compareNames,
  findChild,
  hasRoom,
  isDir,
  isValidName,
  lookup,
} from './fs.ts';
import { parentPath, resolvePath, segmentsOf } from './path.ts';

// ---------------------------------------------------------------- 共通の補助

/** ls が名前を表示するときの引用（スペースなどを含むとき） */
function quoteName(name: string): string {
  if (/[\s"\\$&;|<>()*?[\]{}!#`]/.test(name) || name.startsWith('~')) {
    return name.includes("'") ? `"${name}"` : `'${name}'`;
  }
  return name;
}

// ---------------------------------------------------------------- pwd

function pwd(state: ShellState, args: string[]): CommandOutput {
  for (const a of args) {
    if (a === '-L' || a === '-P') continue;
    if (a.startsWith('-') && a.length > 1) {
      return {
        lines: [
          error(`bash: pwd: ${a}: invalid option`),
          hint('pwd は引数なしで使います。今いる場所が表示されます。'),
        ],
      };
    }
  }
  return { lines: [stdout(state.cwd)] };
}

// ---------------------------------------------------------------- cd

function cd(state: ShellState, args: string[]): CommandOutput {
  const operands: string[] = [];
  let endOfOptions = false;
  for (const a of args) {
    if (!endOfOptions && a === '--') {
      endOfOptions = true;
    } else if (!endOfOptions && a === '-') {
      return {
        lines: [
          error("bash: cd: '-' is not supported in this simulator"),
          hint('直前の場所に戻る cd - は未対応です。cd で場所を指定して移動しましょう。'),
        ],
      };
    } else if (!endOfOptions && /^-[LP]+$/.test(a)) {
      continue;
    } else if (!endOfOptions && a.startsWith('-') && a.length > 1) {
      return {
        lines: [
          error(`bash: cd: ${a}: invalid option`),
          error('cd: usage: cd [dir]'),
          hint('cd の後ろには、移動先のディレクトリ名だけを書きます。'),
        ],
      };
    } else {
      operands.push(a);
    }
  }
  if (operands.length > 1) {
    return {
      lines: [
        error('bash: cd: too many arguments'),
        hint('cd で指定できる移動先は1つだけです。スペースが入っていないか確認しましょう。'),
      ],
    };
  }
  const arg = operands[0];
  if (arg === '') return { lines: [] };
  const target = arg === undefined ? state.home : resolvePath(state.cwd, arg);
  const shown = arg ?? target;
  const res = lookup(state.root, state.user, target);
  if (!res.ok) {
    if (res.code === 'EACCES') {
      return { lines: [error(`bash: cd: ${shown}: Permission denied`), PERMISSION_HINT] };
    }
    if (res.code === 'ENOTDIR') {
      return { lines: [error(`bash: cd: ${shown}: Not a directory`)] };
    }
    const lines: OutputLine[] = [error(`bash: cd: ${shown}: No such file or directory`)];
    lines.push(caseMismatchHint(res) ?? NO_SUCH_HINT);
    return { lines };
  }
  if (!isDir(res.node)) {
    return {
      lines: [
        error(`bash: cd: ${shown}: Not a directory`),
        hint('cd で移動できるのはディレクトリだけです。ファイルの中身を見るには cat を使います。'),
      ],
    };
  }
  if (!canAccess(res.node, state.user, 'x')) {
    return { lines: [error(`bash: cd: ${shown}: Permission denied`), PERMISSION_HINT] };
  }
  state.cwd = target;
  return { lines: [] };
}

// ---------------------------------------------------------------- ls

interface LsEntry {
  name: string;
  dir: boolean;
}

function entriesOf(dir: DirNode, all: boolean): LsEntry[] {
  const list: LsEntry[] = dir.children
    .filter((c) => all || !c.name.startsWith('.'))
    .sort((a, b) => compareNames(a.name, b.name))
    .map((c) => ({ name: c.name, dir: c.type === 'dir' }));
  return all ? [{ name: '.', dir: true }, { name: '..', dir: true }, ...list] : list;
}

function entriesLine(entries: LsEntry[]): OutputLine {
  const spans = entries.flatMap((e, i) => {
    const s = [{ text: quoteName(e.name), ...(e.dir ? { style: 'dir' as const } : {}) }];
    if (i < entries.length - 1) s.push({ text: '  ' });
    return s;
  });
  return stdout(spans.map((s) => s.text).join(''), spans);
}

/** 画面では横に並べ、ファイルに書くときは本物の ls と同じく1行に1つ（引用符もなし）にする */
function entryLines(entries: LsEntry[], toFile: boolean): OutputLine[] {
  return toFile ? entries.map((e) => stdout(e.name)) : [entriesLine(entries)];
}

function ls(state: ShellState, args: string[]): CommandOutput {
  let all = false;
  const operands: string[] = [];
  let endOfOptions = false;
  for (const a of args) {
    if (endOfOptions || !a.startsWith('-') || a === '-') {
      operands.push(a);
    } else if (a === '--') {
      endOfOptions = true;
    } else if (a === '--all') {
      all = true;
    } else if (a.startsWith('--')) {
      return unsupportedOption('ls', a, 'この ls で使えるオプションは -a（隠しファイルも表示）だけです。');
    } else {
      for (const letter of a.slice(1)) {
        if (letter === 'a') all = true;
        else {
          return unsupportedOption(
            'ls',
            `-${letter}`,
            'この ls で使えるオプションは -a（隠しファイルも表示）だけです。',
          );
        }
      }
    }
  }
  if (operands.length === 0) operands.push('.');

  const errors: OutputLine[] = [];
  const files: LsEntry[] = [];
  const dirs: { arg: string; node: DirNode }[] = [];
  for (const arg of [...operands].sort(compareNames)) {
    const abs = resolvePath(state.cwd, arg);
    const res = lookup(state.root, state.user, abs);
    if (!res.ok) {
      if (res.code === 'EACCES') {
        errors.push(error(`ls: cannot access '${arg}': Permission denied`), PERMISSION_HINT);
      } else if (res.code === 'ENOTDIR') {
        errors.push(error(`ls: cannot access '${arg}': Not a directory`));
      } else {
        errors.push(error(`ls: cannot access '${arg}': No such file or directory`));
        errors.push(caseMismatchHint(res) ?? NO_SUCH_HINT);
      }
    } else if (isDir(res.node)) {
      if (!canAccess(res.node, state.user, 'r')) {
        errors.push(error(`ls: cannot open directory '${arg}': Permission denied`), PERMISSION_HINT);
      } else {
        dirs.push({ arg, node: res.node });
      }
    } else {
      files.push({ name: arg, dir: false });
    }
  }

  const toFile = state.stdoutRedirected;
  const lines: OutputLine[] = [...errors];
  if (files.length > 0) lines.push(...entryLines(files, toFile));
  const showHeaders = operands.length > 1;
  dirs.forEach((d, i) => {
    if (files.length > 0 || i > 0) lines.push(stdout(''));
    if (showHeaders) lines.push(stdout(`${d.arg}:`));
    const entries = entriesOf(d.node, all);
    if (entries.length > 0) lines.push(...entryLines(entries, toFile));
  });
  return { lines };
}

// ---------------------------------------------------------------- cat

function cat(state: ShellState, args: string[], stdin?: string): CommandOutput {
  const operands: string[] = [];
  let endOfOptions = false;
  for (const a of args) {
    if (!endOfOptions && a === '--') endOfOptions = true;
    else if (!endOfOptions && a === '-' && stdin === undefined) {
      return {
        lines: [
          error("cat: '-' (standard input) is not supported in this simulator"),
          hint('cat の後ろにはファイル名を書きます。'),
        ],
      };
    } else if (!endOfOptions && a !== '-' && a.startsWith('-')) {
      return unsupportedOption('cat', a, 'この cat は、ファイル名を指定して中身を表示する使い方だけに対応しています。');
    } else operands.push(a);
  }
  const sameFile = (arg: string): OutputLine[] => [
    error(`cat: ${arg}: input file is output file`),
    hint('読み込むファイルと、書き込み先のファイルが同じです。書き込み先は別の名前にしましょう。'),
  ];
  if (operands.length === 0 && stdin === undefined) return missingInput('cat', 'ls | cat');
  const lines: OutputLine[] = [];
  // エラーと中身が、指定した順に並ぶよう、1つずつ読む
  for (const arg of operands.length === 0 ? [] : operands) {
    const read = readSources(state, 'cat', [arg], stdin, { sameFile });
    if (read) lines.push(...read.errors, ...catLines(read.sources));
  }
  if (operands.length === 0) lines.push(...catLines([{ text: stdin as string }]));
  return { lines };
}

function catLines(sources: Array<{ text: string }>): OutputLine[] {
  const lines: OutputLine[] = [];
  for (const src of sources) {
    const rows = textToLines(src.text);
    rows.forEach((l, i) => {
      const line = stdout(l);
      // 最後の改行がない入力（echo -n など）は、改行なしのまま流す
      if (i === rows.length - 1 && !src.text.endsWith('\n')) line.noNewline = true;
      lines.push(line);
    });
  }
  return lines;
}

// ---------------------------------------------------------------- mkdir

function newDir(name: string, user: string): DirNode {
  return { type: 'dir', name, owner: user, mode: 0o755, children: [] };
}

/** mkdir 1件分。エラーがあれば出力行を返す。 */
function makeDirectory(state: ShellState, arg: string, parents: boolean): OutputLine[] {
  const q = `mkdir: cannot create directory ‘${arg}’`;
  const abs = resolvePath(state.cwd, arg);
  const segs = segmentsOf(abs);
  if (segs.length === 0) {
    return parents ? [] : [error(`${q}: File exists`)];
  }
  if (segs.length > MAX_PATH_DEPTH || segs.some((s) => !isValidName(s))) {
    return [error(`${q}: File name too long`)];
  }
  const noSpace = [
    error(`${q}: No space left on device`),
    hint('ファイルやディレクトリが多すぎます。rm で不要なものを削除してから、もう一度試しましょう。'),
  ];

  if (!parents) {
    const exists = lookup(state.root, state.user, abs);
    if (exists.ok) {
      return [
        error(`${q}: File exists`),
        hint('同じ名前のファイルかディレクトリがすでにあります。別の名前にするか、ls で確認しましょう。'),
      ];
    }
    if (exists.code === 'EACCES') return [error(`${q}: Permission denied`), PERMISSION_HINT];
    const parent = lookup(state.root, state.user, parentPath(abs));
    if (!parent.ok) {
      if (parent.code === 'EACCES') return [error(`${q}: Permission denied`), PERMISSION_HINT];
      if (parent.code === 'ENOTDIR') return [error(`${q}: Not a directory`)];
      return [
        error(`${q}: No such file or directory`),
        hint('途中のディレクトリがありません。1つずつ作るか、mkdir -p を使うとまとめて作れます。'),
      ];
    }
    if (!isDir(parent.node)) return [error(`${q}: Not a directory`)];
    if (!canAccess(parent.node, state.user, 'w') || !canAccess(parent.node, state.user, 'x')) {
      return [error(`${q}: Permission denied`), PERMISSION_HINT];
    }
    if (!hasRoom(state.root, 1)) return noSpace;
    parent.node.children.push(newDir(segs[segs.length - 1] as string, state.user));
    return [];
  }

  // -p: 途中のディレクトリもまとめて作る
  let cur: DirNode = state.root;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i] as string;
    if (!canAccess(cur, state.user, 'x')) return [error(`${q}: Permission denied`), PERMISSION_HINT];
    const child: FsNode | undefined = findChild(cur, seg);
    if (child) {
      if (!isDir(child)) {
        return [error(`${q}: ${i === segs.length - 1 ? 'File exists' : 'Not a directory'}`)];
      }
      cur = child;
      continue;
    }
    if (!canAccess(cur, state.user, 'w')) return [error(`${q}: Permission denied`), PERMISSION_HINT];
    if (!hasRoom(state.root, 1)) return noSpace;
    const created = newDir(seg, state.user);
    cur.children.push(created);
    cur = created;
  }
  return [];
}

function mkdir(state: ShellState, args: string[]): CommandOutput {
  let parents = false;
  const operands: string[] = [];
  let endOfOptions = false;
  for (const a of args) {
    if (!endOfOptions && a === '--') endOfOptions = true;
    else if (!endOfOptions && a === '--parents') parents = true;
    else if (!endOfOptions && a.startsWith('--')) {
      return unsupportedOption('mkdir', a, 'この mkdir で使えるオプションは -p だけです。');
    } else if (!endOfOptions && a.startsWith('-') && a.length > 1) {
      for (const letter of a.slice(1)) {
        if (letter === 'p') parents = true;
        else {
          return unsupportedOption('mkdir', `-${letter}`, 'この mkdir で使えるオプションは -p だけです。');
        }
      }
    } else operands.push(a);
  }
  if (operands.length === 0) {
    return {
      lines: [
        error('mkdir: missing operand'),
        error("Try 'mkdir --help' for more information."),
        hint('mkdir の後ろに、作りたいディレクトリの名前を書きます。例：mkdir test'),
      ],
    };
  }
  const lines: OutputLine[] = [];
  for (const arg of operands) lines.push(...makeDirectory(state, arg, parents));
  return { lines };
}

// ---------------------------------------------------------------- clear

function clear(_state: ShellState, args: string[]): CommandOutput {
  if (args.length > 0) {
    return unsupportedOption('clear', args[0] as string, 'clear は引数なしで使います。');
  }
  return { lines: [], clear: true };
}

// ---------------------------------------------------------------- help

function help(_state: ShellState, args: string[]): CommandOutput {
  if (args.length > 1) {
    return { lines: [error('bash: help: too many arguments'), hint('help コマンド名 の形で1つだけ指定します。')] };
  }
  const topic = args[0];
  if (topic !== undefined) {
    const def = COMMANDS.find((c) => c.name === topic);
    if (!def) {
      return {
        lines: [
          error(`bash: help: no help topics match '${topic}'.`),
          hint('help だけを入力すると、使えるコマンドの一覧を表示します。'),
        ],
      };
    }
    return {
      lines: [
        stdout(`${def.name}: ${def.usage}`),
        stdout(`  ${def.summary}`),
        ...def.details.map((d) => stdout(`  ${d}`)),
      ],
    };
  }
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  return {
    lines: [
      stdout('使えるコマンド：'),
      ...COMMANDS.map((c) => stdout(`  ${c.name.padEnd(width)}  ${c.summary}`)),
      stdout(''),
      stdout('help コマンド名 で、そのコマンドの使い方を表示します。例：help ls'),
      stdout('Tab キーで補完、↑ ↓ キーで過去のコマンドを呼び出せます。'),
      stdout('Ctrl+C で入力を取り消し、Ctrl+L で画面をクリアします。'),
      stdout('コマンドの出力をファイルに保存：コマンド > ファイル名（上書き）、コマンド >> ファイル名（追記）'),
      stdout('例：history > rireki.txt　　echo こんにちは > memo.txt'),
      stdout('コマンドをつなぐ：コマンド1 | コマンド2（前の出力が、次の入力になります）'),
      stdout('例：ls | wc -l　　grep error access.log | sort | uniq -c'),
      stdout('ワイルドカード：* （任意の文字）、? （任意の1文字）、[abc] （どれか1文字）で、複数のファイルをまとめて指定できます。'),
      stdout('例：ls *.jpg　　rm *.tmp　　mv *.png photos/'),
    ],
  };
}

// ---------------------------------------------------------------- echo

/** -e で使えるエスケープ */
const ECHO_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  a: '\x07',
  b: '\b',
  e: '\x1b',
  f: '\f',
  v: '\v',
  '\\': '\\',
};

/** echo -e の \n や \t を変換する。\c が出てきたら、そこで出力を打ち切る。 */
function interpretEscapes(text: string): { text: string; stop: boolean } {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = text[i + 1];
    if (next === 'c') return { text: out, stop: true };
    if (next !== undefined && Object.hasOwn(ECHO_ESCAPES, next)) {
      out += ECHO_ESCAPES[next];
      i++;
    } else {
      out += ch; // 未対応のエスケープは、そのまま表示する（本物と同じ）
    }
  }
  return { text: out, stop: false };
}

function echo(_state: ShellState, args: string[]): CommandOutput {
  // 本物の echo と同じく、先頭の -n / -e / -E（組み合わせも可）だけがオプション。
  // それ以外の -x などは、ただの文字として表示する。
  let newline = true;
  let escapes = false;
  let i = 0;
  while (i < args.length && /^-[neE]+$/.test(args[i] as string)) {
    for (const f of (args[i] as string).slice(1)) {
      if (f === 'n') newline = false;
      else if (f === 'e') escapes = true;
      else escapes = false;
    }
    i++;
  }
  let body = args.slice(i).join(' ');
  if (escapes) {
    const r = interpretEscapes(body);
    body = r.text;
    if (r.stop) newline = false;
  }
  const parts = (body + (newline ? '\n' : '')).split('\n');
  const rest = parts.pop() as string; // 最後の改行より後ろ（改行で終わるなら空）
  const lines: OutputLine[] = parts.map((p) => stdout(p));
  if (rest !== '') lines.push({ ...stdout(rest), noNewline: true });
  return { lines };
}

// ---------------------------------------------------------------- history

function history(state: ShellState, args: string[]): CommandOutput {
  if (args.length > 1) {
    return {
      lines: [
        error('bash: history: too many arguments'),
        hint('history は引数なし、または history 5 のように表示する件数を1つだけ指定します。'),
      ],
    };
  }
  const arg = args[0];
  let list = state.history;
  let first = 1;
  if (arg !== undefined) {
    if (arg.startsWith('-') && arg.length > 1 && !/^-\d+$/.test(arg)) {
      return {
        lines: [
          error(`bash: history: option '${arg}' is not supported in this simulator`),
          hint('履歴を消す -c などは使えません。history だけで履歴を一覧表示、history 5 で最近の5件を表示します。'),
        ],
      };
    }
    if (!/^\d+$/.test(arg)) {
      return {
        lines: [
          error(`bash: history: ${arg}: numeric argument required`),
          hint('表示する件数は半角の数字で指定します。例：history 5'),
        ],
      };
    }
    const n = Number(arg);
    first = Math.max(list.length - n, 0) + 1;
    list = n === 0 ? [] : list.slice(-n);
  }
  // 本物の bash と同じ表示（番号を右寄せ5桁、2つ空白、コマンド）
  return {
    lines: list.map((cmd, i) => stdout(`${String(first + i).padStart(5, ' ')}  ${cmd}`)),
  };
}

// ---------------------------------------------------------------- 一覧

const BASE_COMMANDS: CommandDef[] = [
  {
    name: 'pwd',
    summary: '今いる場所（カレントディレクトリ）を表示します',
    usage: 'pwd',
    details: ['今いる場所を、/ から始まる絶対パスで表示します。'],
    run: pwd,
  },
  {
    name: 'ls',
    summary: 'ファイルやディレクトリの一覧を表示します',
    usage: 'ls [-a] [場所...]',
    details: [
      '場所を省略すると、今いる場所の中身を表示します。',
      'パイプ（|）やファイルに出力するときは、1行に1つずつ表示します。例：ls | wc -l',
      '-a  . で始まる隠しファイルも表示します。',
      '（ディレクトリは青色で表示されます）',
    ],
    run: ls,
  },
  {
    name: 'cd',
    summary: '別のディレクトリに移動します',
    usage: 'cd [場所]',
    details: [
      '場所を省略すると、ホームディレクトリ（~）に移動します。',
      '絶対パス（/home/student）、相対パス（Documents）、.（今の場所）、.. （1つ上）、~（ホーム）が使えます。',
    ],
    run: cd,
  },
  {
    name: 'echo',
    summary: '文字を表示します（> でファイルに書き込めます）',
    usage: 'echo [-n] [-e] 文字列...',
    details: [
      '例：echo Hello　→　Hello と表示します。',
      '例：echo "こんにちは" > memo.txt　→　memo.txt に書き込みます（>> なら追記）。',
      '-n  最後に改行を付けません。',
      '-e  \\n（改行）や \\t（タブ）を、特別な文字として扱います。例：echo -e "1行目\\n2行目"',
      '変数（$HOME など）は、まだ使えません。',
    ],
    run: echo,
  },
  {
    name: 'mkdir',
    summary: '新しいディレクトリを作ります',
    usage: 'mkdir [-p] ディレクトリ名...',
    details: ['-p  途中のディレクトリもまとめて作ります。例：mkdir -p a/b/c'],
    run: mkdir,
  },
  {
    name: 'cat',
    summary: 'ファイルの中身を表示します',
    usage: 'cat [ファイル名...]',
    details: [
      '複数のファイルを指定すると、順番に続けて表示します。',
      'ファイル名を省略すると、パイプ（|）で渡された出力をそのまま表示します。',
      '例：cat server/logs/*.log | grep error',
    ],
    run: cat,
  },
  {
    name: 'history',
    summary: 'これまでに入力したコマンドの履歴を表示します',
    usage: 'history [件数]',
    details: [
      '番号つきで、入力した順に表示します（history 自身も含まれます）。',
      '件数を指定すると、最近のその件数だけを表示します。例：history 5',
      '↑ キーでも、前に入力したコマンドを呼び出せます。',
    ],
    run: history,
  },
  {
    name: 'clear',
    summary: '画面をきれいにします',
    usage: 'clear',
    details: ['Ctrl+L でも同じことができます。'],
    run: clear,
  },
  {
    name: 'help',
    summary: '使えるコマンドの一覧を表示します',
    usage: 'help [コマンド名]',
    details: [],
    run: help,
  },
];

/** 表示順: 見る → 作る・編集する → 消す → 画面・ヘルプ */
const ORDER = ['pwd', 'ls', 'cd', 'cat', 'head', 'tail', 'grep', 'wc', 'sort', 'uniq', 'cut', 'echo', 'mkdir', 'touch', 'nano', 'cp', 'mv', 'rm', 'rmdir', 'history', 'clear', 'help'];
export const COMMANDS: CommandDef[] = [...BASE_COMMANDS, ...FILE_COMMANDS, ...TEXT_COMMANDS].sort(
  (a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name),
);

export const COMMAND_MAP: Map<string, CommandDef> = new Map(COMMANDS.map((c) => [c.name, c]));
