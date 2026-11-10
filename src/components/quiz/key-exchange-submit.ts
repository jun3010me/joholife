// 問題演習「鍵交換シミュレータ」：保存したJSONを提出して判定し、合格したら修了証を発行する。
// 画面の流れは既存のネットワーク構築課題と同じ（氏名 → 提出 → 判定結果 → 修了証）。
import { validateSubmission } from '../../utils/key-exchange-simulator/submission.ts';
import { validateFreeSubmission } from '../../utils/key-exchange-simulator/submission-free.ts';
import { FREE_TEMPLATES } from '../../utils/key-exchange-simulator/templates.ts';
import { fetchIpAddress, trackingInfo } from './device-fingerprint.ts';
import { taskById, type KeyExchangeTask } from './key-exchange-tasks.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const md = (t: string) =>
  esc(t).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(header)?.[1] ?? 'image/png';
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};
const DIFF: Record<string, string> = { easy: '初級', medium: '中級', hard: '上級' };

export function mountKeyExchangeSubmit(): void {
  const root = document.getElementById('ke-submit-app');
  const task = taskById(root?.dataset.task ?? '');
  if (!root || !task) return;
  new Session(root, task);
}

class Session {
  userName = '';
  data: unknown = null;
  fileName = '';
  ip = 'N/A';
  startTime = new Date();

  constructor(private root: HTMLElement, private task: KeyExchangeTask) {
    fetchIpAddress().then((ip) => (this.ip = ip));
    this.renderName();
  }

  private card(inner: string, max = 720) {
    this.root.innerHTML = `<div style="max-width:${max}px;margin:0 auto;"><div class="card" style="padding:2rem;">${inner}</div></div>`;
  }

  renderName() {
    const saved = (localStorage.getItem('quizStudentName') || '').trim();
    const t = this.task;
    this.card(`
      <div style="text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;">${t.icon}</div>
        <h2 style="font-size:clamp(1.25rem,4vw,1.75rem);font-weight:700;color:var(--text-primary);margin-bottom:.5rem;">${esc(t.title)}</h2>
        <p style="color:var(--text-secondary);margin-bottom:1.5rem;">${esc(t.description)}</p>
        <p style="color:var(--text-muted);font-size:.875rem;margin-bottom:1.5rem;">約${t.estimatedTime}分 ・ ${DIFF[t.difficulty]} ・ JSONファイルを提出</p>
        ${saved
          ? `<p style="margin-bottom:1rem;color:var(--text-primary);">${esc(saved)}さん、この課題を開始しますか？</p>
             <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
               <button id="ke-start" class="btn btn-primary">開始する</button>
               <button id="ke-change" class="btn btn-secondary">名前を変更</button></div>`
          : `<label for="ke-name" style="display:block;font-weight:600;margin-bottom:.5rem;">氏名（修了証に表示されます）</label>
             <input id="ke-name" type="text" maxlength="40" autocomplete="name" placeholder="例：山田 太郎" style="width:100%;max-width:360px;padding:.75rem;border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:1rem;">
             <div><button id="ke-start" class="btn btn-primary" disabled style="opacity:.5;">開始する</button></div>`}
      </div>`, 600);
    const start = document.getElementById('ke-start') as HTMLButtonElement;
    if (saved) {
      start.onclick = () => { this.userName = saved; this.renderSubmit(); };
      (document.getElementById('ke-change') as HTMLElement).onclick = () => { localStorage.removeItem('quizStudentName'); this.renderName(); };
    } else {
      const input = document.getElementById('ke-name') as HTMLInputElement;
      const go = () => {
        const n = input.value.trim();
        if (!n) return;
        this.userName = n; localStorage.setItem('quizStudentName', n); this.renderSubmit();
      };
      input.oninput = () => { const ok = input.value.trim().length > 0; start.disabled = !ok; start.style.opacity = ok ? '1' : '.5'; };
      input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      start.onclick = go;
      input.focus();
    }
  }

