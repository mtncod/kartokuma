# Kartokuma — Backend + Web Uygulaması Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kartvizit fotoğrafından Claude vision ile yapılandırılmış iletişim bilgisi çıkaran bir Vercel serverless backend + statik web arayüzü kurmak, GitHub'a (`mtncod/kartokuma`) push edip Vercel'e deploy etmek.

**Architecture:** `api/scan.ts` Vercel Serverless Function, `lib/` altında saf/test edilebilir mantık (Claude API çağrısı + rapor formatlama), `public/` altında framework'süz statik web arayüzü. iOS uygulaması bu plana dahil değil — ayrı bir oturumda, macOS/Xcode erişimi olduğunda ele alınacak (bkz. tasarım dokümanı).

**Tech Stack:** Node.js 22, TypeScript (ESM), `@anthropic-ai/sdk`, Vitest (test), Vercel (hosting/serverless), düz HTML/CSS/JS (web).

## Global Constraints

- Model: `claude-opus-5` (spec'te belirtilen varsayılan model).
- Çıkarılan alanlar tam olarak şunlar: Ad Soyad (`fullName`), Unvan (`jobTitle`), Şirket Adı (`company`), Telefon(lar) (`phones`, dizi), E-posta (`email`), Adres (`address`), Web Sitesi (`website`).
- Bulunamayan alanlar boş string (`""`) veya boş dizi (`[]`) olarak dönmeli — `null` kullanılmaz (yapılandırılmış çıktı şeması basit tutulur).
- `ANTHROPIC_API_KEY` yalnızca sunucu tarafında (Vercel environment variable) tutulur; hiçbir istemci kodunda görünmez.
- Kullanıcı arayüzü metinleri Türkçe.
- Geçmiş/liste kaydı, telefon rehberine ekleme, gerçek HubSpot CRM entegrasyonu kapsam dışı.
- Tüm dosyalarda ESM importlarında `.js` uzantısı kullanılır (Node ESM + TypeScript standart pratiği; derleme sırasında `.ts` dosyasına çözümlenir).

---

### Task 1: Proje İskeleti

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vercel.json`
- Create: `.env.example`
- Create: `.gitignore`

**Interfaces:**
- Consumes: yok (ilk görev).
- Produces: `npm test` komutu (Vitest), `npx tsc --noEmit` komutu (tip kontrolü) — sonraki tüm görevler bu araçları kullanır.

- [ ] **Step 1: `.gitignore` dosyasını oluştur**

```
node_modules/
.env
.env.local
.vercel/
dist/
```

- [ ] **Step 2: `package.json` dosyasını oluştur**

```json
{
  "name": "kartokuma",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "vercel dev"
  }
}
```

- [ ] **Step 3: Bağımlılıkları kur**

Run:
```bash
npm install @anthropic-ai/sdk
npm install -D typescript vitest @vercel/node @types/node
```

Expected: `package.json` içine `dependencies` ve `devDependencies` bölümleri otomatik eklenir, `node_modules/` ve `package-lock.json` oluşur.

- [ ] **Step 4: `tsconfig.json` dosyasını oluştur**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["api", "lib", "tests"]
}
```

- [ ] **Step 5: `vercel.json` dosyasını oluştur**

```json
{
  "outputDirectory": "public"
}
```

- [ ] **Step 6: `.env.example` dosyasını oluştur**

```
ANTHROPIC_API_KEY=
```

- [ ] **Step 7: Araçların çalıştığını doğrula**

