'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const FINGER_COLORS = {
  'left-pinky':  '#FF6B6B',
  'left-ring':   '#FF922B',
  'left-middle': '#FCC419',
  'left-index':  '#51CF66',
  'right-index': '#339AF0',
  'right-middle':'#7950F2',
  'right-ring':  '#F06595',
  'right-pinky': '#20C997',
};

const FINGER_COLORS_DARK = {
  'left-pinky':  '#7a1c1c',
  'left-ring':   '#7a3800',
  'left-middle': '#7a5a00',
  'left-index':  '#1a5e2a',
  'right-index': '#0a3a6e',
  'right-middle':'#3a1a7a',
  'right-ring':  '#7a1a40',
  'right-pinky': '#0a5a40',
};

const KEY_FINGER = {
  '1':'left-pinky',  '2':'left-ring',   '3':'left-middle',
  '4':'left-index',  '5':'left-index',  '6':'right-index',
  '7':'right-index', '8':'right-middle','9':'right-ring',  '0':'right-pinky',
  'Q':'left-pinky',  'W':'left-ring',   'E':'left-middle',
  'R':'left-index',  'T':'left-index',  'Y':'right-index',
  'U':'right-index', 'I':'right-middle','O':'right-ring',  'P':'right-pinky',
  'A':'left-pinky',  'S':'left-ring',   'D':'left-middle',
  'F':'left-index',  'G':'left-index',  'H':'right-index',
  'J':'right-index', 'K':'right-middle','L':'right-ring',  ';':'right-pinky',
  'Z':'left-pinky',  'X':'left-ring',   'C':'left-middle',
  'V':'left-index',  'B':'left-index',  'N':'right-index', 'M':'right-index',
  ',':'right-middle','.':'right-ring',  '/':'right-pinky',
};

const GAME_MODES = [
  // 段ごとモード
  { id: 'number-row', name: '数字段',               subtitle: '1 2 3 4 5 6 7 8 9 0',         icon: '🔢', keys: ['1','2','3','4','5','6','7','8','9','0'],                                               color: '#FCC419' },
  { id: 'top-row',    name: '上段',                  subtitle: 'Q W E R T Y U I O P',         icon: '⬆️', keys: ['Q','W','E','R','T','Y','U','I','O','P'],                                           color: '#51CF66' },
  { id: 'home-row',   name: '中段（ホームポジション）', subtitle: 'A S D F G H J K L ;',       icon: '🏠', keys: ['A','S','D','F','G','H','J','K','L',';'],                                           color: '#339AF0' },
  { id: 'bottom-row', name: '下段',                  subtitle: 'Z X C V B N M , . /',         icon: '⬇️', keys: ['Z','X','C','V','B','N','M',',','.','/'],                                           color: '#FF922B' },
  { id: 'all-rows',   name: '上段＋中段＋下段',       subtitle: 'アルファベット＋記号キー',     icon: '🌟', keys: ['Q','W','E','R','T','Y','U','I','O','P','A','S','D','F','G','H','J','K','L',';','Z','X','C','V','B','N','M',',','.','/'], color: '#F06595' },
  { id: 'a-to-z',    name: 'AtoZ',                  subtitle: 'A → B → C → … → Z',          icon: '🔤', keys: ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'], color: '#94A3B8', ordered: true },
  // 指ごとモード（左手）
  { id: 'left-pinky',  name: '左小指',    subtitle: 'Q A Z',     icon: '🤙', keys: ['Q','A','Z'],           color: '#FF6B6B' },
  { id: 'left-ring',   name: '左薬指',    subtitle: 'W S X',     icon: '💍', keys: ['W','S','X'],           color: '#FF922B' },
  { id: 'left-middle', name: '左中指',    subtitle: 'E D C',     icon: '✋', keys: ['E','D','C'],           color: '#FCC419' },
  { id: 'left-index',  name: '左人差し指', subtitle: 'R T F G V B', icon: '👈', keys: ['R','T','F','G','V','B'], color: '#51CF66' },
  // 指ごとモード（右手）
  { id: 'right-index',  name: '右人差し指', subtitle: 'Y U H J N M', icon: '👉', keys: ['Y','U','H','J','N','M'], color: '#339AF0' },
  { id: 'right-middle', name: '右中指',    subtitle: 'I K ,',    icon: '✋', keys: ['I','K',','],           color: '#7950F2' },
  { id: 'right-ring',   name: '右薬指',    subtitle: 'O L .',    icon: '💍', keys: ['O','L','.'],           color: '#F06595' },
  { id: 'right-pinky',  name: '右小指',    subtitle: 'P ; /',    icon: '🤙', keys: ['P',';','/'],           color: '#20C997' },
  // 英単語モード
  { id: 'word-lv1', name: '英単語 中学1年生', subtitle: '基本単語', icon: '📖', wordMode: true, wordLevel: 1, color: '#4ECDC4' },
  { id: 'word-lv2', name: '英単語 中学2年生', subtitle: '標準単語', icon: '📚', wordMode: true, wordLevel: 2, color: '#45B7D1' },
  { id: 'word-lv3', name: '英単語 中学3年生', subtitle: '応用単語', icon: '🎓', wordMode: true, wordLevel: 3, color: '#96CEB4' },
  { id: 'word-mix', name: '英単語 ミックス', subtitle: '全学年混合', icon: '🌀', wordMode: true, wordLevel: 0, color: '#DDA0DD' },
  // 指ごとモード（両手）　ordered時は行ごとに左→右の順
  { id: 'both-index',  name: '両手人差し指', subtitle: 'R T F G V B + Y U H J N M', icon: '🤜🤛', keys: ['R','T','Y','U','F','G','H','J','V','B','N','M'], color: '#22D3EE' },
  { id: 'both-middle', name: '両手中指',    subtitle: 'E D C + I K ,',             icon: '✌️',  keys: ['E','I','D','K','C',','],                         color: '#A78BFA' },
  { id: 'both-ring',   name: '両手薬指',    subtitle: 'W S X + O L .',             icon: '💍💍', keys: ['W','O','S','L','X','.'],                         color: '#FB923C' },
  { id: 'both-pinky',  name: '両手小指',    subtitle: 'Q A Z + P ; /',             icon: '🤙🤙', keys: ['Q','P','A',';','Z','/'],                         color: '#34D399' },
];

// 英単語モード：動詞セット（出現確率を上げるために使用）
const WORD_VERBS = new Set(['accept','achieve','act','add','affect','afford','agree','allow','appear','ask','attack','attend','beg','believe','borrow','bow','break','bring','build','buy','carry','catch','change','check','choose','clean','close','collect','compare','connect','contact','control','copy','count','create','cry','cut','dance','decide','deliver','describe','design','develop','differ','dig','dip','discuss','draw','drive','eat','enable','enjoy','ensure','enter','escape','exist','expect','explain','export','express','extend','feature','fight','finish','fit','fix','float','fly','follow','forget','gather','get','grow','guard','guess','happen','help','hit','hold','imagine','import','improve','inform','inspire','intend','involve','join','jump','keep','knock','laugh','launch','learn','let','lie','listen','live','look','love','make','manage','mark','master','meet','mix','move','need','nod','notice','obtain','offer','open','oppose','order','paint','pass','pat','pay','pet','play','prefer','prepare','prevent','process','produce','protect','provide','pull','push','put','raise','reach','read','realize','receive','record','recycle','reduce','reform','relate','repeat','report','require','respect','return','review','rub','run','save','say','see','select','send','serve','set','share','show','sing','sit','sleep','smile','solve','speak','spend','stand','start','stop','suggest','support','swim','take','talk','tap','teach','tell','think','throw','tie','touch','train','travel','trust','try','use','visit','wag','walk','want','watch','wear','welcome','win','wish','wonder','work']);

// ============================================================
// HELPERS
// ============================================================

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
  if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
  t -= 2.625 / d1;
  return n1 * t * t + 0.984375;
}

