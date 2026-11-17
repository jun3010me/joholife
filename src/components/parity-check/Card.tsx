import type { Bit } from '../../utils/parity-check/parity.ts';

interface Props {
  value: Bit;
  /** 読み上げ名（例：「データ3枚目」） */
  label: string;
  /** パリティのカード（オレンジの枠） */
  parity?: boolean;
  /** 答え合わせで、反転したカードに付ける（赤い点線の枠） */
  flipped?: boolean;
  /** 選択中など、目印を付ける */
  selected?: boolean;
  onClick?: () => void;
}

/** 表（黒地に白の「1」）＝1、裏（白地に薄い「0」）＝0。タップでめくれる */
export default function Card({ value, label, parity, flipped, selected, onClick }: Props) {
  const cls = ['pc-card', parity ? 'pc-parity' : '', flipped ? 'pc-flipped' : '', selected ? 'pc-selected' : '', onClick ? '' : 'pc-static']
    .filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      data-v={value}
      aria-label={`${label}、${value}${flipped ? '、反転したカード' : ''}`}
      aria-disabled={onClick ? undefined : true}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
    >
      <span className="pc-card-inner" aria-hidden="true">
        <span className="pc-face pc-face-0">0</span>
        <span className="pc-face pc-face-1">1</span>
      </span>
    </button>
  );
}
