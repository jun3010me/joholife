// 自由モード課題の「テンプレートJSON」（初期配置）。
// 手書きではなくエンジン（KeyLab）で組み立てて toJSON() で出力する。
// 生徒はこれをダウンロードして、シミュレータの「📁 読込」で開く。
import { PERSON_COLORS } from './engine/constants.ts';
import { KeyLab } from './engine/world.ts';

/** 3人で共有鍵を作る課題（key-exchange-three）の初期配置 */
export function buildThreePersonTemplate(): Record<string, unknown> {
  // 読み込み時にキャンバス内へ収まるので、固定サイズで作ってよい
  const w = new KeyLab({ size: { w: 1000, h: 520 } });
  w.reset('free');
  const person = (n: number, name: string, initial: string, k: number) =>
    w.makeDevice('person', ...w.pos(k, 40, 1.5), {
      id: `person-00${n}`, name, initial, color: PERSON_COLORS[n - 1], machines: ['combine'],
    });
  const a = person(1, 'アリス', 'A', -1.5);
  w.makeDevice('internet', ...w.pos(-0.5, 40, 1.5), { id: 'internet-001' });
  const b = person(2, 'ボブ', 'B', 0.5);
  const c = person(3, 'キャロル', 'C', 1.5);
  w.makeDevice('eve', ...w.pos(-0.5, 'b', 1.5), { id: 'eve-001', machines: ['combine'], mitm: false });
  for (const id of ['person-001', 'person-002', 'person-003', 'eve-001']) w.connect(id, 'internet-001', true);
  w.give(a, { kind: 'block', parts: ['P'] });
  w.give(a, { kind: 'block', parts: ['S:person-001'] });
  w.give(b, { kind: 'block', parts: ['S:person-002'] });
  w.give(c, { kind: 'block', parts: ['S:person-003'] });
  return JSON.parse(JSON.stringify(w.toJSON()));
}

/** 課題ごとのテンプレート（単元ID → 作る関数）。ファイル名もここで決める */
export const FREE_TEMPLATES: Record<string, { fileName: string; build: () => Record<string, unknown> }> = {
  'key-exchange-three': { fileName: 'key-exchange-three-template.json', build: buildThreePersonTemplate },
};
