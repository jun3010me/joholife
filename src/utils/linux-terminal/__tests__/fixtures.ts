import { Shell } from '../engine/shell.ts';
import { createDefaultEnvironment } from '../environments/default.ts';
import type { DirNode, FsNode } from '../engine/types.ts';

/** ログ調査とお片付けの実習を想定した環境（テスト用。課題専用の機能ではなく、ただのファイル群） */
const S = 'student';
const f = (name: string, content: string, owner = S, mode = 0o644): FsNode => ({ type: 'file', name, owner, mode, content });
const d = (name: string, children: FsNode[] = [], owner = S, mode = 0o755): DirNode => ({ type: 'dir', name, owner, mode, children });

/** Apache 形式のログ 300 行 */
export function makeAccessLog(): string {
  const ips = ['192.168.0.12', '192.168.0.12', '192.168.0.34', '10.0.0.5', '172.16.1.9'];
  const paths = ['/index.html', '/about.html', '/admin/login', '/img/logo.png', '/css/style.css'];
  const lines: string[] = [];
  for (let i = 0; i < 300; i++) {
    const ip = ips[i % ips.length] as string;
    const path = paths[i % paths.length] as string;
    const status = i % 30 === 7 ? 404 : i % 100 === 50 ? 500 : 200;
    const sec = String(i % 60).padStart(2, '0');
    lines.push(`${ip} - - [10/Nov/2026:09:01:${sec} +0900] "GET ${path} HTTP/1.1" ${status} ${5120 + i}`);
  }
  return lines.join('\n') + '\n';
}

export function createLogEnvironment() {
  const env = createDefaultEnvironment();
  const home = (env.root.children.find((c) => c.name === 'home') as DirNode).children.find(
    (c) => c.name === S,
  ) as DirNode;
  home.children.push(
    d('server', [
      d('logs', [
        f('access.log', makeAccessLog()),
        f('error.log', '[error] disk almost full\n[warn] slow query\n[Error] failed to open\n'),
      ]),
      d('inbox', [
        f('a.jpg', 'jpg-a\n'),
        f('b.jpg', 'jpg-b\n'),
        f('c.png', 'png-c\n'),
        f('report_1.txt', 'r1\n'),
        f('report_2.txt', 'r2\n'),
        f('memo.txt', 'memo\n'),
        f('data_01.csv', '1,2\n'),
        f('data_02.csv', '3,4\n'),
        f('data_100.csv', '5,6\n'),
        f('cache.tmp', 'x\n'),
        f('swap.tmp', 'y\n'),
        f('.hidden.jpg', 'hidden\n'),
      ]),
    ]),
    d('photos'),
    d('docs'),
  );
  return env;
}

export const newLogShell = (): Shell => new Shell(createLogEnvironment());