function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// KEY SPRITE CACHE
// shadowBlur はここで1回だけ計算し、drawImage で使い回す
// ============================================================

class KeySpriteCache {
  constructor() {
    this.dpr = window.devicePixelRatio || 1;
    this.cache = {};
    this._build();
  }

  _renderSprite(color, darkColor, glowBlur) {
    const sz = 72;
    const pad = 24; // グロー用の余白
    const total = sz + pad * 2;
    const dpr = this.dpr;

    const oc = document.createElement('canvas');
    oc.width = Math.ceil(total * dpr);
    oc.height = Math.ceil(total * dpr);
    const ctx = oc.getContext('2d');
    ctx.scale(dpr, dpr);

    const half = sz / 2;
    const r = 14;
    ctx.translate(total / 2, total / 2);

    // ① グロー付き本体（shadowBlur はここで1回だけ）
    ctx.shadowColor = color;
    ctx.shadowBlur = glowBlur;
    ctx.fillStyle = darkColor;
    roundRect(ctx, -half, -half, sz, sz, r);
    ctx.fill();

    // ② グラデーションオーバーレイ（shadow なし）
    ctx.shadowBlur = 0;
    const grad = ctx.createLinearGradient(-half, -half, -half, half);
    grad.addColorStop(0, rgba(color, 0.82));
    grad.addColorStop(1, rgba(color, 0.18));
    ctx.fillStyle = grad;
    roundRect(ctx, -half, -half, sz, sz, r);
    ctx.fill();

    // ③ ボーダー（shadow なし）
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    roundRect(ctx, -half, -half, sz, sz, r);
    ctx.stroke();

    return { canvas: oc, pad, total };
  }

  _build() {
    for (const [finger, color] of Object.entries(FINGER_COLORS)) {
      const dark = FINGER_COLORS_DARK[finger];
      this.cache[finger + '_n'] = this._renderSprite(color, dark, 10);
      this.cache[finger + '_w'] = this._renderSprite(color, dark, 18);
    }
  }

  get(finger, isWaiting) {
    return this.cache[finger + (isWaiting ? '_w' : '_n')]
        || this.cache['right-index_n'];
  }
}

// ============================================================
// PARTICLE
// ============================================================

class Particle {
  constructor(x, y, color, type = 'burst') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.color = color;

    if (type === 'ring') {
      this.radius = 5;
      this.maxRadius = 70 + Math.random() * 50;
      this.life = 1;
      this.decay = 0.035 + Math.random() * 0.015;
      this.vx = this.vy = this.size = this.gravity = 0;
    } else if (type === 'spark') {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const speed = 3 + Math.random() * 7;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = 2 + Math.random() * 4;
      this.life = 1;
      this.decay = 0.035 + Math.random() * 0.05;
      this.gravity = 0.25;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = 3 + Math.random() * 8;
      this.life = 1;
      this.decay = 0.025 + Math.random() * 0.04;
      this.gravity = 0.12;
    }
  }

  update(dtF = 1) {
    this.life -= this.decay * dtF;
    if (this.type === 'ring') {
      this.radius = lerp(this.radius, this.maxRadius, 1 - Math.pow(0.92, dtF));
    } else {
      this.x += this.vx * dtF;
      this.y += this.vy * dtF;
      this.vy += this.gravity * dtF;
      this.vx *= Math.pow(0.97, dtF);
      this.size *= Math.pow(0.97, dtF);
    }
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    if (this.type === 'ring') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3 * this.life;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10 * this.life;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  isDead() { return this.life <= 0; }
}

// ============================================================
// FLOW KEY
// ============================================================

class FlowKey {
  constructor(letter, startX, centerY) {
    this.letter = letter;
    this.x = startX;
    this.y = centerY;
    this.finger = KEY_FINGER[letter] || 'right-index';
    this.color = FINGER_COLORS[this.finger];
    this.darkColor = FINGER_COLORS_DARK[this.finger];

    this.state = 'flowing'; // flowing | waiting | hit | done
    this.alpha = 0;
    this.scale = 0.5;
    this.age = 0;
    this.hitAge = 0;

    this.wobblePhase = Math.random() * Math.PI * 2;
    this.waitVx = 0;
    this.waitSettled = false;
    this.waitBaseX = 0;
  }

  update(speed, isFirst, lineX, t) {
    this.age++;

    // Fade-in on spawn
    if (this.alpha < 1) this.alpha = Math.min(1, this.alpha + 0.07);
    if (this.scale < 1 && this.state === 'flowing') {
      this.scale = Math.min(1, lerp(this.scale, 1.05, 0.12));
    }

    switch (this.state) {
      case 'flowing': {
        this.x -= speed;
        const dist = this.x - lineX;
        if (dist > 0 && dist < 280) {
          // Subtle grow as approaching line
          const normalized = 1 - dist / 280;
          this.scale = 1 + 0.10 * normalized * normalized;
        } else if (dist <= 0) {
          this.scale = 1;
        }
        break;
      }

      case 'waiting': {
        if (!this.waitSettled) {
          this.waitVx *= 0.80;
          this.x -= this.waitVx;
          if (Math.abs(this.waitVx) < 0.4) {
            this.waitSettled = true;
            this.waitBaseX = this.x;
          }
        } else {
          // Breathing wobble while waiting
          this.x = this.waitBaseX + Math.sin(t * 0.09 + this.wobblePhase) * 7;
        }
        // Pulsing scale while waiting
        this.scale = 1.05 + Math.sin(t * 0.10 + this.wobblePhase) * 0.04;
        break;
      }

      case 'hit': {
        this.hitAge++;
        const p = clamp(this.hitAge / 18, 0, 1);
        this.scale = 1 + p * 1.2;
        this.alpha = 1 - p;
        if (this.hitAge >= 18) this.state = 'done';
        break;
      }
    }
  }

