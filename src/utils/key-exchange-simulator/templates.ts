// 自由モード課題の「テンプレートJSON」（初期配置）。
// 手書きではなくエンジン（KeyLab）で組み立てて toJSON() で出力する。
// 生徒はこれをダウンロードして、シミュレータの「📁 読込」で開く。
import { PERSON_COLORS } from './engine/constants.ts';
import { KeyLab } from './engine/world.ts';

/** 3人で共有鍵を作る課題（key-exchange-three）の初期配置 */
export function buildThreePersonTemplate(): Record<string, unknown> {
  const w = new KeyLab({ size: { w: 1100, h: 520 } });
  w.reset('free');
  // 座標は固定。読み込み時、シミュレータは左パネルが開いた幅（1280px画面で約990px）に合わせて位置を詰める。
  // そこで、一番右の人物も x ≤ 890 に収まり、吹き出し（幅260）を全員ぶん開いても重ならない間隔にしている。
  const X0 = 86; // 左端の吹き出しが画面端に押されない位置
  const STEP = 266; // 吹き出しの幅 + 6px
  const TOP = 40, BOTTOM = 376;
  const person = (n: number, name: string, initial: string, col: number) =>
    w.makeDevice('person', X0 + STEP * col, TOP, {
      id: `person-00${n}`, name, initial, color: PERSON_COLORS[n - 1], machines: ['combine'],
    });
  const a = person(1, 'アリス', 'A', 0);
  w.makeDevice('internet', X0 + STEP, TOP, { id: 'internet-001' });
  const b = person(2, 'ボブ', 'B', 2);
  const c = person(3, 'キャロル', 'C', 3);
  w.makeDevice('eve', X0 + STEP, BOTTOM, { id: 'eve-001', machines: ['combine'], mitm: false });
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
