# Kartokuma Form Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kartvizit tarama alanının altına, bağımsız bir "Form Tara" bölümü eklemek — kullanıcı herhangi bir formun fotoğrafını yükler, Claude içindeki tüm metni serbest (yapılandırılmamış) düz metne çevirir, ekranda gösterilir ve panoya kopyalanabilir.

**Architecture:** Yeni, bağımsız bir backend endpoint'i (`POST /api/transcribe`) ve yeni bir `lib/transcribeForm.ts` modülü — kartvizit endpoint'inden (`/api/scan`) tamamen ayrı, JSON şeması olmadan Claude'dan düz metin ister. Frontend'de, mevcut kartvizit bölümünün altına yeni, bağımsız bir bölüm ve olay dinleyici seti eklenir; `resizeImage`/`show`/`hide` gibi paylaşılan yardımcı fonksiyonlar yeniden kullanılır.

**Tech Stack:** Mevcut yığın değişmiyor — TypeScript (backend), vanilla JS (frontend), Vitest.

## Global Constraints

- Form, sabit bir şablon değildir — Claude, yapılandırılmış alanlara ayırmadan, fotoğraftaki tüm metni olduğu gibi düz metne çevirir (kartvizitteki gibi bir JSON şeması yok).
- Bu özellik, kartvizit tarama akışıyla (mevcut `fileInput`, `lastCard`, `/api/scan`) hiçbir şekilde birleştirilmez veya ona bağımlı olmaz — tamamen ayrı bir alan/akış.
- Dosya indirme (Excel/XML/txt) yok — sadece ekranda gösterim + panoya kopyalama.
- Kullanıcı arayüzü metinleri Türkçe.
- Model: `claude-opus-5`.
- Bu değişiklikler mevcut `mtncod/kartokuma` GitHub reposuna ve `metingencay-9195/kartokuma` Vercel projesine deploy edilir — yeni repo/proje oluşturulmaz.

---

### Task 1: `lib/transcribeForm.ts` — Claude Düz Metin Çıkarımı

**Files:**
- Create: `lib/transcribeForm.ts`
- Create: `tests/transcribeForm.test.ts`

**Interfaces:**
- Consumes: yok (bağımsız yeni modül).
- Produces: `transcribeForm(imageBase64: string, mediaType: string, client?: AnthropicMessagesClient): Promise<string>` ve `AnthropicMessagesClient` arayüzü — Task 2 (`api/transcribe.ts`) bunları kullanır.

- [ ] **Step 1: Başarısız olacak testi yaz — `tests/transcribeForm.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { transcribeForm, type AnthropicMessagesClient } from '../lib/transcribeForm.js';

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

describe('transcribeForm', () => {
  it('returns the transcribed text from a well-formed response', async () => {
    const client = fakeClient('Ad Soyad: Ali Veli\nTarih: 01.08.2026\nAçıklama: Test formu');

    const result = await transcribeForm('base64data', 'image/jpeg', client);

    expect(result).toBe('Ad Soyad: Ali Veli\nTarih: 01.08.2026\nAçıklama: Test formu');
  });

  it('returns an empty string when the form has no readable text', async () => {
    const client = fakeClient('');

    const result = await transcribeForm('base64data', 'image/jpeg', client);

    expect(result).toBe('');
  });

  it('throws when the response has no text content block', async () => {
    const client: AnthropicMessagesClient = {
      messages: {
        create: async () => ({ stop_reason: 'end_turn', content: [] }),
      },
    };

    await expect(transcribeForm('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtında metin bulunamadı.',
    );
  });

  it('throws when Claude refuses the request', async () => {
    const client = fakeClient('', 'refusal');

    await expect(transcribeForm('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude bu isteği reddetti.',
    );
  });

  it('throws when the response was truncated by the token budget', async () => {
    const client = fakeClient('yarım kalan metin', 'max_tokens');

    await expect(transcribeForm('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtı tamamlanamadı.',
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
            content: [{ type: 'text', text: '' }],
          };
        },
      },
    };

    await transcribeForm('the-image-base64', 'image/png', client);

    expect(capturedParams.model).toBe('claude-opus-5');

    const imageBlock = capturedParams.messages[0].content.find(
      (block: any) => block.type === 'image',
    );
    expect(imageBlock.source.data).toBe('the-image-base64');
    expect(imageBlock.source.media_type).toBe('image/png');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/transcribeForm.test.ts`
