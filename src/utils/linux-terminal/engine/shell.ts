import type {
  CompletionResult,
  DirNode,
  EditRequest,
  Environment,
  ExecResult,
  OutputLine,
  ShellSnapshot,
  ShellState,
} from './types.ts';
import { COMMAND_MAP, COMMANDS } from './commands.ts';
import { completeLine } from './complete.ts';
import { canAccess, cloneNode, isDir, lookup } from './fs.ts';
import { expandTilde, resolvePath } from './path.ts';
import { error, hint } from './output.ts';
import { ERR_TEXT, openRedirectTarget, saveFileContent, writeRedirectOutput } from './fsops.ts';
import { FULLWIDTH_HINT, PERMISSION_HINT, hasFullwidth, unknownCommandOutput } from './hints.ts';
import { tokenize } from './tokenizer.ts';
import type { Problem, SimpleCommand } from './tokenizer.ts';
import { expandGlob } from './glob.ts';
import { outputToText } from './input.ts';
import { checkUpload, performUpload } from './upload.ts';
import type { UploadCheck, UploadFile, UploadOptions, UploadResult } from './upload.ts';

export const MAX_HISTORY = 1000;

/** 出力を捨てる特別な書き込み先（ファイルシステム上には存在しない） */
const DEV_NULL = '/dev/null';

function redirectHint(code: string): OutputLine[] {
  switch (code) {
    case 'EACCES':
      return [PERMISSION_HINT];
    case 'ENOENT':
      return [hint('書き込み先のディレクトリがありません。ls で確認しましょう。')];
    case 'EISDIR':
      return [hint('ディレクトリには書き込めません。> の後ろには、ファイル名を指定します。')];
    case 'ENOSPC':
      return [hint('ファイルが大きすぎるか、ファイルの数が多すぎます。rm で不要なものを削除しましょう。')];
    default:
      return [];
  }
}

export interface RestoredState {
  cwd: string;
  root: DirNode;
  history: string[];
}

const PROBLEM_HINTS: Record<string, string> = {
  '<': '入力のリダイレクト（<）は、このシミュレーターではまだ使えません。出力をファイルに保存する > と >> は使えます。',
  '<<': '入力のリダイレクト（<<）は、このシミュレーターではまだ使えません。',
  '&>': 'まとめてのリダイレクト（&>）は、このシミュレーターではまだ使えません。> は使えます。',
  '>&': 'リダイレクト（>&）は、このシミュレーターではまだ使えません。> は使えます。',
  '>|': 'リダイレクト（>|）は、このシミュレーターではまだ使えません。> は使えます。',
  '&&': '1行に複数のコマンドをつなぐ書き方は、このシミュレーターではまだ使えません。1行に1つずつ実行しましょう。',
  '||': '1行に複数のコマンドをつなぐ書き方は、このシミュレーターではまだ使えません。1行に1つずつ実行しましょう。',
  ';': '1行に複数のコマンドをつなぐ書き方は、このシミュレーターではまだ使えません。1行に1つずつ実行しましょう。',
  '&': 'バックグラウンド実行（&）は、このシミュレーターではまだ使えません。',
};

function problemOutput(p: Problem): OutputLine[] {
  switch (p.kind) {
    case 'operator':
      return [
        error(`bash: syntax '${p.token}' is not supported in this simulator`),
        hint(
          PROBLEM_HINTS[p.token] ??
            `この記号（${p.token}）を使った書き方は、このシミュレーターではまだ使えません。`,
        ),
      ];
    case 'syntax':
      if (p.ctx === 'pipe') {
        return p.token === 'newline'
          ? [
              error('bash: syntax error: unexpected end of file'),
              hint('| の後ろには、次のコマンドが必要です。例：ls | wc -l'),
            ]
          : [
              error("bash: syntax error near unexpected token `|'"),
              hint('| の前には、コマンドが必要です。例：ls | wc -l'),
            ];
      }
      return [
        error(`bash: syntax error near unexpected token \`${p.token}'`),
        hint(
          p.token === 'newline'
            ? '> の後ろには、出力を書き込むファイル名が必要です。例：history > rireki.txt'
            : '> の直後に別の記号があります。> の後ろには、出力を書き込むファイル名だけを書きます。',
        ),
      ];
    case 'variable':
      return [
        error(`bash: '${p.token}' expansion is not supported in this simulator`),
        hint('変数（$名前）やコマンド置換は、このシミュレーターではまだ使えません。'),
      ];
    case 'quote':
      return [
        error(`bash: unexpected EOF while looking for matching \`${p.token}'`),
        hint(`引用符（${p.token}）が閉じられていません。開いた引用符は、もう一度入力して閉じましょう。`),
      ];
  }
}

