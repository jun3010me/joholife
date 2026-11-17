// ステージの一覧。ステージ4（チェックディジット）・5（JANコード）は、ここに足してから部品を作る。
export interface StageInfo {
  id: number;
  anchor: string;
  title: string;
  summary: string;
}
export const STAGES: StageInfo[] = [
  { id: 1, anchor: 'pc-stage1', title: 'ステージ1 偶数パリティ', summary: 'カードを送って、ノイズに気づけるか確かめよう' },
  { id: 2, anchor: 'pc-stage2', title: 'ステージ2 奇数パリティ', summary: '偶数パリティが見逃すものを、奇数パリティで見つけよう' },
  { id: 3, anchor: 'pc-stage3', title: 'ステージ3 2次元パリティ', summary: '誤りの場所を特定して、直そう' },
];
