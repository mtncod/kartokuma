# Kartokuma Form Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut "Form Tara" bölümüne (bağımsız form-fotoğrafı → serbest metin akışı), kartvizit bölümündeki gibi Excel (CSV) ve XML indirme butonları eklemek.

**Architecture:** `public/exportFormats.js`'e form metni için üç yeni saf fonksiyon eklenir (`buildFormCsv`, `buildFormXml`, `buildFormFileName`), mevcut `escapeCsvCell`/`escapeXml` güvenlik yardımcıları yeniden kullanılır. `public/index.html`'e iki yeni buton, `public/app.js`'e kartvizit tarafındaki `lastCard`/`csvBtn`/`xmlBtn` deseninin birebir aynısı eklenir. Backend değişikliği yok.

**Tech Stack:** Vanilla JS (frontend, `public/`), Vitest (test).

## Global Constraints

- Form metni yapılandırılmış alanlara ayrılmaz — CSV/XML'de tek sütun/tek etiket olarak, olduğu gibi yer alır.
- Form akışı kartvizit akışından tamamen bağımsız kalır — ortak rapor/satır yok.
- Backend (`/api/transcribe`, `lib/transcribeForm.ts`) değişmez.
- Kullanıcı arayüzü metinleri Türkçe (kartvizit bölümüyle aynı buton etiketleri: "Excel İndir", "XML İndir").

---

### Task 1: `exportFormats.js` — Form CSV/XML/dosya adı üretimi

**Files:**
- Modify: `public/exportFormats.js`
- Test: `tests/exportFormats.test.ts`

**Interfaces:**
- Consumes: `escapeCsvCell(value)`, `escapeXml(value)` — dosyada zaten mevcut, aynen kullanılacak.
- Produces: `buildFormCsv(text: string): string`, `buildFormXml(text: string): string`, `buildFormFileName(extension: string, dateStamp?: string): string` — Task 2 (`app.js`) bunları kullanır.

- [ ] **Step 1: Başarısız olacak testleri yaz — `tests/exportFormats.test.ts`'in sonuna ekle**

```typescript
import { buildFormCsv, buildFormXml, buildFormFileName } from '../public/exportFormats.js';

describe('buildFormCsv', () => {
  it('starts with a UTF-8 BOM and a single header/data row', () => {
    const csv = buildFormCsv('Ad: Ali Veli\nTarih: 01.08.2026');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('Form Metni');
  });

  it('preserves embedded newlines inside a single quoted cell', () => {
    const csv = buildFormCsv('Ad: Ali Veli\nTarih: 01.08.2026');
    const body = csv.replace(/^\uFEFF/, '').replace(/\r\n$/, '');
    const dataCell = body.split('\r\n').slice(1).join('\r\n');
    expect(dataCell).toBe('"Ad: Ali Veli\nTarih: 01.08.2026"');
  });

  it('neutralizes a formula-injection payload with a leading apostrophe', () => {
    const csv = buildFormCsv('=SUM(1,2)');
    expect(csv).toContain("'=SUM(1,2)");
  });
});

describe('buildFormXml', () => {
  it('wraps the text in a form/metin element', () => {
    const xml = buildFormXml('Ad: Ali Veli');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<form>');
    expect(xml).toContain('<metin>Ad: Ali Veli</metin>');
    expect(xml).toContain('</form>');
  });

  it('escapes XML special characters', () => {
    const xml = buildFormXml('A & B <Ltd> "Şti"');
    expect(xml).toContain('<metin>A &amp; B &lt;Ltd&gt; &quot;Şti&quot;</metin>');
  });

  it('strips illegal XML control characters', () => {
    const xml = buildFormXml('Ay\u0000şe');
    expect(xml).toContain('<metin>Ayşe</metin>');
  });
});

describe('buildFormFileName', () => {
  it('builds a filename with a date+time stamp', () => {
    expect(buildFormFileName('csv', '20260804-143022')).toBe('form-20260804-143022.csv');
  });

  it('respects the requested extension', () => {
    expect(buildFormFileName('xml', '20260804-143022')).toBe('form-20260804-143022.xml');
  });
});
```

- [ ] **Step 2: Testleri çalıştırıp başarısız olduklarını doğrula**

Run: `npx vitest run tests/exportFormats.test.ts`
Expected: FAIL — `buildFormCsv`, `buildFormXml`, `buildFormFileName` tanımlı değil hatası.

- [ ] **Step 3: `public/exportFormats.js`'e üç fonksiyonu ekle**

Dosyanın sonuna (`buildFileName` fonksiyonundan sonra) ekle:

```javascript
export function buildFormCsv(text) {
  const bom = '\uFEFF';
  const header = 'Form Metni';
  const cell = escapeCsvCell(text);
  return bom + header + '\r\n' + cell + '\r\n';
}

export function buildFormXml(text) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + '<form>\n' + `  <metin>${escapeXml(text)}</metin>\n` + '</form>\n';
}

export function buildFormFileName(extension, dateStamp) {
  const stamp =
    dateStamp ||
    new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[-:]/g, '')
      .replace('T', '-');
  return `form-${stamp}.${extension}`;
}
```

