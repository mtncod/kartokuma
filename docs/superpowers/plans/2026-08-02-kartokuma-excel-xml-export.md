# Kartokuma Excel/XML Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Taranan bir kartvizitin bilgilerini (yeni eklenen İl alanı dahil) tarayıcıda CSV ("Excel İndir") veya XML ("XML İndir") dosyası olarak indirilebilir hale getirmek.

**Architecture:** Backend'e yeni bir `il` alanı eklenir (Claude'un ayrı bir alan olarak çıkardığı). İndirme tamamen istemci tarafında çalışır: yeni bir `public/exportFormats.js` modülü saf `buildCsv`/`buildXml`/`buildFileName` fonksiyonlarını içerir (vitest ile test edilebilir), `public/app.js` bunları import edip iki yeni butona bağlar. Yeni bir backend endpoint'i veya sunucu tarafı depolama yok.

**Tech Stack:** Mevcut yığın değişmiyor — TypeScript (backend), vanilla JS ES modülleri (frontend, ilk kez `<script type="module">` kullanılacak), Vitest.

## Global Constraints

- Yeni alan adı tam olarak `il` (CardData tipinde ve JSON şemasında); bulunamazsa boş string (`""`), asla `null` değil.
- Rapor/CSV/XML alan sırası her yerde aynı: Ad Soyad, Unvan, Şirket, Telefon, E-posta, İl, Adres, Web Sitesi.
- CSV: noktalı virgül (`;`) ayraçlı, UTF-8 BOM ile başlar (kaynak kodda BOM her zaman `'\uFEFF'` escape dizisiyle yazılır — görünmez ham karakter asla kullanılmaz), `\r\n` satır sonu.
- XML: `<?xml version="1.0" encoding="UTF-8"?>` ile başlar, kök eleman `<kartvizit>`, birden fazla telefon için tekrar eden `<telefon>` etiketleri, özel karakterler escape edilir.
- Dış kütüphane/CDN bağımlılığı eklenmez.
- Kullanıcı arayüzü metinleri Türkçe.
- Bu değişiklikler mevcut `mtncod/kartokuma` GitHub reposuna ve `metingencay-9195/kartokuma` Vercel projesine deploy edilir — yeni repo/proje oluşturulmaz.

---

### Task 1: `CardData`'ya `il` Alanı Ekle + Claude Çıkarımını Güncelle

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/extractCard.ts`
- Modify: `tests/extractCard.test.ts`

**Interfaces:**
- Consumes: yok (mevcut `CardData`, `extractCard`, `AnthropicMessagesClient` — bu görev bunları genişletiyor).
- Produces: `CardData.il: string` alanı ve Claude'un bunu dolduran güncellenmiş şema/prompt — Task 2, 3, 4 bu alanı kullanır.

- [ ] **Step 1: `tests/extractCard.test.ts` dosyasının tamamını şununla değiştir (başarısız olacak testler içerir)**

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
        il: 'İstanbul',
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
      il: 'İstanbul',
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

  it('throws when the response was truncated by the token budget', async () => {
    const client = fakeClient('{"fullName": "eksik', 'max_tokens');

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtı tamamlanamadı.',
    );
  });

  it('throws when the text block is not valid JSON', async () => {
    const client = fakeClient('bu json değil {{{');

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtı çözümlenemedi.',
    );
  });

  it('throws when the parsed JSON does not match the expected shape', async () => {
    const client = fakeClient(JSON.stringify({ fullName: 'Ayşe Yılmaz', phones: 'not-an-array' }));

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtı çözümlenemedi.',
    );
  });

  it('sends the expected request params to Claude', async () => {
    let capturedParams: any;
    const client: AnthropicMessagesClient = {
      messages: {
        create: async (params) => {
          capturedParams = params;
          return {
            stop_reason: 'end_turn',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  fullName: '',
                  jobTitle: '',
                  company: '',
                  phones: [],
                  email: '',
                  il: '',
                  address: '',
                  website: '',
                }),
              },
            ],
          };
        },
      },
    };

    await extractCard('the-image-base64', 'image/png', client);

    expect(capturedParams.model).toBe('claude-opus-5');
    expect(capturedParams.output_config.format.schema.required).toEqual([
      'fullName',
      'jobTitle',
      'company',
      'phones',
      'email',
      'il',
      'address',
      'website',
    ]);

    const imageBlock = capturedParams.messages[0].content.find(
      (block: any) => block.type === 'image',
    );
    expect(imageBlock.source.data).toBe('the-image-base64');
    expect(imageBlock.source.media_type).toBe('image/png');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/extractCard.test.ts`
