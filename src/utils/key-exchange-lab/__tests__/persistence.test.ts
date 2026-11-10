import { test } from 'node:test';
import assert from 'node:assert/strict';
import { block, find, newLab } from './helpers.ts';
import { KeyLab } from '../engine/world.ts';

test('保存→読込で状態が戻る（JSON文字列を経由）', () => {
  const w = newLab();
  w.startScenario('dh');
  w.send('person-001', block(w, 'person-001', ['P']).uid, 'person-002');
  w.runMachine('person-001', 'combine', [block(w, 'person-001', ['P']).uid, block(w, 'person-001', ['S:person-001']).uid]);
  const text = JSON.stringify(w.toJSON());
  const r = newLab();
  r.load(JSON.parse(text));
  assert.equal(r.mode, 'scenario');
  assert.equal(r.scenario?.id, 'dh');
  assert.deepEqual(r.scenario?.steps.map((s) => s.done), [true, false, false, false, false], '進み具合は再判定される');
  assert.deepEqual(JSON.parse(JSON.stringify(r.devices.map((d) => ({ ...d, items: d.items.map(({ uid, ...x }) => x) })))),
    JSON.parse(JSON.stringify(w.devices.map((d) => ({ ...d, items: d.items.map(({ uid, ...x }) => x) })))));
  assert.deepEqual(r.connections, w.connections);
  assert.equal(r.log.length, w.log.length);
  assert.ok(block(r, 'person-001', ['P', 'S:person-001']));
});

test('保存データの形：simulator・mode・scenario・flags・devices・connections・log', () => {
  const w = newLab();
  w.startScenario('passkey');
  const j = w.toJSON() as any;
  assert.equal(j.version, '1.0');
  assert.equal(j.simulator, 'key-exchange');
  assert.equal(j.mode, 'scenario');
  assert.equal(j.scenario.id, 'passkey');
  assert.deepEqual(Object.keys(j.devices[0]).sort(), ['config', 'height', 'id', 'items', 'name', 'ports', 'state', 'type', 'width', 'x', 'y']);
  assert.equal(j.devices[0].ports.nics[0].id, 'net');
  assert.ok(j.connections[0].from.deviceId && j.connections[0].to.portId);
});

test('完了済みの記録は読み込んでも残る。読込後に続きの識別子が重ならない', () => {
  const w = newLab();
  w.startScenario('passkey');
  w.runMachine('server-001', 'challenge', []);
  w.scenario!.completed = true;
  w.scenario!.completedAt = '2026-11-10T02:29:41.000Z';
  const r = newLab();
  r.load(JSON.parse(JSON.stringify(w.toJSON())));
  assert.equal(r.scenario?.completed, true);
  assert.equal(r.scenario?.completedAt, '2026-11-10T02:29:41.000Z');
  r.runMachine('server-001', 'challenge', []);
  const cids = r.dev('server-001')!.items.filter((i) => i.kind === 'challenge').map((i: any) => i.cid);
  assert.equal(new Set(cids).size, 2);
});

test('別のシミュレータのファイルは読み込まない', () => {
  const w = newLab();
  assert.throws(() => w.load({ version: '1.0', devices: [], connections: [] }), /鍵交換ラボ/);
  assert.throws(() => w.load({ simulator: 'network', version: '1.0', devices: [] }), /鍵交換ラボ/);
  assert.throws(() => w.load(null));
});

test('自由モードの保存→読込', () => {
  const w = newLab();
  w.startFree();
  w.makeDevice('eve', 5, 5, { mitm: true });
  const r = new KeyLab();
  r.load(JSON.parse(JSON.stringify(w.toJSON())));
  assert.equal(r.mode, 'free');
  assert.equal(r.scenario, null);
  assert.equal(r.devices.length, 4);
  assert.equal(r.dev('eve-001')!.config.mitm, true);
});

test('読み込み後に操作を続けられる（dh の続き）', () => {
  const w = newLab();
  w.startScenario('dh');
  w.send('person-001', block(w, 'person-001', ['P']).uid, 'person-002');
  const r = newLab();
  r.load(JSON.parse(JSON.stringify(w.toJSON())));
  const res = r.runMachine('person-002', 'combine', [block(r, 'person-002', ['P']).uid, block(r, 'person-002', ['S:person-002']).uid]);
  assert.equal(res.tone, 'ok');
  find(r, 'person-002', 'block');
});
