import { test } from 'node:test';
import assert from 'node:assert/strict';
import { block, find, has, newLab } from './helpers.ts';
import { DH_FINAL } from '../scenarios/dh.ts';
import { hash } from '../engine/items.ts';

const A = 'person-001', B = 'person-002', EVE = 'eve-001';

test('dh: 最後まで操作すると completed になる', () => {
  const w = newLab();
  w.startScenario('dh');
  assert.equal(w.scenario?.completed, false);
  w.send(A, block(w, A, ['P']).uid, B);
  w.runMachine(A, 'combine', [block(w, A, ['P']).uid, block(w, A, ['S:person-001']).uid]);
  w.runMachine(B, 'combine', [block(w, B, ['P']).uid, block(w, B, ['S:person-002']).uid]);
  w.send(A, block(w, A, ['P', 'S:person-001']).uid, B);
  w.send(B, block(w, B, ['P', 'S:person-002']).uid, A);
  w.runMachine(A, 'combine', [block(w, A, ['P', 'S:person-002']).uid, block(w, A, ['S:person-001']).uid]);
  const r = w.runMachine(B, 'combine', [block(w, B, ['P', 'S:person-001']).uid, block(w, B, ['S:person-002']).uid]);
  assert.ok(r.text.includes('合成鍵'));
  assert.ok(block(w, A, DH_FINAL) && block(w, B, DH_FINAL));
  assert.equal(w.scenario?.completed, false, '4手順まで');
  // イブは盗み見た鍵どうしで合成を試す
  const e1 = block(w, EVE, ['P', 'S:person-001']).uid, e2 = block(w, EVE, ['P', 'S:person-002']).uid;
  const e = w.runMachine(EVE, 'combine', [e1, e2]);
  assert.equal(w.flags.eveTried, true);
  assert.ok(e.text.includes('一致しません'));
  assert.equal(w.scenario?.completed, true);
  assert.equal(w.scenario?.failed, false);
  assert.equal(e.scenario?.tone, 'ok');
  assert.equal(w.scenario?.completedAt, '2026-11-10T02:30:00.000Z');
});

test('dh: 秘密の素材を送ると、盗聴者がいれば bad、イブが共有鍵を持てば失敗', () => {
  const w = newLab();
  w.startScenario('dh');
  const r = w.send(A, block(w, A, ['S:person-001']).uid, B);
  assert.equal(r.tone, 'bad');
  assert.ok(has(w, EVE, 'block', (i) => i.parts.join() === 'S:person-001'));
});

test('dh: 盗聴者がいない経路では送ってはいけないものは warn', () => {
  const w = newLab();
  w.startScenario('dh');
  w.removeDevice(EVE);
  const r = w.send(A, block(w, A, ['S:person-001']).uid, B);
  assert.equal(r.tone, 'warn');
});

function passkeyLogin(w: ReturnType<typeof newLab>) {
  const S = 'server-001', P = 'phone-001';
  w.runMachine(S, 'challenge', []);
  w.send(S, find(w, S, 'challenge').uid, P);
  w.runMachine(P, 'keygen', [find(w, P, 'challenge').uid]);
  w.send(P, find(w, P, 'pubkey').uid, S);
  w.runMachine(S, 'challenge', []);
  const c2 = w.dev(S)!.items.filter((i) => i.kind === 'challenge')[1];
  w.send(S, c2.uid, P);
  const c2p = w.dev(P)!.items.find((i) => i.kind === 'challenge' && i.cid === (c2 as any).cid)!;
  w.runMachine(P, 'sign', [find(w, P, 'privkey').uid, c2p.uid]);
  w.send(P, find(w, P, 'sig').uid, S);
  return w.runMachine(S, 'verify', [find(w, S, 'pubkey').uid, find(w, S, 'sig').uid]);
}

