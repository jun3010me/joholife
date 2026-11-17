import type { ReactNode } from 'react';

/** 「なぜ？」パネル。開け閉めできる（初期は閉じる） */
export default function WhyPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="pc-why">
      <summary>💡 {title}</summary>
      <div className="pc-why-body">{children}</div>
    </details>
  );
}
