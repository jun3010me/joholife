import type { Scenario } from '../engine/scenario.ts';
import { cert } from './cert.ts';
import { dh } from './dh.ts';
import { passkey } from './passkey.ts';
import { phish } from './phish.ts';
import { sig } from './sig.ts';

/** 表示順。シナリオを追加するときは、ここに足す */
export const SCENARIO_LIST: Scenario[] = [dh, passkey, phish, sig, cert];

export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(SCENARIO_LIST.map((s) => [s.id, s]));
