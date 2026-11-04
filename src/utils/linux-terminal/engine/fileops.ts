/** ファイル操作のコマンド: touch / rm / rmdir / mv / cp / nano */
import type { CommandDef, CommandOutput, DirNode, FsNode, OutputLine, ShellState } from './types.ts';
import { error, hint } from './output.ts';
import { PERMISSION_HINT } from './hints.ts';
import { NO_SUCH_HINT, caseMismatchHint, unsupportedOption } from './common.ts';
import {
  MAX_PATH_DEPTH,
  canAccess,
  cloneNode,
  countChars,
  countNodes,
  findChild,
  hasRoom,
  heightOf,
  isDir,
  isSameOrInside,
  isValidName,
  lookup,
} from './fs.ts';
import { ERR_TEXT, canModify, createFile, resolveParent } from './fsops.ts';
import type { FsErr } from './fsops.ts';
import { joinPath, resolvePath, segmentsOf } from './path.ts';

const BUSY_HINT = hint(
  '今いる場所（とそれを含む上の階層）は、削除も移動もできません。cd で別の場所に移動してから操作しましょう。',
);
const NO_SPACE_HINT = hint(
  'ファイルやディレクトリが多すぎます。rm で不要なものを削除してから、もう一度試しましょう。',
);

const baseName = (abs: string): string => segmentsOf(abs).pop() ?? '/';

/** エラーコードに対応する出力行（権限エラーにはヒントを付ける） */
function fsErrorLines(prefix: string, code: FsErr): OutputLine[] {
  const lines: OutputLine[] = [error(`${prefix}: ${ERR_TEXT[code]}`)];
  if (code === 'EACCES') lines.push(PERMISSION_HINT);
  if (code === 'EBUSY') lines.push(BUSY_HINT);
  if (code === 'ENOSPC') lines.push(NO_SPACE_HINT);
  return lines;
}

/** 引数をオプションとファイル名に分ける。未対応のオプションがあれば CommandOutput を返す。 */
function parseArgs(
  cmd: string,
  args: string[],
  letters: Record<string, string>,
  longs: Record<string, string>,
  advice: string,
): { flags: Set<string>; operands: string[] } | CommandOutput {
  const flags = new Set<string>();
  const operands: string[] = [];
  let endOfOptions = false;
  for (const a of args) {
    if (endOfOptions || !a.startsWith('-') || a === '-') {
      operands.push(a);
    } else if (a === '--') {
      endOfOptions = true;
    } else if (a.startsWith('--')) {
      const f = longs[a];
      if (!f) return unsupportedOption(cmd, a, advice);
      flags.add(f);
    } else {
      for (const letter of a.slice(1)) {
        const f = letters[letter];
        if (!f) return unsupportedOption(cmd, `-${letter}`, advice);
        flags.add(f);
      }
    }
  }
  return { flags, operands };
}

const isOutput = (v: unknown): v is CommandOutput => typeof v === 'object' && v !== null && 'lines' in v;

const missingOperand = (cmd: string, example: string): CommandOutput => ({
  lines: [
    error(`${cmd}: missing operand`),
    error(`Try '${cmd} --help' for more information.`),
    hint(example),
  ],
});

// ---------------------------------------------------------------- touch

function touch(state: ShellState, args: string[]): CommandOutput {
  const parsed = parseArgs('touch', args, {}, {}, 'この touch はオプションなしで使います。touch ファイル名');
  if (isOutput(parsed)) return parsed;
  if (parsed.operands.length === 0) {
    return missingOperand('touch', 'touch の後ろに、作りたいファイルの名前を書きます。例：touch memo.txt');
  }
  const lines: OutputLine[] = [];
  for (const arg of parsed.operands) {
    const abs = resolvePath(state.cwd, arg);
    if (abs === '/') continue;
    const res = lookup(state.root, state.user, abs);
    if (res.ok) continue; // すでにある（本物は更新日時を変えるだけ）
    if (res.code !== 'ENOENT') {
      lines.push(...fsErrorLines(`touch: cannot touch '${arg}'`, res.code));
      continue;
    }
    const created = createFile(state.root, state.user, abs, '');
    if (!created.ok) {
      lines.push(...fsErrorLines(`touch: cannot touch '${arg}'`, created.code));
      if (created.code === 'ENOENT') lines.push(NO_SUCH_HINT);
    }
  }
  return { lines };
}

// ---------------------------------------------------------------- rm