  startWaiting(speed) {
    this.state = 'waiting';
    this.waitVx = speed * 0.5;
    this.waitSettled = false;
  }

  triggerHit() {
    this.state = 'hit';
    this.hitAge = 0;
  }

  // sprites: KeySpriteCache インスタンス
  draw(ctx, sprites) {
    if (this.state === 'done' || this.alpha <= 0.01) return;

    const sprite = sprites.get(this.finger, this.state === 'waiting');
    const { canvas, total } = sprite;
    const half = total / 2;

    ctx.save();
    // 整数ピクセルに揃えてサブピクセルぼけを防ぐ
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.scale(this.scale, this.scale);
    ctx.globalAlpha = clamp(this.alpha, 0, 1);

    // ① キー背景：drawImage は GPU 転送のみ → 超高速
    ctx.drawImage(canvas, -half, -half, total, total);

    // ② 文字：shadowBlur なしでくっきり描画
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(this.letter, 0, 1);
    ctx.fillText(this.letter, 0, 1);

    ctx.restore();
  }
}

// ============================================================
// KEYBOARD DIAGRAM
// ============================================================

const KB_ROWS = [
  { offset: 0,    letters: ['1','2','3','4','5','6','7','8','9','0'] },
  { offset: 0.5,  letters: ['Q','W','E','R','T','Y','U','I','O','P'] },
  { offset: 0.75, letters: ['A','S','D','F','G','H','J','K','L',';'] },
  { offset: 1.25, letters: ['Z','X','C','V','B','N','M',',','.','/'] },
];