**Not:** `escapeCsvCell`'in mevcut davranışı — içinde `\n`, `\r` veya `;` varsa hücreyi çift tırnakla sarar ve içindeki `"` karakterlerini ikiye katlar (`""`). Form metni neredeyse her zaman çok satırlı olacağından `buildFormCsv` çıktısı normalde tırnaklı olacaktır; bu, mevcut testte doğrulanıyor.

- [ ] **Step 4: Testleri çalıştırıp geçtiklerini doğrula**

Run: `npx vitest run tests/exportFormats.test.ts`
Expected: PASS (tüm testler, kartvizit testleri dahil)

- [ ] **Step 5: Commit**

```bash
git add public/exportFormats.js tests/exportFormats.test.ts
git commit -m "exportFormats.js: form metni için CSV/XML/dosya adı üretimi ekle"
```

---

### Task 2: UI — Form bölümüne Excel/XML indirme butonları

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

**Interfaces:**
- Consumes: Task 1'in `buildFormCsv`, `buildFormXml`, `buildFormFileName` fonksiyonları; `app.js` içinde zaten var olan `downloadFile(filename, content, mimeType)` yardımcı fonksiyonu (kartvizit CSV/XML butonlarının kullandığı, `public/app.js:105-115`).
- Produces: Yok (bu, kullanıcı arayüzünün son entegrasyon adımı).

- [ ] **Step 1: `public/index.html`'de form sonuç bölümüne iki buton ekle**

`public/index.html:52-58` içindeki `formResult` bölümünü şu şekilde güncelle (`formCopyBtn`'in yanına iki yeni buton ekleniyor, `id="formResult"` ve içeriğindeki `<pre>` değişmiyor):

```html
    <section id="formResult" class="result" hidden>
      <h2>Form Metni</h2>
      <pre id="formReportText"></pre>
      <div class="actions">
        <button id="formCopyBtn" type="button">Panoya Kopyala</button>
        <button id="formCsvBtn" type="button">Excel İndir</button>
        <button id="formXmlBtn" type="button">XML İndir</button>
      </div>
    </section>
```

- [ ] **Step 2: `public/app.js`'de importları ve DOM referanslarını güncelle**

`public/app.js:1` satırındaki import'u genişlet:

```javascript
import { buildCsv, buildXml, buildFileName, buildFormCsv, buildFormXml, buildFormFileName } from './exportFormats.js';
```

`public/app.js:156-161` civarındaki form DOM referanslarının olduğu bloğa iki yeni satır ekle (mevcut `formErrorEl` satırından sonra):

```javascript
const formFileInput = document.getElementById('formFileInput');
const formStatusEl = document.getElementById('formStatus');
const formResultEl = document.getElementById('formResult');
const formReportTextEl = document.getElementById('formReportText');
const formCopyBtn = document.getElementById('formCopyBtn');
const formErrorEl = document.getElementById('formError');
const formCsvBtn = document.getElementById('formCsvBtn');
const formXmlBtn = document.getElementById('formXmlBtn');

let lastFormText = null;
```

- [ ] **Step 3: Her yeni form taramasında `lastFormText`'i sıfırla ve başarılı sonuçta doldur**

`public/app.js:163-196` içindeki `formFileInput` change handler'ını güncelle — `hide(formResultEl);` satırından hemen sonra sıfırlama eklenir, `formReportTextEl.textContent = data.text;` satırından hemen sonra atama eklenir:

```javascript
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
```

- [ ] **Step 4: İndirme butonlarını bağla**

`public/app.js:211-221` içindeki `formCopyBtn` handler'ından hemen sonra ekle (kartvizit tarafındaki `csvBtn`/`xmlBtn` handler'larıyla — `public/app.js:87-103` — birebir aynı desen):

```javascript
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
```

- [ ] **Step 5: Tam test paketini çalıştırıp regresyon olmadığını doğrula**

Run: `npm test`
Expected: PASS — tüm test dosyaları (`tests/pwa.test.ts` dahil, `sw.js` cache listesi `exportFormats.js`'i zaten içeriyor, değişmedi) yeşil.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js
git commit -m "Form Tara bölümüne Excel/XML indirme butonları ekle"
```

---

### Task 3: Canlı doğrulama

**Files:** Yok (kod değişikliği içermez — deploy + manuel kontrol).

- [ ] **Step 1: `master`'ı push et**

```bash
git push origin master
```

Not: Bu depo artık Vercel Git entegrasyonuna bağlı (2026-08-04'te kuruldu) — push otomatik prod deploy tetiklemeli. Değilse insan partneri deploy'u Vercel dashboard'dan tetiklemeli.

- [ ] **Step 2: Canlıda doğrula**

`https://kartokuma.vercel.app/` adresinde bir form fotoğrafı taratıp "Excel İndir" ve "XML İndir" butonlarının indirdiği dosyaları aç: CSV'nin Excel'de tek hücrede okunabilir metin olarak açıldığını, XML'in `<form><metin>...</metin></form>` yapısında olduğunu doğrula. Bu adım insan partnerine bırakılır (tarayıcıdan gerçek dosya indirme/açma gerektirir).