/** ディレクトリの下すべてを削除できるか */
function canDeleteTree(node: FsNode, user: string): boolean {
  if (node.type === 'file') return true;
  if (!canAccess(node, user, 'r') || !canModify(node, user)) return false;
  return node.children.every((c) => canDeleteTree(c, user));
}

function removeChild(parent: DirNode, node: FsNode): void {
  parent.children = parent.children.filter((c) => c !== node);
}

function rm(state: ShellState, args: string[]): CommandOutput {
  const parsed = parseArgs(
    'rm',
    args,
    { r: 'r', R: 'r', f: 'f' },
    { '--recursive': 'r', '--force': 'f' },
    'この rm で使えるオプションは -r（ディレクトリごと削除）と -f（確認なし）だけです。',
  );
  if (isOutput(parsed)) return parsed;
  const recursive = parsed.flags.has('r');
  const force = parsed.flags.has('f');
  if (parsed.operands.length === 0) {
    return force ? { lines: [] } : missingOperand('rm', 'rm の後ろに、削除するファイルの名前を書きます。例：rm memo.txt');
  }
  const lines: OutputLine[] = [];
  for (const arg of parsed.operands) {
    const q = `rm: cannot remove '${arg}'`;
    const last = arg.replace(/\/+$/, '').split('/').pop();
    if (last === '.' || last === '..') {
      lines.push(error(`rm: refusing to remove '.' or '..' directory: skipping '${arg}'`));
      continue;
    }
    const abs = resolvePath(state.cwd, arg);
    if (abs === '/') {
      lines.push(
        error(recursive ? "rm: it is dangerous to operate recursively on '/'" : `${q}: Is a directory`),
        hint('/ は一番上のディレクトリです。ここを消すとすべてなくなるため、削除できません。'),
      );
      continue;
    }
    const res = lookup(state.root, state.user, abs);
    if (!res.ok) {
      if (res.code === 'ENOENT') {
        if (force) continue;
        lines.push(error(`${q}: ${ERR_TEXT.ENOENT}`), caseMismatchHint(res) ?? NO_SUCH_HINT);
      } else lines.push(...fsErrorLines(q, res.code));
      continue;
    }
    const node = res.node;
    if (isDir(node) && !recursive) {
      lines.push(
        error(`${q}: Is a directory`),
        hint('ディレクトリを削除するには rm -r を使います（空のディレクトリなら rmdir でも消せます）。'),
      );
      continue;
    }
    if (isSameOrInside(state.cwd, abs)) {
      lines.push(...fsErrorLines(q, 'EBUSY'));
      continue;
    }
    const p = resolveParent(state.root, state.user, abs);
    if (!p.ok) {
      lines.push(...fsErrorLines(q, p.code));
      continue;
    }
    if (!canModify(p.parent, state.user) || !canDeleteTree(node, state.user)) {
      lines.push(...fsErrorLines(q, 'EACCES'));
      continue;
    }
    removeChild(p.parent, node);
  }
  return { lines };
}

// ---------------------------------------------------------------- rmdir

function rmdir(state: ShellState, args: string[]): CommandOutput {
  const parsed = parseArgs('rmdir', args, {}, {}, 'この rmdir はオプションなしで使います。rmdir ディレクトリ名');
  if (isOutput(parsed)) return parsed;
  if (parsed.operands.length === 0) {
    return missingOperand('rmdir', 'rmdir の後ろに、削除する空のディレクトリ名を書きます。');
  }
  const lines: OutputLine[] = [];
  for (const arg of parsed.operands) {
    const q = `rmdir: failed to remove '${arg}'`;
    const abs = resolvePath(state.cwd, arg);
    const res = lookup(state.root, state.user, abs);
    if (!res.ok) {
      if (res.code === 'ENOENT') lines.push(error(`${q}: ${ERR_TEXT.ENOENT}`), caseMismatchHint(res) ?? NO_SUCH_HINT);
      else lines.push(...fsErrorLines(q, res.code));
      continue;
    }
    if (!isDir(res.node)) {
      lines.push(
        error(`${q}: Not a directory`),
        hint('rmdir はディレクトリ用です。ファイルを消すには rm を使います。'),
      );
      continue;
    }
    if (res.node.children.length > 0) {
      lines.push(
        error(`${q}: Directory not empty`),
        hint('rmdir は空のディレクトリしか消せません。中身ごと消すには rm -r を使います。'),
      );
      continue;
    }
    if (abs === '/' || isSameOrInside(state.cwd, abs)) {
      lines.push(...fsErrorLines(q, 'EBUSY'));
      continue;
    }
    const p = resolveParent(state.root, state.user, abs);
    if (!p.ok) lines.push(...fsErrorLines(q, p.code));
    else if (!canModify(p.parent, state.user)) lines.push(...fsErrorLines(q, 'EACCES'));
    else removeChild(p.parent, res.node);
  }
  return { lines };
}

