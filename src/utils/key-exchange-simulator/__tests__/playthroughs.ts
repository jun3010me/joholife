// 5シナリオを最後まで操作して完了させる（提出判定のテスト用）
import { block, find, newLab } from './helpers.ts';
import type { KeyLab } from '../engine/world.ts';

const A = 'person-001', B = 'person-002', EVE = 'eve-001';

export function solve(id: string): KeyLab {
  const w = newLab();
  w.startScenario(id);
  SOLVERS[id](w);
  return w;
}

const SOLVERS: Record<string, (w: KeyLab) => void> = {
  dh(w) {
    w.send(A, block(w, A, ['P']).uid, B);
    w.runMachine(A, 'combine', [block(w, A, ['P']).uid, block(w, A, ['S:person-001']).uid]);
    w.runMachine(B, 'combine', [block(w, B, ['P']).uid, block(w, B, ['S:person-002']).uid]);
    w.send(A, block(w, A, ['P', 'S:person-001']).uid, B);
    w.send(B, block(w, B, ['P', 'S:person-002']).uid, A);
    w.runMachine(A, 'combine', [block(w, A, ['P', 'S:person-002']).uid, block(w, A, ['S:person-001']).uid]);
    w.runMachine(B, 'combine', [block(w, B, ['P', 'S:person-001']).uid, block(w, B, ['S:person-002']).uid]);
    w.runMachine(EVE, 'combine', [block(w, EVE, ['P', 'S:person-001']).uid, block(w, EVE, ['P', 'S:person-002']).uid]);
  },
  passkey(w) {
    const S = 'server-001', P = 'phone-001';
    w.runMachine(S, 'challenge', []);
    w.send(S, find(w, S, 'challenge').uid, P);
    w.runMachine(P, 'keygen', [find(w, P, 'challenge').uid]);
    w.send(P, find(w, P, 'pubkey').uid, S);
    w.runMachine(S, 'challenge', []);
    const c2 = w.dev(S)!.items.filter((i) => i.kind === 'challenge')[1] as any;
    w.send(S, c2.uid, P);
    const c2p = w.dev(P)!.items.find((i) => i.kind === 'challenge' && i.cid === c2.cid)!;
    w.runMachine(P, 'sign', [find(w, P, 'privkey').uid, c2p.uid]);
    w.send(P, find(w, P, 'sig').uid, S);
    w.runMachine(S, 'verify', [find(w, S, 'pubkey').uid, find(w, S, 'sig').uid]);
  },
  phish(w) {
    const P = 'phone-001', real = 'server-001', fake = 'server-002';
    w.runMachine(fake, 'challenge', []);
    w.send(fake, find(w, fake, 'challenge').uid, P);
    w.runMachine(P, 'sign', [find(w, P, 'privkey').uid, find(w, P, 'challenge', (c) => c.site === 'yamazon.com.sagi').uid]);
    w.runMachine(real, 'challenge', []);
    w.send(real, find(w, real, 'challenge').uid, P);
    w.runMachine(P, 'sign', [find(w, P, 'privkey').uid, find(w, P, 'challenge', (c) => c.site === 'yamazon.com').uid]);
    w.send(P, find(w, P, 'sig').uid, real);
    w.runMachine(real, 'verify', [find(w, real, 'pubkey').uid, find(w, real, 'sig').uid]);
  },
  sig(w) {
    w.runMachine(A, 'docsign', [find(w, A, 'privkey').uid, find(w, A, 'doc', (d) => !d.sig).uid]);
    w.send(A, find(w, A, 'doc', (d) => !!d.sig).uid, B);
    w.runMachine(EVE, 'tamper', [find(w, EVE, 'doc').uid]);
    w.send(EVE, find(w, EVE, 'doc', (d) => d.text.startsWith('イブに')).uid, B);
    w.runMachine(B, 'docverify', [find(w, B, 'pubkey').uid, find(w, B, 'doc').uid]);
    w.send(EVE, find(w, EVE, 'doc', (d) => d.text.startsWith('ボブに')).uid, B);
    const good = w.dev(B)!.items.find((i) => i.kind === 'doc' && i.text.startsWith('ボブに'))!;
    w.runMachine(B, 'docverify', [find(w, B, 'pubkey').uid, good.uid]);
  },
  cert(w) {
    const S = 'server-001', CA = 'ca-001', PC = 'pc-001';
    w.runMachine(S, 'keymake', []);
    w.send(S, find(w, S, 'pubkey').uid, CA);
    w.runMachine(CA, 'issue', [find(w, CA, 'pubkey').uid]);
    w.send(CA, find(w, CA, 'cert').uid, S);
    w.send(S, find(w, S, 'cert').uid, PC);
    w.runMachine(PC, 'certcheck', [find(w, PC, 'cert').uid]);
    w.send(EVE, find(w, EVE, 'cert', (c) => c.issuer === 'イブ').uid, PC);
    w.runMachine(PC, 'certcheck', [find(w, PC, 'cert', (c) => c.issuer === 'イブ').uid]);
  },
};