Run: `npx tsc --version && npx vitest --version`
Expected: İkisi de sürüm numarası basar, hata vermez.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vercel.json .env.example .gitignore
git commit -m "Proje iskeletini kur (package.json, tsconfig, vercel.json)"
```

---

### Task 2: `formatReport` — Rapor Formatlama Modülü

**Files:**
- Create: `lib/types.ts`
- Create: `lib/formatReport.ts`
- Test: `tests/formatReport.test.ts`

**Interfaces:**
- Consumes: yok.
- Produces: `CardData` tipi (`lib/types.ts`), `formatReport(data: CardData): string` ve `isEmptyCard(data: CardData): boolean` fonksiyonları (`lib/formatReport.ts`) — Task 3 ve Task 4 bunları kullanır.

- [ ] **Step 1: `lib/types.ts` dosyasını oluştur**

```typescript
export interface CardData {
  fullName: string;
  jobTitle: string;
  company: string;
  phones: string[];
  email: string;
  address: string;
  website: string;
}
```

- [ ] **Step 2: Başarısız olacak testi yaz — `tests/formatReport.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { formatReport, isEmptyCard } from '../lib/formatReport.js';
import type { CardData } from '../lib/types.js';

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    fullName: '',
    jobTitle: '',
    company: '',
    phones: [],
    email: '',
    address: '',
    website: '',
    ...overrides,
  };
}

describe('formatReport', () => {
  it('formats a fully populated card with all labeled lines in order', () => {
    const card = makeCard({
      fullName: 'Ayşe Yılmaz',
      jobTitle: 'Satış Müdürü',
      company: 'Acme A.Ş.',
      phones: ['0212 555 11 22'],
      email: 'ayse@acme.com',
      address: 'Levent, İstanbul',
      website: 'acme.com',
    });

    expect(formatReport(card)).toBe(
      [
        'Ad Soyad: Ayşe Yılmaz',
        'Unvan: Satış Müdürü',
        'Şirket: Acme A.Ş.',
        'Telefon: 0212 555 11 22',
        'E-posta: ayse@acme.com',
        'Adres: Levent, İstanbul',
        'Web Sitesi: acme.com',
      ].join('\n'),
    );
  });

  it('omits empty fields', () => {
    const card = makeCard({ fullName: 'Ayşe Yılmaz', email: 'ayse@acme.com' });

    expect(formatReport(card)).toBe('Ad Soyad: Ayşe Yılmaz\nE-posta: ayse@acme.com');
  });

  it('joins multiple phone numbers with a slash', () => {
    const card = makeCard({ phones: ['0212 555 11 22', '0532 111 22 33'] });

    expect(formatReport(card)).toBe('Telefon: 0212 555 11 22 / 0532 111 22 33');
  });
});

describe('isEmptyCard', () => {
  it('returns true when every field is empty', () => {
    expect(isEmptyCard(makeCard())).toBe(true);
  });

  it('returns false when at least one scalar field is populated', () => {
    expect(isEmptyCard(makeCard({ company: 'Acme' }))).toBe(false);
  });

  it('returns false when only phones has entries', () => {
    expect(isEmptyCard(makeCard({ phones: ['0212 555 11 22'] }))).toBe(false);
  });
});
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/formatReport.test.ts`
Expected: FAIL — `lib/formatReport.ts` bulunamadığı için modül çözümleme hatası.

- [ ] **Step 4: `lib/formatReport.ts` içinde minimal implementasyonu yaz**

```typescript
import type { CardData } from './types.js';

export function formatReport(data: CardData): string {
  const lines: string[] = [];

  if (data.fullName) lines.push(`Ad Soyad: ${data.fullName}`);
  if (data.jobTitle) lines.push(`Unvan: ${data.jobTitle}`);
  if (data.company) lines.push(`Şirket: ${data.company}`);
  if (data.phones.length > 0) lines.push(`Telefon: ${data.phones.join(' / ')}`);
  if (data.email) lines.push(`E-posta: ${data.email}`);
  if (data.address) lines.push(`Adres: ${data.address}`);
  if (data.website) lines.push(`Web Sitesi: ${data.website}`);

  return lines.join('\n');
}