  renderSubmit(message?: string) {
    this.startTime = this.startTime ?? new Date();
    const t = this.task;
    this.card(`
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:1rem;">${esc(t.title)}</h2>
      <div style="color:var(--text-secondary);line-height:1.7;margin-bottom:1.5rem;">${md(t.body)}</div>
      ${this.freeGuide()}
      <div style="text-align:center;margin-bottom:1.5rem;">
        <a href="/key-exchange-simulator" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display:inline-block;text-decoration:none;color:#fff !important;">🔑 鍵交換シミュレータを開く</a>
      </div>
      ${message ? `<div role="alert" style="background:#fef2f2;border:1px solid #ef4444;border-radius:var(--radius-md);padding:1rem 1.25rem;color:#991b1b;margin-bottom:1.5rem;line-height:1.6;"><strong>不合格です</strong><br>${esc(message)}</div>` : ''}
      <div id="ke-drop" tabindex="0" role="button" aria-label="JSONファイルを選ぶ" style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:2rem;text-align:center;background:var(--surface);cursor:pointer;">
        <p style="font-weight:500;margin-bottom:.5rem;">保存したJSONファイルをドラッグ＆ドロップ、またはクリックして選ぶ</p>
        <p id="ke-file" style="color:var(--text-muted);font-size:.875rem;">${this.fileName ? '選択中：' + esc(this.fileName) : 'シミュレータの「💾 保存」で出力したファイル'}</p>
        <input id="ke-input" type="file" accept=".json,application/json" style="display:none;">
      </div>
      <div style="text-align:center;margin-top:1.5rem;">
        <button id="ke-submit" class="btn btn-primary" ${this.data ? '' : 'disabled'} style="opacity:${this.data ? 1 : 0.5};">判定を実行</button>
      </div>`);
    const tplBtn = document.getElementById('ke-template');
    if (tplBtn) tplBtn.onclick = () => this.downloadTemplate();
    const drop = document.getElementById('ke-drop') as HTMLElement;
    const input = document.getElementById('ke-input') as HTMLInputElement;
    const submit = document.getElementById('ke-submit') as HTMLButtonElement;
    const take = (f?: File) => {
      if (!f) return;
      if (!f.name.endsWith('.json') && f.type !== 'application/json') { alert('JSONファイルを選択してください。'); return; }
      const rd = new FileReader();
      rd.onload = () => {
        try { this.data = JSON.parse(String(rd.result)); } catch { this.data = null; alert('JSONファイルの形式が正しくありません。シミュレータの「保存」で出力したファイルを使用してください。'); return; }
        this.fileName = f.name;
        (document.getElementById('ke-file') as HTMLElement).textContent = '選択中：' + f.name;
        submit.disabled = false; submit.style.opacity = '1';
      };
      rd.readAsText(f);
    };
    drop.onclick = () => input.click();
    drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    drop.ondragover = (e) => { e.preventDefault(); drop.style.borderColor = 'var(--primary-color)'; };
    drop.ondragleave = () => { drop.style.borderColor = 'var(--border)'; };
    drop.ondrop = (e) => { e.preventDefault(); drop.style.borderColor = 'var(--border)'; take(e.dataTransfer?.files[0]); };
    input.onchange = () => take(input.files?.[0]);
    submit.onclick = () => {
      const r = this.task.mode === 'free'
        ? validateFreeSubmission(this.data, this.task.id)
        : validateSubmission(this.data, this.task.scenarioId ?? '');
      if (r.valid) this.renderCertificate(r.message);
      else this.renderSubmit(r.message);
    };
  }

