// 自由モード課題の提出判定（UI非依存）。シナリオモード用の submission.ts とは別に持つ。
// ブラウザ内で作られるJSONなので、手作業の改ざんを完全には防げない（既存の判定と同じ前提）。
import { isSecret, sameParts } from './engine/items.ts';
import type { ItemData, LogEntry } from './engine/types.ts';
import { KeyLab } from './engine/world.ts';
import { buildMitmTemplate, buildReplayTemplate, buildSwapTemplate, buildThreePersonTemplate, SWAP_DOC_TEXT } from './templates.ts';
import type { SubmissionResult } from './submission.ts';

interface FreeTaskSpec {
  title: string;
  /** 合格したときのメッセージ */
  okMessage: string;
  template: () => Record<string, unknown>;
  /** 共通の確認（構成・追加の禁止）のあとに行う、課題ごとの判定。合格なら null を返す */
  judge: (lab: KeyLab, log: LogEntry[]) => SubmissionResult | null;
}

const bad = (message: string): SubmissionResult => ({ valid: false, message });
const asLog = (x: unknown): LogEntry[] => (Array.isArray(x) ? (x as LogEntry[]) : []);
const connKey = (c: any): string => [c?.from?.deviceId, c?.to?.deviceId].sort().join('~');


// ---------- 課題⑥ 3人で共有鍵を作る ----------
const FINAL3 = ['P', 'S:person-001', 'S:person-002', 'S:person-003'];
const MEMBERS3 = ['person-001', 'person-002', 'person-003'];
const OUTSIDER3 = 'eve-001';

function judgeThree(lab: KeyLab, log: LogEntry[]): SubmissionResult | null {
  // e. 通信路に流してはいけないもの
  const sent = log.filter((e) => (e.action === 'send' || e.action === 'intercept') && e.item);
  if (sent.some((e) => isSecret(e.item as ItemData))) {
    return bad('秘密の素材だけの鍵を、通信路に流してしまっています。テンプレートを読み込み直して、やり直しましょう。');
  }
  if (sent.some((e) => {
    const it = e.item as ItemData;
    return it.kind === 'block' && sameParts(it.parts, FINAL3);
  })) {
    return bad('共有鍵そのものを、通信路に流してしまっています。共有鍵は、通信路に出さずに作るものです。');
  }

  // c. 3人全員が共有鍵を持っているか
  const holds = (id: string) => (lab.dev(id)?.items ?? []).some((i) => i.kind === 'block' && sameParts(i.parts, FINAL3));
  const lack = MEMBERS3.filter((id) => !holds(id));
  if (lack.length) {
    return bad(`${lack.map((id) => lab.dev(id)?.name ?? id).join('・')}がまだ共有鍵を持っていません。`);
  }

  // d. イブが共有鍵を持っていないか
  if (holds(OUTSIDER3)) {
    return bad(`${lab.dev(OUTSIDER3)?.name ?? 'イブ'}も共有鍵を持っています。盗み見されても作られないように、何を送るかを見直しましょう。`);
  }

  // f. 3人それぞれが、自分で共有鍵を合成した記録があるか
  const noLog = MEMBERS3.filter((id) => !log.some((e) =>
    e.action === 'combine' && e.device === id && Array.isArray(e.result) && sameParts(e.result as string[], FINAL3)));
  if (noLog.length) {
    return bad(`操作ログに、${noLog.map((id) => lab.dev(id)?.name ?? id).join('・')}が共有鍵を合成した記録がありません。自分の操作で最後まで進めたファイルを提出してください。`);
  }
  return null;
}

// ---------- 課題⑦ 中間者攻撃を成功させる ----------
const ALICE_KEY = ['P', 'S:person-001', 'S:eve-001'];
const BOB_KEY = ['P', 'S:person-002', 'S:eve-001'];
const REAL_KEY = ['P', 'S:person-001', 'S:person-002'];

