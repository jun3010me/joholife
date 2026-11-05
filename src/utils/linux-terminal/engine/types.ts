/**
 * Linuxターミナルシミュレーター：エンジンの型定義
 *
 * エンジンはReactやブラウザAPIに依存しない（単体テストできる）。
 */

export interface FileNode {
  type: 'file';
  name: string;
  owner: string;
  /** パーミッション（8進数, 例: 0o644）。グループは other と同じ扱い */
  mode: number;
  content: string;
}

export interface DirNode {
  type: 'dir';
  /** ルートだけ空文字 */
  name: string;
  owner: string;
  mode: number;
  children: FsNode[];
}

export type FsNode = FileNode | DirNode;

/**
 * 初期環境の定義。章ごとに別の Environment を用意すれば、
 * 初期ファイルと現在地を切り替えられる。
 */
export interface Environment {
  id: string;
  title: string;
  user: string;
  hostname: string;
  home: string;
  /** 開始時の現在地（絶対パス） */
  cwd: string;
  root: DirNode;
  /** 起動時に表示するメッセージ */
  welcome: string[];
}

export type OutputKind = 'stdout' | 'error' | 'hint' | 'info';

export interface OutputSpan {
  text: string;
  style?: 'dir';
}

export interface OutputLine {
  kind: OutputKind;
  text: string;
  /** 色分けが必要な行だけ使う（text と同じ文字列になる） */
  spans?: OutputSpan[];
}

/** エディタ（nano）を開く依頼。画面側がエディタを表示し、保存時に shell.saveFile を呼ぶ */
export interface EditRequest {
  /** 絶対パス */
  path: string;
  /** 入力されたままのファイル名（表示用） */
  displayName: string;
  content: string;
  /** まだ存在しないファイルを新規作成するか */
  isNew: boolean;
  /** 書き込み権限がない（保存できない） */
  readOnly: boolean;
}

export interface CommandOutput {
  lines: OutputLine[];
  clear?: boolean;
  edit?: EditRequest;
}

export interface ExecResult {
  lines: OutputLine[];
  /** true なら画面をクリアする */
  clear: boolean;
  /** コマンド履歴に記録されたか（空入力は false） */
  recorded: boolean;
  /** 実行前に空入力と判定されたか */
  empty: boolean;
  /** エディタを開く場合の依頼 */
  edit?: EditRequest;
}

export interface CompletionResult {
  /** 補完後の入力行 */
  line: string;
  /** 候補が複数あるときの一覧（表示用） */
  candidates: string[];
}

/** 保存・課題判定・書き出しに使う、シェルの最終状態 */
export interface ShellSnapshot {
  version: 1;
  envId: string;
  cwd: string;
  fs: DirNode;
  history: string[];
}

/** コマンドが読み書きするシェルの状態 */
export interface ShellState {
  user: string;
  hostname: string;
  home: string;
  cwd: string;
  root: DirNode;
  /** コマンド履歴（Shell と同じ配列。実行中のコマンド自身も含む）。コマンドからは読み取り専用で使う */
  history: readonly string[];
  /** 出力のリダイレクト先（絶対パス）。画面に出力するときは null */
  stdoutFile: string | null;
}

export interface CommandDef {
  name: string;
  summary: string;
  usage: string;
  details: string[];
  run: (state: ShellState, args: string[]) => CommandOutput;
}
