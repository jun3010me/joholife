// 修了証（Canvas）の画像をダウンロードする共通処理。
// iOS Safari は data URL への <a download> によるプログラム的なダウンロードに対応していないため、
// iPhone・iPad では共有シート（Web Share API）で「写真」などに保存してもらう。
// 共有できないときは、画像を新しいタブで開いて長押し保存を案内する。PC・Android は従来どおりダウンロードする。
// 使い方：window.downloadCertificateImage(canvas, 'ファイル名.png')
(function () {
  function dataURLToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mimeMatch = parts[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : 'image/png';
    var binary = atob(parts[1]);
    var array = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  }

  window.downloadCertificateImage = async function (canvas, fileName) {
    if (!canvas) return;
    try {
      var dataUrl = canvas.toDataURL('image/png');
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS && navigator.share) {
        var blob = dataURLToBlob(dataUrl);
        var file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: fileName });
            return;
          } catch (shareError) {
            if (shareError && shareError.name === 'AbortError') return; // ユーザーがキャンセル
            // 共有に失敗したときは、下のフォールバックに進む
          }
        }
        window.open(URL.createObjectURL(blob), '_blank');
        alert('画像が新しいタブで開きます。画像を長押しして「写真に保存」を選択してください。');
        return;
      }

      var link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download certificate:', error);
      alert('修了証のダウンロードに失敗しました。');
    }
  };
})();