export class Shell {
  readonly env: Pick<Environment, 'id' | 'title' | 'user' | 'hostname' | 'home' | 'welcome'>;
  readonly state: ShellState;
  private _history: string[];

  /**
   * @param env 初期環境（読み取り専用。内部でコピーして使うので、渡したデータは変更されない）
   * @param restored 保存データから復元するときの状態
   */
  constructor(env: Environment, restored?: RestoredState) {
    this.env = {
      id: env.id,
      title: env.title,
      user: env.user,
      hostname: env.hostname,
      home: env.home,
      welcome: [...env.welcome],
    };
    this._history = restored ? [...restored.history] : [];
    this.state = {
      user: env.user,
      hostname: env.hostname,
      home: env.home,
      cwd: restored ? restored.cwd : env.cwd,
      root: cloneNode(restored ? restored.root : env.root),
      // history コマンドが読めるよう、同じ配列を共有する（配列は作り直さず、中身だけ変更する）
      history: this._history,
      stdoutFile: null,
      stdoutRedirected: false,
    };
  }

  get history(): readonly string[] {
    return this._history;
  }

  get cwd(): string {
    return this.state.cwd;
  }

  /** `student@joho:~$` のような表示用プロンプト */
  prompt(): { user: string; host: string; path: string; text: string } {
    const { user, hostname, home, cwd } = this.state;
    let path = cwd;
    if (cwd === home) path = '~';
    else if (cwd.startsWith(home + '/')) path = '~' + cwd.slice(home.length);
    return { user, host: hostname, path, text: `${user}@${hostname}:${path}$` };
  }