test('passkey: 最後まで操作すると completed になる。イブが返事を盗み見ても使い回せない', () => {
  const w = newLab();
  w.startScenario('passkey');
  const r = passkeyLogin(w);
  assert.equal(r.tone, 'ok');
  assert.equal(w.scenario?.completed, true);
  // 盗み見た署名つき返事をイブがサーバに送って使い回す
  const stolen = find(w, EVE, 'sig');
  w.send(EVE, stolen.uid, 'server-001');
  const sv = w.dev('server-001')!;
  const again = w.runMachine('server-001', 'verify', [find(w, 'server-001', 'pubkey').uid, sv.items.find((i) => i.kind === 'sig')!.uid]);
  assert.equal(again.tone, 'warn');
  assert.ok(again.text.includes('もう使われています'));
});

test('passkey: 秘密鍵を送るとイブに渡り、失敗になる', () => {
  const w = newLab();
  w.startScenario('passkey');
  const S = 'server-001', P = 'phone-001';
  w.runMachine(S, 'challenge', []);
  w.send(S, find(w, S, 'challenge').uid, P);
  w.runMachine(P, 'keygen', [find(w, P, 'challenge').uid]);
  const r = w.send(P, find(w, P, 'privkey').uid, S);
  assert.equal(r.tone, 'bad');
  assert.equal(w.scenario?.failed, true);
  assert.equal(r.scenario?.tone, 'bad');
});

test('passkey: 使用済みチャレンジは鍵ペア生成も署名も拒否する', () => {
  const w = newLab();
  w.startScenario('passkey');
  const S = 'server-001', P = 'phone-001';
  w.runMachine(S, 'challenge', []);
  w.send(S, find(w, S, 'challenge').uid, P);
  const c = find(w, P, 'challenge');
  w.runMachine(P, 'keygen', [c.uid]);
  assert.equal(w.runMachine(P, 'keygen', [c.uid]).tone, 'warn');
  assert.equal(w.runMachine(P, 'sign', [find(w, P, 'privkey').uid, c.uid]).tone, 'warn');
});

test('phish: 偽サイトでは署名が拒否され、本物でログインすると completed', () => {
  const w = newLab();
  w.startScenario('phish');
  const P = 'phone-001', real = 'server-001', fake = 'server-002';
  w.runMachine(fake, 'challenge', []);
  w.send(fake, find(w, fake, 'challenge').uid, P);
  const r = w.runMachine(P, 'sign', [find(w, P, 'privkey').uid, find(w, P, 'challenge', (c) => c.site === 'yamazon.com.sagi').uid]);
  assert.equal(w.flags.phishBlocked, true);
  assert.equal(r.tone, 'warn');
  assert.ok(!has(w, P, 'sig'), '署名は作られない');
  w.runMachine(real, 'challenge', []);
  w.send(real, find(w, real, 'challenge').uid, P);
  w.runMachine(P, 'sign', [find(w, P, 'privkey').uid, find(w, P, 'challenge', (c) => c.site === 'yamazon.com').uid]);
  w.send(P, find(w, P, 'sig').uid, real);
  const v = w.runMachine(real, 'verify', [find(w, real, 'pubkey').uid, find(w, real, 'sig').uid]);
  assert.equal(v.tone, 'ok');
  assert.equal(w.scenario?.completed, true);
});

