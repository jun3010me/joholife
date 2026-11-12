// 鍵交換シミュレータ：型定義（UI非依存）

export type Tone = 'info' | 'ok' | 'warn' | 'bad';

export interface Result {
  text: string;
  tone: Tone;
  /** 操作の結果、装置のスロットを空にしてよいか（装置の実行時のみ） */
  cleared?: boolean;
  /** 操作のあとシナリオの完了／失敗が決まったときの追加メッセージ */
  scenario?: { text: string; tone: Tone };
}

export type ItemData =
  | { kind: 'block'; parts: string[] }
  | { kind: 'challenge'; cid: string; nonce: string; site: string; issuer: string }
  | { kind: 'privkey'; pair: string; site: string; owner: string }
  | { kind: 'pubkey'; pair: string; site: string; root?: boolean }
  | { kind: 'sig'; pair: string; cid: string; nonce: string; site: string }
  | { kind: 'doc'; text: string; sig?: { pair: string; by: string; h: number } }
  | { kind: 'cert'; subject: string; pair: string; issuer: string; caPair: string };

export type ItemKind = ItemData['kind'];

/** 持ち物。uid は実行中だけの通し番号（保存しない） */
export type Item = ItemData & { uid: number; recv: boolean; used?: boolean };

export type DeviceType = 'person' | 'phone' | 'server' | 'pc' | 'ca' | 'internet' | 'eve';

export type MachineId =
  | 'combine' | 'challenge' | 'keygen' | 'sign' | 'verify'
  | 'keymake' | 'docsign' | 'docverify' | 'tamper' | 'issue' | 'certcheck';

export interface DeviceConfig {
  machines: MachineId[];
  color: string | null;
  initial: string;
  site?: string;
  visit?: string;
  mitm?: boolean;
}

export interface DeviceState {
  loggedIn: boolean;
  secure: boolean;
  issued: string[];
  used: string[];
}

export interface Nic {
  id: string;
  connectedId: string | null;
}

export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: DeviceConfig;
  items: Item[];
  state: DeviceState;
  ports: { nics: Nic[] };
}

export interface Connection {
  id: string;
  from: { deviceId: string; portId: string };
  to: { deviceId: string; portId: string };
}

export type Flags = Partial<{
  eveTried: boolean;
  phishBlocked: boolean;
  tamperDetected: boolean;
  docVerified: boolean;
  fakeCertRejected: boolean;
  /** 受け取った公開鍵・署名つき文書の持ち主名を伏せる（課題⑩のテンプレートだけが立てる。進み具合の印ではない） */
  hideKeyOwner: boolean;
}>;

export type LogAction =
  | 'send' | 'intercept' | 'combine' | 'challenge' | 'keygen' | 'sign' | 'sign-refused'
  | 'verify' | 'keymake' | 'docsign' | 'docverify' | 'tamper' | 'issue' | 'certcheck'
  | 'connect' | 'disconnect' | 'add-device' | 'remove-device' | 'add-item' | 'edit' | 'move';

export interface LogEntry {
  step: number;
  time: string;
  action: LogAction;
  [k: string]: unknown;
}

export type Mode = 'scenario' | 'free';

export interface ScenarioState {
  id: string;
  title: string;
  completed: boolean;
  failed: boolean;
  completedAt: string | null;
  steps: { text: string; done: boolean }[];
}