function judgeMitm(lab: KeyLab, log: LogEntry[]): SubmissionResult | null {
  const holds = (id: string, parts: string[]) =>
    (lab.dev(id)?.items ?? []).some((i) => i.kind === 'block' && sameParts(i.parts, parts));
  const sent = log.filter((e) => (e.action === 'send' || e.action === 'intercept') && e.item);
  const isBlock = (e: LogEntry, parts: string[]) => {
    const it = e.item as ItemData;
    return it.kind === 'block' && sameParts(it.parts, parts);
  };

  // 通信路に流してはいけないもの（イブの秘密も同じ）
  if (sent.some((e) => isSecret(e.item as ItemData))) {
    return bad('秘密の素材だけの鍵を、通信路に流してしまっています。テンプレートを読み込み直して、やり直しましょう。');
  }
  if (sent.some((e) => isBlock(e, ALICE_KEY) || isBlock(e, BOB_KEY) || isBlock(e, REAL_KEY))) {
    return bad('完成した鍵そのものを、通信路に流してしまっています。完成した鍵は、持ち主が自分の手元で作るものです。');
  }
  // 2人は、本物の共有鍵（P＋A＋B）を持っていてはいけない（イブが素通しすると、攻撃になっていない）
  if (holds('person-001', REAL_KEY) || holds('person-002', REAL_KEY)) {
    return bad('アリスとボブが、本物の共有鍵 P＋A＋B を作れてしまっています。これでは、イブは通信を素通ししただけで、攻撃になっていません。');
  }
  // イブが横取りした記録（アリス宛・ボブ宛の両方）
  const stolenFrom = (id: string) => log.some((e) => e.action === 'intercept' && e.from === id && e.by === 'eve-001');
  if (!stolenFrom('person-001') || !stolenFrom('person-002')) {
    return bad('イブが、アリスとボブの両方の通信を横取りした記録がありません。イブを「中間者」にして、2人が送ったものを横取りしましょう。');
  }
  // アリス・ボブの鍵
  if (!holds('person-001', ALICE_KEY)) return bad('アリスが、自分とイブの秘密を合わせた鍵（P＋A＋E）をまだ持っていません。');
  if (!holds('person-002', BOB_KEY)) return bad('ボブが、自分とイブの秘密を合わせた鍵（P＋B＋E）をまだ持っていません。');
  // イブは両方の鍵を持つ
  const lackEve = [ALICE_KEY, BOB_KEY].filter((k) => !holds('eve-001', k));
  if (lackEve.length) {
    return bad('イブが、' + (lackEve.length === 2 ? 'アリスとボブの両方の' : lackEve[0] === ALICE_KEY ? 'アリスの' : 'ボブの') + '鍵をまだ持っていません。2人の鍵を、イブも作れる状態にしましょう。');
  }
  // 自分の操作で合成した記録
  const combined = (id: string, parts: string[]) =>
    log.some((e) => e.action === 'combine' && e.device === id && Array.isArray(e.result) && sameParts(e.result as string[], parts));
  const need: [string, string[], string][] = [
    ['person-001', ALICE_KEY, 'アリス'], ['person-002', BOB_KEY, 'ボブ'],
    ['eve-001', ALICE_KEY, 'イブ（アリスの鍵）'], ['eve-001', BOB_KEY, 'イブ（ボブの鍵）'],
  ];
  const noLog = need.filter(([id, parts]) => !combined(id, parts));
  if (noLog.length) {
    return bad(`操作ログに、${noLog.map((n) => n[2]).join('・')}が鍵を合成した記録がありません。自分の操作で最後まで進めたファイルを提出してください。`);
  }
  return null;
}

// ---------- 課題⑧ 通信回数を節約して3人で鍵交換 ----------
/** 送信回数の上限。3人の場合の理論上の最小回数（総当たりで確認ずみ）。テストでも、この回数でできることを確かめている */
export const THREE_MIN_SENDS = 7;

function judgeThreeMin(lab: KeyLab, log: LogEntry[]): SubmissionResult | null {
  const base = judgeThree(lab, log);
  if (base) return base;
  // 「送る」操作はすべて数える（同じものを何度も送った分も含む）
  const sends = log.filter((e) => e.action === 'send').length;
  if (sends > THREE_MIN_SENDS) {
    return bad(`3人とも共有鍵を作れていますが、送信が${sends}回あります。${THREE_MIN_SENDS}回以内で作れるように、誰が何を誰に送るかを見直しましょう。`);
  }
  return null;
}

// ---------- 課題⑨ 盗み見た返事でログインしてみる（リプレイ攻撃） ----------
const PHONE = 'phone-001', SITE = 'server-001', EVE = 'eve-001';

