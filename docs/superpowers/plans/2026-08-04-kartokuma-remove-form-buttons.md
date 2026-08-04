# Kartokuma Remove Independent Form Export Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Form Tara bölümündeki bağımsız "Excel İndir"/"XML İndir" butonlarını kaldırmak, böylece uygulamada tek bir Excel/XML indirme noktası kalır: kartvizit bölümündeki (form metnini zaten içeren) butonlar.

**Architecture:** `public/index.html`'den iki buton silinir; `public/app.js`'den bunların DOM referansları, click handler'ları ve artık kullanılmayan `buildFormCsv`/`buildFormXml`/`buildFormFileName` importları silinir; `public/exportFormats.js`'den bu üç fonksiyon (artık hiçbir çağıranı kalmayan ölü kod) ve `tests/exportFormats.test.ts`'deki ilgili test blokları silinir. Form tarama akışı, ekranda gösterim ve panoya kopyalama değişmeden kalır.

**Tech Stack:** Vanilla JS (frontend, `public/`), Vitest (test).

## Global Constraints

- Form Tara bölümünde "Panoya Kopyala" butonu ve form metnini ekranda gösterme kalır — sadece indirme butonları kaldırılıyor.
- `lastFormText` değişkeni, `formFileInput` tarama akışı, `updateFormHint()` ve kartvizit bölümündeki birleşik Excel/XML export'u değişmez.
- Backend değişikliği yok.

---

### Task 1: Form Tara'nın bağımsız indirme butonlarını ve ilgili ölü kodu kaldır

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/exportFormats.js`
- Modify: `tests/exportFormats.test.ts`

**Interfaces:**
- Consumes: yok (bu, tamamen bir kaldırma/temizlik görevi).
- Produces: yok. `buildFormCsv`, `buildFormXml`, `buildFormFileName` artık dışa aktarılmıyor — hiçbir dosya bunları import etmiyor olmalı.

- [ ] **Step 1: `public/index.html`'den form indirme butonlarını kaldır**

`public/index.html` içindeki `formResult` bölümünü (şu an satır 53-61) şu hale getir:

```html
    <section id="formResult" class="result" hidden>
      <h2>Form Metni</h2>
      <pre id="formReportText"></pre>
      <div class="actions">
        <button id="formCopyBtn" type="button">Panoya Kopyala</button>
      </div>
    </section>
```

(Yani `formCsvBtn` ve `formXmlBtn` `<button>` satırları tamamen silinir, geri kalan her şey aynı kalır.)

- [ ] **Step 2: `public/app.js`'den ilgili kodu kaldır**

Dosyanın en üstündeki import satırını (satır 1) şu hale getir:

```javascript
import { buildCsv, buildXml, buildFileName } from './exportFormats.js';
```

Form DOM referanslarının olduğu bloktan (şu an satır 168-175 civarı) `formCsvBtn`/`formXmlBtn` satırlarını sil — geri kalan referanslar (`formFileInput`, `formStatusEl`, `formResultEl`, `formReportTextEl`, `formCopyBtn`, `formErrorEl`) aynı kalır:

```javascript
const formFileInput = document.getElementById('formFileInput');
const formStatusEl = document.getElementById('formStatus');
const formResultEl = document.getElementById('formResult');
const formReportTextEl = document.getElementById('formReportText');
const formCopyBtn = document.getElementById('formCopyBtn');
const formErrorEl = document.getElementById('formError');
```

Dosyanın sonundaki `formCsvBtn.addEventListener(...)` ve `formXmlBtn.addEventListener(...)` bloklarının ikisini de (şu an satır 242-258 civarı, `formCopyBtn`'in click handler'ından sonraki iki blok) tamamen sil. `formCopyBtn.addEventListener(...)` bloğu ve öncesindeki her şey (form tarama akışı, `updateFormHint()`, `lastFormText`, kartvizit bölümündeki `csvBtn`/`xmlBtn` handler'ları — bunlar hâlâ `buildCsv(lastCard, lastFormText)`/`buildXml(lastCard, lastFormText)` çağırıyor) değişmeden kalır.

- [ ] **Step 3: `public/exportFormats.js`'den ölü kodu kaldır**

Dosyanın sonundaki üç fonksiyonu (şu an satır 82-102, `buildFormCsv`, `buildFormXml`, `buildFormFileName`) tamamen sil. `buildFileName` fonksiyonu (satır 76-80) ve öncesindeki her şey değişmeden kalır.

- [ ] **Step 4: `tests/exportFormats.test.ts`'den ilgili testleri kaldır**

Import satırını (satır 2) şu hale getir:

```typescript
import { buildCsv, buildXml, buildFileName, slugify } from '../public/exportFormats.js';
```

`describe('buildFormCsv', ...)`, `describe('buildFormXml', ...)`, `describe('buildFormFileName', ...)` bloklarının üçünü de (şu an satır 204-253) tamamen sil. `describe('buildFileName', ...)` bloğu (satır 187-202) ve öncesindeki her şey (`buildCsv`, `buildXml`, `slugify` testleri) değişmeden kalır.

- [ ] **Step 5: Tam test paketini çalıştırıp regresyon olmadığını doğrula**

Run: `npm test`
Expected: PASS — silinen testler artık listede yok, kalan tüm testler (kartvizit `buildCsv`/`buildXml` testleri, form tarama akışı testleri vb.) yeşil.

- [ ] **Step 6: Kalıntı referans kalmadığını doğrula**

Run: `grep -rn "buildFormCsv\|buildFormXml\|buildFormFileName\|formCsvBtn\|formXmlBtn" public/ tests/`
Expected: Hiçbir sonuç dönmemeli (boş çıktı) — bu üç fonksiyon ve iki buton kimliği artık kod tabanında hiçbir yerde geçmiyor.

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/app.js public/exportFormats.js tests/exportFormats.test.ts
git commit -m "Form Tara'nın bağımsız Excel/XML butonlarını kaldır, tek indirme noktası kartvizit bölümünde kalsın"
```

---

### Task 2: Canlı doğrulama

**Files:** Yok (kod değişikliği içermez — deploy + manuel kontrol).

- [ ] **Step 1: `master`'ı push et**

```bash
git push origin master
```

Vercel Git entegrasyonu push'u otomatik deploy eder.

- [ ] **Step 2: Canlıda doğrula**

`https://kartokuma.vercel.app/` adresinde Form Tara bölümünde artık hiç buton olmadığını (sadece taranan form metninin ekranda gösterildiğini) doğrula. Bir kartvizit ve bir form taratıp kartvizit bölümündeki "Excel İndir"e bastığında indirilen dosyanın hâlâ form metnini içerdiğini (bir önceki özellikte eklenen "Form Açıklamaları" sütunu/`<formAciklamalari>` etiketi) doğrula. Bu adım insan partnerine bırakılır.
