// 鍵交換シミュレータ：持ち物・アイコンの見た目（HTML文字列）
import type { Item, ItemData } from '../../utils/key-exchange-simulator/engine/types.ts';
import { isSecret } from '../../utils/key-exchange-simulator/engine/items.ts';
import type { KeyLab } from '../../utils/key-exchange-simulator/engine/world.ts';

export const PCOL = '#2e8f88';
const CERTC = '#8a6d1a', PRIVC = '#7a5a2a', PUBC = '#3b7fb3', CHC = '#8a6d1a', SIGC = '#5a63b8';

const svg = (inner: string, extra = 'stroke-linecap="round"') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ${extra} aria-hidden="true">${inner}</svg>`;

export const ICON: Record<string, string> = {
  person: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  phone: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  server: svg('<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
  internet: svg('<path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z"/>', 'stroke-linejoin="round"'),
  eve: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', ''),
  pc: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>'),
  ca: svg('<circle cx="12" cy="9" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/>', 'stroke-linecap="round" stroke-linejoin="round"'),
  doc: svg('<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  key: svg('<circle cx="12" cy="6" r="3.5"/><path d="M12 9.5V21M12 15h3M12 18.5h2.5"/>'),
};

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const keyV = (kc: string, tiles: string) =>
  `<span class="kx-keyv" style="--kc:${kc}"><span class="kx-grip">${tiles}</span><span class="kx-shaft"></span></span>`;

function blockTile(lab: KeyLab, p: string): string {
  if (p === 'P') return `<span class="kx-blk" style="--c:${PCOL}">P</span>`;
  const o = lab.dev(p.slice(2));
  return `<span class="kx-blk kx-secret" style="--c:${o?.config.color ?? '#888'}">${esc(o?.config.initial ?? '?')}</span>`;
}

function visual(lab: KeyLab, i: ItemData): string {
  switch (i.kind) {
    case 'block': {
      const one = i.parts.length === 1;
      // 持ち手の中は上から P → 秘密素材（A, B…）の順に積む
      const parts = [...i.parts].sort((a, b) => (a === 'P' ? -1 : b === 'P' ? 1 : a.localeCompare(b)));
      const kc = one ? (i.parts[0] === 'P' ? PCOL : lab.dev(i.parts[0].slice(2))?.config.color || '#888') : '#5b6670';
      return keyV(kc, parts.map((p) => blockTile(lab, p)).join('')) + `<span class="kx-cap">${one ? (i.parts[0] === 'P' ? '公開' : '秘密') : '合成'}</span>`;
    }
    case 'privkey':
      return keyV(PRIVC, `<span class="kx-blk kx-secret" style="--c:${PRIVC}">秘</span>`) + `<span class="kx-cap">秘密鍵<br>${esc(i.site)}</span>`;
    case 'pubkey': {
      const c = i.root ? CERTC : PUBC;
      return keyV(c, `<span class="kx-blk" style="--c:${c}">公</span>`) + `<span class="kx-cap">${i.root ? 'ルート証明書' : '公開鍵'}<br>${lab.hidesOwner(i) ? '持ち主不明' : esc(i.site)}</span>`;
    }
    case 'doc': {
      // 持ち主名を伏せる設定（課題⑩）では、受け取った文書の署名者名を出さない
      const sigText = !i.sig ? '' : lab.hidesOwner(i) ? '署名つき' : `${esc(i.sig.by)}の署名つき`;
      return `<span class="kx-paper">${esc(i.text)}${i.sig ? `<span class="kx-seal" title="${sigText}">署</span>` : ''}</span><span class="kx-cap">${i.sig ? sigText : '文書'}</span>`;
    }
    case 'cert':
      return `<span class="kx-certc"><b>証明書</b><span>${esc(i.subject)}</span><i>発行：${esc(i.issuer)}</i></span><span class="kx-cap">証明書</span>`;
    case 'challenge':
      return `<span class="kx-ticket" style="--c:${CHC}"><b>チャレンジ</b><span>#${i.nonce}</span></span><span class="kx-cap">${esc(i.site)}</span>`;
    case 'sig':
      return `<span class="kx-ticket" style="--c:${SIGC}"><b>署名つき返事</b><span>#${i.nonce}</span></span><span class="kx-cap">${esc(i.site)}</span>`;
  }
}

export function itemHTML(lab: KeyLab, i: Item, attrs: string, cls = '', fresh = false): string {
  let badge = '';
  if (i.kind === 'challenge' && i.used) badge = '<span class="kx-badge">使用済み</span>';
  else if (isSecret(i)) badge = '<span class="kx-badge kx-secret">送らない</span>';
  else if (i.recv) badge = '<span class="kx-badge">受信</span>';
  const label = esc(lab.label(i));
  return `<span class="kx-item ${cls}${fresh ? ' kx-fresh' : ''}" ${attrs} title="${label}" aria-label="${label}" tabindex="0">${visual(lab, i)}${badge}</span>`;
}