class KeyboardDiagram {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rects = {};
    this.pressAnims = {};
    this.targetKey = null;
    this.t = 0;
    this.rebuild();
  }

  rebuild() {
    const dpr = window.devicePixelRatio || 1;
    const W = this.canvas.width / dpr;
    const H = this.canvas.height / dpr;
    if (W <= 0 || H <= 0) return;

    const pad = 16;
    const avail = W - pad * 2;
    // 最も広い行：下段10キー + offset 1.25 → 11.25u + 10.25gap
    const gap = 4;
    const u = Math.min(Math.floor((avail - 10.25 * gap) / 11.25), 52);
    const kh = Math.min(u, 44);
    const totalW = 11.25 * u + 10.25 * gap;
    const totalH = 4 * kh + 3 * gap;
    const sx = (W - totalW) / 2;
    const sy = (H - totalH) / 2;

    this.u = u;
    this.kh = kh;
    this.rects = {};

    KB_ROWS.forEach((row, ri) => {
      const y = sy + ri * (kh + gap);
      const ox = sx + row.offset * (u + gap);
      row.letters.forEach((key, ci) => {
        const x = ox + ci * (u + gap);
        this.rects[key] = { x, y, w: u, h: kh };
      });
    });
  }

  setTarget(key) { this.targetKey = key; }

  press(key) { this.pressAnims[key] = 0; }

  update() {
    this.t++;
    for (const k in this.pressAnims) {
      this.pressAnims[k] += 0.07;
      if (this.pressAnims[k] >= 1) delete this.pressAnims[k];
    }
  }

  draw() {
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;
    const W = this.canvas.width / dpr;
    const H = this.canvas.height / dpr;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0c0c1a';
    ctx.fillRect(0, 0, W, H);

    // Subtle label
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('キーボード（次に押すキーが光ります）', 16, 6);

    for (const [letter, rect] of Object.entries(this.rects)) {
      this._drawKey(ctx, letter, rect);
    }
  }

  _drawKey(ctx, letter, rect) {
    const finger = KEY_FINGER[letter];
    const color = finger ? FINGER_COLORS[finger] : '#555';
    const isTarget = letter === this.targetKey;
    const pressT = this.pressAnims[letter];

    // Press animation
    let sy = 0, sc = 1;
    if (pressT !== undefined) {
      if (pressT < 0.3) {
        sc = lerp(1, 0.82, pressT / 0.3);
        sy = lerp(0, 5, pressT / 0.3);
      } else {
        const t2 = (pressT - 0.3) / 0.7;
        sc = lerp(0.82, 1, easeOutBounce(t2));
        sy = lerp(5, 0, easeOutBounce(t2));
      }
    }

    const pulse = isTarget ? 0.5 + 0.5 * Math.sin(this.t * 0.13) : 0;

    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2 + sy);
    ctx.scale(sc, sc);

    const hw = rect.w / 2;
    const hh = rect.h / 2;
    const r = 6;

    if (isTarget) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 + pulse * 18;
    }

    // Body
    const bodyAlpha = isTarget ? 0.28 + pulse * 0.25 : 0.10;
    ctx.fillStyle = rgba(color, bodyAlpha);
    roundRect(ctx, -hw, -hh, rect.w, rect.h, r);
    ctx.fill();

    // Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isTarget ? color : rgba(color, 0.45);
    ctx.lineWidth = isTarget ? 2 : 1;
    roundRect(ctx, -hw, -hh, rect.w, rect.h, r);
    ctx.stroke();

    // Letter
    if (isTarget) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + pulse * 10;
    }
    ctx.fillStyle = isTarget ? '#fff' : rgba('#fff', 0.55);
    ctx.font = `${isTarget ? 'bold' : 'normal'} ${Math.floor(rect.w * 0.44)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, 0);

    ctx.restore();
  }
}

// ============================================================
// TYPING GAME (main)
// ============================================================

class TypingGame {
  constructor() {
    this.gc = document.getElementById('game-canvas');
    this.ctx = this.gc.getContext('2d');
    this.kc = document.getElementById('keyboard-canvas');
    this.kbd = null;
    this.dpr = window.devicePixelRatio || 1;

    this.state = 'menu';
    this.mode = null;
    this.lastModeId = null;

    this.flowKeys = [];
    this.particles = [];
    this.flashes = [];

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalCount = 0;
    this.hitCount = 0;
    this.perfectCount = 0;

    this.t = 0;
    this.baseSpeed = 4.5;
    this.scrollSpeed = 4.5;
    this.keyQueue = [];
    this.spawnTimer = 0;
    this.baseSpawnInterval = 95;
    this.spawnInterval = 95;
    this.gameDuration = 40000; // ms
    this.timeLeftMs = 0;
    this.demonMode = false;
    this.randomMode = true; // false = ordered（固定順）

    this.lineX = 200;
    this.trackY = 0;
    this.perfectWin = 44;
    this.goodWin = 90;

    this._audioCtx = null;
    this._menuBgKeys = [];
    this._sprites = new KeySpriteCache(); // キースプライトキャッシュ（初回のみ生成）
    this._bgPattern = null;               // 背景ドットパターン

    // 英単語モード状態
    this._wordData = null;       // words.json データ
    this.wordMode = false;
    this.wordPool = [];
    this.wordPoolIdx = 0;
    this.currentWord = null;     // { word, meaning, level }
    this.currentCharIdx = 0;     // 次に打つ文字インデックス
    this.wordsCompleted = 0;
    this._wordEntryErrors = 0;   // 現在の単語内のミス数
    this.memLevel = 1;           // 1=全表示 2=一部ヒント 3=意味のみ
    this._wordFlash = null;      // { type: 'ok'|'miss', life }
    this._wordTransition = false; // 単語切り替えアニメーション中

    this.init();
  }

  init() {
    this._resize();
    window.addEventListener('resize', () => {
      this._resize();
      if (this.kbd) this.kbd.rebuild();
    });
    document.addEventListener('keydown', e => this._onKey(e));

    // キー練習モードボタン（英単語モードボタンは除外）
    document.querySelectorAll('[data-mode]:not([data-word])').forEach(btn => {
      btn.addEventListener('click', () => this.startGame(btn.dataset.mode));
    });

    document.getElementById('btn-back')?.addEventListener('click', () => this.showMenu());
    document.getElementById('btn-menu')?.addEventListener('click', () => this.showMenu());
    document.getElementById('btn-retry')?.addEventListener('click', () => {
      if (this.lastModeId) this.startGame(this.lastModeId);
    });

    // 鬼モードトグル
    document.getElementById('demon-toggle')?.addEventListener('click', () => {
      this.demonMode = !this.demonMode;
      const btn = document.getElementById('demon-toggle');
      btn.classList.toggle('active', this.demonMode);
      btn.textContent = this.demonMode ? '🔥 鬼モード ON' : '💀 鬼モード OFF';
    });

    // ランダムトグル
    document.getElementById('random-toggle')?.addEventListener('click', () => {
      this.randomMode = !this.randomMode;
      const btn = document.getElementById('random-toggle');
      btn.classList.toggle('active', !this.randomMode);
      btn.textContent = this.randomMode ? '🔀 ランダム ON' : '📋 ランダム OFF';
    });

    // 英単語モードボタン（wordMode フラグ付き）
    document.querySelectorAll('[data-mode][data-word]').forEach(btn => {
      btn.addEventListener('click', () => this._startWordGame(btn.dataset.mode));
    });

    // 暗記レベルボタン
    document.querySelectorAll('[data-mem-level]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.memLevel = parseInt(btn.dataset.memLevel, 10);
        document.querySelectorAll('[data-mem-level]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    // words.json をバックグラウンドで先読み
    fetch('/typing-game/words.json')
      .then(r => r.json())
      .then(data => { this._wordData = data; })
      .catch(() => {});

    // Generate background menu demo keys
    this._spawnMenuBgKeys();

    this._lastTime = 0;
    requestAnimationFrame(t => this._loop(t));
  }

  _resize() {
    const setCanvas = (c) => {
      const W = c.offsetWidth;
      const H = c.offsetHeight;
      c.width = W * this.dpr;
      c.height = H * this.dpr;
      const ctx = c.getContext('2d');
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      return { W, H };
    };

    const { W, H } = setCanvas(this.gc);
    this.W = W;
    this.H = H;
    this.trackY = H * 0.5;
    this.lineX = W * 0.5;

    // 背景ドットパターンをキャンバスで1回だけ生成
    this._buildBgPattern();

    if (this.kc.offsetWidth > 0 && this.kc.offsetHeight > 0) {
      setCanvas(this.kc);
      if (!this.kbd) {
        this.kbd = new KeyboardDiagram(this.kc);
      } else {
        this.kbd.rebuild();
      }
    }
  }

  // ── Start / Menu / Result ──────────────────────────────────

  startGame(modeId) {
    this.mode = GAME_MODES.find(m => m.id === modeId);
    if (!this.mode) return;

    // 英単語モードでデータ未ロードの場合はロードしてから再実行
    if (this.mode.wordMode && !this._wordData) {
      fetch('/typing-game/words.json')
        .then(r => r.json())
        .then(data => { this._wordData = data; this.startGame(modeId); });
      return;
    }

    this.lastModeId = modeId;
    this.wordMode = !!this.mode.wordMode;

    this.flowKeys = [];
    this.particles = [];
    this.flashes = [];
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.totalCount = 0; this.hitCount = 0; this.perfectCount = 0; this.missCount = 0;
    this.t = 0;
    this.timeLeftMs = this.gameDuration;

    if (this.wordMode) {
      // 英単語モード初期化
      this.wordsCompleted = 0;
      this.currentWord = null;
      this.currentCharIdx = 0;
      this._wordEntryErrors = 0;
      this._wordFlash = null;
      this._wordTransition = false;
      this._prepareWordPool();
      this._startNextWord();
    } else {
      // キー練習モード初期化
      this.baseSpawnInterval = this.demonMode ? 16 : 95;
      this.spawnInterval = this.baseSpawnInterval;
      this.spawnTimer = this.baseSpawnInterval;
      const ordered = !this.randomMode || !!this.mode.ordered;
      this.keyQueue = this._genQueue(this.mode.keys, this.mode.keys.length * 4, ordered);
    }

    this.state = 'playing';
    document.getElementById('screen-menu').hidden = true;
    document.getElementById('screen-game').hidden = false;
    document.getElementById('screen-result').hidden = true;

    // Re-measure canvases now that they're visible
    this._resize();

    document.getElementById('hud-mode-name').textContent = this.mode.name;
    this._updateHUD();
    this._updateTimer();
  }

  // 英単語モードをデータロード後に起動（ボタンから呼ばれる）
  _startWordGame(modeId) {
    if (!this._wordData) {
      fetch('/typing-game/words.json')
        .then(r => r.json())
        .then(data => { this._wordData = data; this.startGame(modeId); });
    } else {
      this.startGame(modeId);
    }
  }

  // 単語プールを作成（レベル別 + 動詞3倍ウェイト）
  _prepareWordPool() {
    if (!this._wordData) return;
    const lvl = this.mode.wordLevel;
    const filtered = lvl === 0 ? [...this._wordData] : this._wordData.filter(w => w.level === lvl);

    // 動詞は3倍の確率で出現（非動詞は1回、動詞は3回プールに追加）
    const weighted = [];
    for (const w of filtered) {
      weighted.push(w);
      if (WORD_VERBS.has(w.word)) {
        weighted.push(w);
        weighted.push(w);
      }
    }

    // シャッフル
    this.wordPool = weighted.sort(() => Math.random() - 0.5);
    this.wordPoolIdx = 0;
  }

  // 次の単語をセット
  _startNextWord() {
    if (this.wordPool.length === 0) return;
    this.currentWord = this.wordPool[this.wordPoolIdx % this.wordPool.length];
    this.wordPoolIdx++;
    this.currentCharIdx = 0;
    this._wordEntryErrors = 0;
    this._wordTransition = false;
    const firstChar = this.currentWord.word.toUpperCase()[0];
    this.kbd?.setTarget(firstChar);
  }

  showMenu() {
    this.state = 'menu';
    this.flowKeys = [];
    this.particles = [];
    this._spawnMenuBgKeys();
    document.getElementById('screen-menu').hidden = false;
    document.getElementById('screen-game').hidden = true;
    document.getElementById('screen-result').hidden = true;
  }

  showResults() {
    this.state = 'result';
    const acc = this.totalCount > 0 ? Math.round((this.totalCount - this.missCount) / this.totalCount * 100) : 0;
    const rank = this._calcRank(acc, this.missCount === 0 && this.totalCount > 0);
    document.getElementById('screen-menu').hidden = true;
    document.getElementById('screen-game').hidden = true;
    document.getElementById('screen-result').hidden = false;
    document.getElementById('res-rank').textContent = rank;
    document.getElementById('res-rank').className = 'rank rank-' + rank;
    document.getElementById('res-score').textContent = this.score.toLocaleString();
    document.getElementById('res-accuracy').textContent = acc + '%';
    document.getElementById('res-combo').textContent = this.maxCombo;
    if (this.wordMode) {
      document.getElementById('res-perfect-label').textContent = '完了単語数';
      document.getElementById('res-perfect').textContent = this.wordsCompleted + '語';
    } else {
      document.getElementById('res-perfect-label').textContent = 'ミス';
      document.getElementById('res-perfect').textContent = this.missCount;
    }
    document.getElementById('res-mode').textContent = this.mode?.name || '';
  }

  _calcRank(acc, noMiss) {
    if (noMiss) return 'S';
    if (acc >= 90) return 'A';
    if (acc >= 75) return 'B';
    if (acc >= 50) return 'C';
    if (acc >= 25) return 'D';
    return 'E';
  }

  _genQueue(keys, count, ordered = false) {
    const q = [];
    while (q.length < count) {
      q.push(...(ordered ? keys : [...keys].sort(() => Math.random() - 0.5)));
    }
    return q.slice(0, count);
  }

  // ── Input ─────────────────────────────────────────────────

  _onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (this.state === 'menu') {
      if (e.key === 'Enter') {
        const focused = document.querySelector('[data-mode]:focus');
        if (focused) focused.click();
      }
      return;
    }

    if (this.state === 'result') {
      if (e.key === 'Enter') document.getElementById('btn-retry')?.click();
      if (e.key === 'Escape') this.showMenu();
      return;
    }

    if (this.state !== 'playing') return;
    if (e.key === 'Escape') { this.showMenu(); return; }

    // 英単語モードは専用ハンドラへ
    if (this.wordMode) {
      this._onWordKey(e);
      return;
    }

    // キー文字を正規化：英数字は大文字に、記号はそのまま
    const SYMBOL_KEYS = [';', '/', ',', '.'];
    let key;
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
      key = e.key.toUpperCase();
    } else if (SYMBOL_KEYS.includes(e.key)) {
      key = e.key;
    } else {
      return;
    }

    e.preventDefault();
    this.kbd?.press(key);

    const active = this._getActive();
    if (!active) return;

    if (key === active.letter) {
      this._onHit(active);
    } else {
      this._onMiss(active);
    }
  }

  // 英単語モードのキー入力処理
  _onWordKey(e) {
    if (!this.currentWord || this._wordTransition) return;
    if (e.key.length !== 1 || !/[a-zA-Z]/.test(e.key)) return;
    e.preventDefault();

    const key = e.key.toUpperCase();
    const word = this.currentWord.word; // 小文字のまま
    const target = word[this.currentCharIdx].toUpperCase();

    this.kbd?.press(key);

    if (key === target) {
      // 正解
      this.currentCharIdx++;
      this.hitCount++;
      this.totalCount++;
      const color = FINGER_COLORS[KEY_FINGER[key] || 'right-index'];
      this._wordFlash = { type: 'ok', life: 1, color };
      this._playSound('perfect');

      if (this.currentCharIdx >= word.length) {
        // 単語完了！
        this._onWordComplete();
      } else {
        this.kbd?.setTarget(word[this.currentCharIdx].toUpperCase());
        this._spawnParticles(this.W * 0.5, this.H * 0.38, color, 'ok');
      }
    } else {
      // ミス
      this._wordEntryErrors++;
      this.missCount++;
      this.totalCount++;
      this.combo = 0;
      this._wordFlash = { type: 'miss', life: 1, color: '#FF4444' };
      this._playSound('wrong');
      this._showJudgment('miss');
      this._addFlash(this.W * 0.5, this.H * 0.38, '#FF4444', 'miss');
    }
    this._updateHUD();
  }

  _onWordComplete() {
    const noError = this._wordEntryErrors === 0;
    this.wordsCompleted++;
    const color = noError ? '#FFD700' : '#74C0FC';

    if (noError) {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 500 + Math.min(this.combo, 20) * 25;
      this._showJudgment('perfect');
      this._spawnParticles(this.W * 0.5, this.H * 0.38, color, 'perfect');
      this._addFlash(this.W * 0.5, this.H * 0.38, color, 'perfect');
    } else {
      this.combo = 0;
      this.score += Math.max(100, 300 - this._wordEntryErrors * 40);
      this._showJudgment('good');
      this._spawnParticles(this.W * 0.5, this.H * 0.38, color, 'good');
    }

    this._playSound(noError ? 'perfect' : 'good');
    this._wordTransition = true;
    this._wordFlash = { type: noError ? 'perfect' : 'ok', life: 1, color };
    this._updateHUD();

    // 少し待ってから次の単語へ
    setTimeout(() => {
      if (this.state === 'playing' && this.timeLeftMs > 0) {
        this._startNextWord();
      }
    }, 500);
  }

  _getActive() {
    return this.flowKeys.find(k => k.state === 'flowing' || k.state === 'waiting');
  }

  _onHit(key) {
    const signedDist = key.x - this.lineX;
    // ラインより手前（右側）で押した = 早打ち → PERFECT
    // ライン上 perfectWin 以内 → PERFECT
    // goodWin 以内 → GOOD
    // それ以上遅れ → OK
    const isEarly = signedDist > 0;
    const judgment = isEarly                                      ? 'perfect'
                   : Math.abs(signedDist) <= this.perfectWin     ? 'perfect'
                   : Math.abs(signedDist) <= this.goodWin        ? 'good'
                   : 'ok';

    // 早打ちのたびにキー間隔を縮める（密度アップ）→ 鬼モード中は固定密度なので無効
    if (isEarly && !this.demonMode) {
      this.spawnInterval = Math.max(this.spawnInterval * 0.88, this.baseSpawnInterval * 0.35);
    }

    const cx = this.lineX;
    const cy = this.trackY;

    key.triggerHit();
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.hitCount++;

    const baseScore = judgment === 'perfect' ? 300
                    : judgment === 'good'    ? 200 : 100;
    this.score += baseScore + Math.min(this.combo, 10) * 10;
    if (judgment === 'perfect') this.perfectCount++;

    this._spawnParticles(cx, cy, key.color, judgment);
    this._addFlash(cx, cy, key.color, judgment);
    this._showJudgment(judgment);
    this._playSound(judgment);
    this._updateHUD();
  }

  _onMiss(key) {
    this._addFlash(this.lineX, this.trackY, '#FF4444', 'miss');
    this._showJudgment('miss');
    this._playSound('wrong');
  }

  // ── Effects ───────────────────────────────────────────────

  _spawnParticles(x, y, color, judgment) {
    const counts = { perfect: 22, good: 12, ok: 6 };
    const n = counts[judgment] || 4;
    for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color, 'burst'));
    if (judgment === 'perfect') {
      for (let i = 0; i < 3; i++) {
        const ring = new Particle(x, y, color, 'ring');
        ring.decay = 0.028 + i * 0.01;
        ring.maxRadius = 55 + i * 35;
        this.particles.push(ring);
      }
      for (let i = 0; i < 10; i++) this.particles.push(new Particle(x, y, '#FFD700', 'spark'));
    } else if (judgment === 'good') {
      const ring = new Particle(x, y, color, 'ring');
      this.particles.push(ring);
    }
  }

  _addFlash(x, y, color, judgment) {
    this.flashes.push({
      x, y, color,
      alpha: judgment === 'perfect' ? 0.85 : 0.45,
      radius: judgment === 'perfect' ? 100 : 65,
      decay: judgment === 'perfect' ? 0.05 : 0.07,
    });
  }

  _showJudgment(judgment) {
    const el = document.getElementById('judgment-text');
    if (!el) return;
    const map = { perfect: 'PERFECT!', good: 'GOOD!', ok: 'OK', miss: 'MISS' };
    const col = { perfect: '#FFD700', good: '#51CF66', ok: '#74C0FC', miss: '#FF6B6B' };
    el.textContent = map[judgment] || '';
    el.style.color = col[judgment] || '#fff';
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  _playSound(type) {
    try {
      if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ac = this._audioCtx;
      if (ac.state === 'suspended') ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      const now = ac.currentTime;

      if (type === 'perfect') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      } else if (type === 'good') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(820, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.09);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      } else if (type === 'ok') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      }
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  }

  // ── HUD ───────────────────────────────────────────────────

  _updateHUD() {
    const el = id => document.getElementById(id);
    el('hud-combo').textContent = this.combo;
    el('hud-score').textContent = this.score.toLocaleString();
  }

  _updateTimer() {
    const secs = Math.ceil(this.timeLeftMs / 1000);
    document.getElementById('hud-remaining').textContent = secs + 's';
  }

  // ── Game Loop ─────────────────────────────────────────────

  _loop(now) {
    // デルタタイム：60fps = dtF 1.0 に正規化
    if (!this._lastTime) this._lastTime = now;
    const dt = Math.min(now - this._lastTime, 50); // 最大50ms（タブ非アクティブ対策）
    const dtF = dt / (1000 / 60);
    this._lastTime = now;

    this._update(dtF, dt);
    this._render();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dtF = 1, dt = 1000 / 60) {
    this.t += dtF;
    this.kbd?.update();

    if (this.state === 'playing') {
      if (this.wordMode) {
        this._updateWordMode(dtF, dt);
      } else {
        this._updateKeyMode(dtF, dt);
      }
    } else if (this.state === 'menu') {
      this._updateMenuBg(dtF);
    }
  }

  _updateWordMode(dtF, dt) {
    this.timeLeftMs = Math.max(0, this.timeLeftMs - dt);
    this._updateTimer();

    // wordFlash ライフ減衰
    if (this._wordFlash) {
      this._wordFlash.life -= 0.06 * dtF;
      if (this._wordFlash.life <= 0) this._wordFlash = null;
    }

    this.particles = this.particles.filter(p => { p.update(dtF); return !p.isDead(); });
    this.flashes = this.flashes.filter(f => { f.alpha -= f.decay * dtF; return f.alpha > 0; });

    if (this.timeLeftMs <= 0 && this.state === 'playing') {
      setTimeout(() => this.showResults(), 600);
      this.state = 'ending';
    }
  }

  _updateKeyMode(dtF, dt) {
      // タイマーカウントダウン
      this.timeLeftMs = Math.max(0, this.timeLeftMs - dt);
      this._updateTimer();

      // Spawn keys（時間が残っている＆重なりなし）
      this.spawnTimer += dtF;
      if (this.spawnTimer >= this.spawnInterval && this.timeLeftMs > 0 && this._canSpawnKey()) {
        this._spawnKey();
        this.spawnTimer = 0;
      }

      const active = this._getActive();
      const waiting = active?.state === 'waiting';

      for (const k of this.flowKeys) {
        if (k.state === 'done') continue;
        const freeze = waiting && k !== active && k.state !== 'hit';
        // dtF を掛けた速度を渡す → フレームレートに依存しない動き
        if (!freeze) k.update(this.scrollSpeed * dtF, k === active, this.lineX, this.t);

        // Check if key missed the line
        if (k.state === 'flowing' && k === active) {
          if (k.x < this.lineX - this.goodWin - 20) {
            k.startWaiting(this.scrollSpeed);
            this.combo = 0;
            this.missCount++;
            this.spawnInterval = this.baseSpawnInterval; // ミスで密度リセット
            this._updateHUD();
          }
        }
      }

      this.kbd?.setTarget(active?.letter || null);

      this.particles = this.particles.filter(p => { p.update(dtF); return !p.isDead(); });
      this.flashes = this.flashes.filter(f => { f.alpha -= f.decay * dtF; return f.alpha > 0; });

      // Game end: タイマー切れ＆画面上のキーが全て処理済み
      if (this.timeLeftMs <= 0 && !this.flowKeys.some(k => k.state === 'flowing' || k.state === 'waiting')) {
        setTimeout(() => this.showResults(), 800);
        this.state = 'ending';
      }
  }

  _spawnKey() {
    if (this.keyQueue.length === 0) {
      const ordered = !this.randomMode || !!this.mode.ordered;
      this.keyQueue = this._genQueue(this.mode.keys, this.mode.keys.length * 4, ordered);
    }
    const letter = this.keyQueue.shift();
    this.flowKeys.push(new FlowKey(letter, this.W + 90, this.trackY));
    this.totalCount++;
  }

  // 次のキーをスポーンしても重ならないか確認
  _canSpawnKey() {
    const spawnX = this.W + 90;
    const KEY_SIZE = 76; // キー本体幅(72px) + 最小余白
    for (const k of this.flowKeys) {
      if (k.state === 'done') continue;
      if (spawnX - k.x < KEY_SIZE) return false;
    }
    return true;
  }

  // ── Menu background animation ─────────────────────────────

  _spawnMenuBgKeys() {
    this._menuBgKeys = [];
    const letters = 'ASDFGHJKLQWERTYUIOPZXCVBNM';
    for (let i = 0; i < 6; i++) {
      const letter = letters[Math.floor(Math.random() * letters.length)];
      this._menuBgKeys.push({
        letter,
        x: Math.random() * (this.W || 800) * 0.8 + 100,
        y: (Math.random() * 0.6 + 0.2) * (this.H || 400),
        alpha: Math.random() * 0.4 + 0.1,
        scale: 0.4 + Math.random() * 0.6,
        color: FINGER_COLORS[KEY_FINGER[letter]] || '#888',
        vx: -(0.5 + Math.random() * 1),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  _updateMenuBg(dtF = 1) {
    for (const k of this._menuBgKeys) {
      k.x += k.vx * dtF;
      k.alpha = 0.08 + Math.sin(this.t * 0.02 + k.phase) * 0.06;
      if (k.x < -100) {
        k.x = (this.W || 800) + 50;
        k.y = (Math.random() * 0.6 + 0.2) * (this.H || 400);
        const letters = 'ASDFGHJKL';
        k.letter = letters[Math.floor(Math.random() * letters.length)];
        k.color = FINGER_COLORS[KEY_FINGER[k.letter]] || '#888';
      }
    }
  }

  // ── Render ────────────────────────────────────────────────

  _render() {
    this._renderGame();
    this.kbd?.draw();
  }

  _renderGame() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    this._drawBg(ctx, W, H);

    if (this.state === 'menu') {
      this._drawMenuBg(ctx, W, H);
      return;
    }

    // 英単語モードは専用レンダー
    if (this.wordMode) {
      this._renderWordMode(ctx, W, H);
      return;
    }

    this._drawTrack(ctx, W, H);
    this._drawFlashes(ctx);
    this._drawJudgeLine(ctx, W, H);

    // Particles behind keys
    for (const p of this.particles) p.draw(ctx);

    // Keys（スプライトキャッシュを渡す）
    for (const k of this.flowKeys) k.draw(ctx, this._sprites);

    // Perfect window hint
    this._drawJudgeAccent(ctx);

    this._drawComboDisplay(ctx, W, H);
  }

  // ── 英単語モード レンダリング ─────────────────────────────
  _renderWordMode(ctx, W, H) {
    if (!this.currentWord) return;

    const word = this.currentWord.word; // 小文字のまま表示
    const meaning = this.currentWord.meaning;

    // フラッシュエフェクト
    this._drawFlashes(ctx);
    for (const p of this.particles) p.draw(ctx);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // === 暗記レベル表示（左上） ===
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'left';
    ctx.fillText('暗記レベル ' + '★'.repeat(this.memLevel), 12, 14);
    ctx.textAlign = 'center';

    // === ヒント表示（上部） ===
    const hintY = H * 0.22;

    // 意味（常に表示）
    ctx.font = `bold ${clamp(Math.floor(H * 0.09), 18, 32)}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.85;
    ctx.fillText(meaning, W * 0.5, hintY);
    ctx.globalAlpha = 1;

    // === 単語文字ボックス（中央） ===
    const centerY = H * 0.55;
    const maxBoxW = Math.min(72, Math.floor((W * 0.9) / word.length) - 6);
    const boxW = Math.max(28, maxBoxW);
    const boxH = boxW;
    const gap = Math.max(4, boxW * 0.1);
    const totalW = word.length * boxW + (word.length - 1) * gap;
    const startX = (W - totalW) / 2;

    for (let i = 0; i < word.length; i++) {
      const ch = word[i]; // 小文字
      const finger = KEY_FINGER[ch.toUpperCase()] || 'right-index';
      const color = FINGER_COLORS[finger];
      const isTyped   = i < this.currentCharIdx;
      const isCurrent = i === this.currentCharIdx;
      // isCurrent でも isTyped でもなければ upcoming

      // 表示する文字を決定（暗記レベルによる）
      let displayChar = ch;
      if (!isTyped) {
        if (this.memLevel === 2 && i > 0 && i < word.length - 1) displayChar = '_';
        else if (this.memLevel === 3) displayChar = '_';
      }

      // 現在のキーは少しボックスを大きく見せる
      const inflate = isCurrent ? 4 : 0;
      const bx = startX + i * (boxW + gap) - inflate / 2;
      const by = centerY - boxH / 2      - inflate / 2;
      const bw = boxW + inflate;
      const bh = boxH + inflate;
      const r  = Math.min(12, bw * 0.16);

      // ── 背景ボックス ──
      if (isTyped) {
        ctx.fillStyle = rgba('#51CF66', 0.18);
      } else if (isCurrent) {
        ctx.fillStyle = rgba(color, 0.30);
      } else {
        // upcoming: やや明るめ（薄い指色）
        ctx.fillStyle = rgba(color, 0.12);
      }
      roundRect(ctx, bx, by, bw, bh, r);
      ctx.fill();

      // ── ボーダー ──
      if (isTyped) {
        ctx.strokeStyle = rgba('#51CF66', 0.45);
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, bw, bh, r);
        ctx.stroke();
      } else if (isCurrent) {
        // 脈動グロー
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 0.14);
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 16 + pulse * 14;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        roundRect(ctx, bx, by, bw, bh, r);
        ctx.stroke();
        ctx.restore();
      } else {
        // upcoming: 指色のボーダーをちゃんと見せる
        ctx.strokeStyle = rgba(color, 0.55);
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, bw, bh, r);
        ctx.stroke();
      }

      // ── 文字テキスト ──
      const fontSize = Math.floor(bw * 0.52);
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isTyped) {
        // 入力済み：緑（やや控えめ）
        ctx.fillStyle = rgba('#51CF66', 0.65);
      } else if (isCurrent) {
        // 現在のキー：真っ白 + 指色のグロー
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(displayChar, bx + bw / 2, by + bh / 2);
        ctx.restore();
        continue; // fillText 済みなので skip
      } else {
        // upcoming：ちゃんと白く読める
        ctx.fillStyle = 'rgba(220, 220, 220, 0.85)';
      }
      ctx.fillText(displayChar, bx + bw / 2, by + bh / 2);
    }

    // === ワードフラッシュ（画面下部の細いバー演出・文字を邪魔しない） ===
    if (this._wordFlash && this._wordFlash.life > 0) {
      const life = this._wordFlash.life;
      ctx.save();
      const barH = Math.round(H * 0.04 * life);
      ctx.globalAlpha = life * 0.7;
      ctx.fillStyle = this._wordFlash.color;
      ctx.fillRect(0, H - barH, W, barH);
      ctx.restore();
    }

    // === コンボ表示 ===
    this._drawComboDisplay(ctx, W, H);

    // === 完了単語数（右上） ===
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.wordsCompleted}語完了`, W - 12, 14);

    ctx.restore();
  }

  // 背景ドットを OffscreenCanvas に1回だけ描いてパターン化
  _buildBgPattern() {
    const gs = 36;
    const oc = document.createElement('canvas');
    oc.width = gs;
    oc.height = gs;
    const pc = oc.getContext('2d');
    pc.fillStyle = 'rgba(255,255,255,0.03)';
    pc.beginPath();
    pc.arc(gs / 2, gs / 2, 1.2, 0, Math.PI * 2);
    pc.fill();
    // createPattern は main canvas のコンテキストが必要
    this._bgPattern = this.ctx.createPattern(oc, 'repeat');
  }

  _drawBg(ctx, W, H) {
    // 単色塗り（グラデーションは毎フレーム生成せず固定色で代替）
    ctx.fillStyle = '#0a0a1c';
    ctx.fillRect(0, 0, W, H);

    // ドットグリッド：fillRect 1回で完了（個別 arc ループなし）
    if (this._bgPattern) {
      ctx.fillStyle = this._bgPattern;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawMenuBg(ctx, W, H) {
    // Draw the floating bg keys
    for (const k of this._menuBgKeys) {
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.scale(k.scale, k.scale);
      ctx.globalAlpha = k.alpha;

      const sz = 72, half = 36, r = 14;
      const dark = FINGER_COLORS_DARK[KEY_FINGER[k.letter]] || '#222';

      ctx.fillStyle = dark;
      roundRect(ctx, -half, -half, sz, sz, r);
      ctx.fill();

      const grad = ctx.createLinearGradient(-half, -half, -half, half);
      grad.addColorStop(0, rgba(k.color, 0.6));
      grad.addColorStop(1, rgba(k.color, 0.1));
      ctx.fillStyle = grad;
      roundRect(ctx, -half, -half, sz, sz, r);
      ctx.fill();

      ctx.strokeStyle = k.color;
      ctx.lineWidth = 2;
      roundRect(ctx, -half, -half, sz, sz, r);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(k.letter, 0, 0);
      ctx.restore();
    }
  }

  _drawTrack(ctx, W, H) {
    const tw = H * 0.22;
    const ty = this.trackY - tw / 2;
    const grad = ctx.createLinearGradient(0, ty, 0, ty + tw);
    grad.addColorStop(0, 'rgba(255,255,255,0.02)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.055)');
    grad.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, ty, W, tw);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ty + tw); ctx.lineTo(W, ty + tw); ctx.stroke();
  }

  _drawFlashes(ctx) {
    for (const f of this.flashes) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.alpha);
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
      grad.addColorStop(0, f.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(f.x - f.radius, f.y - f.radius, f.radius * 2, f.radius * 2);
      ctx.restore();
    }
  }

  _drawJudgeLine(ctx, W, H) {
    const x = this.lineX;
    const pulse = 0.65 + 0.35 * Math.sin(this.t * 0.07);

    // shadowBlur の代わりに多重ストロークでグロー表現（高速）
    ctx.save();
    ctx.lineCap = 'round';

    // 縦ライン：太→細の順に重ねてグロー風に
    for (const [lw, alpha] of [[8, 0.04], [4, 0.08], [1.5, 0.55]]) {
      ctx.globalAlpha = alpha * pulse;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // ターゲット円
    const cy = this.trackY;
    const rr = 42;
    for (const [lw, alpha] of [[8, 0.04], [4, 0.07], [2, 0.45]]) {
      ctx.globalAlpha = alpha * pulse;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(x, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawJudgeAccent(ctx) {
    // Subtle perfect window highlight
    const x = this.lineX;
    const cy = this.trackY;
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - this.perfectWin, cy - 42, this.perfectWin * 2, 84);
    ctx.restore();
  }

  _drawComboDisplay(ctx, W, H) {
    if (this.combo < 3) return;
    // Big combo text in background, fades based on combo magnitude
    const alpha = Math.min(0.18, this.combo * 0.006);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(200, 60 + this.combo * 3)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.combo, W / 2, H / 2);
    ctx.restore();
  }
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  window._typingGame = new TypingGame();
});
