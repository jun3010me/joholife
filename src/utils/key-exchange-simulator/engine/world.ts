import { executeMachine, MACH } from './machines.ts';
import { giveItem, isSecret, payload } from './items.ts';
import { NH, NW, pos, type Size } from './layout.ts';
import { SCENARIOS } from '../scenarios/index.ts';
import type {
  Connection, Device, DeviceType, Flags, Item, ItemData, LogAction, LogEntry,
  MachineId, Mode, Result, ScenarioState, Tone,
} from './types.ts';

import { PERSON_COLORS } from './constants.ts';
export { PERSON_COLORS };
export const PERSONS: [string, string][] = [['アリス', 'A'], ['ボブ', 'B'], ['キャロル', 'C'], ['デイブ', 'D'], ['エレン', 'E']];

export const DEVICE_TYPES: Record<DeviceType, { label: string; machines: MachineId[]; nics: number; color: string | null }> = {
  person: { label: '人物', machines: ['combine', 'keymake', 'docsign', 'docverify'], nics: 1, color: null },
  phone: { label: 'スマホ', machines: ['keygen', 'sign'], nics: 1, color: '#2f7f73' },
  server: { label: 'Webサイト', machines: ['keymake', 'challenge', 'verify'], nics: 1, color: '#4d5b68' },
  pc: { label: 'ブラウザ', machines: ['certcheck'], nics: 1, color: '#3a6fa8' },
  ca: { label: '認証局', machines: ['issue'], nics: 1, color: '#8a6d1a' },
  internet: { label: 'インターネット', machines: [], nics: 6, color: '#8896a2' },
  eve: { label: '盗聴者', machines: ['combine', 'tamper'], nics: 1, color: '#a8463c' },
};

export interface MakeDeviceOpts {
  id?: string; name?: string; initial?: string; color?: string;
  machines?: MachineId[]; site?: string; visit?: string; mitm?: boolean;
}

export interface KeyLabOptions {
  size?: Size;
  rng?: () => number;
  now?: () => Date;
}

type Msg = { text: string; tone: Tone };

export class KeyLab {
  mode: Mode = 'free';
  scenario: ScenarioState | null = null;
  flags: Flags = {};
  devices: Device[] = [];
  connections: Connection[] = [];
  log: LogEntry[] = [];
  size: Size;
  rng: () => number;
  now: () => Date;
  /** 持ち物の通し番号（保存しない） */
  private uidCounter = 0;
  /** チャレンジ・鍵ペアなど、保存して引き継ぐ識別子の通し番号 */
  seqCounter = 0;

  constructor(opts: KeyLabOptions = {}) {
    this.size = opts.size ?? { w: 1200, h: 600 };
    this.rng = opts.rng ?? Math.random;
    this.now = opts.now ?? (() => new Date());
  }

  // ---------- 基本 ----------
  dev(id: string): Device | undefined { return this.devices.find((d) => d.id === id); }
  seq = (): number => ++this.seqCounter;
  private nextUid = (): number => ++this.uidCounter;
  pos(k: number, y: number | 'b', maxk = 1): [number, number] { return pos(this.size, k, y, maxk); }

  addLog(action: LogAction, detail: Record<string, unknown> = {}): void {
    this.log.push({ step: this.log.length + 1, time: this.now().toISOString(), action, ...detail });
  }

  reset(mode: Mode): void {
    this.mode = mode;
    this.scenario = null;
    this.flags = {};
    this.devices = [];
    this.connections = [];
    this.log = [];
    this.uidCounter = 0;
    this.seqCounter = 0;
  }

  /** 開いておくデバイスのIDを返す */
  startScenario(id: string): { open: string[]; message: Msg } {
    const sc = SCENARIOS[id];
    if (!sc) throw new Error('不明なシナリオ: ' + id);
    this.reset('scenario');
    this.scenario = { id, title: sc.title, completed: false, failed: false, completedAt: null, steps: sc.steps.map((s) => ({ text: s.text, done: false })) };
    const open = sc.build(this);
    this.check();
    return { open, message: { text: sc.start, tone: 'info' } };
  }

  startFree(): Msg {
    this.reset('free');
    this.makeDevice('person', ...this.pos(-1, 40));
    this.makeDevice('internet', ...this.pos(0, 40));
    this.makeDevice('person', ...this.pos(1, 40));
    this.connect('person-001', 'internet-001', true);
    this.connect('person-002', 'internet-001', true);
    return { text: '自由モードです。上のパレットからデバイスや鍵をキャンバスへ。青い丸をドラッグするとつなげます。', tone: 'info' };
  }

