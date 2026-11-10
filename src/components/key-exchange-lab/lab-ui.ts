// 鍵交換シミュレータ：画面の操作（試作の動きをそのまま移した）。ルールはすべてエンジン側にある。
import { KeyLab, DEVICE_TYPES, PERSON_COLORS } from '../../utils/key-exchange-lab/engine/world.ts';
import { MACH, TAMPER_DEFAULT } from '../../utils/key-exchange-lab/engine/machines.ts';
import { NH, NW } from '../../utils/key-exchange-lab/engine/layout.ts';
import { SCENARIOS, SCENARIO_LIST } from '../../utils/key-exchange-lab/scenarios/index.ts';
import { DOC_TEXT } from '../../utils/key-exchange-lab/scenarios/sig.ts';
import type { Device, DeviceType, MachineId, Result, Tone } from '../../utils/key-exchange-lab/engine/types.ts';
import { ICON, PCOL, esc, itemHTML } from './visuals.ts';

type Src =
  | { kind: 'pdev'; type: DeviceType }
  | { kind: 'pitem'; item: string }
  | { kind: 'inv'; dev: string; uid: number }
  | { kind: 'slot'; dev: string; m: MachineId; i: number };
interface Tgt { kind: string; dev?: string; m?: MachineId; i?: number }