export function isEmptyCard(data: CardData): boolean {
  return (
    !data.fullName &&
    !data.jobTitle &&
    !data.company &&
    data.phones.length === 0 &&
    !data.email &&
    !data.address &&
    !data.website
  );
}
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `npx vitest run tests/formatReport.test.ts`
Expected: PASS (6 test)

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/formatReport.ts tests/formatReport.test.ts
git commit -m "Rapor formatlama modülünü ekle (formatReport, isEmptyCard)"
```

---

### Task 3: `extractCard` — Claude Vision Çağrısı

**Files:**
- Create: `lib/extractCard.ts`
- Test: `tests/extractCard.test.ts`

**Interfaces:**
- Consumes: `CardData` (Task 2'den, `lib/types.ts`).
- Produces: `extractCard(imageBase64: string, mediaType: string, client?: AnthropicMessagesClient): Promise<CardData>` ve `AnthropicMessagesClient` arayüzü (`lib/extractCard.ts`) — Task 4 bunları kullanır.

- [ ] **Step 1: Başarısız olacak testi yaz — `tests/extractCard.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { extractCard, type AnthropicMessagesClient } from '../lib/extractCard.js';

function fakeClient(responseText: string, stopReason = 'end_turn'): AnthropicMessagesClient {
  return {
    messages: {
      create: async () => ({
        stop_reason: stopReason,
        content: [{ type: 'text', text: responseText }],
      }),
    },
  };
}