  // ---------- デバイス ----------
  newId(type: DeviceType): string {
    let n = 1;
    const f = (k: number) => `${type}-${String(k).padStart(3, '0')}`;
    while (this.devices.some((d) => d.id === f(n))) n++;
    return f(n);
  }

  makeDevice(type: DeviceType, x: number, y: number, o: MakeDeviceOpts = {}): Device {
    const t = DEVICE_TYPES[type];
    let name = o.name;
    let initial = o.initial;
    let color: string | null = o.color ?? t.color;
    if (type === 'person' && !name) {
      const used = this.devices.map((d) => d.name);
      const p = PERSONS.find((q) => !used.includes(q[0])) ?? ['人物' + (this.devices.length + 1), 'X'];
      name = p[0];
      initial = p[1];
      color = PERSON_COLORS[this.devices.filter((d) => d.type === 'person').length % PERSON_COLORS.length];
    }
    if (!name) name = ({ eve: 'イブ', server: 'Webサイト', phone: 'スマホ', pc: 'ブラウザ', ca: '認証局' } as Record<string, string>)[type] ?? 'インターネット';
    const nics = Array.from({ length: t.nics }, (_, i) => ({ id: t.nics > 1 ? 'port' + (i + 1) : 'net', connectedId: null as string | null }));
    const d: Device = {
      id: o.id ?? this.newId(type), type, name, x, y, width: NW, height: NH,
      config: {
        machines: [...(o.machines ?? t.machines)], color, initial: initial ?? name[0],
        ...(type === 'server' ? { site: o.site ?? 'yamazon.com' } : {}),
        ...(type === 'pc' ? { visit: o.visit ?? 'yamazon.com' } : {}),
        ...(type === 'eve' ? { mitm: !!o.mitm } : {}),
      },
      items: [], state: { loggedIn: false, secure: false, issued: [], used: [] }, ports: { nics },
    };
    this.devices.push(d);
    return d;
  }

  removeDevice(id: string): void {
    for (const c of this.connections.filter((x) => x.from.deviceId === id || x.to.deviceId === id)) this.unlink(c.id);
    this.devices = this.devices.filter((d) => d.id !== id);
  }

  // ---------- 接続 ----------
  neighbors(id: string): string[] {
    return this.connections.flatMap((c) => (c.from.deviceId === id ? [c.to.deviceId] : c.to.deviceId === id ? [c.from.deviceId] : []));
  }

  /** 接続できたら true。silent=false のときは失敗理由を message に返す */
  connect(a: string, b: string, silent = false): Msg | boolean {
    const warn = (text: string): Msg | false => (silent ? false : { text, tone: 'warn' });
    const A = this.dev(a), B = this.dev(b);
    if (!A || !B || a === b) return warn('つなげられません。');
    if (this.connections.some((c) => (c.from.deviceId === a && c.to.deviceId === b) || (c.from.deviceId === b && c.to.deviceId === a))) return warn('すでにつながっています。');
    if (A.type !== 'internet' && B.type !== 'internet' && (A.type === 'eve' || B.type === 'eve')) return warn('盗聴者は、インターネットにつないで通信を盗み見します。');
    const pa = A.ports.nics.find((n) => !n.connectedId), pb = B.ports.nics.find((n) => !n.connectedId);
    if (!pa || !pb) return warn(`${(!pa ? A : B).name}には空いているポートがありません。`);
    let n = 1;
    while (this.connections.some((c) => c.id === 'conn-' + String(n).padStart(3, '0'))) n++;
    const id = 'conn-' + String(n).padStart(3, '0');
    this.connections.push({ id, from: { deviceId: a, portId: pa.id }, to: { deviceId: b, portId: pb.id } });
    pa.connectedId = id;
    pb.connectedId = id;
    if (silent) return true;
    this.addLog('connect', { from: a, to: b });
    return { text: `${A.name}と${B.name}をつなぎました。`, tone: 'info' };
  }

  unlink(cid: string): void {
    for (const d of this.devices) for (const n of d.ports.nics) if (n.connectedId === cid) n.connectedId = null;
    this.connections = this.connections.filter((x) => x.id !== cid);
  }

  /** 中継できるのはインターネットだけ。幅優先で経路を探す */
  route(a: string, b: string): string[] | null {
    const prev: Record<string, string | null> = { [a]: null };
    const q = [a];
    while (q.length) {
      const cur = q.shift() as string;
      for (const n of this.neighbors(cur)) {
        if (n in prev) continue;
        prev[n] = cur;
        if (n === b) {
          const p = [b];
          let x: string | null = cur;
          while (x !== null) { p.unshift(x); x = prev[x]; }
          return p;
        }
        if (this.dev(n)?.type === 'internet') q.push(n);
      }
    }
    return null;
  }

