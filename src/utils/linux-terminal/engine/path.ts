/** パス文字列の処理（仮想ファイルシステム用。区切りは常に "/"） */

/** 絶対パスを正規化する。`.` と `..` を解決し、`/` より上には行かない。 */
export function normalizePath(abs: string): string {
  const out: string[] = [];
  for (const seg of abs.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return '/' + out.join('/');
}

/** 現在地 cwd を基準に、入力されたパスを正規化された絶対パスにする。 */
export function resolvePath(cwd: string, input: string): string {
  return normalizePath(input.startsWith('/') ? input : `${cwd}/${input}`);
}

export function segmentsOf(abs: string): string[] {
  return abs.split('/').filter((s) => s !== '');
}

export function parentPath(abs: string): string {
  const segs = segmentsOf(abs);
  segs.pop();
  return '/' + segs.join('/');
}

export function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`;
}

/**
 * bash と同じく、単語の先頭の ~ をホームディレクトリに展開する。
 * `~` / `~/x` は自分のホーム、`~name` は /home/name（存在するときだけ）。
 */
export function expandTilde(
  word: string,
  home: string,
  userExists: (name: string) => boolean,
): string {
  if (!word.startsWith('~')) return word;
  const slash = word.indexOf('/');
  const name = slash === -1 ? word.slice(1) : word.slice(1, slash);
  const rest = slash === -1 ? '' : word.slice(slash);
  if (name === '') return home + rest;
  if (userExists(name)) return `/home/${name}${rest}`;
  return word;
}
