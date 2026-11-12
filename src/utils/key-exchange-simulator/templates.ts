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

/** 中間者攻撃を成功させる課題（key-exchange-mitm）の初期配置 */
export function buildMitmTemplate(): Record<string, unknown> {
  const w = new KeyLab({ size: { w: 1100, h: 520 } });
  w.reset('free');
  // 3列（アリス｜インターネット｜ボブ）。吹き出し（幅260）を全員ぶん開いても重ならない間隔にする
  // イブは下の段。持ち物が多くなるので、吹き出しが上向きに開いたとき高さを確保できるよう、下寄りに置く
  const X0 = 86, STEP = 266, TOP = 40, BOTTOM = 430;
  const a = w.makeDevice('person', X0, TOP, { id: 'person-001', name: 'アリス', initial: 'A', color: PERSON_COLORS[0], machines: ['combine'] });
  w.makeDevice('internet', X0 + STEP, TOP, { id: 'internet-001' });
  const b = w.makeDevice('person', X0 + STEP * 2, TOP, { id: 'person-002', name: 'ボブ', initial: 'B', color: PERSON_COLORS[1], machines: ['combine'] });
  // イブは「中間者」：通るものを横取りし、相手には届かない
  const e = w.makeDevice('eve', X0 + STEP, BOTTOM, { id: 'eve-001', initial: 'E', machines: ['combine'], mitm: true });
  for (const id of ['person-001', 'person-002', 'eve-001']) w.connect(id, 'internet-001', true);
  w.give(a, { kind: 'block', parts: ['P'] });
  w.give(a, { kind: 'block', parts: ['S:person-001'] });
  w.give(b, { kind: 'block', parts: ['S:person-002'] });
  w.give(e, { kind: 'block', parts: ['S:eve-001'] });
  return JSON.parse(JSON.stringify(w.toJSON()));
}

/** 盗み見た返事を使い回す課題（key-exchange-replay）の初期配置。スマホは yamazon.com にパスキー登録ずみ */
export function buildReplayTemplate(): Record<string, unknown> {
  const w = new KeyLab({ size: { w: 1100, h: 520 } });
  w.reset('free');
  // 3列（スマホ｜インターネット｜Webサイト）、イブは下の段。イブは「盗み見」だけ（中間者ではない）
  const X0 = 86, STEP = 266, TOP = 40, BOTTOM = 376;
  const ph = w.makeDevice('phone', X0, TOP, { id: 'phone-001', name: 'スマホ' });
  w.makeDevice('internet', X0 + STEP, TOP, { id: 'internet-001' });
  const sv = w.makeDevice('server', X0 + STEP * 2, TOP, { id: 'server-001', name: 'Webサイト', site: 'yamazon.com', machines: ['challenge', 'verify'] });
  w.makeDevice('eve', X0 + STEP, BOTTOM, { id: 'eve-001', machines: [], mitm: false });
  for (const id of ['phone-001', 'server-001', 'eve-001']) w.connect(id, 'internet-001', true);
  w.give(ph, { kind: 'privkey', pair: 'pk-reg', site: 'yamazon.com', owner: 'phone-001' });
  w.give(sv, { kind: 'pubkey', pair: 'pk-reg', site: 'yamazon.com' }, true);
  return JSON.parse(JSON.stringify(w.toJSON()));
}

/** 課題⑩の元の文書（アリスがボブに送る） */
export const SWAP_DOC_TEXT = 'ボブに1,000円払います';

/** 公開鍵をすり替える課題（key-exchange-swap）の初期配置。受け取った鍵の持ち主名は伏せる */
export function buildSwapTemplate(): Record<string, unknown> {
  const w = new KeyLab({ size: { w: 1100, h: 520 } });
  w.reset('free');
  // ⑦と同じ並び。イブは中間者で、鍵ペア作成・書き換え・署名ができる。持ち物が多くなるので下寄りに置く
  const X0 = 86, STEP = 266, TOP = 40, BOTTOM = 430;
  const a = w.makeDevice('person', X0, TOP, { id: 'person-001', name: 'アリス', initial: 'A', color: PERSON_COLORS[0], machines: ['docsign'] });
  w.makeDevice('internet', X0 + STEP, TOP, { id: 'internet-001' });
  w.makeDevice('person', X0 + STEP * 2, TOP, { id: 'person-002', name: 'ボブ', initial: 'B', color: PERSON_COLORS[1], machines: ['docverify'] });
  w.makeDevice('eve', X0 + STEP, BOTTOM, { id: 'eve-001', initial: 'E', machines: ['keymake', 'tamper', 'docsign'], mitm: true });
  for (const id of ['person-001', 'person-002', 'eve-001']) w.connect(id, 'internet-001', true);
  w.give(a, { kind: 'privkey', pair: 'pk-alice', site: 'アリス', owner: 'person-001' });
  w.give(a, { kind: 'pubkey', pair: 'pk-alice', site: 'アリス' });
  w.give(a, { kind: 'doc', text: SWAP_DOC_TEXT });
  w.flags.hideKeyOwner = true;
  return JSON.parse(JSON.stringify(w.toJSON()));
}

/** 課題ごとのテンプレート（単元ID → 作る関数）。ファイル名もここで決める */
export const FREE_TEMPLATES: Record<string, { fileName: string; build: () => Record<string, unknown> }> = {
  'key-exchange-three': { fileName: 'key-exchange-three-template.json', build: buildThreePersonTemplate },
  'key-exchange-mitm': { fileName: 'key-exchange-mitm-template.json', build: buildMitmTemplate },
  // ⑧は⑥と同じ初期配置（条件だけが違う）
  'key-exchange-three-min': { fileName: 'key-exchange-three-min-template.json', build: buildThreePersonTemplate },
  'key-exchange-replay': { fileName: 'key-exchange-replay-template.json', build: buildReplayTemplate },
  'key-exchange-swap': { fileName: 'key-exchange-swap-template.json', build: buildSwapTemplate },
};