Expected: FAIL — özellikle "sends the expected request params to Claude" testi, `schema.required` dizisinde `'il'` olmadığı için başarısız olur.

- [ ] **Step 3: `lib/types.ts` dosyasının tamamını şununla değiştir**

```typescript
export interface CardData {
  fullName: string;
  jobTitle: string;
  company: string;
  phones: string[];
  email: string;
  il: string;
  address: string;
  website: string;
}
```

- [ ] **Step 4: `lib/extractCard.ts` içindeki `CARD_SCHEMA` sabitini şununla değiştir**

```typescript
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
    il: {
      type: 'string',
      description:
        'Kartvizitteki şehir/il bilgisi (ör. "İstanbul"). Adres metninden bağımsız ' +
        'olarak, kartvizitte geçen ile bakarak doldur. Bulunamazsa boş string.',
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
  required: ['fullName', 'jobTitle', 'company', 'phones', 'email', 'il', 'address', 'website'],
  additionalProperties: false,
} as const;
```

- [ ] **Step 5: Aynı dosyada `PROMPT` sabitini şununla değiştir**

```typescript
const PROMPT =
  'Bu bir kartvizit fotoğrafı. Kartvizitten şu bilgileri çıkar: ad soyad, unvan, ' +
  'şirket adı, telefon numarası/numaraları, e-posta, il (şehir), adres, web sitesi. ' +
  'Kartvizitte olmayan alanlar için boş string ("") veya boş dizi ([]) kullan. ' +
  'Bilgiyi olduğu gibi, çeviri veya yorum yapmadan çıkar.';
```

Dosyanın geri kalanı (`AnthropicMessagesClient`, `getDefaultClient`, `extractCard` fonksiyonunun gövdesi) değişmeden kalır.

- [ ] **Step 6: Testin geçtiğini doğrula**

Run: `npx vitest run tests/extractCard.test.ts`
Expected: PASS (6 test)

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/extractCard.ts tests/extractCard.test.ts
git commit -m "CardData'ya il alanı ekle, Claude şema/prompt'unu güncelle"
```

---

### Task 2: `formatReport`'a İl Satırını Ekle

**Files:**
- Modify: `lib/formatReport.ts`
- Modify: `tests/formatReport.test.ts`

**Interfaces:**
- Consumes: `CardData.il` (Task 1).
- Produces: `formatReport`/`isEmptyCard`'ın İl'i de kapsayan güncellenmiş davranışı — Task 4 (`app.js`) ekrandaki rapor için bunu zaten kullanıyor, değişiklik gerektirmez.

- [ ] **Step 1: `tests/formatReport.test.ts` dosyasının tamamını şununla değiştir (başarısız olacak testler içerir)**

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
    il: '',
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
      il: 'İstanbul',
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
        'İl: İstanbul',
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

  it('includes the İl line when present', () => {
    const card = makeCard({ il: 'Ankara' });

    expect(formatReport(card)).toBe('İl: Ankara');
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

  it('returns false when only il is populated', () => {
    expect(isEmptyCard(makeCard({ il: 'İzmir' }))).toBe(false);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/formatReport.test.ts`
