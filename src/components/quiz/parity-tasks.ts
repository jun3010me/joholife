// 問題演習「パリティチェック」の課題一覧。1つの課題が1つの提出ページ（/quiz/<id>）。
// 課題を足すときは、ここに追加し、pages/quiz/ にページを作り、
// public/questions/index.yaml と pages/quiz/index.astro の categoryConfig にも追加する。
export interface ParityTask {
  /** 問題演習の単元ID（URLは /quiz/<id>） */
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;
  /** 課題の説明（Markdown風） */
  body: string;
  /** 合格後に表示する短い解説 */
  explanation?: string;
}

export const PARITY_TASKS: ParityTask[] = [
  {
    id: 'parity-1', title: 'パリティ課題①偶数・奇数パリティ',
    description: 'カードを送って、ノイズに気づけるかを偶数・奇数の両方で確かめる', icon: '🃏', difficulty: 'easy', estimatedTime: 15,
    body: `**課題**\n「パリティチェック体験」ページの**ステージ1（偶数パリティ）**と**ステージ2（奇数パリティ）**で、次の問題を**自分の手順で**クリアしてください。\n\n- 偶数パリティ：「1枚反転」「2枚反転」「全部0が届く」\n- 奇数パリティ：「1枚反転」「2枚反転」「全部0が届く」\n\n（計6種類。受信側で1の数を数え、「正しく届いた」「誤りあり」を自分で選びます）\n\n**注意**\n- 「答えを見る」を押した問題は、クリアに数えません\n- 「全部0が届く」は、データを1枚以上めくって、1がある状態で送ってください\n\n完了したら、ページの「💾 保存」でJSONファイルを出力し、下に提出してください。`,
    explanation: '1枚の反転は必ず気づけますが、2枚の反転は見逃します。全部0が届く場合は、偶数パリティだと見逃し、奇数パリティなら気づけます。',
  },
  {
    id: 'parity-2', title: 'パリティ課題②2次元パリティ',
    description: '誤りの行と列を見つけて、反転したカードを直す', icon: '🔲', difficulty: 'medium', estimatedTime: 15,
    body: `**課題**\n「パリティチェック体験」ページの**ステージ3（2次元パリティ）**で、「ノイズ1枚」の問題を**3問**クリアしてください。\n\n- ①おかしい行を選ぶ → ②おかしい列を選ぶ → ③交点のカードを直す、の順に進めます\n- 3問のうち1問は、パリティのマス（右端の列か下端の行）が反転した問題になります\n- 「答えを見る」を押した問題は、クリアに数えません\n\n完了したら、ページの「💾 保存」でJSONファイルを出力し、下に提出してください。`,
    explanation: '縦と横にパリティを付けると、おかしい行とおかしい列の交点で、反転した場所まで分かります。パリティのマスが反転したときも同じ方法で特定できます。',
  },
];

export const parityTaskById = (id: string): ParityTask | undefined => PARITY_TASKS.find((t) => t.id === id);
