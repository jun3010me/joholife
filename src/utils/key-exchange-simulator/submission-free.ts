// 自由モード課題の提出判定（UI非依存）。シナリオモード用の submission.ts とは別に持つ。
// ブラウザ内で作られるJSONなので、手作業の改ざんを完全には防げない（既存の判定と同じ前提）。
import { isSecret, sameParts } from './engine/items.ts';
import type { ItemData, LogEntry } from './engine/types.ts';
import { KeyLab } from './engine/world.ts';
import { buildThreePersonTemplate } from './templates.ts';
import type { SubmissionResult } from './submission.ts';

interface FreeTaskSpec {
  title: string;
  template: () => Record<string, unknown>;
  /** 全員が持つべき共有鍵の中身 */
  finalParts: string[];
  /** 共有鍵を作る人のID */
  members: string[];
  /** 持っていてはいけない人のID */
  outsider: string;
}

const FREE_TASKS: Record<string, FreeTaskSpec> = {
  'key-exchange-three': {
    title: '鍵交換課題⑥3人で共有鍵を作る',
    template: buildThreePersonTemplate,
    finalParts: ['P', 'S:person-001', 'S:person-002', 'S:person-003'],
    members: ['person-001', 'person-002', 'person-003'],
    outsider: 'eve-001',
  },
};

const bad = (message: string): SubmissionResult => ({ valid: false, message });
const asLog = (x: unknown): LogEntry[] => (Array.isArray(x) ? (x as LogEntry[]) : []);
const connKey = (c: any): string => [c?.from?.deviceId, c?.to?.deviceId].sort().join('~');

export function validateFreeSubmission(data: any, taskId: string): SubmissionResult {
  const spec = FREE_TASKS[taskId];
  if (!spec) return bad('課題の設定が見つかりません。');
  if (!data || typeof data !== 'object' || data.simulator !== 'key-exchange') {
    return bad('鍵交換シミュレータの保存ファイルではありません。シミュレータの「保存」で出力したJSONを提出してください。');
  }
  if (data.mode !== 'free' || data.scenario) {
    return bad('自由モードで保存したファイルではありません。課題ページの「テンプレートJSON」を読み込んで、自由モードのまま作業してください。');
  }
  const lab = new KeyLab();
  try {
    lab.load(data);
  } catch (e) {
    return bad('ファイルを読み込めませんでした：' + (e as Error).message);
  }

  // b. デバイスの構成がテンプレートと同じか（追加・削除・つなぎ替えがない）
  const tpl = new KeyLab();
  tpl.load(spec.template());
  const sameIds = lab.devices.length === tpl.devices.length &&
    tpl.devices.every((t) => lab.dev(t.id)?.type === t.type);
  if (!sameIds) {
    return bad('デバイスの構成がテンプレートと違います。デバイスを追加・削除せず、テンプレートのまま作業してください。');
  }
  const tplConn = tpl.connections.map(connKey).sort().join('|');
  if (lab.connections.map(connKey).sort().join('|') !== tplConn) {
    return bad('つながりがテンプレートと違います。つなぎ替えずに作業してください。');
  }
  const log = lab.log;
  if (log.some((e) => e.action === 'add-device' || e.action === 'remove-device')) {
    return bad('デバイスを追加・削除した記録があります。テンプレートのまま作業してください。');
  }
  if (log.some((e) => e.action === 'add-item')) {
    return bad('持ち物を手で足した記録があります。最初の持ち物だけで作業してください。');
  }

  // e. 通信路に流してはいけないもの
  const sent = log.filter((e) => (e.action === 'send' || e.action === 'intercept') && e.item);
  if (sent.some((e) => isSecret(e.item as ItemData))) {
    return bad('秘密の素材だけの鍵を、通信路に流してしまっています。テンプレートを読み込み直して、やり直しましょう。');
  }
  if (sent.some((e) => {
    const it = e.item as ItemData;
    return it.kind === 'block' && sameParts(it.parts, spec.finalParts);
  })) {
    return bad('共有鍵そのものを、通信路に流してしまっています。共有鍵は、通信路に出さずに作るものです。');
  }

  // c. 3人全員が共有鍵を持っているか
  const holds = (id: string) => (lab.dev(id)?.items ?? []).some((i) => i.kind === 'block' && sameParts(i.parts, spec.finalParts));
  const lack = spec.members.filter((id) => !holds(id));
  if (lack.length) {
    return bad(`${lack.map((id) => lab.dev(id)?.name ?? id).join('・')}がまだ共有鍵を持っていません。`);
  }

  // d. イブが共有鍵を持っていないか
  if (holds(spec.outsider)) {
    return bad(`${lab.dev(spec.outsider)?.name ?? 'イブ'}も共有鍵を持っています。盗み見されても作られないように、何を送るかを見直しましょう。`);
  }

  // f. 3人それぞれが、自分で共有鍵を合成した記録があるか
  const noLog = spec.members.filter((id) => !log.some((e) =>
    e.action === 'combine' && e.device === id && Array.isArray(e.result) && sameParts(e.result as string[], spec.finalParts)));
  if (noLog.length) {
    return bad(`操作ログに、${noLog.map((id) => lab.dev(id)?.name ?? id).join('・')}が共有鍵を合成した記録がありません。自分の操作で最後まで進めたファイルを提出してください。`);
  }
  return { valid: true, message: `「${spec.title}」：3人が同じ共有鍵を作り、イブには作れない状態になっています。` };
}

/** 自由モード課題のID一覧（提出画面が判定を切り替えるために使う） */
export const isFreeTask = (taskId: string): boolean => taskId in FREE_TASKS;