  /** 自由モードの課題だけ：テンプレートJSONの入手と、使い方の案内 */
  private freeGuide(): string {
    if (this.task.mode !== 'free' || !FREE_TEMPLATES[this.task.id]) return '';
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:1rem 1.25rem;margin-bottom:1.5rem;">
        <p style="font-weight:600;margin-bottom:.5rem;">取り組み方</p>
        <ol style="margin:0 0 1rem 1.25rem;padding:0;line-height:1.8;color:var(--text-secondary);">
          <li>下のボタンで、テンプレートJSONをダウンロードする</li>
          <li>鍵交換シミュレータを開き、「📁 読込」でそのファイルを開く</li>
          <li>自由モードのまま作業して、完了したら「💾 保存」</li>
          <li>保存したJSONを、このページに提出する</li>
        </ol>
        <div style="text-align:center;"><button type="button" id="ke-template" class="btn btn-secondary" style="color:var(--text-primary);">📥 テンプレートJSONをダウンロード</button></div>
      </div>`;
  }

  /** ブラウザ内でBlobを作ってダウンロードする（ネットワーク構築課題と同じ方式） */
  private downloadTemplate() {
    const t = FREE_TEMPLATES[this.task.id];
    if (!t) return;
    const blob = new Blob([JSON.stringify(t.build(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = t.fileName;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  renderCertificate(message: string) {
    this.card(`
      <div style="text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;">🎉</div>
        <h2 style="font-size:1.75rem;font-weight:700;margin-bottom:.5rem;">合格です！修了証が発行されました</h2>
        <p style="color:var(--text-secondary);margin-bottom:${this.task.explanation ? '.5rem' : '1.5rem'};">${esc(message)}</p>
        ${this.task.explanation ? `<p style="color:var(--text-muted);font-size:.9rem;margin-bottom:1.5rem;">${esc(this.task.explanation)}</p>` : ''}
        <canvas id="ke-cert" width="800" height="600" style="max-width:100%;height:auto;border:1px solid #e5e7eb;"></canvas>
        <div style="display:flex;flex-direction:column;gap:1rem;align-items:center;margin-top:1.5rem;">
          <button id="ke-dl" class="btn btn-primary" style="padding:.75rem 2rem;">修了証をダウンロード</button>
          <div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;">
            <button id="ke-retry" class="btn btn-secondary">別のファイルを提出する</button>
            <button id="ke-back" class="btn btn-secondary">メニューに戻る</button>
          </div>
        </div>
      </div>`, 860);
    const canvas = document.getElementById('ke-cert') as HTMLCanvasElement;
    this.drawCertificate(canvas);
    (document.getElementById('ke-dl') as HTMLElement).onclick = () => this.downloadCertificate(canvas);
    (document.getElementById('ke-retry') as HTMLElement).onclick = () => { this.data = null; this.fileName = ''; this.renderSubmit(); };
    (document.getElementById('ke-back') as HTMLElement).onclick = () => { window.location.href = '/quiz'; };
  }

  /**
   * 修了証のダウンロード。プログラミング問題演習と同じ仕組み。
   * iOS Safari は data URL への <a download> が効かないため、共有シート（Web Share API）で「写真」などに保存してもらう。
   * 共有できないときは、画像を新しいタブで開いて長押し保存を案内する。
   */
  private async downloadCertificate(canvas: HTMLCanvasElement) {
    const fileName = `修了証_${this.task.title}_${this.userName}_${new Date().toISOString().split('T')[0]}.png`;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS && navigator.share) {
        const blob = dataUrlToBlob(dataUrl);
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: fileName });
            return;
          } catch (e) {
            if ((e as Error).name === 'AbortError') return; // ユーザーがキャンセル
            // 共有に失敗したときは、下のフォールバックに進む
          }
        }
        window.open(URL.createObjectURL(blob), '_blank');
        alert('画像が新しいタブで開きます。画像を長押しして「写真に保存」を選択してください。');
        return;
      }
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download certificate:', error);
      alert('修了証のダウンロードに失敗しました。');
    }
  }

  /** 既存の修了証と同じデザイン（800x600） */
  drawCertificate(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const W = canvas.width, H = canvas.height;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#f8fafc'); g.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#059669'; ctx.lineWidth = 8; ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.strokeStyle = '#047857'; ctx.lineWidth = 2; ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e293b'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('修了証', W / 2, 120);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#475569'; ctx.fillText('Certificate of Completion', W / 2, 160);
    ctx.fillStyle = '#0f172a'; this.fit(ctx, this.userName, 'bold', 36, W - 160); ctx.fillText(this.userName, W / 2, 240);
    ctx.font = '20px sans-serif'; ctx.fillStyle = '#374151';
    ctx.fillText('上記の方は、以下の課題において', W / 2, 290);
    ctx.fillText('合格して修了されました', W / 2, 320);
    ctx.fillStyle = '#047857'; const title = `「${this.task.title}」`; this.fit(ctx, title, 'bold', 28, W - 120); ctx.fillText(title, W / 2, 370);
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#6b7280';
    ctx.fillText(`発行日: ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}`, W / 2, 450);
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#059669'; ctx.fillText('じょうほうらいふ', W / 2, 520);
    // なりすまし防止情報
    const tr = trackingInfo(this.ip);
    ctx.font = '10px monospace'; ctx.fillStyle = '#f59e0b';
    const y = H - 40;
    ctx.textAlign = 'left'; ctx.fillText(`発行時刻: ${tr.timestamp}`, 43, y - 20); ctx.fillText(`アクセス元: ${tr.ipAddress}`, 43, y - 5);
    ctx.textAlign = 'right'; ctx.fillText(`端末: ${tr.userAgent}`, W - 43, y - 20); ctx.fillText(`画面: ${tr.screenInfo}`, W - 43, y - 5);
    ctx.textAlign = 'center'; ctx.fillText(`端末識別: ${tr.deviceUserHash}`, W / 2, y + 12);
    for (const [x, yy, c] of [[150, 150, '#10b981'], [W - 150, 150, '#059669'], [150, H - 150, '#047857'], [W - 150, H - 150, '#065f46']] as [number, number, string][]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, yy, 20, 0, 2 * Math.PI); ctx.fill();
    }
  }

  /** 長い文字列は、幅に収まるまで文字を小さくする */
  private fit(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, maxW: number) {
    let s = size;
    ctx.font = `${weight} ${s}px sans-serif`;
    while (s > 12 && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px sans-serif`; }
  }
}
