const fileInput = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const reportTextEl = document.getElementById('reportText');
const copyBtn = document.getElementById('copyBtn');
const errorEl = document.getElementById('error');

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  hide(resultEl);
  hide(errorEl);
  show(statusEl, 'Fotoğraf hazırlanıyor...');

  try {
    const { base64, mediaType } = await resizeImage(file);
    show(statusEl, 'Kartvizit okunuyor...');

    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    }

    hide(statusEl);

    if (data.empty) {
      show(errorEl, 'Kart okunamadı. Lütfen daha net bir fotoğraf ile tekrar deneyin.');
      return;
    }

    reportTextEl.textContent = data.report;
    show(resultEl);
  } catch (err) {
    hide(statusEl);
    if (err && err.name === 'AbortError') {
      show(errorEl, 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
    } else {
      show(errorEl, err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  } finally {
    fileInput.value = '';
  }
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(reportTextEl.textContent || '');
    copyBtn.textContent = 'Kopyalandı!';
    setTimeout(() => {
      copyBtn.textContent = 'Panoya Kopyala';
    }, 1500);
  } catch {
    show(errorEl, 'Kopyalama başarısız oldu. Metni manuel olarak seçip kopyalayabilirsin.');
  }
});

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('Görsel yüklenemedi.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const [prefix, base64] = dataUrl.split(',');
        const match = prefix.match(/data:(.*);base64/);
        resolve({ base64, mediaType: match ? match[1] : 'image/jpeg' });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function show(el, text) {
  el.hidden = false;
  if (text !== undefined) el.textContent = text;
}

function hide(el) {
  el.hidden = true;
}