  /** 1行を実行する。空入力（ASCIIの空白のみ含む）は何もせず、履歴にも残さない。 */
  execute(line: string): ExecResult {
    if (/^[ \t]*$/.test(line)) {
      return { lines: [], clear: false, recorded: false, empty: true };
    }
    this._history.push(line);
    if (this._history.length > MAX_HISTORY) this._history.splice(0, this._history.length - MAX_HISTORY);

    const lines: OutputLine[] = [];
    let clear = false;
    let edit: EditRequest | undefined;
    let unmatched: string[] = [];
    const tok = tokenize(line);
    if (!tok.ok) {
      lines.push(...problemOutput(tok.problem));
    } else {
      const r = this.runPipeline(tok.commands);
      lines.push(...r.lines);
      clear = r.clear;
      edit = r.edit;
      unmatched = r.unmatched;
    }

    const failed = lines.some((l) => l.kind === 'error');
    if (failed) {
      for (const pattern of new Set(unmatched)) {
        lines.push(
          hint(
            `「${pattern}」に一致するファイルがありませんでした。ワイルドカードは、一致するものがないと、そのままの文字として扱われます。ls で名前を確認しましょう。`,
          ),
        );
      }
      const alreadyHinted = lines.includes(FULLWIDTH_HINT);
      if (hasFullwidth(line) && !alreadyHinted) lines.push(FULLWIDTH_HINT);
      if (/\\[^ \t"'\\$`]/.test(line)) {
        lines.push(hint('Linux ではパスの区切りに / を使います。Windows の \\ ではありません。'));
      }
    }
    return edit
      ? { lines, clear, recorded: true, empty: false, edit }
      : { lines, clear, recorded: true, empty: false };
  }

  /** パイプでつながったコマンドを、前から順に実行する（途中の出力は次のコマンドの stdin になる） */
  private runPipeline(commands: SimpleCommand[]): {
    lines: OutputLine[];
    clear: boolean;
    edit: EditRequest | undefined;
    unmatched: string[];
  } {
    const lines: OutputLine[] = [];
    const unmatched: string[] = [];
    const userExists = (name: string) => {
      const r = lookup(this.state.root, this.state.user, `/home/${name}`);
      return r.ok && isDir(r.node);
    };
    const expand = (text: string, tilde: boolean) =>
      tilde ? expandTilde(text, this.state.home, userExists) : text;

    // 1. 単語を展開する（~ とワイルドカード）。bash と同じく、> で作られるファイルより先に行う。
    const expanded = commands.map((c) =>
      c.words.flatMap((w) => {
        if (!w.glob) return [expand(w.text, w.tilde)];
        const found = expandGlob(this.state, expand(w.pattern, w.tilde));
        if (found.length > 0) return found;
        unmatched.push(w.text);
        return [expand(w.text, w.tilde)];
      }),
    );

    // 2. > と >> は、一番最後のコマンドにだけ付けられる
    const lastIndex = commands.length - 1;
    if (commands.slice(0, lastIndex).some((c) => c.redirects.length > 0)) {
      lines.push(
        error('bash: output redirection (>, >>) is only supported on the last command of a pipeline in this simulator'),
        hint('> や >> は、パイプの一番最後のコマンドにだけ付けられます。例：grep 404 a.log | wc -l > kekka.txt'),
      );
      return { lines, clear: false, edit: undefined, unmatched };
    }

    // 3. 書き込み先を開く。bash と同じく、コマンドの前に行う。開けなければ何も実行しない。
    const targets: { abs: string; op: '>' | '>>'; shown: string }[] = [];
    for (const r of commands[lastIndex]?.redirects ?? []) {
      const shown = expand(r.target, r.tilde); // 書き込み先は、ワイルドカードを展開しない
      const abs = resolvePath(this.state.cwd, shown);
      if (abs !== DEV_NULL) {
        const opened = openRedirectTarget(this.state.root, this.state.user, abs, r.op);
        if (!opened.ok) {
          lines.push(error(`bash: ${shown}: ${ERR_TEXT[opened.code]}`), ...redirectHint(opened.code));
          return { lines, clear: false, edit: undefined, unmatched };
        }
      }
      targets.push({ abs, op: r.op, shown });
    }
    const last = targets[targets.length - 1];

    // 4. 順に実行する
    let clear = false;
    let edit: EditRequest | undefined;
    let stdin: string | undefined;
    expanded.forEach((words, idx) => {
      const isLast = idx === lastIndex;
      const [name, ...args] = words;
      const stage: OutputLine[] = [];
      const def = name === undefined ? undefined : COMMAND_MAP.get(name);
      if (name === undefined) {
        // コマンドがなく、リダイレクトだけ（例：> memo.txt）。ファイルを作る／空にするだけ。
      } else if (def?.name === 'nano' && (last || lastIndex > 0)) {
        stage.push(
          error(`nano: cannot be used with ${lastIndex > 0 ? 'a pipeline' : 'output redirection'}`),
          hint('nano は画面で編集するエディタです。| や > や >> は付けずに、nano ファイル名 だけで使います。'),
        );
      } else if (def) {
        this.state.stdoutFile = isLast && last && last.abs !== DEV_NULL ? last.abs : null;
        this.state.stdoutRedirected = !isLast || last !== undefined;
        try {
          const out = def.run(this.state, args, stdin);
          stage.push(...out.lines);
          // 出力をファイルやパイプに流すときは、画面をクリアしない
          if (isLast) clear = out.clear === true && !last;
          if (isLast) edit = out.edit;
        } finally {
          this.state.stdoutFile = null;
          this.state.stdoutRedirected = false;
        }
      } else {
        stage.push(
          ...unknownCommandOutput(
            name as string,
            COMMANDS.map((c) => c.name),
          ),
        );
      }

      if (!isLast) {
        // 通常の出力（stdout）は次のコマンドへ。エラーとヒント（stderr）は画面に残す。
        stdin = outputToText(stage);
        lines.push(...stage.filter((l) => l.kind !== 'stdout'));
        return;
      }
      // 最後のコマンド: 通常の出力（stdout）はファイルへ。エラーとヒント（stderr）は画面に残す。
      if (last) {
        const text = outputToText(stage);
        const rest = stage.filter((l) => l.kind !== 'stdout');
        if (last.abs !== DEV_NULL) {
          const w = writeRedirectOutput(this.state.root, this.state.user, last.abs, last.op, text);
          if (!w.ok) {
            rest.push(error(`bash: ${last.shown}: ${ERR_TEXT[w.code]}`), ...redirectHint(w.code));
          }
        }
        lines.push(...rest);
      } else {
        lines.push(...stage);
      }
    });
    return { lines, clear, edit, unmatched };
  }

  /** ファイルのアップロード先を確認する（権限と、上書きになるファイルの一覧）。何も書き込まない。 */
  checkUpload(dirPath: string, files: UploadFile[]): UploadCheck {
    return checkUpload(this.state, dirPath, files);
  }

  /**
   * パソコンから読み込んだファイルを、dirPath の下に作る（scp のようなもの）。
   * ターミナルの cp と同じ権限・容量の判定をする。履歴には残らない（コマンドではないため）。
   */
  uploadFiles(dirPath: string, files: UploadFile[], options: UploadOptions = {}): UploadResult {
    return performUpload(this.state, dirPath, files, options);
  }

  /**
   * エディタ（nano）の保存。権限や容量を確認して書き込む。
   * 失敗したときは、画面に表示するメッセージを返す。
   */
  saveFile(
    path: string,
    content: string,
  ): { ok: true; created: boolean } | { ok: false; message: string } {
    const r = saveFileContent(this.state.root, this.state.user, path, content);
    if (r.ok) return r;
    const base = `Error writing ${path}: ${ERR_TEXT[r.code]}`;
    const extra: Partial<Record<typeof r.code, string>> = {
      EACCES: '（このファイル・ディレクトリへの書き込み権限がありません）',
      ENOSPC: '（ファイルが大きすぎるか、ファイルの数が多すぎます）',
      ENOENT: '（保存先のディレクトリがありません）',
    };
    return { ok: false, message: base + (extra[r.code] ?? '') };
  }

  /**
   * ファイルの内容を取り出す（ダウンロード用）。ターミナルの cat と同じく、読み取り権限を確認する。
   * 履歴には残らない（コマンドではないため）。
   */
  readFile(path: string): { ok: true; name: string; content: string } | { ok: false; message: string } {
    const r = lookup(this.state.root, this.state.user, path);
    if (!r.ok) return { ok: false, message: `${path}: ${ERR_TEXT[r.code]}` };
    if (isDir(r.node)) return { ok: false, message: `${path}: ${ERR_TEXT.EISDIR}` };
    if (!canAccess(r.node, this.state.user, 'r')) {
      return { ok: false, message: `${path}: ${ERR_TEXT.EACCES}` };
    }
    return { ok: true, name: r.node.name, content: r.node.content };
  }

  /** Tab補完 */
  complete(line: string): CompletionResult {
    return completeLine(
      this.state,
      COMMANDS.map((c) => c.name),
      line,
    );
  }

  /** 保存・課題判定・書き出しに使える最終状態（コピーを返す） */
  snapshot(): ShellSnapshot {
    return {
      version: 1,
      envId: this.env.id,
      cwd: this.state.cwd,
      fs: cloneNode(this.state.root),
      history: [...this._history],
    };
  }
}
