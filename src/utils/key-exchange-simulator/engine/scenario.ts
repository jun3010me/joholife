import type { KeyLab } from './world.ts';

export interface ScenarioStep {
  text: string;
  hint: string;
  check: (w: KeyLab) => boolean;
}

/** シナリオはデータ。あとから追加するときは scenarios/ にファイルを足して index.ts に登録する */
export interface Scenario {
  id: string;
  title: string;
  desc: string;
  /** 初期配置と持ち物を作り、最初に吹き出しを開くデバイスIDを返す */
  build: (w: KeyLab) => string[];
  start: string;
  steps: ScenarioStep[];
  fail: (w: KeyLab) => boolean;
  failText: string;
  doneText: string;
}