// ---------------------------------------------------------------- mv / cp 共通

interface Plan {
  src: string;
  srcAbs: string;
  srcNode: FsNode;
  targetAbs: string;
  /** 表示用（入力された形に近い） */
  targetShown: string;
  targetParent: DirNode;
  targetName: string;
  existing: FsNode | undefined;
}

/** mv / cp の1件分の共通チェック。問題があれば出力行を返す。 */
function planTransfer(
  cmd: 'mv' | 'cp',
  state: ShellState,
  src: string,
  dest: string,
  destAbs: string,
  destIsDir: boolean,
): Plan | OutputLine[] {
  const srcAbs = resolvePath(state.cwd, src);
  const sres = lookup(state.root, state.user, srcAbs);
  if (!sres.ok) {
    const q = `${cmd}: cannot stat '${src}'`;
    if (sres.code === 'ENOENT') return [error(`${q}: ${ERR_TEXT.ENOENT}`), caseMismatchHint(sres) ?? NO_SUCH_HINT];
    return fsErrorLines(q, sres.code);
  }
  const srcNode = sres.node;
  const targetAbs = destIsDir ? joinPath(destAbs, baseName(srcAbs)) : destAbs;
  const targetShown = destIsDir ? `${dest.replace(/\/+$/, '')}/${baseName(srcAbs)}` : dest;
  const verb =
    cmd === 'mv'
      ? `cannot move '${src}' to '${targetShown}'`
      : `cannot create ${isDir(srcNode) ? 'directory' : 'regular file'} '${targetShown}'`;

  if (srcAbs === targetAbs) return [error(`${cmd}: '${src}' and '${targetShown}' are the same file`)];
  if (isDir(srcNode) && isSameOrInside(targetAbs, srcAbs)) {
    return [
      error(
        cmd === 'mv'
          ? `mv: cannot move '${src}' to a subdirectory of itself, '${targetShown}'`
          : `cp: cannot copy a directory, '${src}', into itself, '${targetShown}'`,
      ),
    ];
  }
  const name = segmentsOf(targetAbs).pop();
  if (
    name === undefined ||
    segmentsOf(targetAbs).length + heightOf(srcNode) > MAX_PATH_DEPTH ||
    !isValidName(name)
  ) {
    return fsErrorLines(`${cmd}: ${verb}`, 'ENAMETOOLONG');
  }
  const tp = resolveParent(state.root, state.user, targetAbs);
  if (!tp.ok) {
    const lines = fsErrorLines(`${cmd}: ${verb}`, tp.code);
    if (tp.code === 'ENOENT') lines.push(hint('移動先のディレクトリがありません。ls で確認しましょう。'));
    return lines;
  }
  const existing = findChild(tp.parent, tp.name);
  // cp の上書きは、ディレクトリではなくファイル自身に書き込めればよい（本物と同じ）
  const overwritesFile = cmd === 'cp' && existing !== undefined && !isDir(existing);
  if (!overwritesFile && !canModify(tp.parent, state.user)) {
    return fsErrorLines(`${cmd}: ${verb}`, 'EACCES');
  }
  return {
    src,
    srcAbs,
    srcNode,
    targetAbs,
    targetShown,
    targetParent: tp.parent,
    targetName: tp.name,
    existing,
  };
}

/** mv / cp の操作対象（コピー元・移動元と、コピー先・移動先）を決める */
function transfer(
  cmd: 'mv' | 'cp',
  state: ShellState,
  operands: string[],
  one: (plan: Plan) => OutputLine[],
): CommandOutput {
  if (operands.length < 2) {
    const first = operands[0];
    return {
      lines: [
        error(
          first === undefined
            ? `${cmd}: missing file operand`
            : `${cmd}: missing destination file operand after '${first}'`,
        ),
        error(`Try '${cmd} --help' for more information.`),
        hint(
          cmd === 'mv'
            ? 'mv 元の名前 新しい名前（または移動先のディレクトリ）の形で使います。'
            : 'cp コピー元 コピー先（または先のディレクトリ）の形で使います。',
        ),
      ],
    };
  }
  const dest = operands[operands.length - 1] as string;
  const sources = operands.slice(0, -1);
  const destAbs = resolvePath(state.cwd, dest);
  const dres = lookup(state.root, state.user, destAbs);
  const destIsDir = dres.ok && isDir(dres.node);
  if (!destIsDir && (sources.length > 1 || dest.endsWith('/'))) {
    return {
      lines: [
        error(`${cmd}: target '${dest}' is not a directory`),
        hint('複数のものを移す先は、存在するディレクトリにします。'),
      ],
    };
  }
  const lines: OutputLine[] = [];
  for (const src of sources) {
    const plan = planTransfer(cmd, state, src, dest, destAbs, destIsDir);
    if (Array.isArray(plan)) lines.push(...plan);
    else lines.push(...one(plan));
  }
  return { lines };
}