Expected: FAIL — `lib/transcribeForm.ts` bulunamadığı için modül çözümleme hatası.

- [ ] **Step 3: `lib/transcribeForm.ts` dosyasını oluştur**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const PROMPT =
  'Bu, elle veya bilgisayarda doldurulmuş bir form fotoğrafı. Fotoğraftaki tüm metni ' +
  '(başlıklar, alan adları, doldurulmuş değerler dahil) olduğu gibi, yorum veya çeviri ' +
  'yapmadan düz metin olarak çıkar. Formun yapısını satır satır, okunabilir şekilde ' +
  'koru. Fotoğrafta hiç metin yoksa veya okunamıyorsa boş string ("") döndür.';

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

export async function transcribeForm(
  imageBase64: string,
  mediaType: string,
  client: AnthropicMessagesClient = getDefaultClient(),
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    output_config: {
      effort: 'low',
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

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Claude yanıtı tamamlanamadı.');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || typeof textBlock.text !== 'string') {
    throw new Error('Claude yanıtında metin bulunamadı.');
  }

  return textBlock.text;
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx vitest run tests/transcribeForm.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add lib/transcribeForm.ts tests/transcribeForm.test.ts
git commit -m "Form fotoğrafını düz metne çeviren transcribeForm modülünü ekle"
```

---

### Task 2: `POST /api/transcribe` — Vercel Serverless Function

**Files:**
- Create: `api/transcribe.ts`
- Create: `tests/transcribe.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `transcribeForm` (Task 1, `lib/transcribeForm.ts`).
- Produces: `POST /api/transcribe` HTTP endpoint. İstek gövdesi: `{ imageBase64: string, mediaType: string }`. Başarılı yanıt (200): `{ text: string, empty: boolean }`. Hata yanıtları: 400/405/413/502, gövde `{ error: string }`. Task 3 (web arayüzü) bu sözleşmeyi kullanır.

- [ ] **Step 1: Başarısız olacak testi yaz — `tests/transcribe.test.ts`**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transcribeFormMock = vi.fn();

vi.mock('../lib/transcribeForm.js', () => ({
  transcribeForm: transcribeFormMock,
}));

const { default: handler } = await import('../api/transcribe.js');

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

describe('POST /api/transcribe handler', () => {
  beforeEach(() => {
    transcribeFormMock.mockReset();
  });

  it('rejects non-POST methods with 405', async () => {
    const req: any = { method: 'GET' };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.body).toEqual({ error: 'Sadece POST istekleri desteklenir.' });
  });

  it('rejects a request missing imageBase64 or mediaType with 400', async () => {
    const req: any = { method: 'POST', body: { mediaType: 'image/jpeg' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: 'imageBase64 ve mediaType alanları gerekli.' });
  });

  it('rejects a request missing mediaType (imageBase64 present) with 400', async () => {
    const req: any = { method: 'POST', body: { imageBase64: 'validbase64' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: 'imageBase64 ve mediaType alanları gerekli.' });
  });

  it('rejects an oversized image with 413', async () => {
    const req: any = {
      method: 'POST',
      body: { imageBase64: 'a'.repeat(4_000_001), mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.body).toEqual({
      error: 'Görsel çok büyük. Lütfen daha küçük bir fotoğraf yükleyin.',
    });
  });

  it('returns 200 with text and empty:false on a successful non-empty transcription', async () => {
    transcribeFormMock.mockResolvedValue('Ad Soyad: Ali Veli');

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ text: 'Ad Soyad: Ali Veli', empty: false });
  });

  it('returns 200 with empty:true when the transcribed text is blank', async () => {
    transcribeFormMock.mockResolvedValue('   ');

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ text: '   ', empty: true });
  });

  it('returns 502 when transcription fails', async () => {
    transcribeFormMock.mockRejectedValue(new Error('boom'));

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.body).toEqual({ error: 'Form okunamadı. Lütfen tekrar deneyin.' });
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/transcribe.test.ts`
Expected: FAIL — `api/transcribe.ts` bulunamadığı için modül çözümleme hatası.

- [ ] **Step 3: `api/transcribe.ts` dosyasını oluştur**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transcribeForm } from '../lib/transcribeForm.js';

const MAX_BASE64_LENGTH = 4_000_000; // Vercel'in ~4.5MB istek gövdesi limitinin altında kalır

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
    const text = await transcribeForm(imageBase64, mediaType);
    res.status(200).json({
      text,
      empty: text.trim().length === 0,
    });
  } catch (err) {
    console.error('Form okuma hatası:', err);
    res.status(502).json({ error: 'Form okunamadı. Lütfen tekrar deneyin.' });
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx vitest run tests/transcribe.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: `vercel.json`'a yeni fonksiyon için süre limiti ekle**

Dosyanın tamamını şununla değiştir:

```json
{
  "outputDirectory": "public",
  "functions": {
    "api/scan.ts": {
      "maxDuration": 60
    },
    "api/transcribe.ts": {
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 6: Tüm test paketini çalıştır**

Run: `npm test`
Expected: PASS (mevcut tüm testler + bu plandaki 13 yeni test — `transcribeForm`: 6, `transcribe`: 7 — hiçbiri başarısız olmamalı)

- [ ] **Step 7: Commit**

```bash
git add api/transcribe.ts tests/transcribe.test.ts vercel.json
git commit -m "POST /api/transcribe Vercel serverless function'ını ekle"
```

---

### Task 3: Web Arayüzü — Form Tara Bölümü

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/style.css`

**Interfaces:**
- Consumes: `POST /api/transcribe` sözleşmesi (Task 2).
- Produces: yok — bu, kullanıcıya gösterilen son nokta.

- [ ] **Step 1: `public/index.html` içinde, mevcut kartvizit `<div id="error">` bloğundan hemen sonra, `</main>`'den önce yeni bölümü ekle**

Mevcut blok:

```html
    <div id="error" class="error" hidden></div>
  </main>
```

Bunu şununla değiştir:

```html
    <div id="error" class="error" hidden></div>

    <hr class="section-divider" />

    <h2>Form Tara</h2>
    <p>Elle veya bilgisayarda doldurulmuş bir form fotoğrafı yükle, metne çevirelim.</p>

    <label class="upload-box" for="formFileInput">
      <span>Form fotoğrafı seç veya çek</span>
      <input type="file" id="formFileInput" accept="image/*" capture="environment" />
    </label>

    <div id="formStatus" class="status" hidden></div>

    <section id="formResult" class="result" hidden>
      <h2>Form Metni</h2>
      <pre id="formReportText"></pre>
      <div class="actions">
        <button id="formCopyBtn" type="button">Panoya Kopyala</button>
      </div>
    </section>

    <div id="formError" class="error" hidden></div>
  </main>
```

Dosyanın geri kalanı (`<head>` içeriği, kartvizit bölümü, `<script>` etiketi) değişmeden kalır.

- [ ] **Step 2: `public/style.css`'in sonuna bölüm ayırıcı için stil ekle**

Dosyanın sonuna şunu ekle:

```css

.section-divider {
  border: none;
  border-top: 1px solid #e4e4e7;
  margin: 32px 0 24px;
}
```

- [ ] **Step 3: `public/app.js`'in sonuna, `function hide(el) { el.hidden = true; }` tanımından hemen sonra, yeni form bölümü mantığını ekle**

```javascript

const formFileInput = document.getElementById('formFileInput');
const formStatusEl = document.getElementById('formStatus');
const formResultEl = document.getElementById('formResult');
const formReportTextEl = document.getElementById('formReportText');
const formCopyBtn = document.getElementById('formCopyBtn');
const formErrorEl = document.getElementById('formError');

formFileInput.addEventListener('change', async () => {
  const file = formFileInput.files && formFileInput.files[0];
  if (!file) return;

  hide(formResultEl);
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
```

**Not:** Bu yeni koddaki çevrimdışı algılama (`err instanceof TypeError`) kasıtlı olarak kartvizit akışındaki mevcut desenden (`err instanceof TypeError || !navigator.onLine`) farklı ve daha doğru yazıldı — `!navigator.onLine` eklemek, cihaz çevrimdışıyken oluşan alakasız bir hatayı (ör. bozuk bir görsel dosyası) yanlışlıkla "internet yok" mesajıyla göstermeye neden olabilir. Kartvizit akışındaki mevcut (bilinen, ertelenmiş) davranışına dokunma — sadece bu yeni kod için doğru deseni kullan.

- [ ] **Step 4: Sözdizimi doğrulaması**

Run: `node --check public/exportFormats.js`

Expected: Çıktı yok, hata yok (bu, projedeki mevcut tek Node ile çalıştırılabilir doğrulanabilir dosya; `app.js` `import` içerdiği için `node --check` ile doğrudan çalıştırılamaz).

Bunun yerine `public/app.js`'i oku ve şunları elle doğrula:
- `formFileInput`, `formStatusEl`, `formResultEl`, `formReportTextEl`, `formCopyBtn`, `formErrorEl` doğru ID'lerle (`formFileInput`, `formStatus`, `formResult`, `formReportText`, `formCopyBtn`, `formError`) eşleşiyor.
- Yeni kod bloğu, mevcut `fileInput`/`copyBtn`/`csvBtn`/`xmlBtn` ile ilgili hiçbir değişkene veya DOM elemanına dokunmuyor.
- `fetch('/api/transcribe', ...)` çağrısı `{ imageBase64, mediaType }` gönderiyor ve `data.text`/`data.empty`'yi Task 2'nin döndürdüğü şekilde okuyor.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "Web arayüzüne bağımsız Form Tara bölümünü ekle"
```

---

### Task 4: Deploy ve Canlı Doğrulama

**Files:**
- Modify: yok (yalnızca git/deployment işlemleri)

**Interfaces:**
- Consumes: Task 1-3'te oluşturulan tüm dosyalar.
- Produces: `https://kartokuma.vercel.app` üzerinde çalışan Form Tara özelliği.

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
curl -s -X POST https://kartokuma.vercel.app/api/transcribe -H "Content-Type: application/json" -d '{}' -w "\nHTTP %{http_code}\n"
```

Eğer bağlantı hatası veya beklenmeyen bir yanıt gelirse (yeni endpoint henüz görünmüyorsa), Step 3'ün çıktısındaki gerçek production deployment URL'ini bul ve şunu çalıştır:

```bash
npx vercel alias set <step-3-deployment-url> kartokuma.vercel.app
```

Sonra tekrar doğrula.

- [ ] **Step 5: Canlı ortamda yeni endpoint'i ve regresyonu doğrula**

```bash
curl -s -X POST https://kartokuma.vercel.app/api/transcribe -H "Content-Type: application/json" -d '{}' -w "\nHTTP %{http_code}\n"
curl -s -X POST https://kartokuma.vercel.app/api/scan -H "Content-Type: application/json" -d '{}' -w "\nHTTP %{http_code}\n"
```

Expected: İlki `{"error":"imageBase64 ve mediaType alanları gerekli."}` ve `HTTP 400` döner (yeni endpoint çalışıyor); ikincisi de aynı şekilde `HTTP 400` döner (kartvizit endpoint'inde regresyon yok).

- [ ] **Step 6: Kullanıcıya manuel tarayıcı testi talimatı ver**

Bu adım otomatikleştirilemez:
1. `https://kartokuma.vercel.app` adresini aç.
2. Sayfada kartvizit bölümünün altında, ayırıcı çizgiyle ayrılmış yeni "Form Tara" bölümünü gördüğünü doğrula.
3. Elle doldurulmuş herhangi bir form (ya da düz bir kağıda yazılmış birkaç satır metin) fotoğrafını yükle.
4. Birkaç saniye içinde "Form Metni" bölümünde, fotoğraftaki metnin doğru şekilde düz metne çevrildiğini doğrula.
5. "Panoya Kopyala"ya bas, başka bir yere yapıştırıp metnin doğru geldiğini doğrula.
6. Kartvizit bölümünün, bu yeni bölümden bağımsız olarak hâlâ normal çalıştığını doğrula (bir kartvizit tara, sonucun değişmediğini kontrol et).