function judgeReplay(_lab: KeyLab, log: LogEntry[]): SubmissionResult | null {
  const sent = log.filter((e) => (e.action === 'send' || e.action === 'intercept') && e.item);
  if (sent.some((e) => isSecret(e.item as ItemData))) {
    return bad('スマホの秘密鍵を、通信路に流してしまっています。テンプレートを読み込み直して、やり直しましょう。');
  }
  const sigSend = (from: string) => (e: LogEntry) =>
    e.action === 'send' && e.from === from && e.to === SITE && (e.item as ItemData)?.kind === 'sig';
  const cidOf = (e: LogEntry) => (e.item as Extract<ItemData, { kind: 'sig' }>).cid;
  const okVerify = (cid: unknown) => log.find((v) => v.action === 'verify' && v.device === SITE && v.result === 'success' && v.cid === cid);

  // 対象外の操作：サイトが確かめる前に、イブが返事を送った（先回り）
  for (const e of log.filter(sigSend(EVE))) {
    const v = okVerify(cidOf(e));
    if (!v || v.step > e.step) {
      return bad('イブが、サイトが確かめる前に返事を送っています。この課題では、スマホで正しくログインしたあとで、イブが盗み見た返事を使い回してください。テンプレートを読み込み直して、やり直しましょう。');
    }
  }
  // スマホからの返事で、正しくログインした記録
  const legit = log.find((v) => v.action === 'verify' && v.device === SITE && v.result === 'success' &&
    log.some((e) => sigSend(PHONE)(e) && cidOf(e) === v.cid && e.step < v.step));
  if (!legit) return bad('スマホが送った返事で、Webサイトにログインした記録がありません。まずは、スマホで正しくログインしましょう。');
  // イブがその返事のコピーを持っていた（盗み見た）
  if (!log.some((e) => e.action === 'send' && e.from === PHONE && Array.isArray(e.tappedBy) && (e.tappedBy as string[]).length > 0 &&
    (e.item as ItemData)?.kind === 'sig' && cidOf(e) === legit.cid)) {
    return bad('スマホの返事が、イブに盗み見された記録がありません。');
  }
  // イブが使い回しを試し、サイトが拒否した
  const replaySend = log.find((e) => sigSend(EVE)(e) && cidOf(e) === legit.cid);
  if (!replaySend) return bad('イブが、盗み見た返事をWebサイトに送った記録がありません。イブとしてログインを試してみましょう。');
  const refused = log.some((v) => v.action === 'verify' && v.device === SITE && v.result === 'failure' &&
    v.reason === 'replay' && v.cid === legit.cid && v.step > replaySend.step);
  if (!refused) return bad('イブが送った返事を、Webサイトの検証台で確かめた記録がありません。届いた返事でログインできるか、確かめてみましょう。');
  return null;
}

// ---------- 課題⑩ 公開鍵をすり替えて、偽の文書を本物と信じさせる ----------
const ALICE = 'person-001', BOB = 'person-002';
const ALICE_PAIR = 'pk-alice';

function judgeSwap(lab: KeyLab, log: LogEntry[]): SubmissionResult | null {
  if (!lab.flags.hideKeyOwner) {
    return bad('このファイルは、課題のテンプレートの設定（受け取った鍵の持ち主名を伏せる）が外れています。テンプレートを読み込み直して、やり直しましょう。');
  }
  const sent = log.filter((e) => (e.action === 'send' || e.action === 'intercept') && e.item);
  if (sent.some((e) => isSecret(e.item as ItemData))) {
    return bad('秘密鍵を、通信路に流してしまっています。秘密鍵は持ち主の手元から出さずに、やり直しましょう。');
  }
  // アリスが署名して送り、イブが横取りした
  if (!log.some((e) => e.action === 'docsign' && e.device === ALICE)) {
    return bad('アリスが文書に署名した記録がありません。');
  }
  const stole = (kind: ItemData['kind']) => log.some((e) => e.action === 'intercept' && e.from === ALICE && e.by === EVE && (e.item as ItemData)?.kind === kind);
  if (!stole('pubkey') || !stole('doc')) {
    return bad('イブが、アリスの送った公開鍵と文書の両方を横取りした記録がありません。アリスからボブへ、公開鍵と署名つきの文書を送りましょう。');
  }
  // ボブは本物のアリスの公開鍵を持っていてはいけない（素通しでは攻撃になっていない）
  if ((lab.dev(BOB)?.items ?? []).some((i) => i.kind === 'pubkey' && i.pair === ALICE_PAIR)) {
    return bad('ボブが、本物のアリスの公開鍵を持っています。これでは、イブは公開鍵をすり替えられていません。');
  }
  // イブ自身の鍵ペア
  const eveMade = log.filter((e) => e.action === 'keymake' && e.device === EVE).map((e) => e.pair);
  if (!eveMade.length) return bad('イブが、自分の鍵ペアを作った記録がありません。');
  // ボブの検証で、書き換えた文書が「本物」と判定された
  const fooled = log.some((e) => e.action === 'docverify' && e.device === BOB && e.result === 'valid' &&
    e.text !== SWAP_DOC_TEXT && eveMade.includes(e.keyPair) && e.sigPair === e.keyPair);
  if (!fooled) {
    return bad('ボブが、書き換えられた文書を「本物です」と確かめた記録がありません。ボブの手元にある公開鍵で確かめると、どうなるでしょう。');
  }
  return null;
}