// ---------------------------------------------------------------- mv

function mv(state: ShellState, args: string[]): CommandOutput {
  const parsed = parseArgs('mv', args, {}, {}, 'この mv はオプションなしで使います。mv 元 先');
  if (isOutput(parsed)) return parsed;
  return transfer('mv', state, parsed.operands, (plan) => {
    const { src, srcAbs, srcNode, targetShown, targetParent, targetName, existing } = plan;
    const q = `mv: cannot move '${src}' to '${targetShown}'`;
    if (srcAbs === '/' || isSameOrInside(state.cwd, srcAbs)) return fsErrorLines(q, 'EBUSY');
    const sp = resolveParent(state.root, state.user, srcAbs);
    if (!sp.ok) return fsErrorLines(q, sp.code);
    if (!canModify(sp.parent, state.user)) return fsErrorLines(q, 'EACCES');
    if (existing) {
      if (isDir(existing)) {
        if (!isDir(srcNode)) {
          return [error(`mv: cannot overwrite directory '${targetShown}' with non-directory`)];
        }
        if (existing.children.length > 0) return [error(`${q}: Directory not empty`)];
      } else if (isDir(srcNode)) {
        return [error(`mv: cannot overwrite non-directory '${targetShown}' with directory '${src}'`)];
      }
      removeChild(targetParent, existing);
    }
    removeChild(sp.parent, srcNode);
    srcNode.name = targetName;
    targetParent.children.push(srcNode);
    return [];
  });
}

// ---------------------------------------------------------------- cp

function canReadTree(node: FsNode, user: string): boolean {
  if (node.type === 'file') return canAccess(node, user, 'r');
  return (
    canAccess(node, user, 'r') &&
    canAccess(node, user, 'x') &&
    node.children.every((c) => canReadTree(c, user))
  );
}

function reown(node: FsNode, user: string): void {
  node.owner = user;
  if (node.type === 'dir') node.children.forEach((c) => reown(c, user));
}

function cp(state: ShellState, args: string[]): CommandOutput {
  const parsed = parseArgs(
    'cp',
    args,
    { r: 'r', R: 'r' },
    { '--recursive': 'r' },
    'この cp で使えるオプションは -r（ディレクトリごとコピー）だけです。',
  );
  if (isOutput(parsed)) return parsed;
  const recursive = parsed.flags.has('r');
  return transfer('cp', state, parsed.operands, (plan) => {
    const { src, srcNode, targetShown, targetParent, targetName, existing } = plan;
    const q = `cp: cannot create ${isDir(srcNode) ? 'directory' : 'regular file'} '${targetShown}'`;
    if (isDir(srcNode) && !recursive) {
      return [
        error(`cp: -r not specified; omitting directory '${src}'`),
        hint('ディレクトリをコピーするには cp -r を使います。'),
      ];
    }
    if (!canReadTree(srcNode, state.user)) {
      return [error(`cp: cannot open '${src}' for reading: Permission denied`), PERMISSION_HINT];
    }
    if (existing) {
      if (isDir(existing)) {
        return isDir(srcNode)
          ? [
              error(`cp: cannot overwrite '${targetShown}' (a directory with that name already exists)`),
              hint('同じ名前のディレクトリがすでにあります。別の名前にするか、先に rm -r で消しましょう。'),
            ]
          : [error(`cp: cannot overwrite directory '${targetShown}' with non-directory`)];
      }
      if (isDir(srcNode)) {
        return [error(`cp: cannot overwrite non-directory '${targetShown}' with directory '${src}'`)];
      }
      if (!canAccess(existing, state.user, 'w')) return fsErrorLines(`cp: cannot create regular file '${targetShown}'`, 'EACCES');
      if (!hasRoom(state.root, 0, countChars(srcNode) - countChars(existing))) return fsErrorLines(q, 'ENOSPC');
      if (existing.type === 'file' && srcNode.type === 'file') existing.content = srcNode.content;
      return [];
    }
    if (!hasRoom(state.root, countNodes(srcNode), countChars(srcNode))) return fsErrorLines(q, 'ENOSPC');
    const copy = cloneNode(srcNode);
    reown(copy, state.user);
    copy.name = targetName;
    targetParent.children.push(copy);
    return [];
  });
}

