import type { DirNode, Environment, FileNode, FsNode } from '../engine/types.ts';

/**
 * 初期環境データ（章ごとに別の Environment を追加できる）
 * 毎回新しいオブジェクトを返すので、呼び出し側が書き換えても他に影響しない。
 */

const dir = (name: string, children: FsNode[] = [], owner = 'root', mode = 0o755): DirNode => ({
  type: 'dir',
  name,
  owner,
  mode,
  children,
});

const file = (name: string, content: string, owner = 'root', mode = 0o644): FileNode => ({
  type: 'file',
  name,
  owner,
  mode,
  content,
});

const S = 'student';

export function createDefaultEnvironment(): Environment {
  const root = dir('', [
    dir('bin'),
    dir('boot'),
    dir('etc', [
      file('hostname', 'joho\n'),
      file(
        'os-release',
        'NAME="Ubuntu"\nVERSION="22.04 LTS (Jammy Jellyfish)"\nID=ubuntu\nPRETTY_NAME="Ubuntu 22.04 LTS"\n',
      ),
      file(
        'passwd',
        'root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:student:/home/student:/bin/bash\nteacher:x:1001:1001:teacher:/home/teacher:/bin/bash\n',
      ),
      file('shadow', 'root:*:19000:0:99999:7:::\nstudent:*:19000:0:99999:7:::\n', 'root', 0o640),
    ]),
    dir('home', [
      dir(
        'student',
        [
          file(
            '.bashrc',
            '# これは隠しファイルです。ls -a で表示できます。\nalias ll="ls -l"\n',
            S,
          ),
          file('.profile', '# ログイン時に読み込まれる設定ファイルです。\n', S),
          file(
            'README.txt',
            'ようこそ！ここは student さんのホームディレクトリです。\n' +
              'まずは ls と入力して、ここにあるものを見てみましょう。\n',
            S,
          ),
          dir(
            'Documents',
            [
              file('memo.txt', '今日の授業メモ\n- ディレクトリは「フォルダ」のこと\n- cd で移動する\n', S),
              file('todo.txt', '1. ls を使う\n2. cd で移動する\n3. mkdir でディレクトリを作る\n', S),
            ],
            S,
          ),
          dir('Downloads', [file('readme.txt', 'ダウンロードしたファイルがここに入ります。\n', S)], S),
          dir('Pictures', [file('list.txt', 'photo1.png\nphoto2.png\nphoto3.png\n', S)], S),
          dir(
            'practice',
            [
              file('hello.txt', 'Hello, Linux!\n', S),
              file('memo.txt', 'これは小文字の memo.txt です。\n', S),
              file('Memo.txt', 'これは大文字で始まる Memo.txt です。別のファイルです。\n', S),
              dir(
                'sample',
                [
                  file('a.txt', 'ファイル a です。\n', S),
                  file('b.txt', 'ファイル b です。\n', S),
                  dir('deep', [file('secret.txt', 'ここまでたどり着けましたね！\n', S)], S),
                ],
                S,
              ),
            ],
            S,
          ),
        ],
        S,
        0o755,
      ),
      dir(
        'teacher',
        [
          file('grades.txt', '成績表（先生用）\n', 'teacher', 0o600),
          dir('private', [file('note.txt', '先生のメモ\n', 'teacher', 0o600)], 'teacher', 0o700),
        ],
        'teacher',
        0o700,
      ),
    ]),
    dir('tmp', [], 'root', 0o777),
    dir('usr', [dir('bin'), dir('share')]),
    dir('var', [dir('log')]),
  ]);

  return {
    id: 'default',
    title: '自由に練習',
    user: S,
    hostname: 'joho',
    home: '/home/student',
    cwd: '/home/student',
    root,
    welcome: [
      'じょうほうらいふ Linuxターミナル（練習用シミュレーター）へようこそ！',
      'ここでの操作は、あなたのパソコンには影響しません。安心して試してください。',
      '使えるコマンドは help と入力すると確認できます。まずは ls と入力してみましょう。',
    ],
  };
}