test('sig: 中間者が横取りすると相手に届かず、書き換えは検証で見破られる', () => {
  const w = newLab();
  w.startScenario('sig');
  w.runMachine(A, 'docsign', [find(w, A, 'privkey').uid, find(w, A, 'doc', (d) => !d.sig).uid]);
  const signed = find(w, A, 'doc', (d) => !!d.sig);
  const r = w.send(A, signed.uid, B);
  assert.ok(r.text.includes('横取り'));
  assert.ok(!has(w, B, 'doc'), 'ボブには届かない');
  assert.ok(has(w, EVE, 'doc', (d) => !!d.sig));
  w.runMachine(EVE, 'tamper', [find(w, EVE, 'doc').uid], { tamperText: 'イブに10,000円払います' });
  const forged = find(w, EVE, 'doc', (d) => d.text.startsWith('イブに'));
  assert.equal(forged.kind === 'doc' && forged.sig?.h, hash('ボブに1,000円払います'), '署名はそのまま');
  w.send(EVE, forged.uid, B);
  assert.ok(has(w, B, 'doc', (d) => d.text.startsWith('イブに')), 'イブが送れば届く');
  const v = w.runMachine(B, 'docverify', [find(w, B, 'pubkey').uid, find(w, B, 'doc').uid]);
  assert.equal(v.tone, 'bad');
  assert.equal(w.flags.tamperDetected, true);
  // 元の文書をそのまま転送すれば本物と確認できる
  const orig = find(w, EVE, 'doc', (d) => d.text.startsWith('ボブに'));
  w.send(EVE, orig.uid, B);
  const bobDocs = w.dev(B)!.items.filter((i) => i.kind === 'doc');
  assert.equal(bobDocs.length, 2);
  const good = bobDocs.find((d) => d.kind === 'doc' && d.text.startsWith('ボブに'))!;
  const v2 = w.runMachine(B, 'docverify', [find(w, B, 'pubkey').uid, good.uid]);
  assert.equal(v2.tone, 'ok');
  assert.equal(w.flags.docVerified, true);
  assert.equal(w.scenario?.completed, true);
});

test('sig: 署名のない文書・別人の公開鍵は検証で弾かれる', () => {
  const w = newLab();
  w.startScenario('sig');
  w.send(A, find(w, A, 'pubkey').uid, B);
  // 未署名の文書を直接ボブに持たせる
  w.give(w.dev(B)!, { kind: 'doc', text: 'x' }, true);
  const r = w.runMachine(B, 'docverify', [find(w, B, 'pubkey').uid, find(w, B, 'doc').uid]);
  assert.equal(r.tone, 'warn');
});

test('cert: 最後まで操作すると completed になる。偽証明書は拒否される', () => {
  const w = newLab();
  w.startScenario('cert');
  const S = 'server-001', CA = 'ca-001', PC = 'pc-001';
  w.runMachine(S, 'keymake', []);
  w.send(S, find(w, S, 'pubkey').uid, CA);
  w.runMachine(CA, 'issue', [find(w, CA, 'pubkey').uid]);
  w.send(CA, find(w, CA, 'cert').uid, S);
  w.send(S, find(w, S, 'cert').uid, PC);
  const ok = w.runMachine(PC, 'certcheck', [find(w, PC, 'cert').uid]);
  assert.equal(ok.tone, 'ok');
  assert.equal(w.dev(PC)!.state.secure, true);
  assert.ok(has(w, EVE, 'cert', (c) => c.issuer === '認証局'), '証明書は公開情報なので盗み見されてよい');
  assert.equal(w.scenario?.failed, false);
  const fake = find(w, EVE, 'cert', (c) => c.issuer === 'イブ');
  w.send(EVE, fake.uid, PC);
  const bad = w.runMachine(PC, 'certcheck', [find(w, PC, 'cert', (c) => c.issuer === 'イブ').uid]);
  assert.equal(bad.tone, 'bad');
  assert.equal(w.flags.fakeCertRejected, true);
  assert.equal(w.scenario?.completed, true);
});

test('cert: subject が違う本物の証明書も拒否。認証局は自分の公開鍵に証明書を出さない', () => {
  const w = newLab();
  w.startScenario('cert');
  const PC = 'pc-001', CA = 'ca-001';
  w.give(w.dev(PC)!, { kind: 'cert', subject: 'yamazon.com.sagi', pair: 'pk-x', issuer: '認証局', caPair: 'pk-ca' });
  assert.equal(w.runMachine(PC, 'certcheck', [find(w, PC, 'cert').uid]).tone, 'bad');
  w.give(w.dev(CA)!, { kind: 'pubkey', pair: 'pk-ca', site: '認証局' });
  assert.equal(w.runMachine(CA, 'issue', [find(w, CA, 'pubkey', (p) => p.pair === 'pk-ca').uid]).tone, 'warn');
});