Expected: FAIL — "formats a fully populated card..." ve "includes the İl line..." testleri, çıktıda `İl:` satırı olmadığı için başarısız olur.

- [ ] **Step 3: `lib/formatReport.ts` dosyasının tamamını şununla değiştir**

```typescript
import type { CardData } from './types.js';

export function formatReport(data: CardData): string {
  const lines: string[] = [];

  if (data.fullName) lines.push(`Ad Soyad: ${data.fullName}`);
  if (data.jobTitle) lines.push(`Unvan: ${data.jobTitle}`);
  if (data.company) lines.push(`Şirket: ${data.company}`);
  if (data.phones.length > 0) lines.push(`Telefon: ${data.phones.join(' / ')}`);
  if (data.email) lines.push(`E-posta: ${data.email}`);
  if (data.il) lines.push(`İl: ${data.il}`);
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
    !data.il &&
    !data.address &&
    !data.website
  );
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx vitest run tests/formatReport.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add lib/formatReport.ts tests/formatReport.test.ts
git commit -m "formatReport ve isEmptyCard'a İl alanını ekle"
```

---

### Task 3: `public/exportFormats.js` — CSV/XML/Dosya Adı Üretimi

**Files:**
- Create: `public/exportFormats.js`
- Create: `tests/exportFormats.test.ts`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `CardData` şeklinde bir nesne (Task 1'den; bu dosya saf JS olduğu için tip import etmez, sadece alan adlarını bilir: `fullName`, `jobTitle`, `company`, `phones`, `email`, `il`, `address`, `website`).
- Produces: `buildCsv(card): string`, `buildXml(card): string`, `slugify(value): string`, `buildFileName(card, extension, dateStamp?): string` — Task 4 (`public/app.js`) bunları import edip kullanır.

- [ ] **Step 1: `tsconfig.json`'ı güncelle — `allowJs` ekle**

Dosyanın tamamını şununla değiştir (tek değişiklik: `"allowJs": true,` eklendi):

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
    "allowJs": true,
    "types": ["node"]
  },
  "include": ["api", "lib", "tests"]
}
```

(Bu, `tests/exportFormats.test.ts`'in `public/exportFormats.js` gibi düz bir `.js` dosyasını import etmesine izin verir; `npx tsc --noEmit` bu satır olmadan "Cannot find module" hatası verir.)

- [ ] **Step 2: Başarısız olacak testi yaz — `tests/exportFormats.test.ts`**

**Önemli:** Bu dosyadaki BOM ile ilgili tüm regex'lerde ve `exportFormats.js`'deki BOM sabitinde, görünmez ham Unicode karakteri **asla** doğrudan kaynak koduna yapıştırma — her zaman `'\uFEFF'` escape dizisini kullan (kopyala/yapıştır sırasında görünmez karakterin sessizce kaybolması/bozulması riskini önler).

```typescript
import { describe, expect, it } from 'vitest';
import { buildCsv, buildXml, buildFileName, slugify } from '../public/exportFormats.js';

function makeCard(overrides = {}) {
  return {
    fullName: '',
    jobTitle: '',
    company: '',
    phones: [],
    email: '',
    il: '',
    address: '',
    website: '',
    ...overrides,
  };
}

