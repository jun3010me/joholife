/**
 * テキストファイルをブラウザのダウンロードとして保存する。
 * 文字コードは UTF-8（BOMなし）、改行は LF のまま。外部への通信は行わない。
 */
export function downloadTextFile(name: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