  // ---------- 持ち物 ----------
  give(d: Device, data: ItemData, recv = false): Item { return giveItem(d, data, recv, this.nextUid); }

  addItem(d: Device, data: ItemData): Item {
    const it = this.give(d, data, false);
    this.addLog('add-item', { device: d.id, item: data });
    return it;
  }

  removeItem(d: Device, uid: number): void { d.items = d.items.filter((i) => i.uid !== uid); }

  itemByUid(d: Device, uid: number): Item | undefined { return d.items.find((i) => i.uid === uid); }

  private partName(p: string): string { return p === 'P' ? 'P' : (this.dev(p.slice(2))?.config.initial ?? '?'); }

  label(i: ItemData): string {
    switch (i.kind) {
      case 'block':
        if (i.parts.length === 1) return i.parts[0] === 'P' ? '公開鍵P' : `${this.dev(i.parts[0].slice(2))?.name ?? '?'}の秘密鍵`;
        return `合成鍵（${i.parts.map((p) => this.partName(p)).join('＋')}）`;
      case 'challenge': return `チャレンジ #${i.nonce}（${i.site}）`;
      case 'privkey': return `秘密鍵（${i.site}）`;
      case 'pubkey': return i.root ? `ルート証明書（${i.site}の公開鍵）` : `公開鍵（${i.site}）`;
      case 'doc': return `文書「${i.text}」${i.sig ? `（${i.sig.by}の署名つき）` : ''}`;
      case 'cert': return `証明書（${i.subject}／発行：${i.issuer}）`;
      case 'sig': return `署名つき返事 #${i.nonce}`;
    }
  }

  // ---------- 通信 ----------
  /** 持ち物を別デバイスへ送る。経路上の盗聴者にはコピーされ、中間者なら横取りされる */
  send(fromId: string, uid: number, toId: string): Result {
    const from = this.dev(fromId), to = this.dev(toId);
    const item = from && this.itemByUid(from, uid);
    if (!from || !to || !item) return this.done({ text: '送れませんでした。', tone: 'warn' });
    if (from === to) return { text: '送り先が同じデバイスです。', tone: 'warn' };
    if (to.type === 'internet') return { text: 'インターネットは通り道です。送り先にはできません。', tone: 'warn' };
    const path = this.route(from.id, to.id);
    if (!path) return { text: `${from.name}から${to.name}への通信路がつながっていません。`, tone: 'warn' };
    const data = payload(item);
    const taps = new Set<string>();
    let mitm: Device | null = null;
    for (const id of path) {
      if (this.dev(id)?.type !== 'internet') continue;
      for (const n of this.neighbors(id)) {
        const e = this.dev(n) as Device;
        if (e.type === 'eve' && n !== from.id && n !== to.id) {
          this.give(e, data, true);
          if (e.config.mitm && !mitm) mitm = e;
          else taps.add(e.name);
        }
      }
    }
    const secret = isSecret(data);
    if (mitm) {
      this.addLog('intercept', { from: from.id, to: to.id, item: data, by: mitm.id });
      return this.done({ text: `${mitm.name}が通信の途中で「${this.label(data)}」を横取りしました。${to.name}にはまだ届いていません。${mitm.name}が${to.name}へ送ると届きます。`, tone: secret ? 'bad' : 'warn' }, path);
    }
    this.give(to, data, true);
    this.addLog('send', { from: from.id, to: to.id, item: data, tappedBy: [...taps] });
    const tapText = taps.size ? `同じものが${[...taps].join('・')}にもコピーされました。` : '途中で盗み見している人はいませんでした。';
    let r: Msg;
    if (secret) {
      r = taps.size
        ? { text: `しまった！「${this.label(data)}」は送ってはいけないものです。${tapText}`, tone: 'bad' }
        : { text: `「${this.label(data)}」は本来送ってはいけないものです。今回は盗み見されませんでしたが、気をつけましょう。`, tone: 'warn' };
    } else r = { text: `${from.name}が「${this.label(data)}」を${to.name}に送りました。${tapText}`, tone: 'info' };
    return this.done(r, path);
  }

  /** 通信の経路（UIが線をハイライトするため）。最後の送信のみ */
  lastPath: string[] | null = null;

  // ---------- 装置 ----------
  runMachine(deviceId: string, m: MachineId, uids: number[], opts: { tamperText?: string } = {}): Result {
    const d = this.dev(deviceId);
    if (!d) return { text: 'デバイスが見つかりません。', tone: 'warn' };
    const items = uids.map((u) => this.itemByUid(d, u)).filter((x): x is Item => !!x);
    const r = executeMachine(
      { flags: this.flags, rng: this.rng, seq: this.seq, give: (dd, data, recv) => this.give(dd, data, recv), log: (a, det) => this.addLog(a, det), label: (i) => this.label(i) },
      d, m, items, opts,
    );
    return this.done(r);
  }

