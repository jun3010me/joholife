import type { Device, Item, ItemData } from './types.ts';

/** 文書の中身から作る簡易ハッシュ（署名と結びつける用） */
export const hash = (s: string): number =>
  [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** 暗号文の見た目用：元の文から決まる、読めない記号の並び（同じ文なら毎回同じ） */
export function garble(s: string, len = 10): string {
  const chars = '#%@*?$+=~§';
  let h = hash(s), o = '';
  for (let k = 0; k < len; k++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; o += chars[(h >>> 16) % chars.length]; }
  return o;
}

/** 同じ中身かどうかの判定キー（重複を1つにまとめる） */
export function itemKey(i: ItemData): string {
  switch (i.kind) {
    case 'block': return 'b:' + i.parts.join('|');
    case 'challenge': return 'c:' + i.cid;
    case 'privkey': return 'k:' + i.pair;
    case 'pubkey': return 'p:' + i.pair;
    case 'sig': return 's:' + i.pair + ':' + i.cid;
    case 'doc': return 'd:' + i.text + ':' + (i.sig ? i.sig.pair + i.sig.h : '');
    case 'cert': return 'z:' + i.subject + ':' + i.pair + ':' + i.caPair;
    case 'symkey': return 'y:' + i.kid;
    case 'cipher': return 'x:' + i.lock.type + ':' + (i.lock.type === 'sym' ? i.lock.kid : i.lock.pair) + ':' + (i.key ? 'key:' + i.key : i.text);
  }
}

/** 通信で運ばれる中身（uid・受信・使用済みを除いたコピー） */
export function payload(i: Item): ItemData {
  const { uid: _u, recv: _r, used: _used, ...rest } = i;
  return JSON.parse(JSON.stringify(rest)) as ItemData;
}

/** 送ってはいけないもの：秘密鍵・共通鍵、または P を含まない（秘密素材だけの）block */
export const isSecret = (i: ItemData): boolean =>
  i.kind === 'privkey' || i.kind === 'symkey' || (i.kind === 'block' && i.parts.some((p) => p !== 'P') && !i.parts.includes('P'));

export const sameParts = (a: string[], b: string[]): boolean =>
  [...a].sort().join('|') === [...b].sort().join('|');

/** 持ち物を渡す（同じものがあれば recv だけ更新して1つにまとめる） */
export function giveItem(d: Device, data: ItemData, recv: boolean, nextUid: () => number): Item {
  let src: ItemData = data;
  if (src.kind === 'block') src = { ...src, parts: [...src.parts].sort() };
  const k = itemKey(src);
  const hit = d.items.find((x) => itemKey(x) === k);
  if (hit) {
    if (recv) hit.recv = true;
    return hit;
  }
  const it = { ...(JSON.parse(JSON.stringify(src)) as ItemData), uid: nextUid(), recv } as Item;
  d.items.push(it);
  return it;
}
