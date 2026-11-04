import type { Environment } from '../engine/types.ts';
import { createDefaultEnvironment } from './default.ts';

/** 環境（章）の一覧。新しい章の環境は、ここに作成関数を追加する。 */
const FACTORIES: Record<string, () => Environment> = {
  default: createDefaultEnvironment,
};

export const DEFAULT_ENVIRONMENT_ID = 'default';

export function getEnvironment(id: string): Environment | undefined {
  return Object.hasOwn(FACTORIES, id) ? FACTORIES[id]?.() : undefined;
}

export { createDefaultEnvironment };