describe('buildCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = buildCsv(makeCard());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('produces a semicolon-delimited header and data row for a fully populated card', () => {
    const card = makeCard({
      fullName: 'Ayşe Yılmaz',
      jobTitle: 'Satış Müdürü',
      company: 'Acme A.Ş.',
      phones: ['0212 555 11 22'],
      email: 'ayse@acme.com',
      il: 'İstanbul',
      address: 'Levent, İstanbul',
      website: 'acme.com',
    });

    const csv = buildCsv(card);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');

    expect(lines[0]).toBe('Ad Soyad;Unvan;Şirket;Telefon;E-posta;İl;Adres;Web Sitesi');
    expect(lines[1]).toBe(
      'Ayşe Yılmaz;Satış Müdürü;Acme A.Ş.;0212 555 11 22;ayse@acme.com;İstanbul;Levent, İstanbul;acme.com',
    );
  });

  it('joins multiple phone numbers with a slash inside a single cell', () => {
    const card = makeCard({ phones: ['0212 555 11 22', '0532 111 22 33'] });
    const csv = buildCsv(card);
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain('0212 555 11 22 / 0532 111 22 33');
  });

  it('quotes a cell containing a semicolon', () => {
    const card = makeCard({ address: 'Levent; Beşiktaş' });
    const csv = buildCsv(card);
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain('"Levent; Beşiktaş"');
  });
});

describe('buildXml', () => {
  it('produces well-formed XML with all fields for a fully populated card', () => {
    const card = makeCard({
      fullName: 'Ayşe Yılmaz',
      jobTitle: 'Satış Müdürü',
      company: 'Acme A.Ş.',
      phones: ['0212 555 11 22', '0532 111 22 33'],
      email: 'ayse@acme.com',
      il: 'İstanbul',
      address: 'Levent, İstanbul',
      website: 'acme.com',
    });

    const xml = buildXml(card);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<adSoyad>Ayşe Yılmaz</adSoyad>');
    expect(xml).toContain('<unvan>Satış Müdürü</unvan>');
    expect(xml).toContain('<sirket>Acme A.Ş.</sirket>');
    expect(xml).toContain('<telefon>0212 555 11 22</telefon>');
    expect(xml).toContain('<telefon>0532 111 22 33</telefon>');
    expect(xml).toContain('<eposta>ayse@acme.com</eposta>');
    expect(xml).toContain('<il>İstanbul</il>');
    expect(xml).toContain('<adres>Levent, İstanbul</adres>');
    expect(xml).toContain('<webSitesi>acme.com</webSitesi>');
  });

  it('omits telefon tags entirely when there are no phone numbers', () => {
    const xml = buildXml(makeCard());
    expect(xml).not.toContain('<telefon>');
  });

  it('escapes XML special characters', () => {
    const card = makeCard({ company: 'A & B <Ltd> "Şti"' });
    const xml = buildXml(card);

    expect(xml).toContain('<sirket>A &amp; B &lt;Ltd&gt; &quot;Şti&quot;</sirket>');
  });
});

describe('slugify', () => {
  it('converts Turkish characters and spaces to a URL-safe slug', () => {
    expect(slugify('Ayşe Yılmaz Öğüt')).toBe('ayse-yilmaz-ogut');
  });

  it('returns an empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });
});

describe('buildFileName', () => {
  it('derives the filename from fullName when present', () => {
    const card = makeCard({ fullName: 'Ayşe Yılmaz', company: 'Acme' });
    expect(buildFileName(card, 'csv', '20260802')).toBe('kartvizit-ayse-yilmaz-20260802.csv');
  });

  it('falls back to company when fullName is empty', () => {
    const card = makeCard({ company: 'Acme A.Ş.' });
    expect(buildFileName(card, 'xml', '20260802')).toBe('kartvizit-acme-a-s-20260802.xml');
  });

  it('falls back to just the date stamp when both are empty', () => {
    const card = makeCard();
    expect(buildFileName(card, 'csv', '20260802')).toBe('kartvizit-20260802.csv');
  });
});
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/exportFormats.test.ts`
Expected: FAIL — `public/exportFormats.js` bulunamadığı için modül çözümleme hatası.

- [ ] **Step 4: `public/exportFormats.js` dosyasını oluştur**

**Önemli:** Aşağıdaki `bom` sabitini tam olarak `'\uFEFF'` (altı karakterlik escape dizisi) olarak yaz — görünmez ham Unicode karakteri yapıştırma.

```javascript
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[;"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(card) {
  const header = ['Ad Soyad', 'Unvan', 'Şirket', 'Telefon', 'E-posta', 'İl', 'Adres', 'Web Sitesi'];
  const row = [
    card.fullName,
    card.jobTitle,
    card.company,
    card.phones.join(' / '),
    card.email,
    card.il,
    card.address,
    card.website,
  ].map(escapeCsvCell);

  const bom = '\uFEFF';
  return bom + header.join(';') + '\r\n' + row.join(';') + '\r\n';
}

export function buildXml(card) {
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
    '</kartvizit>\n'
  );
}