describe('extractCard', () => {
  it('parses a well-formed structured JSON response into CardData', async () => {
    const client = fakeClient(
      JSON.stringify({
        fullName: 'Ayşe Yılmaz',
        jobTitle: 'Satış Müdürü',
        company: 'Acme A.Ş.',
        phones: ['0212 555 11 22'],
        email: 'ayse@acme.com',
        address: 'Levent, İstanbul',
        website: 'acme.com',
      }),
    );

    const result = await extractCard('base64data', 'image/jpeg', client);

    expect(result).toEqual({
      fullName: 'Ayşe Yılmaz',
      jobTitle: 'Satış Müdürü',
      company: 'Acme A.Ş.',
      phones: ['0212 555 11 22'],
      email: 'ayse@acme.com',
      address: 'Levent, İstanbul',
      website: 'acme.com',
    });
  });

  it('throws when the response has no text content block', async () => {
    const client: AnthropicMessagesClient = {
      messages: {
        create: async () => ({ stop_reason: 'end_turn', content: [] }),
      },
    };

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtında metin bulunamadı.',
    );
  });

  it('throws when Claude refuses the request', async () => {
    const client = fakeClient('{}', 'refusal');

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude bu isteği reddetti.',
    );
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/extractCard.test.ts`
Expected: FAIL — `lib/extractCard.ts` bulunamadığı için modül çözümleme hatası.

- [ ] **Step 3: `lib/extractCard.ts` içinde implementasyonu yaz**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { CardData } from './types.js';

const CARD_SCHEMA = {
  type: 'object',
  properties: {
    fullName: {
      type: 'string',
      description: 'Kartvizitteki ad soyad. Bulunamazsa boş string ("") döndür.',
    },
    jobTitle: {
      type: 'string',
      description: 'Unvan veya pozisyon. Bulunamazsa boş string.',
    },
    company: {
      type: 'string',
      description: 'Şirket adı. Bulunamazsa boş string.',
    },
    phones: {
      type: 'array',
      items: { type: 'string' },
      description: 'Kartvizitteki tüm telefon numaraları. Yoksa boş dizi.',
    },
    email: {
      type: 'string',
      description: 'E-posta adresi. Bulunamazsa boş string.',
    },
    address: {
      type: 'string',
      description: 'Açık adres. Bulunamazsa boş string.',
    },
    website: {
      type: 'string',
      description: 'Web sitesi. Bulunamazsa boş string.',
    },
  },
  required: ['fullName', 'jobTitle', 'company', 'phones', 'email', 'address', 'website'],
  additionalProperties: false,
} as const;

const PROMPT =
  'Bu bir kartvizit fotoğrafı. Kartvizitten şu bilgileri çıkar: ad soyad, unvan, ' +
  'şirket adı, telefon numarası/numaraları, e-posta, adres, web sitesi. Kartvizitte ' +
  'olmayan alanlar için boş string ("") veya boş dizi ([]) kullan. Bilgiyi olduğu ' +
  'gibi, çeviri veya yorum yapmadan çıkar.';

export interface AnthropicMessagesClient {
  messages: {
    create: (params: unknown) => Promise<{
      stop_reason: string;
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}

let defaultClient: AnthropicMessagesClient | undefined;

function getDefaultClient(): AnthropicMessagesClient {
  if (!defaultClient) {
    defaultClient = new Anthropic() as unknown as AnthropicMessagesClient;
  }
  return defaultClient;
}

export async function extractCard(
  imageBase64: string,
  mediaType: string,
  client: AnthropicMessagesClient = getDefaultClient(),
): Promise<CardData> {
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: CARD_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude bu isteği reddetti.');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || typeof textBlock.text !== 'string') {
    throw new Error('Claude yanıtında metin bulunamadı.');
  }

  return JSON.parse(textBlock.text) as CardData;
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx vitest run tests/extractCard.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add lib/extractCard.ts tests/extractCard.test.ts
git commit -m "Claude vision ile kartvizit çıkarma modülünü ekle (extractCard)"
```

---

### Task 4: `POST /api/scan` — Vercel Serverless Function

**Files:**
- Create: `api/scan.ts`
- Test: `tests/scan.test.ts`

**Interfaces:**
- Consumes: `extractCard` (Task 3, `lib/extractCard.ts`), `formatReport` + `isEmptyCard` (Task 2, `lib/formatReport.ts`).
- Produces: `POST /api/scan` HTTP endpoint. İstek gövdesi: `{ imageBase64: string, mediaType: string }`. Başarılı yanıt (200): `{ card: CardData, report: string, empty: boolean }`. Hata yanıtları: 400/405/413/502, gövde `{ error: string }`. Task 5 (web arayüzü) bu sözleşmeyi kullanır.

- [ ] **Step 1: Başarısız olacak testi yaz — `tests/scan.test.ts`**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const extractCardMock = vi.fn();
const formatReportMock = vi.fn();
const isEmptyCardMock = vi.fn();

vi.mock('../lib/extractCard.js', () => ({
  extractCard: extractCardMock,
}));

vi.mock('../lib/formatReport.js', () => ({
  formatReport: formatReportMock,
  isEmptyCard: isEmptyCardMock,
}));

const { default: handler } = await import('../api/scan.js');

function createMockRes() {
  const res: any = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('POST /api/scan handler', () => {
  beforeEach(() => {
    extractCardMock.mockReset();
    formatReportMock.mockReset();
    isEmptyCardMock.mockReset();
  });

  it('rejects non-POST methods with 405', async () => {
    const req: any = { method: 'GET' };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request missing imageBase64 or mediaType with 400', async () => {
    const req: any = { method: 'POST', body: { mediaType: 'image/jpeg' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an oversized image with 413', async () => {
    const req: any = {
      method: 'POST',
      body: { imageBase64: 'a'.repeat(6_000_001), mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
  });

  it('returns 200 with card, report, and empty flag on success', async () => {
    const card = {
      fullName: 'Ayşe Yılmaz',
      jobTitle: '',
      company: '',
      phones: [],
      email: '',
      address: '',
      website: '',
    };
    extractCardMock.mockResolvedValue(card);
    formatReportMock.mockReturnValue('Ad Soyad: Ayşe Yılmaz');
    isEmptyCardMock.mockReturnValue(false);

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ card, report: 'Ad Soyad: Ayşe Yılmaz', empty: false });
  });

  it('returns 502 when extraction fails', async () => {
    extractCardMock.mockRejectedValue(new Error('boom'));

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/scan.test.ts`
Expected: FAIL — `api/scan.ts` bulunamadığı için modül çözümleme hatası.

- [ ] **Step 3: `api/scan.ts` içinde implementasyonu yaz**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractCard } from '../lib/extractCard.js';
import { formatReport, isEmptyCard } from '../lib/formatReport.js';

const MAX_BASE64_LENGTH = 6_000_000; // ~4.5MB base64 kodlanmış görsel

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Sadece POST istekleri desteklenir.' });
    return;
  }

  const body = req.body as { imageBase64?: unknown; mediaType?: unknown } | undefined;
  const imageBase64 = body?.imageBase64;
  const mediaType = body?.mediaType;

  if (
    typeof imageBase64 !== 'string' ||
    typeof mediaType !== 'string' ||
    !imageBase64 ||
    !mediaType
  ) {
    res.status(400).json({ error: 'imageBase64 ve mediaType alanları gerekli.' });
    return;
  }

  if (imageBase64.length > MAX_BASE64_LENGTH) {
    res.status(413).json({ error: 'Görsel çok büyük. Lütfen daha küçük bir fotoğraf yükleyin.' });
    return;
  }

  try {
    const card = await extractCard(imageBase64, mediaType);
    res.status(200).json({
      card,
      report: formatReport(card),
      empty: isEmptyCard(card),
    });
  } catch (err) {
    console.error('Kartvizit okuma hatası:', err);
    res.status(502).json({ error: 'Kart okunamadı. Lütfen tekrar deneyin.' });
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx vitest run tests/scan.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Tüm test paketini çalıştır**

Run: `npm test`
Expected: PASS (toplam 14 test — Task 2 + Task 3 + Task 4)

- [ ] **Step 6: Commit**

```bash
git add api/scan.ts tests/scan.test.ts
git commit -m "POST /api/scan Vercel serverless function'ını ekle"
```

---

### Task 5: Web Arayüzü

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`

**Interfaces:**
- Consumes: `POST /api/scan` sözleşmesi (Task 4).
- Produces: Tarayıcıda çalışan kullanıcı arayüzü — sonraki görev yok, bu plan için son işlevsel parça.

- [ ] **Step 1: `public/index.html` dosyasını oluştur**

```html
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kartokuma — Kartvizit Okuma</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Kartokuma</h1>
    <p>Bir kartvizit fotoğrafı yükle, bilgileri otomatik çıkaralım.</p>

    <label class="upload-box" for="fileInput">
      <span id="uploadLabel">Fotoğraf seç veya çek</span>
      <input type="file" id="fileInput" accept="image/*" capture="environment" />
    </label>

    <div id="status" class="status" hidden></div>

    <section id="result" class="result" hidden>
      <h2>Sonuç</h2>
      <pre id="reportText"></pre>
      <button id="copyBtn" type="button">Panoya Kopyala</button>
    </section>

    <div id="error" class="error" hidden></div>
  </main>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `public/style.css` dosyasını oluştur**

```css
* {
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: #f4f4f5;
  color: #1c1c1e;
  margin: 0;
  padding: 24px 16px;
}

main {
  max-width: 480px;
  margin: 0 auto;
}

h1 {
  font-size: 1.5rem;
  margin-bottom: 4px;
}

p {
  color: #52525b;
  margin-top: 0;
}

.upload-box {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #a1a1aa;
  border-radius: 12px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  background: #fff;
  margin: 16px 0;
}

.upload-box input {
  display: none;
}

.status {
  text-align: center;
  color: #52525b;
  margin: 16px 0;
}

.result {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}

.result pre {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.95rem;
}

.result button {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

.error {
  color: #b91c1c;
  background: #fef2f2;
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
  text-align: center;
}
```

- [ ] **Step 3: `public/app.js` dosyasını oluştur**

```javascript
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
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Bilinmeyen hata.');
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
    show(errorEl, err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
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
```

- [ ] **Step 4: Yerel ortamda manuel test için `.env.local` oluştur**

`.env.local` dosyasını proje köküne ekle (bu dosya `.gitignore` içinde, commit edilmeyecek):

```
ANTHROPIC_API_KEY=<gerçek-api-anahtarın>
```

- [ ] **Step 5: Yerel sunucuyu başlat ve manuel test yap**

Run: `npx vercel dev`

İlk çalıştırmada Vercel CLI proje bağlama soruları sorabilir — mevcut hesabı/organizasyonu seç, yeni proje olarak devam et. Sunucu `http://localhost:3000` üzerinde açılınca:

1. Tarayıcıda `http://localhost:3000` adresini aç.
2. "Fotoğraf seç veya çek" alanına net bir kartvizit fotoğrafı yükle.
3. Birkaç saniye içinde "Sonuç" bölümünde alanların (Ad Soyad, Şirket, Telefon vb.) doğru çıktığını doğrula.
4. "Panoya Kopyala" butonuna bas, başka bir yere (ör. Not Defteri) yapıştırıp metnin doğru geldiğini doğrula.
5. Kartvizit olmayan bir fotoğraf (ör. bir manzara fotoğrafı) yükleyip "Kart okunamadı" mesajının çıktığını doğrula.

Expected: Yukarıdaki 5 adımın tümü açıklandığı gibi çalışır.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "Web arayüzünü ekle (yükleme, sonuç gösterimi, kopyalama)"
```

---

### Task 6: GitHub Reposu ve Vercel Deployment

**Files:**
- Modify: yok (yalnızca git/deployment işlemleri)

**Interfaces:**
- Consumes: Task 1-5'te oluşturulan tüm proje.
- Produces: Canlı, `https://kartokuma.vercel.app` (veya benzeri) adresinde erişilebilir web uygulaması.

- [ ] **Step 1: GitHub reposunu oluştur**

Run:
```bash
gh repo create mtncod/kartokuma --public --source=. --remote=origin --push
```

Bu komut mevcut yerel git reposunu `mtncod/kartokuma` adında yeni, boş bir GitHub reposuna bağlar ve `master` dalını push eder.

Expected: Komut, yeni reponun URL'ini basar; `git log` GitHub'daki commit geçmişiyle eşleşir.

- [ ] **Step 2: Vercel'e giriş yap ve projeyi bağla**

Run: `npx vercel login`

Tarayıcıda açılan sayfadan mevcut Vercel hesabınla (`metingencay-9195`) giriş yap.

Run: `npx vercel link`

Sorulduğunda: mevcut bir proje yerine **yeni proje oluştur**, proje adı olarak `kartokuma` gir, scope olarak `metingencay-9195` hesabını seç.

- [ ] **Step 3: `ANTHROPIC_API_KEY` ortam değişkenini Vercel'e ekle**

Run: `npx vercel env add ANTHROPIC_API_KEY production`

İstendiğinde gerçek Claude API anahtarını yapıştır. Aynı komutu `preview` ve `development` ortamları için de tekrarla (isteğe bağlı, ama önerilir):

```bash
npx vercel env add ANTHROPIC_API_KEY preview
npx vercel env add ANTHROPIC_API_KEY development
```

- [ ] **Step 4: Production'a deploy et**

Run: `npx vercel --prod`

Expected: Komut sonunda bir production URL basar (ör. `https://kartokuma.vercel.app`).

- [ ] **Step 5: Canlı ortamda doğrula**

1. Basılan production URL'i tarayıcıda aç.
2. Task 5, Step 5'teki manuel test adımlarını (1-5) canlı URL üzerinde tekrarla.

Expected: Web uygulaması canlıda da yerel ortamdaki gibi çalışır.

- [ ] **Step 6: Vercel proje ayarlarında GitHub entegrasyonunu doğrula**

`https://vercel.com/metingencay-9195/kartokuma/settings/git` adresine giderek reponun `mtncod/kartokuma` olarak bağlı olduğunu ve `master` daline yapılan her push'un otomatik deploy tetikleyeceğini doğrula.
