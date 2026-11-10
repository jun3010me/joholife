import { sameParts } from '../engine/items.ts';
import type { KeyLab } from '../engine/world.ts';
import type { Item } from '../engine/types.ts';

export const hasBlock = (w: KeyLab, id: string, parts: string[]): boolean =>
  (w.dev(id)?.items ?? []).some((i) => i.kind === 'block' && sameParts(i.parts, parts));

export const hasKind = <K extends Item['kind']>(
  w: KeyLab, id: string, kind: K, f: (i: Extract<Item, { kind: K }>) => boolean = () => true,
): boolean => (w.dev(id)?.items ?? []).some((i) => i.kind === kind && f(i as Extract<Item, { kind: K }>));
