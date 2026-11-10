import { KeyLab } from '../engine/world.ts';
import type { Item, ItemKind } from '../engine/types.ts';
import { sameParts } from '../engine/items.ts';

/** 乱数を固定したシミュレータ（テストを毎回同じ結果にする） */
export function newLab(): KeyLab {
  let n = 0;
  return new KeyLab({ size: { w: 1200, h: 640 }, rng: () => ((n = (n * 7 + 3) % 97) / 97), now: () => new Date('2026-11-10T02:30:00.000Z') });
}

export function find(w: KeyLab, id: string, kind: ItemKind, f: (i: any) => boolean = () => true): Item {
  const it = w.dev(id)?.items.find((i) => i.kind === kind && f(i));
  if (!it) throw new Error(`${id} に ${kind} がありません`);
  return it;
}

export function block(w: KeyLab, id: string, parts: string[]): Item {
  const it = w.dev(id)?.items.find((i) => i.kind === 'block' && sameParts(i.parts, parts));
  if (!it) throw new Error(`${id} に block ${parts.join('+')} がありません`);
  return it;
}

export const has = (w: KeyLab, id: string, kind: ItemKind, f: (i: any) => boolean = () => true): boolean =>
  !!w.dev(id)?.items.some((i) => i.kind === kind && f(i));
