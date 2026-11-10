// 問題演習の提出ファイルの判定（UI非依存）。
// 保存JSONを読み直して、手順の達成を再判定し、操作ログに証拠が残っているかも確かめる。
// ブラウザ内で作られるJSONなので、手作業の改ざんを完全には防げない（HANDOFFの前提どおり）。
import { KeyLab } from './engine/world.ts';
import type { LogEntry } from './engine/types.ts';
import { SCENARIOS } from './scenarios/index.ts';

export interface SubmissionResult {
  valid: boolean;
  message: string;
}

const bad = (message: string): SubmissionResult => ({ valid: false, message });
const count = (log: LogEntry[], action: string, f: (e: LogEntry) => boolean = () => true) =>
  log.filter((e) => e.action === action && f(e)).length;

/** シナリオごとに、操作ログにあるべき証拠。足りなければ理由を返す */
const EVIDENCE: Record<string, (log: LogEntry[]) => string | null> = {
  dh: (log) =>
    count(log, 'combine') < 5 || count(log, 'combine', (e) => e.device === 'eve-001') < 1
      ? '合成の操作ログが足りません。自分の操作で最後まで進めたファイルを提出してください。' : null,
  passkey: (log) =>
    count(log, 'keygen') < 1 || count(log, 'sign') < 1 || count(log, 'verify', (e) => e.result === 'success') < 1
      ? '鍵ペア生成・署名・検証の操作ログが足りません。' : null,
  phish: (log) =>
    count(log, 'sign-refused') < 1 || count(log, 'verify', (e) => e.result === 'success') < 1
      ? '偽サイトでの署名拒否と、本物のサイトでのログインの操作ログが足りません。' : null,
  sig: (log) =>
    count(log, 'docsign') < 1 || count(log, 'tamper') < 1 ||
    count(log, 'docverify', (e) => e.result === 'invalid') < 1 || count(log, 'docverify', (e) => e.result === 'valid') < 1
      ? '署名・書き換え・検証（改ざん検出と本物の確認）の操作ログが足りません。' : null,
  cert: (log) =>
    count(log, 'issue') < 1 || count(log, 'certcheck', (e) => e.result === 'valid') < 1 ||
    count(log, 'certcheck', (e) => e.result === 'invalid') < 1
      ? '証明書の発行と、本物・偽物の確認の操作ログが足りません。' : null,
};

export function validateSubmission(data: any, scenarioId: string): SubmissionResult {
  const expected = SCENARIOS[scenarioId];
  if (!expected) return bad('課題の設定が見つかりません。');
  if (!data || typeof data !== 'object' || data.simulator !== 'key-exchange') {
    return bad('鍵交換シミュレータの保存ファイルではありません。シミュレータの「保存」で出力したJSONを提出してください。');
  }
  if (data.mode !== 'scenario' || !data.scenario) {
    return bad('シナリオモードで保存したファイルではありません。自由モードのファイルは提出できません。');
  }
  if (data.scenario.id !== scenarioId) {
    const other = SCENARIOS[data.scenario.id]?.title ?? String(data.scenario.id);
    return bad(`このファイルは「${other}」のシナリオです。この課題は「${expected.title}」のシナリオを提出してください。`);
  }
  const lab = new KeyLab();
  try {
    lab.load(data);
  } catch (e) {
    return bad('ファイルを読み込めませんでした：' + (e as Error).message);
  }
  if (data.scenario.failed || expected.fail(lab)) {
    return bad('このシナリオは失敗した状態です。「クリア」で最初からやり直して、完了したものを提出してください。');
  }
  const todo = lab.scenario!.steps.find((s) => !s.done);
  if (todo) return bad(`まだ達成していない手順があります：「${todo.text}」`);
  if (data.scenario.completed !== true) {
    return bad('シナリオが完了になっていません。すべての手順を達成してから保存してください。');
  }
  const missing = EVIDENCE[scenarioId]?.(lab.log);
  if (missing) return bad(missing);
  return { valid: true, message: `「${expected.title}」のすべての手順を達成しています。` };
}
