// 問題演習「鍵交換シミュレータ」の課題一覧。1つのシナリオが1つの課題（提出して修了証を発行する）。
// 課題を足すときは、ここに追加し、pages/quiz/ にページを作り、
// public/questions/index.yaml と pages/quiz/index.astro の categoryConfig にも追加する。
export interface KeyExchangeTask {
  /** 問題演習の単元ID（URLは /quiz/<id>） */
  id: string;
  /** 'scenario'：シナリオモードを完了して提出／'free'：自由モードで作った状態を提出 */
  mode: 'scenario' | 'free';
  /** シミュレータのシナリオID（mode が scenario のときだけ） */
  scenarioId?: string;
  title: string;
  description: string;
  icon: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;
  /** 課題の説明（Markdown風） */
  body: string;
  /** 合格後に表示する短い解説（任意。解答そのものにならないこと） */
  explanation?: string;
}

export const KEY_EXCHANGE_TASKS: KeyExchangeTask[] = [
  {
    id: 'key-exchange-dh', mode: 'scenario', scenarioId: 'dh', title: '鍵交換課題①ディフィー・ヘルマン鍵交換',
    description: '盗み見される通信路で、共有鍵を安全に作る', icon: '🔑', difficulty: 'medium', estimatedTime: 15,
    body: `**課題**\n鍵交換シミュレータの「**ディフィー・ヘルマン鍵交換**」のシナリオを、最後まで完了してください。\n\n- アリスとボブが、盗み見されている通信路を使って、同じ共有鍵を作る\n- イブが同じものを作れないことを確かめる\n\n完了したら「💾 保存」でJSONファイルを出力し、下に提出してください。`,
  },
  {
    id: 'key-exchange-passkey', mode: 'scenario', scenarioId: 'passkey', title: '鍵交換課題②パスキーで登録してログイン',
    description: '秘密鍵を端末から出さずに、Webサイトにログインする', icon: '📱', difficulty: 'medium', estimatedTime: 15,
    body: `**課題**\n鍵交換シミュレータの「**パスキーで登録してログイン**」のシナリオを、最後まで完了してください。\n\n- スマホの中で鍵ペアを作り、公開鍵だけをサイトに登録する\n- 署名つきの返事でログインする\n\n完了したら「💾 保存」でJSONファイルを出力し、下に提出してください。`,
  },
  {
    id: 'key-exchange-phish', mode: 'scenario', scenarioId: 'phish', title: '鍵交換課題③偽サイトにだまされない',
    description: 'パスキーが偽サイトには反応しないことを確かめる', icon: '🎣', difficulty: 'easy', estimatedTime: 10,
    body: `**課題**\n鍵交換シミュレータの「**偽サイトにだまされない**」のシナリオを、最後まで完了してください。\n\n- 偽サイト（yamazon.com.sagi）のチャレンジには、署名が拒否される\n- 本物のサイトではログインできる\n\n完了したら「💾 保存」でJSONファイルを出力し、下に提出してください。`,
  },
  {
    id: 'key-exchange-sig', mode: 'scenario', scenarioId: 'sig', title: '鍵交換課題④デジタル署名で改ざんを見破る',
    description: '署名で「だれが書いたか」「書き換えられていないか」を確かめる', icon: '✍️', difficulty: 'medium', estimatedTime: 15,
    body: `**課題**\n鍵交換シミュレータの「**デジタル署名で改ざんを見破る**」のシナリオを、最後まで完了してください。\n\n- アリスが文書に署名し、イブが途中で書き換える\n- ボブが公開鍵で確かめて、改ざんを見破る\n\n完了したら「💾 保存」でJSONファイルを出力し、下に提出してください。`,
  },
  {
    id: 'key-exchange-cert', mode: 'scenario', scenarioId: 'cert', title: '鍵交換課題⑤デジタル証明書でなりすましを防ぐ',
    description: '認証局の証明書で、公開鍵が本物かを確かめる', icon: '🔒', difficulty: 'medium', estimatedTime: 15,
    body: `**課題**\n鍵交換シミュレータの「**デジタル証明書でなりすましを防ぐ**」のシナリオを、最後まで完了してください。\n\n- 認証局が証明書を発行し、ブラウザが本物と確認する\n- イブの偽の証明書は拒否される\n\n完了したら「💾 保存」でJSONファイルを出力し、下に提出してください。`,
  },
  {
    id: 'key-exchange-three', mode: 'free', title: '鍵交換課題⑥3人で共有鍵を作る',
    description: '自由モードで、アリス・ボブ・キャロルが同じ共有鍵を作る', icon: '👥', difficulty: 'hard', estimatedTime: 25,
    body: `**課題**\n鍵交換シミュレータの「**自由モード**」で、アリス・ボブ・キャロルの3人が、同じ共有鍵 **P＋A＋B＋C** を作ってください。\n\n**条件**\n- 秘密の素材（A・B・Cだけの鍵）や、共有鍵そのものを通信路に送らないこと\n- イブ（盗み見している人）には、共有鍵を作れないこと\n- デバイスを増やしたり、持ち物を手で足したりしないこと\n\n**ヒント**\n共有鍵は送れません。他の2人の素材を合わせた鍵を、全員に回しましょう。\n\n完了したら「💾 保存」でJSONファイルを出力し、下に提出してください。`,
    explanation: '共有鍵は通信路を通らず、3人がそれぞれ自分の手元で完成させます。途中の鍵だけを盗み見たイブには、足りない素材が残ります。',
  },
];

export const taskById = (id: string): KeyExchangeTask | undefined => KEY_EXCHANGE_TASKS.find((t) => t.id === id);
