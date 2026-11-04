import type { CommandDef, CommandOutput, DirNode, FsNode, OutputLine, ShellState } from './types.ts';
import { error, hint, stdout } from './output.ts';
import { PERMISSION_HINT } from './hints.ts';
import { canAccess, compareNames, findChild, isDir, isValidName, lookup } from './fs.ts';
import { parentPath, resolvePath, segmentsOf } from './path.ts';

// ---------------------------------------------------------------- 共通の補助

/** 未対応オプションの表示 */
function unsupportedOption(cmd: string, opt: string, advice: string): CommandOutput {
  return {
    lines: [error(`${cmd}: option '${opt}' is not supported in this simulator`), hint(advice)],
  };
}

/** 大文字小文字だけが違う名前が隣にあれば、その名前を返す */
function caseMismatchHint(
  res: { missing?: string; parent?: DirNode },
): OutputLine | null {
  if (!res.missing || !res.parent) return null;
  const lower = res.missing.toLowerCase();
  const similar = res.parent.children.find((c) => c.name.toLowerCase() === lower);
  if (!similar) return null;
  return hint(
    `ファイル名・ディレクトリ名は大文字と小文字を区別します。「${similar.name}」のことではありませんか？`,
  );
}

const NO_SUCH_HINT = hint(
  'ls で今いる場所にあるものを確認しましょう。綴りや大文字・小文字も確認してください。',
);

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

  const lines: OutputLine[] = [...errors];
  if (files.length > 0) lines.push(entriesLine(files));
  const showHeaders = operands.length > 1;
  dirs.forEach((d, i) => {
    if (files.length > 0 || i > 0) lines.push(stdout(''));
    if (showHeaders) lines.push(stdout(`${d.arg}:`));
    const entries = entriesOf(d.node, all);
    if (entries.length > 0) lines.push(entriesLine(entries));
  });
  return { lines };
}

// ---------------------------------------------------------------- cat

function cat(state: ShellState, args: string[]): CommandOutput {
  const operands: string[] = [];
  let endOfOptions = false;
  for (const a of args) {
    if (!endOfOptions && a === '--') endOfOptions = true;
    else if (!endOfOptions && a === '-') {
      return {
        lines: [
          error("cat: '-' (standard input) is not supported in this simulator"),
          hint('cat の後ろにはファイル名を書きます。'),
        ],
      };
    } else if (!endOfOptions && a.startsWith('-')) {
      return unsupportedOption('cat', a, 'この cat は、ファイル名を指定して中身を表示する使い方だけに対応しています。');
    } else operands.push(a);
  }
  if (operands.length === 0) {
    return {
      lines: [
        error('cat: missing file operand'),
        hint(
          '本物の cat は引数がないとキーボード入力を待ち続けます。このシミュレーターでは cat ファイル名 の形で使いましょう。',
        ),
      ],
    };
  }
  const lines: OutputLine[] = [];
  for (const arg of operands) {
    const res = lookup(state.root, state.user, resolvePath(state.cwd, arg));
    if (!res.ok) {
      if (res.code === 'EACCES') lines.push(error(`cat: ${arg}: Permission denied`), PERMISSION_HINT);
      else if (res.code === 'ENOTDIR') lines.push(error(`cat: ${arg}: Not a directory`));
      else {
        lines.push(error(`cat: ${arg}: No such file or directory`));
        lines.push(caseMismatchHint(res) ?? NO_SUCH_HINT);
      }
      continue;
    }
    if (isDir(res.node)) {
      lines.push(
        error(`cat: ${arg}: Is a directory`),
        hint('cat はファイルの中身を表示するコマンドです。ディレクトリの中身を見るには ls を使います。'),
      );
      continue;
    }
    if (!canAccess(res.node, state.user, 'r')) {
      lines.push(error(`cat: ${arg}: Permission denied`), PERMISSION_HINT);
      continue;
    }
    if (res.node.content === '') continue;
    const text = res.node.content.endsWith('\n') ? res.node.content.slice(0, -1) : res.node.content;
    for (const l of text.split('\n')) lines.push(stdout(l));
  }
  return { lines };
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
  if (segs.some((s) => !isValidName(s))) {
    return [error(`${q}: File name too long`)];
  }

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
    ],
  };
}

// ---------------------------------------------------------------- 一覧

export const COMMANDS: CommandDef[] = [
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
    name: 'mkdir',
    summary: '新しいディレクトリを作ります',
    usage: 'mkdir [-p] ディレクトリ名...',
    details: ['-p  途中のディレクトリもまとめて作ります。例：mkdir -p a/b/c'],
    run: mkdir,
  },
  {
    name: 'cat',
    summary: 'ファイルの中身を表示します',
    usage: 'cat ファイル名...',
    details: ['複数のファイルを指定すると、順番に続けて表示します。'],
    run: cat,
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

export const COMMAND_MAP: Map<string, CommandDef> = new Map(COMMANDS.map((c) => [c.name, c]));
