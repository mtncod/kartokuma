# Kartokuma Combined Card+Form Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kartvizit bölümündeki "Excel İndir"/"XML İndir" butonlarının, o an taranmış olan form metnini de aynı satıra/etikete ekleyerek birleşik bir rapor üretmesini sağlamak.

**Architecture:** `public/exportFormats.js`'deki `buildCsv(card)` ve `buildXml(card)` fonksiyonlarına opsiyonel bir `formText` parametresi eklenir; verilmişse CSV'ye "Form Açıklamaları" sütunu, XML'e `<formAciklamalari>` etiketi eklenir. `public/app.js`'deki kartvizit `csvBtn`/`xmlBtn` handler'ları bu yeni parametreyi `lastFormText` ile doldurur. Form bölümünün kendi bağımsız butonları ve her iki taramanın kendi akışı (state sıfırlama davranışı dahil) değişmeden kalır.

**Tech Stack:** Vanilla JS (frontend, `public/`), Vitest (test).

## Global Constraints

- Form metni yapılandırılmış alanlara ayrılmaz — kartvizit raporuna tek bir serbest metin sütunu/etiketi olarak eklenir.
- Kartvizit taraması `lastFormText`'i sıfırlamaz; form taraması `lastCard`'ı sıfırlamaz — mevcut davranış, ek kod değişikliği gerektirmez.
- Form henüz taranmamışsa kartvizit indirmesi engellenmez — sadece form sütunu/etiketi boş kalır.
- Form bölümünün kendi bağımsız "Excel İndir"/"XML İndir" butonları (`formCsvBtn`/`formXmlBtn`, sadece form metni) değişmez.
- Backend değişikliği yok.

---

### Task 1: `exportFormats.js` — `buildCsv`/`buildXml`'e form metni desteği

**Files:**
- Modify: `public/exportFormats.js`
- Test: `tests/exportFormats.test.ts`

**Interfaces:**
- Consumes: mevcut `escapeCsvCell(value)`, `escapeXml(value)` — aynen kullanılacak.
- Produces: `buildCsv(card, formText?: string): string`, `buildXml(card, formText?: string): string` — imza genişliyor, ikinci parametre opsiyonel. Task 2 (`app.js`) bu yeni parametreyi kullanır.

- [ ] **Step 1: Başarısız olacak testleri yaz — `tests/exportFormats.test.ts`'deki `describe('buildCsv', ...)` bloğunun sonuna (satır 85'teki kapanış `});`'den hemen önce) ekle**

```typescript
  it('appends a Form Açıklamaları column with the form text when provided', () => {
    const card = makeCard({ fullName: 'Ayşe Yılmaz' });
    const csv = buildCsv(card, 'Ad: Ali Veli\nTarih: 01.08.2026');
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');

    expect(lines[0]).toBe('Ad Soyad;Unvan;Şirket;Telefon;E-posta;İl;Adres;Web Sitesi;Form Açıklamaları');
    expect(lines[1]).toBe(
      'Ayşe Yılmaz;;;;;;;;"Ad: Ali Veli\nTarih: 01.08.2026"',
    );
  });

  it('leaves the Form Açıklamaları column empty when formText is not provided', () => {
    const card = makeCard({ fullName: 'Ayşe Yılmaz' });
    const csv = buildCsv(card);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');

    expect(lines[0]).toBe('Ad Soyad;Unvan;Şirket;Telefon;E-posta;İl;Adres;Web Sitesi;Form Açıklamaları');
    expect(lines[1]).toBe('Ayşe Yılmaz;;;;;;;;');
  });

  it('neutralizes a formula-injection payload in the form text column', () => {
    const card = makeCard();
    const csv = buildCsv(card, '=SUM(1,2)');
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain("'=SUM(1,2)");
  });
```

Then, in the `describe('buildXml', ...)` block (before its closing `});` at line 132), add:

```typescript
  it('includes a formAciklamalari tag with the form text when provided', () => {
    const xml = buildXml(makeCard(), 'Ad: Ali Veli\nTarih: 01.08.2026');
    expect(xml).toContain('<formAciklamalari>Ad: Ali Veli\nTarih: 01.08.2026</formAciklamalari>');
  });

  it('includes an empty formAciklamalari tag when formText is not provided', () => {
    const xml = buildXml(makeCard());
    expect(xml).toContain('<formAciklamalari></formAciklamalari>');
  });

  it('escapes XML special characters in the form text', () => {
    const xml = buildXml(makeCard(), 'A & B <Ltd>');
    expect(xml).toContain('<formAciklamalari>A &amp; B &lt;Ltd&gt;</formAciklamalari>');
  });
```

- [ ] **Step 2: Testleri çalıştırıp başarısız olduklarını doğrula**

Run: `npx vitest run tests/exportFormats.test.ts`
Expected: FAIL — yeni testler "Form Açıklamaları" sütununu/`<formAciklamalari>` etiketini bulamaz (fonksiyonlar henüz ikinci parametreyi kullanmıyor).

- [ ] **Step 3: `public/exportFormats.js`'deki `buildCsv` ve `buildXml`'i güncelle**

`buildCsv` fonksiyonunu (satır 26-41) şu şekilde değiştir:

```javascript
export function buildCsv(card, formText) {
  const header = ['Ad Soyad', 'Unvan', 'Şirket', 'Telefon', 'E-posta', 'İl', 'Adres', 'Web Sitesi', 'Form Açıklamaları'];
  const row = [
    card.fullName,
    card.jobTitle,
    card.company,
    card.phones.join(' / '),
    card.email,
    card.il,
    card.address,
    card.website,
    formText,
  ].map(escapeCsvCell);

  const bom = '\uFEFF';
  return bom + header.join(';') + '\r\n' + row.join(';') + '\r\n';
}
```

