import { test } from 'node:test';
import assert from 'node:assert/strict';
import { block, find, newLab } from './helpers.ts';
import { itemKey, isSecret } from '../engine/items.ts';
import { SCENARIO_LIST } from '../scenarios/index.ts';

test('接続のルール：盗聴者はインターネットにだけ、インターネットは送信先にできない', () => {
  const w = newLab();
  w.startFree();
  const eve = w.makeDevice('eve', 10, 300);
  const r = w.connect('eve-001', 'person-001') as any;
  assert.equal(r.tone, 'warn');
  assert.equal(w.connect(eve.id, 'internet-001', true), true);
  const a = w.dev('person-001')!;
  w.give(a, { kind: 'block', parts: ['P'] });
  assert.equal(w.send('person-001', a.items[0].uid, 'internet-001').tone, 'warn');
});

test('通信路がつながっていないと送れない。人物は中継しない', () => {
  const w = newLab();
  w.startFree();
  w.unlink('conn-002');
  const a = w.dev('person-001')!;
  w.give(a, { kind: 'block', parts: ['P'] });
  assert.equal(w.send('person-001', a.items[0].uid, 'person-002').tone, 'warn');
  const c = w.makeDevice('person', 0, 0);
  w.connect('person-001', c.id, true);
  assert.equal(w.route('person-001', 'person-002'), null);
});

test('同じ中身のアイテムは1つにまとめる。block は並び順に関係なく同じ', () => {
  const w = newLab();
  w.startFree();
  const a = w.dev('person-001')!;
  w.give(a, { kind: 'block', parts: ['S:person-001', 'P'] });
  w.give(a, { kind: 'block', parts: ['P', 'S:person-001'] });
  assert.equal(a.items.length, 1);
  assert.equal(itemKey({ kind: 'sig', pair: 'p', cid: 'c', nonce: '0', site: 's' }), 's:p:c');
  assert.equal(isSecret({ kind: 'block', parts: ['S:person-001'] }), true);
  assert.equal(isSecret({ kind: 'block', parts: ['P', 'S:person-001'] }), false);
});

test('盗聴者を2人つなぐと、どちらにもコピーされる', () => {
  const w = newLab();
  w.startScenario('dh');
  const e2 = w.makeDevice('eve', 0, 0, { id: 'eve-002' });
  w.connect(e2.id, 'internet-001', true);
  const r = w.send('person-001', block(w, 'person-001', ['P']).uid, 'person-002');
  assert.ok(r.text.includes('イブ'));
  assert.ok(block(w, 'eve-002', ['P']));
  assert.ok(block(w, 'eve-001', ['P']));
});

test('チャレンジの nonce は4桁16進', () => {
  const w = newLab();
  w.startScenario('passkey');
  w.runMachine('server-001', 'challenge', []);
  const c = find(w, 'server-001', 'challenge');
  assert.ok(c.kind === 'challenge' && /^[0-9A-F]{4}$/.test(c.nonce));
});

test('すべてのシナリオが start できて、手順が1つ以上ある', () => {
  for (const sc of SCENARIO_LIST) {
    const w = newLab();
    const { open } = w.startScenario(sc.id);
    assert.ok(open.every((id) => w.dev(id)), sc.id);
    assert.ok(sc.steps.length >= 3, sc.id);
    assert.equal(w.scenario?.steps.length, sc.steps.length);
  }
});

test('初期配置：すべてのデバイスがキャンバス内に収まり、列の間隔は吹き出し幅＋14', () => {
  for (const sc of SCENARIO_LIST) {
    const w = newLab();
    w.startScenario(sc.id);
    for (const d of w.devices) {
      assert.ok(d.x >= 0 && d.x + d.width <= w.size.w, `${sc.id}/${d.id} x=${d.x}`);
      assert.ok(d.y >= 0 && d.y + d.height <= w.size.h, `${sc.id}/${d.id} y=${d.y}`);
    }
  }
  const w = newLab();
  w.startScenario('dh');
  assert.equal(w.dev('person-002')!.x - w.dev('person-001')!.x, 274 * 2);
});
