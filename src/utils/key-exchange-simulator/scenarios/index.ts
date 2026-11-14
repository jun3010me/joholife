import type { Scenario } from '../engine/scenario.ts';
import { cert } from './cert.ts';
import { dh } from './dh.ts';
import { hybrid } from './hybrid.ts';
import { passkey } from './passkey.ts';
import { phish } from './phish.ts';
import { pk } from './pk.ts';
import { sig } from './sig.ts';
import { sym } from './sym.ts';

/** 表示順。シナリオを追加するときは、ここに足す */
export const SCENARIO_LIST: Scenario[] = [sym, pk, hybrid, dh, passkey, phish, sig, cert];

export const SCENARIOS: Record<string, Scenario> = Object.fromEntries(SCENARIO_LIST.map((s) => [s.id, s]));