const FREE_TASKS: Record<string, FreeTaskSpec> = {
  'key-exchange-three-min': {
    title: '鍵交換課題⑧通信回数を節約して3人で鍵交換',
    okMessage: `「鍵交換課題⑧通信回数を節約して3人で鍵交換」：${THREE_MIN_SENDS}回以内の送信で、3人が同じ共有鍵を作れています。`,
    template: buildThreePersonTemplate,
    judge: judgeThreeMin,
  },
  'key-exchange-replay': {
    title: '鍵交換課題⑨盗み見た返事でログインしてみる',
    okMessage: '「鍵交換課題⑨盗み見た返事でログインしてみる」：スマホは正しくログインでき、イブの使い回しは拒否されています。',
    template: buildReplayTemplate,
    judge: judgeReplay,
  },
  'key-exchange-swap': {
    title: '鍵交換課題⑩公開鍵をすり替えて、偽の文書を信じさせる',
    okMessage: '「鍵交換課題⑩公開鍵をすり替えて、偽の文書を信じさせる」：ボブは、イブが書き換えた文書を本物だと信じてしまいました。',
    template: buildSwapTemplate,
    judge: judgeSwap,
  },
  'key-exchange-three': {
    title: '鍵交換課題⑥3人で共有鍵を作る',
    okMessage: '「鍵交換課題⑥3人で共有鍵を作る」：3人が同じ共有鍵を作り、イブには作れない状態になっています。',
    template: buildThreePersonTemplate,
    judge: judgeThree,
  },
  'key-exchange-mitm': {
    title: '鍵交換課題⑦中間者攻撃を成功させる',
    okMessage: '「鍵交換課題⑦中間者攻撃を成功させる」：アリスとボブが別々の鍵を持ち、イブが両方を読める状態になっています。',
    template: buildMitmTemplate,
    judge: judgeMitm,
  },
};

export function validateFreeSubmission(data: any, taskId: string): SubmissionResult {
  const spec = FREE_TASKS[taskId];
  if (!spec) return bad('課題の設定が見つかりません。');
  if (!data || typeof data !== 'object' || data.simulator !== 'key-exchange') {
    return bad('鍵交換シミュレータの保存ファイルではありません。シミュレータの「保存」で出力したJSONを提出してください。');
  }
  if (data.mode !== 'free' || data.scenario) {
    return bad('自由モードで保存したファイルではありません。課題ページの「テンプレートJSON」を読み込んで、自由モードのまま作業してください。');
  }
  const lab = new KeyLab();
  try {
    lab.load(data);
  } catch (e) {
    return bad('ファイルを読み込めませんでした：' + (e as Error).message);
  }

  // b. デバイスの構成がテンプレートと同じか（追加・削除・つなぎ替えがない）
  const tpl = new KeyLab();
  tpl.load(spec.template());
  const sameIds = lab.devices.length === tpl.devices.length &&
    tpl.devices.every((t) => lab.dev(t.id)?.type === t.type);
  if (!sameIds) {
    return bad('デバイスの構成がテンプレートと違います。デバイスを追加・削除せず、テンプレートのまま作業してください。');
  }
  const tplConn = tpl.connections.map(connKey).sort().join('|');
  if (lab.connections.map(connKey).sort().join('|') !== tplConn) {
    return bad('つながりがテンプレートと違います。つなぎ替えずに作業してください。');
  }
  const log = lab.log;
  if (log.some((e) => e.action === 'add-device' || e.action === 'remove-device')) {
    return bad('デバイスを追加・削除した記録があります。テンプレートのまま作業してください。');
  }
  if (log.some((e) => e.action === 'add-item')) {
    return bad('持ち物を手で足した記録があります。最初の持ち物だけで作業してください。');
  }

  const failed = spec.judge(lab, log);
  if (failed) return failed;
  return { valid: true, message: spec.okMessage };
}

/** 自由モード課題のID一覧（提出画面が判定を切り替えるために使う） */
export const isFreeTask = (taskId: string): boolean => taskId in FREE_TASKS;
