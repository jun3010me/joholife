// 初期配置：デバイスを列に分け、列の間隔＝吹き出しの幅＋14px。全体をキャンバス中央にそろえる。
export const NW = 100;
export const NH = 74;
export const POPW = 260;

export interface Size {
  w: number;
  h: number;
}

/**
 * k: 列の位置（中央が0。4列なら -1.5〜+1.5）
 * y: 上端からの距離、または 'b'（下端：トーストの上）
 * maxk: 一番外側の列の位置（画面が狭いときに間隔を縮めるため）
 */
export function pos(size: Size, k: number, y: number | 'b', maxk = 1): [number, number] {
  const sp = Math.min(POPW + 14, (size.w - NW - 24) / (2 * maxk));
  const cx = size.w / 2;
  const yy = y === 'b' ? size.h - NH - 70 : y;
  return [
    Math.round(cx + k * sp - NW / 2),
    Math.round(Math.max(8, Math.min(yy, size.h - NH - 16))),
  ];
}

/** デバイスがキャンバスの外に出ないように位置を収める */
export function clampToCanvas(size: Size, x: number, y: number): [number, number] {
  return [
    Math.round(Math.max(4, Math.min(x, size.w - NW - 4))),
    Math.round(Math.max(4, Math.min(y, size.h - NH - 4))),
  ];
}