// ---------------------------------------------------------------- nano

function nano(state: ShellState, args: string[]): CommandOutput {
  const parsed = parseArgs('nano', args, {}, {}, 'このエディタはオプションなしで使います。nano ファイル名');
  if (isOutput(parsed)) return parsed;
  if (parsed.operands.length === 0) {
    return {
      lines: [
        error('nano: missing file name'),
        hint('nano の後ろに、編集（または新しく作る）ファイルの名前を書きます。例：nano memo.txt'),
      ],
    };
  }
  if (parsed.operands.length > 1) {
    return {
      lines: [
        error('nano: only one file can be edited at a time in this simulator'),
        hint('このシミュレーターでは、一度に開けるファイルは1つだけです。'),
      ],
    };
  }
  const arg = parsed.operands[0] as string;
  const abs = resolvePath(state.cwd, arg);
  const q = `Error reading ${arg}`;
  const res = lookup(state.root, state.user, abs);
  if (res.ok) {
    if (isDir(res.node)) {
      return { lines: [error(`${q}: Is a directory`), hint('nano で開けるのはファイルです。ディレクトリの中身は ls で見ます。')] };
    }
    if (!canAccess(res.node, state.user, 'r')) return { lines: fsErrorLines(q, 'EACCES') };
    return {
      lines: [],
      edit: {
        path: abs,
        displayName: arg,
        content: res.node.content,
        isNew: false,
        readOnly: !canAccess(res.node, state.user, 'w'),
      },
    };
  }
  if (res.code !== 'ENOENT') return { lines: fsErrorLines(q, res.code) };
  const p = resolveParent(state.root, state.user, abs);
  if (!p.ok) {
    return {
      lines: [...fsErrorLines(q, p.code), ...(p.code === 'ENOENT' ? [NO_SUCH_HINT] : [])],
    };
  }
  if (!isValidName(p.name)) return { lines: fsErrorLines(q, 'ENAMETOOLONG') };
  return {
    lines: [],
    edit: {
      path: abs,
      displayName: arg,
      content: '',
      isNew: true,
      readOnly: !canModify(p.parent, state.user),
    },
  };
}

// ---------------------------------------------------------------- 一覧

export const FILE_COMMANDS: CommandDef[] = [
  {
    name: 'touch',
    summary: '空のファイルを作ります',
    usage: 'touch ファイル名...',
    details: ['すでにあるファイルは何も変わりません。中身を書くときは nano を使います。'],
    run: touch,
  },
  {
    name: 'nano',
    summary: 'ファイルを編集します（エディタ）',
    usage: 'nano ファイル名',
    details: [
      'ファイルがなければ、保存したときに新しく作られます。',
      '保存: Ctrl+O（または Ctrl+S）　終了: Ctrl+X',
    ],
    run: nano,
  },
  {
    name: 'cp',
    summary: 'ファイルやディレクトリをコピーします',
    usage: 'cp [-r] コピー元... コピー先',
    details: [
      '-r  ディレクトリを中身ごとコピーします。',
      'コピー先が既存のディレクトリなら、その中にコピーします。',
    ],
    run: cp,
  },
  {
    name: 'mv',
    summary: 'ファイルの移動・名前の変更をします',
    usage: 'mv 元... 先',
    details: [
      '先が既存のディレクトリなら、その中に移動します。',
      '先が存在しない名前なら、その名前に変更します。',
    ],
    run: mv,
  },
  {
    name: 'rm',
    summary: 'ファイルやディレクトリを削除します',
    usage: 'rm [-r] [-f] 名前...',
    details: [
      '-r  ディレクトリを中身ごと削除します。',
      '-f  存在しなくてもエラーにしません。',
      '注意：本物の Linux と同じく、削除したものは元に戻せません。',
      '（このシミュレーターは「最初からやり直す」で初期状態に戻せます）',
    ],
    run: rm,
  },
  {
    name: 'rmdir',
    summary: '空のディレクトリを削除します',
    usage: 'rmdir ディレクトリ名...',
    details: ['中身があるディレクトリは削除できません（rm -r を使います）。'],
    run: rmdir,
  },
];
