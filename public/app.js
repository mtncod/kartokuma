import { buildCsv, buildXml, buildFileName, buildFormCsv, buildFormXml, buildFormFileName } from './exportFormats.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Servis worker kaydı başarısız:', err);
    });
  });
}

const fileInput = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const reportTextEl = document.getElementById('reportText');
const copyBtn = document.getElementById('copyBtn');
const errorEl = document.getElementById('error');
const csvBtn = document.getElementById('csvBtn');
const xmlBtn = document.getElementById('xmlBtn');

let lastCard = null;

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  hide(resultEl);
  lastCard = null;
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
    lastCard = data.card;
    show(resultEl);
  } catch (err) {
    hide(statusEl);
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      show(errorEl, 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
    } else if (err instanceof TypeError || !navigator.onLine) {
      show(errorEl, 'İnternet bağlantısı yok. Kartvizit taramak için bağlantı gerekli.');
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

csvBtn.addEventListener('click', () => {
  if (!lastCard) return;
  try {
    downloadFile(buildFileName(lastCard, 'csv'), buildCsv(lastCard, lastFormText), 'text/csv;charset=utf-8');
  } catch (err) {
    show(errorEl, 'Dosya oluşturulamadı. Lütfen tekrar deneyin.');
  }
});

xmlBtn.addEventListener('click', () => {
  if (!lastCard) return;
  try {
    downloadFile(buildFileName(lastCard, 'xml'), buildXml(lastCard, lastFormText), 'application/xml;charset=utf-8');
  } catch (err) {
    show(errorEl, 'Dosya oluşturulamadı. Lütfen tekrar deneyin.');
  }
});

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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

const formFileInput = document.getElementById('formFileInput');
const formStatusEl = document.getElementById('formStatus');
const formResultEl = document.getElementById('formResult');
const formReportTextEl = document.getElementById('formReportText');
const formCopyBtn = document.getElementById('formCopyBtn');
const formErrorEl = document.getElementById('formError');
const formCsvBtn = document.getElementById('formCsvBtn');
const formXmlBtn = document.getElementById('formXmlBtn');

let lastFormText = null;

formFileInput.addEventListener('change', async () => {
  const file = formFileInput.files && formFileInput.files[0];
  if (!file) return;

  hide(formResultEl);
  lastFormText = null;
  hide(formErrorEl);
  show(formStatusEl, 'Fotoğraf hazırlanıyor...');

  try {
    const { base64, mediaType } = await resizeImage(file);
    show(formStatusEl, 'Form okunuyor...');

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    }

    hide(formStatusEl);

    if (data.empty) {
      show(formErrorEl, 'Form okunamadı. Lütfen daha net bir fotoğraf ile tekrar deneyin.');
      return;
    }

    formReportTextEl.textContent = data.text;
    lastFormText = data.text;
    show(formResultEl);
  } catch (err) {
    hide(formStatusEl);
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      show(formErrorEl, 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
    } else if (err instanceof TypeError) {
      show(formErrorEl, 'İnternet bağlantısı yok. Form taramak için bağlantı gerekli.');
    } else {
      show(formErrorEl, err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  } finally {
    formFileInput.value = '';
  }
});

formCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(formReportTextEl.textContent || '');
    formCopyBtn.textContent = 'Kopyalandı!';
    setTimeout(() => {
      formCopyBtn.textContent = 'Panoya Kopyala';
    }, 1500);
  } catch {
    show(formErrorEl, 'Kopyalama başarısız oldu. Metni manuel olarak seçip kopyalayabilirsin.');
  }
});

formCsvBtn.addEventListener('click', () => {
  if (!lastFormText) return;
  try {
    downloadFile(buildFormFileName('csv'), buildFormCsv(lastFormText), 'text/csv;charset=utf-8');
  } catch (err) {
    show(formErrorEl, 'Dosya oluşturulamadı. Lütfen tekrar deneyin.');
  }
});

formXmlBtn.addEventListener('click', () => {
  if (!lastFormText) return;
  try {
    downloadFile(buildFormFileName('xml'), buildFormXml(lastFormText), 'application/xml;charset=utf-8');
  } catch (err) {
    show(formErrorEl, 'Dosya oluşturulamadı. Lütfen tekrar deneyin.');
  }
});
