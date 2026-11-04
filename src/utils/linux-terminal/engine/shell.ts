import type {
  CompletionResult,
  DirNode,
  Environment,
  ExecResult,
  OutputLine,
  ShellSnapshot,
  ShellState,
} from './types.ts';
import { COMMAND_MAP, COMMANDS } from './commands.ts';
import { completeLine } from './complete.ts';
import { cloneNode, isDir, lookup } from './fs.ts';
import { expandTilde } from './path.ts';
import { error, hint } from './output.ts';
import { FULLWIDTH_HINT, hasFullwidth, unknownCommandOutput } from './hints.ts';
import { tokenize } from './tokenizer.ts';
import type { Problem } from './tokenizer.ts';

export const MAX_HISTORY = 1000;

export interface RestoredState {
  cwd: string;
  root: DirNode;
  history: string[];
}

const PROBLEM_HINTS: Record<string, string> = {
  '|': 'パイプ（|）は、このシミュレーターではまだ使えません。コマンドは1つずつ実行しましょう。',
  '>': 'リダイレクト（>）は、このシミュレーターではまだ使えません。',
  '>>': 'リダイレクト（>>）は、このシミュレーターではまだ使えません。',
  '<': 'リダイレクト（<）は、このシミュレーターではまだ使えません。',
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
    case 'glob':
      return [
        error(`bash: wildcard '${p.token}' is not supported in this simulator`),
        hint('ワイルドカード（* や ?）は、このシミュレーターではまだ使えません。名前をそのまま入力しましょう。'),
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
    this.state = {
      user: env.user,
      hostname: env.hostname,
      home: env.home,
      cwd: restored ? restored.cwd : env.cwd,
      root: cloneNode(restored ? restored.root : env.root),
    };
    this._history = restored ? [...restored.history] : [];
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
    const tok = tokenize(line);
    if (!tok.ok) {
      lines.push(...problemOutput(tok.problem));
    } else if (tok.words.length > 0) {
      const userExists = (name: string) => {
        const r = lookup(this.state.root, this.state.user, `/home/${name}`);
        return r.ok && isDir(r.node);
      };
      const words = tok.words.map((w) =>
        w.tilde ? expandTilde(w.text, this.state.home, userExists) : w.text,
      );
      const [name, ...args] = words as [string, ...string[]];
      const def = COMMAND_MAP.get(name);
      if (def) {
        const out = def.run(this.state, args);
        lines.push(...out.lines);
        clear = out.clear === true;
      } else {
        lines.push(
          ...unknownCommandOutput(
            name,
            COMMANDS.map((c) => c.name),
          ),
        );
      }
    }

    const failed = lines.some((l) => l.kind === 'error');
    if (failed) {
      const alreadyHinted = lines.includes(FULLWIDTH_HINT);
      if (hasFullwidth(line) && !alreadyHinted) lines.push(FULLWIDTH_HINT);
      if (/\\[^ \t"'\\$`]/.test(line)) {
        lines.push(hint('Linux ではパスの区切りに / を使います。Windows の \\ ではありません。'));
      }
    }
    return { lines, clear, recorded: true, empty: false };
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