export function slugify(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildFileName(card, extension, dateStamp) {
  const base = slugify(card.fullName) || slugify(card.company);
  const stamp = dateStamp || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return base ? `kartvizit-${base}-${stamp}.${extension}` : `kartvizit-${stamp}.${extension}`;
}
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `npx vitest run tests/exportFormats.test.ts`
Expected: PASS (12 test)

- [ ] **Step 6: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: Hata yok (yeni `allowJs` ayarı sayesinde `.js` importu sorunsuz çözümlenir).

- [ ] **Step 7: Tüm test paketini çalıştır**

Run: `npm test`
Expected: PASS (toplam 32 test — bu plandan önce mevcut olan `tests/scan.test.ts`'ten 5 ve `tests/pwa.test.ts`'ten 2, artı bu plandaki üç dosyadan `extractCard.test.ts`: 6, `formatReport.test.ts`: 7, `exportFormats.test.ts`: 12); hiçbir test başarısız olmamalı.

- [ ] **Step 8: Commit**

```bash
git add public/exportFormats.js tests/exportFormats.test.ts tsconfig.json
git commit -m "CSV/XML/dosya adı üretimi için exportFormats.js ekle"
```

---

### Task 4: Web Arayüzü — İndirme Butonları

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

**Interfaces:**
- Consumes: `buildCsv`, `buildXml`, `buildFileName` (Task 3, `public/exportFormats.js`).
- Produces: yok — bu, kullanıcıya gösterilen son nokta.

- [ ] **Step 1: `public/index.html` içinde `<section id="result">` bloğunu şununla değiştir**

Mevcut blok:

```html
    <section id="result" class="result" hidden>
      <h2>Sonuç</h2>
      <pre id="reportText"></pre>
      <button id="copyBtn" type="button">Panoya Kopyala</button>
    </section>
```

Bunu şununla değiştir:

```html
    <section id="result" class="result" hidden>
      <h2>Sonuç</h2>
      <pre id="reportText"></pre>
      <div class="actions">
        <button id="copyBtn" type="button">Panoya Kopyala</button>
        <button id="csvBtn" type="button">Excel İndir</button>
        <button id="xmlBtn" type="button">XML İndir</button>
      </div>
    </section>
```

- [ ] **Step 2: Aynı dosyada, `<script src="app.js"></script>` satırını şununla değiştir**

```html
  <script type="module" src="app.js"></script>
```

(Diğer her şey — `<head>` içeriği, üst kısım, `upload-box`, `status`, `error` bölümleri — değişmeden kalır.)

- [ ] **Step 3: `public/app.js` dosyasının en üstüne, mevcut servis worker kaydı bloğundan önce import satırını ekle**

Dosyanın en üstü şu anda şöyle başlıyor:

```javascript
if ('serviceWorker' in navigator) {
```

Bunun hemen üstüne, dosyanın ilk satırı olarak şunu ekle:

```javascript
import { buildCsv, buildXml, buildFileName } from './exportFormats.js';

```

- [ ] **Step 4: `const errorEl = ...` satırından hemen sonra yeni DOM referanslarını ve durum değişkenini ekle**

Mevcut satır:

```javascript
const errorEl = document.getElementById('error');
```

Bunun hemen altına şunu ekle:

```javascript
const csvBtn = document.getElementById('csvBtn');
const xmlBtn = document.getElementById('xmlBtn');

let lastCard = null;
```

- [ ] **Step 5: Başarılı tarama sonrası `lastCard`'ı doldur**

Mevcut blok (`fileInput`'un `change` event handler'ı içinde):

```javascript
    reportTextEl.textContent = data.report;
    show(resultEl);
```

Bunu şununla değiştir:

```javascript
    reportTextEl.textContent = data.report;
    lastCard = data.card;
    show(resultEl);
```

- [ ] **Step 6: `copyBtn`'in click handler'ından hemen sonra, indirme handler'larını ve yardımcı fonksiyonu ekle**

Mevcut `copyBtn.addEventListener(...)` bloğundan hemen sonra (ve `function resizeImage(file) {` satırından önce), şunu ekle:

```javascript
csvBtn.addEventListener('click', () => {
  if (!lastCard) return;
  downloadFile(buildFileName(lastCard, 'csv'), buildCsv(lastCard), 'text/csv;charset=utf-8');
});

xmlBtn.addEventListener('click', () => {
  if (!lastCard) return;
  downloadFile(buildFileName(lastCard, 'xml'), buildXml(lastCard), 'application/xml;charset=utf-8');
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
```

- [ ] **Step 7: `public/style.css`'in sonuna buton grubu için stil ekle**

Dosyanın sonuna şunu ekle:

```css

.result .actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.result .actions button {
  width: auto;
  flex: 1 1 120px;
}
```

- [ ] **Step 8: Sözdizimi doğrulaması**

Run: `node --check public/exportFormats.js`

Expected: Çıktı yok, hata yok.

**Not:** `public/app.js` artık `import` içerdiği için (ES modülü), `node --check` bu dosya üzerinde çalıştırılamaz (Node, tarayıcı `import` çözümlemesini farklı yapar). Bunun yerine dosyayı oku ve şunları elle doğrula:
- Import satırı doğru yolu (`./exportFormats.js`) gösteriyor.
- `csvBtn`, `xmlBtn`, `lastCard` doğru şekilde tanımlanmış.
- `lastCard = data.card;` satırı doğru yerde (rapor gösterilmeden hemen önce).
- Yeni buton handler'ları ve `downloadFile` fonksiyonu dosyanın sonunda, `resizeImage`'dan önce, doğru şekilde eklenmiş.

- [ ] **Step 9: Commit**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "Web arayüzüne Excel/XML indirme butonlarını ekle"
```

---

### Task 5: Servis Worker — Yeni Dosyayı Önbelleğe Al

**Files:**
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `public/exportFormats.js` (Task 3).
- Produces: yok.

- [ ] **Step 1: `public/sw.js` içinde `CACHE_NAME` ve `SHELL_FILES`'ı şununla değiştir**

Mevcut blok:

```javascript
const CACHE_NAME = 'kartokuma-shell-v1';
const SHELL_FILES = [
  '/',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',
];
```

Bunu şununla değiştir (sürüm `v1`'den `v2`'ye çıktı, `/exportFormats.js` listeye eklendi):

```javascript
const CACHE_NAME = 'kartokuma-shell-v2';
const SHELL_FILES = [
  '/',
  '/style.css',
  '/app.js',
  '/exportFormats.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',
];
```

Dosyanın geri kalanı (üstteki yorum, `install`/`activate`/`fetch` event listener'ları) değişmeden kalır.

- [ ] **Step 2: Sözdizimi doğrulaması**

Run: `node --check public/sw.js`
Expected: Çıktı yok, hata yok.

- [ ] **Step 3: `public/sw.js`'deki tüm `SHELL_FILES` yollarının gerçekten var olduğunu doğrula**

Bu proje `tests/pwa.test.ts` içinde tam olarak bunu yapan bir test zaten içeriyor
(`SHELL_FILES`'ı okuyup her yolun diskte var olduğunu doğrular). Bu testi çalıştırarak
yeni eklenen `/exportFormats.js` yolunun da doğru tanındığını doğrula:

Run: `npx vitest run tests/pwa.test.ts`
Expected: PASS (2 test) — hiçbir değişiklik gerekmeden geçmeli, çünkü test dosya
listesini `sw.js`'den dinamik olarak okuyor.

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "sw.js: exportFormats.js'i önbelleğe ekle, CACHE_NAME'i v2'ye çıkar"
```

---

### Task 6: Deploy ve Canlı Doğrulama

**Files:**
- Modify: yok (yalnızca git/deployment işlemleri)

**Interfaces:**
- Consumes: Task 1-5'te oluşturulan tüm dosyalar.
- Produces: `https://kartokuma.vercel.app` üzerinde çalışan Excel/XML indirme özelliği.

- [ ] **Step 1: Tüm test paketini son kez çalıştır**

Run: `npm test && node --check public/exportFormats.js && node --check public/sw.js && npx tsc --noEmit`
Expected: Tüm testler geçer, iki `--check` komutu sessizce başarılı olur, `tsc` hata vermez.

- [ ] **Step 2: `master` dalına push et**

```bash
git push origin <mevcut-dal>:master
```

- [ ] **Step 3: Vercel'e yeniden deploy et**

Run: `npx vercel --prod --yes`

Expected: Build başarılı, bir production URL basılır (kısa `kartokuma.vercel.app` adresine otomatik alias edilmeyebilir — önceki deploy'larda gözlemlendiği gibi).

- [ ] **Step 4: `kartokuma.vercel.app`'in yeni deploy'u gösterdiğini doğrula, gerekirse alias'ı düzelt**

```bash
curl -s -o /dev/null -w "kartokuma.vercel.app: %{http_code}\n" https://kartokuma.vercel.app/exportFormats.js
```

Eğer `404` dönerse (yeni dosya henüz görünmüyorsa), Step 3'ün çıktısındaki gerçek production deployment URL'ini bul ve şunu çalıştır:

```bash
npx vercel alias set <step-3-deployment-url> kartokuma.vercel.app
```

Sonra tekrar doğrula — `200` dönmeli.

- [ ] **Step 5: Canlı ortamda statik dosyaları ve regresyonu doğrula**

```bash
curl -s -o /dev/null -w "exportFormats.js: %{http_code}\n" https://kartokuma.vercel.app/exportFormats.js
curl -s -o /dev/null -w "sw.js: %{http_code}\n" https://kartokuma.vercel.app/sw.js
curl -s -X POST https://kartokuma.vercel.app/api/scan -H "Content-Type: application/json" -d '{}' -w "\nHTTP %{http_code}\n"
```

Expected: `exportFormats.js` ve `sw.js` `200` döner; `/api/scan` hâlâ `{"error":"imageBase64 ve mediaType alanları gerekli."}` ve `HTTP 400` döner (regresyon yok).

- [ ] **Step 6: Kullanıcıya manuel tarayıcı testi talimatı ver**

Bu adım otomatikleştirilemez:
1. `https://kartokuma.vercel.app` adresini aç, bir kartvizit fotoğrafı tara.
2. Sonuç ekranında üç butonun (Panoya Kopyala, Excel İndir, XML İndir) yan yana göründüğünü doğrula.
3. "Excel İndir"e bas, inen `.csv` dosyasını Excel'de aç — Türkçe karakterlerin (İl dahil) doğru göründüğünü ve sütunların ayrı hücrelerde olduğunu doğrula.
4. "XML İndir"e bas, inen `.xml` dosyasını bir metin editöründe aç — tüm alanların (İl dahil) doğru göründüğünü doğrula.
5. Kartvizitte il bilgisi varsa (ör. "İstanbul" yazan bir kart), hem ekrandaki rapor hem de indirilen dosyalarda İl alanının doğru dolduğunu doğrula.