export function mountKeyExchangeLab(): void {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
  const stage = $('#kx-stage'), canvas = $('#kx-canvas'), nodesEl = $('#kx-nodes'), wiresEl = $('#kx-wires') as unknown as SVGElement;
  const lab = new KeyLab();
  const ui = {
    open: [] as string[],
    slots: {} as Record<string, Record<string, (number | null)[]>>,
    pick: null as Src | null,
    drawer: window.innerWidth >= 760,
    justOpened: null as string | null,
    tamper: {} as Record<string, string>,
  };
  let fresh = new Set<number>();
  let flashPath: string[] | null = null;
  let tmpLine: number[] | null = null;
  const sameSrc = (a: Src | null, b: Src) => !!a && JSON.stringify(a) === JSON.stringify(b);

  const CW = () => canvas.clientWidth, CH = () => canvas.clientHeight;
  const syncSize = () => { lab.size = { w: CW(), h: CH() }; };
  const clampX = (x: number) => Math.max(0, Math.min(CW() - NW, x));
  const clampY = (y: number) => Math.max(0, Math.min(CH() - NH, y));
  const clampAll = () => lab.devices.forEach((d) => { d.x = clampX(d.x); d.y = clampY(d.y); });

  function say(t: string, tone: Tone = 'info') {
    const el = $('#kx-toast');
    el.textContent = t;
    el.className = 'kx-toast kx-t-' + tone;
  }
  const show = (r: Result) => (r.scenario ? say(r.scenario.text, r.scenario.tone) : say(r.text, r.tone));
  const uidsNow = () => new Set(lab.devices.flatMap((d) => d.items.map((i) => i.uid)));
  /** 操作を実行し、新しくできた持ち物を「ポン」と表示する */
  function act(fn: () => Result | undefined | void) {
    const before = uidsNow();
    const r = fn();
    for (const u of uidsNow()) if (!before.has(u)) fresh.add(u);
    if (r) show(r);
    const m = lab.afterChange();
    if (m) say(m.text, m.tone);
    render();
  }
  const slotsOf = (id: string, m: MachineId) => {
    ui.slots[id] ??= {};
    return (ui.slots[id][m] ??= Array(MACH[m].slots).fill(null));
  };
  const dropFromSlots = (id: string, uid: number) => {
    const s = ui.slots[id];
    if (s) for (const m in s) s[m] = s[m].map((x) => (x === uid ? null : x));
  };

  // ---------- 開始 ----------
  function start(mode: 'scenario' | 'free', sid = 'dh') {
    syncSize();
    ui.slots = {}; ui.pick = null; ui.open = [];
    stage.classList.toggle('kx-dopen', mode === 'scenario' && ui.drawer);
    syncSize();
    if (mode === 'scenario') {
      const r = lab.startScenario(sid);
      ui.open = r.open;
      say(r.message.text, r.message.tone);
    } else say(lab.startFree().text, 'info');
    ui.justOpened = ui.open[0] ?? null;
    fresh.clear();
    render();
  }

  // ---------- 描画 ----------
  function render() {
    renderPalette(); renderDrawer(); renderInfo(); renderNodes(); drawWires();
    document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.mode === lab.mode)));
    fresh.clear(); ui.justOpened = null;
  }
  function tool(attrs: string, color: string, icon: string, label: string, cls = '') {
    return `<div class="device-item ${cls}" ${attrs} tabindex="0"><div class="device-icon"><span class="kx-ti" style="background:${color}">${icon}</span></div><div class="device-name">${label}</div></div>`;
  }
  function renderPalette() {
    const free = lab.mode === 'free', off = free ? '' : 'kx-off', p = ui.pick;
    const sel = (k: string, v: string) => (p && p.kind === k && ((p as any).type === v || (p as any).item === v) ? ' kx-sel' : '');
    const dis = free ? '' : 'aria-disabled="true" title="自由モードで使えます"';
    const devs = (Object.entries(DEVICE_TYPES) as [DeviceType, (typeof DEVICE_TYPES)[DeviceType]][])
      .map(([k, t]) => tool(free ? `data-drag="pdev" data-type="${k}"` : dis, t.color || PERSON_COLORS[0], ICON[k], t.label, `${off}${sel('pdev', k)}`)).join('');
    const items =
      tool(free ? 'data-drag="pitem" data-item="P"' : dis, PCOL, ICON.key, '公開鍵P', off + sel('pitem', 'P')) +
      tool(free ? 'data-drag="pitem" data-item="S"' : dis, '#7d8790', ICON.key, '秘密鍵S', off + sel('pitem', 'S')) +
      tool(free ? 'data-drag="pitem" data-item="D"' : dis, '#6b7a86', ICON.doc, '文書', off + sel('pitem', 'D'));
    $('#kx-palette').innerHTML = devs + '<span class="kx-sep" aria-hidden="true"></span>' + items + '<span class="kx-sep" aria-hidden="true"></span>' +
      `<div class="device-item kx-trash" data-drop="trash" title="持ち物をここへドラッグすると消えます"><div class="device-icon"><span class="kx-ti" style="background:#9aa3ab">${ICON.trash}</span></div><div class="device-name">ゴミ箱</div></div>`;
  }
  function renderDrawer() {
    const dr = $('#kx-drawer'), pn = $('#kx-dpanel'), tab = $('#kx-dtab');
    if (lab.mode !== 'scenario' || !lab.scenario) { dr.hidden = true; stage.classList.remove('kx-dopen'); return; }
    dr.hidden = false;
    dr.classList.toggle('kx-closed', !ui.drawer);
    stage.classList.toggle('kx-dopen', ui.drawer);
    tab.setAttribute('aria-expanded', String(ui.drawer));
    tab.textContent = ui.drawer ? '◀ 閉じる' : 'シナリオ ▶';
    const sc = SCENARIOS[lab.scenario.id], st = lab.scenario, now = st.steps.findIndex((s) => !s.done);
    pn.innerHTML = `<h2>シナリオ</h2><select id="kx-scsel" aria-label="シナリオを選ぶ">${SCENARIO_LIST.map((v) => `<option value="${v.id}" ${v.id === st.id ? 'selected' : ''}>${esc(v.title)}</option>`).join('')}</select>
      <p>${esc(sc.desc)}</p>
      <ol class="kx-steps">${sc.steps.map((s, i) => `<li class="${st.steps[i].done ? 'kx-done' : i === now ? 'kx-now' : ''}"><span>${esc(s.text)}</span>${i === now && !st.failed ? `<span class="kx-hint">${esc(s.hint)}</span>` : ''}</li>`).join('')}</ol>
      ${st.completed ? '<div class="kx-result kx-ok">完了しました。「保存」でJSONを出して提出できます。</div>' : ''}${st.failed ? '<div class="kx-result kx-bad">失敗：「クリア」で最初から挑戦できます。</div>' : ''}`;
  }
  function renderInfo() {
    let h: string;
    if (lab.mode === 'scenario' && lab.scenario) {
      const sc = SCENARIOS[lab.scenario.id], st = lab.scenario, now = st.steps.findIndex((s) => !s.done), done = st.steps.filter((s) => s.done).length;
      h = `<b>${esc(sc.title)}（${done}/${sc.steps.length}）</b>${st.completed ? '完了しました！' : st.failed ? '失敗。クリアでやり直せます' : esc(sc.steps[now]?.text || '')}`;
    } else h = '<b>鍵交換シミュレータ（自由モード）</b>デバイスを配置して、つないでください';
    $('#kx-info').innerHTML = h;
  }
  function devSub(d: Device): string {
    if (d.type === 'server') return d.state.loggedIn ? '<span class="kx-sub kx-ok">ログイン成功</span>' : `<span class="kx-sub">${esc(d.config.site)}</span>`;
    if (d.type === 'eve') return `<span class="kx-sub">${d.config.mitm ? '横取り中' : '盗み見中'}</span>`;
    if (d.type === 'pc') return d.state.secure ? `<span class="kx-sub kx-ok">🔒 ${esc(d.config.visit)}</span>` : `<span class="kx-sub">→ ${esc(d.config.visit)}</span>`;
    if (d.type === 'internet') return '<span class="kx-sub">通信路</span>';
    return `<span class="kx-sub">${esc(DEVICE_TYPES[d.type].label)}</span>`;
  }
  function renderNodes() {
    const free = lab.mode === 'free';
    const nodes = lab.devices.map((d) => `<div class="kx-node kx-t-${d.type}${ui.open.includes(d.id) ? ' kx-open' : ''}" data-node="${d.id}" data-drop="device" data-dev="${d.id}" style="left:${d.x}px;top:${d.y}px;--kx-dc:${d.config.color}" tabindex="0" aria-label="${esc(d.name)}（タップで持ち物を開く）">
      <span class="kx-ic">${ICON[d.type]}</span><span class="kx-nm">${esc(d.name)}</span>${devSub(d)}
      ${d.items.length && !ui.open.includes(d.id) ? `<span class="kx-cnt">${d.items.length}</span>` : ''}
      ${free ? `<span class="kx-handle" data-handle="${d.id}" title="ドラッグしてつなぐ"></span>` : ''}</div>`).join('');
    nodesEl.innerHTML = nodes + ui.open.map((id, z) => { const d = lab.dev(id); return d ? popHTML(d, z) : ''; }).join('');
    ui.open.forEach((id) => { const d = lab.dev(id); if (d) placePop(d); });
  }
  function popHTML(d: Device, z: number): string {
    const free = lab.mode === 'free', p = ui.pick;
    const inv = d.items.length
      ? d.items.map((i) => itemHTML(lab, i, `data-drag="inv" data-dev="${d.id}" data-uid="${i.uid}"`, p && p.kind === 'inv' && p.uid === i.uid ? 'kx-sel' : '', fresh.has(i.uid))).join('')
      : `<span class="kx-empty">${d.type === 'eve' ? '通信路を流れたものがここに集まります' : '持ち物はありません'}</span>`;
    const machines = d.config.machines.map((m) => {
      const M = MACH[m], sl = slotsOf(d.id, m);
      const slots = sl.map((u, i) => {
        const it = u ? d.items.find((x) => x.uid === u) : undefined;
        return `<div class="kx-slot" data-drop="slot" data-dev="${d.id}" data-m="${m}" data-i="${i}">${it ? itemHTML(lab, it, `data-drag="slot" data-dev="${d.id}" data-m="${m}" data-i="${i}"`) : '入れる'}</div>`;
      }).join('<span class="kx-plus" aria-hidden="true">＋</span>');
      const ready = M.slots === 0 || sl.every(Boolean);
      const extra = m === 'tamper' ? `<input type="text" class="kx-tin" data-tamper="${d.id}" aria-label="書き換え後の文" value="${esc(ui.tamper[d.id] ?? TAMPER_DEFAULT)}">` : '';
      return `<div class="kx-mach"><h4>${M.title}</h4><p>${M.hint}</p>${extra}<div class="kx-mrow">${slots}<button class="kx-run" type="button" data-run="${m}" data-dev="${d.id}" ${ready ? '' : 'disabled'}>${M.btn}</button></div></div>`;
    }).join('');
    const links = lab.connections.filter((c) => c.from.deviceId === d.id || c.to.deviceId === d.id);
    const cfg = free ? `<details class="kx-cfg"><summary>設定</summary><div class="kx-cfgb">
      <label class="kx-lbl" for="kx-f-name-${d.id}">名前</label><input type="text" id="kx-f-name-${d.id}" data-field="name" data-dev="${d.id}" value="${esc(d.name)}">
      ${d.type === 'server' ? `<label class="kx-lbl" for="kx-f-site-${d.id}">サイトのアドレス</label><input type="text" id="kx-f-site-${d.id}" data-field="site" data-dev="${d.id}" value="${esc(d.config.site)}">` : ''}
      ${d.type === 'pc' ? `<label class="kx-lbl" for="kx-f-visit-${d.id}">開こうとしているサイト</label><input type="text" id="kx-f-visit-${d.id}" data-field="visit" data-dev="${d.id}" value="${esc(d.config.visit)}">` : ''}
      ${d.type === 'eve' ? `<label class="kx-chk"><input type="checkbox" data-field="mitm" data-dev="${d.id}" ${d.config.mitm ? 'checked' : ''}> 間に入って横取りする（中間者）</label>` : ''}
      <span class="kx-lbl">つながり</span><ul class="kx-links">${links.length ? links.map((c) => { const o = lab.dev(c.from.deviceId === d.id ? c.to.deviceId : c.from.deviceId); return `<li><span>${esc(o?.name)}</span><button class="kx-mini" type="button" data-unlink="${c.id}">外す</button></li>`; }).join('') : '<li class="kx-empty">まだつながっていません</li>'}</ul>
      <button class="kx-mini kx-danger" type="button" data-deldev="${d.id}" style="align-self:flex-start">このデバイスを削除</button></div></details>` : '';
    const body = d.type === 'internet'
      ? '<p class="kx-note">インターネットは通り道です。ここに盗聴者がつながると、通ったものがコピーされます。</p>'
      : `<span class="kx-lbl">持ち物（相手へドラッグで送信）</span><div class="kx-inv" data-drop="inv" data-dev="${d.id}">${inv}</div>${machines}`;
    return `<div class="kx-pop${ui.justOpened === d.id ? ' kx-enter' : ''}" data-pop="${d.id}" style="--kx-dc:${d.config.color};z-index:${10 + z}" role="dialog" aria-label="${esc(d.name)}の持ち物">
      <div class="kx-ph"><span class="kx-dot"></span><b>${esc(d.name)}</b><button class="kx-x" type="button" data-close="${d.id}" aria-label="閉じる">×</button></div>
      <div class="kx-pb">${body}${cfg}</div></div>`;
  }
  /** 下に十分な余白があれば下向き、なければ上向きに開く */
  function placePop(d: Device) {
    const el = document.querySelector(`[data-pop="${d.id}"]`) as HTMLElement | null;
    if (!el) return;
    const W = CW(), H = CH(), pw = Math.min(260, W - 12);
    el.style.left = Math.max(6, Math.min(W - pw - 6, d.x + NW / 2 - pw / 2)) + 'px';
    const below = H - (d.y + NH + 8) - 8, above = d.y - 8 - 8;
    if (below >= Math.min(280, above) || below >= 260) {
      el.style.top = d.y + NH + 8 + 'px'; el.style.bottom = ''; el.style.maxHeight = Math.max(160, below) + 'px';
    } else {
      el.style.bottom = H - d.y + 8 + 'px'; el.style.top = ''; el.style.maxHeight = Math.max(160, above) + 'px';
    }
  }
  const center = (d: Device) => [d.x + NW / 2, d.y + NH / 2];
  function drawWires() {
    const fp = flashPath ? new Set(flashPath.slice(1).map((id, i) => [flashPath![i], id].sort().join('~'))) : new Set<string>();
    let h = lab.connections.map((c) => {
      const a = lab.dev(c.from.deviceId), b = lab.dev(c.to.deviceId);
      if (!a || !b) return '';
      const [x1, y1] = center(a), [x2, y2] = center(b);
      const ev = a.type === 'eve' ? a : b.type === 'eve' ? b : null;
      const fl = fp.has([a.id, b.id].sort().join('~'));
      return `<line class="kx-wire${ev ? (ev.config.mitm ? ' kx-mitm' : ' kx-tap') : ''}${fl ? ' kx-flash' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }).join('');
    if (tmpLine) h += `<line class="kx-wire kx-tmp" x1="${tmpLine[0]}" y1="${tmpLine[1]}" x2="${tmpLine[2]}" y2="${tmpLine[3]}"/>`;
    wiresEl.innerHTML = h;
  }
  function toggleOpen(id: string) {
    if (lab.mode === 'scenario' && lab.dev(id)?.type === 'internet' && !ui.open.includes(id)) {
      say('インターネットは通り道です。ここに盗聴者がつながっていると、通ったものがコピーされます。', 'info');
      return;
    }
    if (ui.open.includes(id)) ui.open = ui.open.filter((x) => x !== id);
    else {
      ui.open.push(id); ui.justOpened = id;
      if (window.innerWidth < 600 && ui.open.length > 2) ui.open.shift();
    }
    render();
  }
  function toFront(id: string) {
    if (!ui.open.includes(id)) return;
    ui.open = ui.open.filter((x) => x !== id).concat(id);
    ui.open.forEach((x, z) => { const el = document.querySelector(`[data-pop="${x}"]`) as HTMLElement | null; if (el) el.style.zIndex = String(10 + z); });
  }

  // ---------- ドロップ ----------
  const canvasPoint = (e: PointerEvent | MouseEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function srcOf(el: HTMLElement): Src {
    const d = el.dataset;
    if (d.drag === 'pdev') return { kind: 'pdev', type: d.type as DeviceType };
    if (d.drag === 'pitem') return { kind: 'pitem', item: d.item as string };
    if (d.drag === 'inv') return { kind: 'inv', dev: d.dev as string, uid: +(d.uid as string) };
    return { kind: 'slot', dev: d.dev as string, m: d.m as MachineId, i: +(d.i as string) };
  }
  function tgtOf(el: HTMLElement | null | undefined): Tgt | null {
    if (!el) return null;
    const d = el.dataset;
    return { kind: d.drop as string, dev: d.dev, m: d.m as MachineId | undefined, i: d.i === undefined ? undefined : +d.i };
  }
  function doDrop(src: Src, t: Tgt, e: PointerEvent | MouseEvent): Result | undefined {
    if (src.kind === 'pdev') {
      if (t.kind !== 'canvas' && t.kind !== 'device') return;
      const [x, y] = canvasPoint(e);
      const d = lab.makeDevice(src.type, clampX(x - NW / 2), clampY(y - NH / 2));
      lab.addLog('add-device', { device: d.id, type: d.type });
      return { text: `${d.name}を置きました。青い丸をドラッグすると、ほかとつなげます。`, tone: 'info' };
    }
    if (src.kind === 'pitem') {
      const d = t.kind === 'device' || t.kind === 'inv' ? lab.dev(t.dev as string) : undefined;
      if (!d) return { text: '人物などのデバイスの上に置いてください。', tone: 'warn' };
      if (src.item === 'D') {
        if (d.type !== 'person' && d.type !== 'eve') return { text: '文書は人物に持たせてください。', tone: 'warn' };
        lab.addItem(d, { kind: 'doc', text: DOC_TEXT });
        return { text: `${d.name}が文書「${DOC_TEXT}」を手に入れました。`, tone: 'info' };
      }
      if (d.type !== 'person' && d.type !== 'eve') return { text: `${d.name}には鍵を置けません。`, tone: 'warn' };
      const it = lab.addItem(d, { kind: 'block', parts: [src.item === 'P' ? 'P' : 'S:' + d.id] });
      return { text: `${d.name}が「${lab.label(it)}」を手に入れました。`, tone: 'info' };
    }
    if (src.kind === 'slot') {
      const arr = slotsOf(src.dev, src.m), u = arr[src.i];
      arr[src.i] = null;
      if (t.kind === 'slot' && t.dev === src.dev && u) {
        const it = lab.dev(src.dev)?.items.find((x) => x.uid === u);
        if (it && MACH[t.m as MachineId].accept?.(it)) slotsOf(t.dev, t.m as MachineId)[t.i as number] = u;
      }
      return;
    }
    const d = lab.dev(src.dev), it = d?.items.find((x) => x.uid === src.uid);
    if (!d || !it) return;
    if (t.kind === 'trash') { lab.removeItem(d, it.uid); dropFromSlots(d.id, it.uid); return { text: '持ち物を片付けました。', tone: 'info' }; }
    if (t.kind === 'slot') {
      if (t.dev !== d.id) return { text: '自分の持ち物しか装置に入れられません。', tone: 'warn' };
      const M = MACH[t.m as MachineId];
      if (!M.accept?.(it)) return { text: `${M.title}には「${lab.label(it)}」は入れられません。`, tone: 'warn' };
      const arr = slotsOf(t.dev, t.m as MachineId);
      for (let i = 0; i < arr.length; i++) if (arr[i] === it.uid) arr[i] = null;
      arr[t.i as number] = it.uid;
      return;
    }
    if ((t.kind === 'device' || t.kind === 'inv') && t.dev !== d.id) {
      if (lab.dev(t.dev as string)?.type === 'internet') return { text: 'インターネットは通り道です。届けたい相手の上に置いてください。', tone: 'warn' };
      const r = lab.send(d.id, it.uid, t.dev as string);
      flashPath = lab.lastPath;
      if (flashPath) setTimeout(() => { flashPath = null; drawWires(); }, 900);
      return r;
    }
  }

  // ---------- ポインタ操作 ----------
  let drag: { el: HTMLElement; src: Src; x0: number; y0: number; ghost: HTMLElement | null } | null = null;
  let mv: { d: Device; el: HTMLElement; x0: number; y0: number; ox: number; oy: number; moved: boolean } | null = null;
  let link: { from: string } | null = null;
  let overEl: Element | null = null;
  const setOver = (el: Element | null) => {
    if (overEl === el) return;
    overEl?.classList.remove('kx-over'); overEl = el; el?.classList.add('kx-over');
  };
  const closest = (t: EventTarget | null, sel: string) => (t as HTMLElement | null)?.closest?.(sel) as HTMLElement | null;

  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !closest(e.target, '.kx-page')) return;
    const pv = closest(e.target, '[data-pop]'); if (pv) toFront(pv.dataset.pop as string);
    const h = closest(e.target, '[data-handle]'); if (h) { e.preventDefault(); link = { from: h.dataset.handle as string }; return; }
    const dg = closest(e.target, '[data-drag]');
    if (dg) {
      if (dg.getAttribute('aria-disabled') === 'true') return;
      // パレットの横スクロールを邪魔しないよう、パレットの項目は preventDefault しない
      if (!dg.classList.contains('device-item')) e.preventDefault();
      drag = { el: dg, src: srcOf(dg), x0: e.clientX, y0: e.clientY, ghost: null };
      return;
    }
    const nd = closest(e.target, '[data-node]');
    if (nd) { e.preventDefault(); const d = lab.dev(nd.dataset.node as string) as Device; mv = { d, el: nd, x0: e.clientX, y0: e.clientY, ox: d.x, oy: d.y, moved: false }; }
  });
  document.addEventListener('pointermove', (e) => {
    if (link) {
      const d = lab.dev(link.from) as Device, [x, y] = canvasPoint(e), [cx, cy] = center(d);
      tmpLine = [cx, cy, x, y]; drawWires();
      setOver(closest(document.elementFromPoint(e.clientX, e.clientY), '[data-node]'));
      return;
    }
    if (drag) {
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
        drag.ghost = drag.el.cloneNode(true) as HTMLElement;
        drag.ghost.classList.add('kx-ghost'); drag.ghost.classList.remove('kx-sel', 'kx-fresh');
        document.body.appendChild(drag.ghost); drag.el.classList.add('kx-dragging');
      }
      drag.ghost.style.transform = `translate(${e.clientX - 22}px,${e.clientY - 22}px)`;
      setOver(closest(document.elementFromPoint(e.clientX, e.clientY), '[data-drop]'));
      return;
    }
    if (mv) {
      const dx = e.clientX - mv.x0, dy = e.clientY - mv.y0;
      if (!mv.moved && Math.hypot(dx, dy) < 5) return;
      mv.moved = true;
      mv.d.x = clampX(mv.ox + dx); mv.d.y = clampY(mv.oy + dy);
      mv.el.style.left = mv.d.x + 'px'; mv.el.style.top = mv.d.y + 'px';
      placePop(mv.d); drawWires();
    }
  });
  document.addEventListener('pointerup', (e) => {
    setOver(null);
    if (link) {
      const nd = closest(document.elementFromPoint(e.clientX, e.clientY), '[data-node]');
      const from = link.from; tmpLine = null; link = null;
      if (nd) { const r = lab.connect(from, nd.dataset.node as string); if (typeof r === 'object') say(r.text, r.tone); }
      render(); return;
    }
    if (drag) {
      const d = drag; drag = null;
      if (d.ghost) {
        d.ghost.remove();
        const t = tgtOf(closest(document.elementFromPoint(e.clientX, e.clientY), '[data-drop]'));
        ui.pick = null;
        if (t) act(() => doDrop(d.src, t, e));
        else { if (d.src.kind === 'slot') slotsOf(d.src.dev, d.src.m)[d.src.i] = null; act(() => undefined); }
        return;
      }
      if (d.src.kind === 'slot') { slotsOf(d.src.dev, d.src.m)[d.src.i] = null; render(); return; }
      ui.pick = sameSrc(ui.pick, d.src) ? null : d.src;
      if (ui.pick) say(d.src.kind === 'pdev' ? 'キャンバス上の置きたい場所をタップしてください。' : '置き場所（相手のデバイス・装置・ゴミ箱）をタップしてください。', 'info');
      render(); return;
    }
    if (mv) {
      const m = mv; mv = null;
      if (!m.moved) {
        if (ui.pick) { const p = ui.pick; ui.pick = null; act(() => doDrop(p, { kind: 'device', dev: m.d.id }, e)); }
        else toggleOpen(m.d.id);
      } else { lab.addLog('move', { device: m.d.id, x: Math.round(m.d.x), y: Math.round(m.d.y) }); act(() => undefined); }
    }
  });
  document.addEventListener('pointercancel', () => {
    if (!drag && !mv && !link) return;
    drag?.ghost?.remove(); drag = null; mv = null; link = null; tmpLine = null; setOver(null); render();
  });

  document.addEventListener('click', (e) => {
    if (!closest(e.target, '.kx-page')) return;
    const r = closest(e.target, '[data-run]');
    if (r) {
      ui.pick = null;
      const d = r.dataset.dev as string, m = r.dataset.run as MachineId;
      act(() => {
        const sl = slotsOf(d, m), uids = sl.filter((u): u is number => !!u);
        const res = lab.runMachine(d, m, uids, { tamperText: ui.tamper[d] });
        if (res.cleared) ui.slots[d][m] = Array(MACH[m].slots).fill(null);
        return res;
      });
      return;
    }
    const cl = closest(e.target, '[data-close]'); if (cl) { toggleOpen(cl.dataset.close as string); return; }
    const ul = closest(e.target, '[data-unlink]');
    if (ul) { lab.unlink(ul.dataset.unlink as string); lab.addLog('disconnect', { connection: ul.dataset.unlink }); say('つながりを外しました。', 'info'); render(); return; }
    const dd = closest(e.target, '[data-deldev]');
    if (dd) {
      const id = dd.dataset.deldev as string;
      lab.removeDevice(id); ui.open = ui.open.filter((x) => x !== id); lab.addLog('remove-device', { device: id });
      say('デバイスを削除しました。', 'info'); render(); return;
    }
    const md = closest(e.target, '[data-mode]');
    if (md) { if (md.dataset.mode !== lab.mode) start(md.dataset.mode as 'scenario' | 'free'); return; }
    if (closest(e.target, '#kx-dtab')) {
      ui.drawer = !ui.drawer; renderDrawer(); syncSize(); clampAll(); renderNodes(); drawWires(); return;
    }
    if (closest(e.target, '[data-drag],[data-node],[data-handle]')) return;
    const z = closest(e.target, '[data-drop]');
    if (z && ui.pick) { const p = ui.pick; ui.pick = null; act(() => doDrop(p, tgtOf(z) as Tgt, e)); }
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[data-drag]')) {
      e.preventDefault();
      const s = srcOf(t);
      ui.pick = sameSrc(ui.pick, s) ? null : s;
      say(ui.pick ? '置き場所をクリックしてください。' : '選択を解除しました。', 'info'); render();
    }
    if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[data-node]')) { e.preventDefault(); toggleOpen(t.dataset.node as string); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'kx-scsel') { start('scenario', t.value); return; }
    const f = t.dataset?.field, d = lab.dev(t.dataset?.dev ?? '');
    if (!f || !d) return;
    if (f === 'mitm') {
      d.config.mitm = t.checked; lab.addLog('edit', { device: d.id, field: f, value: d.config.mitm });
      say(d.config.mitm ? `${d.name}は通信の間に入り、通るものを横取りします。` : `${d.name}は横で盗み見るだけにします。`, 'info'); render(); return;
    }
    const v = t.value.trim(); if (!v) return;
    if (f === 'name') { d.name = v; d.config.initial = v[0]; } else if (f === 'site') d.config.site = v;
    else if (f === 'visit') { d.config.visit = v; d.state.secure = false; }
    lab.addLog('edit', { device: d.id, field: f, value: v }); act(() => undefined);
  });
  document.addEventListener('input', (e) => { const t = (e.target as HTMLElement).dataset?.tamper; if (t) ui.tamper[t] = (e.target as HTMLInputElement).value; });
  window.addEventListener('resize', () => { syncSize(); clampAll(); renderNodes(); drawWires(); });

  // ---------- ボタンバー ----------
  $('#kx-btn-reset').addEventListener('click', () => start(lab.mode, lab.scenario?.id || 'dh'));
  $('#kx-btn-save').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(lab.toJSON(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'key-exchange-lab.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    say('保存しました（key-exchange-lab.json）。', 'ok');
  });
  const fileInput = $<HTMLInputElement>('#kx-file');
  $('#kx-btn-load').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        syncSize();
        lab.load(JSON.parse(String(rd.result)));
        clampAll(); ui.slots = {}; ui.pick = null; ui.open = [];
        stage.classList.toggle('kx-dopen', lab.mode === 'scenario' && ui.drawer);
        syncSize(); clampAll(); fresh.clear(); render();
        say('JSONを読み込みました。続きから操作できます。', 'ok');
      } catch (err) {
        say(err instanceof SyntaxError ? 'JSONの形が正しくありません。' : (err as Error).message, 'bad');
      }
      fileInput.value = '';
    };
    rd.readAsText(f);
  });

  requestAnimationFrame(() => start('scenario', 'dh'));
}