  machineDef(m: MachineId) { return MACH[m]; }

  // ---------- シナリオ ----------
  /** 進み具合を再判定する。完了・失敗が決まったときだけメッセージを返す */
  check(): Msg | undefined {
    if (this.mode !== 'scenario' || !this.scenario) return undefined;
    const sc = SCENARIOS[this.scenario.id];
    const st = this.scenario;
    sc.steps.forEach((s, i) => { st.steps[i].done = !!s.check(this); });
    if (!st.failed && sc.fail(this)) { st.failed = true; return { text: sc.failText, tone: 'bad' }; }
    if (!st.completed && !st.failed && st.steps.every((s) => s.done)) {
      st.completed = true;
      st.completedAt = this.now().toISOString();
      return { text: sc.doneText, tone: 'ok' };
    }
    return undefined;
  }

  private done(r: Result, path?: string[]): Result {
    this.lastPath = path ?? null;
    const s = this.check();
    return s ? { ...r, scenario: s } : r;
  }

  /** 状態が変わったあと（移動・設定変更・持ち物追加など）にUIが呼ぶ */
  afterChange(): Msg | undefined { return this.check(); }

  // ---------- 保存・読込 ----------
  toJSON(): Record<string, unknown> {
    return {
      version: '1.0',
      simulator: 'key-exchange',
      timestamp: this.now().toISOString(),
      mode: this.mode,
      scenario: this.scenario ? JSON.parse(JSON.stringify(this.scenario)) : null,
      flags: { ...this.flags },
      seq: this.seqCounter,
      devices: this.devices.map((d) => ({
        id: d.id, type: d.type, name: d.name, x: d.x, y: d.y, width: d.width, height: d.height,
        config: JSON.parse(JSON.stringify(d.config)),
        items: d.items.map((i) => { const { uid: _u, ...rest } = i; return JSON.parse(JSON.stringify(rest)); }),
        state: JSON.parse(JSON.stringify(d.state)),
        ports: JSON.parse(JSON.stringify(d.ports)),
      })),
      connections: JSON.parse(JSON.stringify(this.connections)),
      log: JSON.parse(JSON.stringify(this.log)),
    };
  }

  /** 保存データを読み込む。別のシミュレータのファイルは Error を投げる */
  load(data: any): void {
    if (!data || data.simulator !== 'key-exchange') throw new Error('鍵交換シミュレータの保存ファイルではありません');
    if (!data.version || !Array.isArray(data.devices)) throw new Error('不正なファイル形式です');
    this.reset(data.mode === 'scenario' ? 'scenario' : 'free');
    this.flags = { ...(data.flags ?? {}) };
    this.log = Array.isArray(data.log) ? data.log : [];
    this.connections = Array.isArray(data.connections) ? data.connections : [];
    let maxSeq = Number(data.seq) || 0;
    for (const dd of data.devices) {
      const d: Device = {
        id: dd.id, type: dd.type, name: dd.name, x: dd.x, y: dd.y, width: dd.width ?? NW, height: dd.height ?? NH,
        config: dd.config, items: [],
        state: { loggedIn: false, secure: false, issued: [], used: [], ...(dd.state ?? {}) },
        ports: dd.ports ?? { nics: [] },
      };
      for (const it of dd.items ?? []) {
        d.items.push({ ...it, uid: this.nextUid(), recv: !!it.recv } as Item);
        for (const v of [it.cid, it.pair]) {
          const m = typeof v === 'string' && /^(?:ch|pk)-(\d+)$/.exec(v);
          if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
        }
      }
      this.devices.push(d);
    }
    this.seqCounter = maxSeq;
    if (this.mode === 'scenario') {
      const id = data.scenario?.id;
      const sc = SCENARIOS[id];
      if (!sc) throw new Error('不明なシナリオです: ' + id);
      this.scenario = {
        id, title: sc.title, completed: !!data.scenario.completed, failed: !!data.scenario.failed,
        completedAt: data.scenario.completedAt ?? null, steps: sc.steps.map((s) => ({ text: s.text, done: false })),
      };
      // 完了済みの記録は残したまま、進み具合だけ再判定する
      const keep = { c: this.scenario.completed, f: this.scenario.failed, t: this.scenario.completedAt };
      this.check();
      this.scenario.completed = keep.c;
      this.scenario.failed = keep.f;
      this.scenario.completedAt = keep.t;
    }
  }
}