`buildXml` fonksiyonunu (satır 43-59) şu şekilde değiştir:

```javascript
export function buildXml(card, formText) {
  const phoneTags = card.phones.map((p) => `  <telefon>${escapeXml(p)}</telefon>`).join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<kartvizit>\n' +
    `  <adSoyad>${escapeXml(card.fullName)}</adSoyad>\n` +
    `  <unvan>${escapeXml(card.jobTitle)}</unvan>\n` +
    `  <sirket>${escapeXml(card.company)}</sirket>\n` +
    (phoneTags ? phoneTags + '\n' : '') +
    `  <eposta>${escapeXml(card.email)}</eposta>\n` +
    `  <il>${escapeXml(card.il)}</il>\n` +
    `  <adres>${escapeXml(card.address)}</adres>\n` +
    `  <webSitesi>${escapeXml(card.website)}</webSitesi>\n` +
    `  <formAciklamalari>${escapeXml(formText)}</formAciklamalari>\n` +
    '</kartvizit>\n'
  );
}
```

**Not:** `escapeCsvCell(undefined)` ve `escapeXml(undefined)` zaten `String(value ?? '')` ile boş string'e düşüyor (dosyanın en üstündeki mevcut kod, satır 2 ve 12) — `formText` parametresi verilmediğinde (`undefined`) ekstra bir kontrol gerekmez, otomatik olarak boş hücre/etiket üretilir.

- [ ] **Step 4: Testleri çalıştırıp geçtiklerini doğrula**

Run: `npx vitest run tests/exportFormats.test.ts`
Expected: PASS — yeni testler dahil, mevcut tüm `buildCsv`/`buildXml` testleri de (tek parametreli çağrılar) hâlâ geçmeli.

- [ ] **Step 5: Tam test paketini çalıştırıp regresyon olmadığını doğrula**

Run: `npm test`
Expected: PASS — tüm dosyalar yeşil.

- [ ] **Step 6: Commit**

```bash
git add public/exportFormats.js tests/exportFormats.test.ts
git commit -m "exportFormats.js: buildCsv/buildXml'e opsiyonel form metni sütunu/etiketi ekle"
```

---

### Task 2: `app.js` — Kartvizit indirme butonlarını form metniyle birleştir

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- Consumes: Task 1'in genişletilmiş `buildCsv(card, formText)`, `buildXml(card, formText)` imzaları.
- Produces: Yok (kullanıcı arayüzünün son entegrasyon adımı).

- [ ] **Step 1: `csvBtn` ve `xmlBtn` handler'larını güncelle**

`public/app.js:87-103` içindeki iki handler'ı şu şekilde değiştir (`buildCsv(lastCard)` → `buildCsv(lastCard, lastFormText)`, `buildXml(lastCard)` → `buildXml(lastCard, lastFormText)`; guard, try/catch, hata mesajı, dosya adı üretimi (`buildFileName`) değişmiyor):

```javascript
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
```

**Not:** `lastFormText` değişkeni dosyanın alt kısmında (`public/app.js:165`) zaten tanımlı — bu handler'lar dosyanın üst kısmında olduğu için, JavaScript'in `let` hoisting'i (temporal dead zone) burada sorun yaratmaz çünkü bu fonksiyonlar ancak bir tıklama olayında (module yüklendikten çok sonra) çalışır; `lastFormText` o ana kadar zaten tanımlanmış olur. Değişkenin tanımını taşımaya gerek yok.

**Not 2:** Kart taraması (`fileInput` change handler, `public/app.js:25-73`) ve form taraması (`formFileInput` change handler, `public/app.js:167-215`) birbirinin state'ine dokunmuyor — bu görevde bu handler'lara hiçbir değişiklik yapılmıyor, sadece `csvBtn`/`xmlBtn`'in çağırdığı fonksiyon argümanları değişiyor.

- [ ] **Step 2: Tam test paketini çalıştırıp regresyon olmadığını doğrula**

Run: `npm test`
Expected: PASS — bu görev yeni otomatik test eklemiyor (DOM wiring, mevcut kart/form buton bağlama deseniyle aynı, o da test edilmiyor), sadece mevcut paketin regresyon vermediğini doğrula.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "app.js: kartvizit Excel/XML indirmesine taranmış form metnini ekle"
```

---

### Task 3: Canlı doğrulama

**Files:** Yok (kod değişikliği içermez — deploy + manuel kontrol).

- [ ] **Step 1: `master`'ı push et**

```bash
git push origin master
```

Not: Bu depo Vercel Git entegrasyonuna bağlı (2026-08-04'te kuruldu, form export deploy'unda doğrulandı) — push otomatik prod deploy tetikler.

- [ ] **Step 2: Canlıda doğrula**

`https://kartokuma.vercel.app/` adresinde önce bir kartvizit, sonra bir form fotoğrafı taratıp (veya tersi sırada), kartvizit bölümündeki "Excel İndir" butonuna bas: indirilen CSV'de "Form Açıklamaları" sütununun taranan form metnini içerdiğini doğrula. Aynısını "XML İndir" için de yap. Ardından sadece kartvizit taranıp form hiç taranmadan "Excel İndir"e basıldığında son sütunun boş kaldığını doğrula. Bu adım insan partnerine bırakılır (tarayıcıdan gerçek dosya indirme/açma gerektirir).
