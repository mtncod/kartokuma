# Kartokuma PWA (Ana Ekrana Ekleme) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kartokuma web uygulamasını, telefonun ana ekranına eklenebilen, kendi ikonuyla tam ekran açılan bir "uygulama benzeri" (PWA) deneyime dönüştürmek.

**Architecture:** Mevcut `public/` statik sitesine bir Web App Manifest, üç boyutta uygulama ikonu, ve sayfa kabuğunu önbelleğe alan (ama `/api/scan`'ı asla önbelleklemeyen) bir servis worker eklenir. `index.html` ve `app.js` bu yeni dosyalara bağlanacak ve servis worker kaydı + çevrimdışı hata mesajı için güncellenir. Mevcut `mtncod/kartokuma` reposuna ve zaten bağlı olan Vercel projesine deploy edilir — yeni repo/proje gerekmez.

**Tech Stack:** Web App Manifest, Service Worker API (vanilla JS, framework yok), SVG→PNG dönüşümü için geçici `sharp` npm paketi (sadece ikon üretimi sırasında).

## Global Constraints

- Marka renkleri: aksan/tema rengi `#2563eb`, arkaplan rengi `#f4f4f5` (mevcut `public/style.css` ile aynı).
- `/api/scan` isteği servis worker tarafından **asla** önbellekten karşılanmaz — her zaman ağa gider.
- Kullanıcı arayüzü metinleri Türkçe.
- Gerçek çevrimdışı tarama desteklenmez (API her zaman internet gerektirir); sadece sayfa kabuğu (HTML/CSS/JS/ikonlar) önbelleğe alınır.
- Özel bir "yükle" butonu eklenmez — tarayıcının native "Ana Ekrana Ekle" istemine güvenilir.
- Bu değişiklikler mevcut `mtncod/kartokuma` GitHub reposuna ve `metingencay-9195/kartokuma` Vercel projesine deploy edilir (ikisi de zaten mevcut ve bağlı — yeni repo/proje oluşturulmaz).

---

### Task 1: Uygulama İkonları

**Files:**
- Create: `public/icons/icon-source.svg`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-180.png`

**Interfaces:**
- Consumes: yok.
- Produces: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-180.png` — Task 2 (manifest) ve Task 3 (`index.html`) bu dosya yollarını referans alır.

- [ ] **Step 1: `public/icons/icon-source.svg` dosyasını oluştur**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2563eb"/>
  <rect x="126" y="176" width="260" height="170" rx="20" fill="#ffffff"/>
  <rect x="156" y="216" width="120" height="16" rx="8" fill="#2563eb"/>
  <rect x="156" y="246" width="160" height="14" rx="7" fill="#93c5fd"/>
  <rect x="156" y="272" width="130" height="14" rx="7" fill="#93c5fd"/>
  <circle cx="366" cy="316" r="34" fill="none" stroke="#ffffff" stroke-width="14"/>
  <line x1="390" y1="340" x2="416" y2="366" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
</svg>
```

Bu, mavi yuvarlatılmış kare arkaplan üzerinde beyaz bir kartvizit (üzerinde
iki açık mavi "metin satırı") ve sağ altta bir büyüteç (tarama) motifi
gösterir.

- [ ] **Step 2: Geçici olarak `sharp` paketini kur**

Run: `npm install -D sharp`

- [ ] **Step 3: İkon üretim betiğini yaz (geçici, commit edilmeyecek)**

Proje köküne `generate-icons.mjs` adında bir dosya oluştur:

```javascript
import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/icons/icon-source.svg');
const sizes = [192, 512, 180];

for (const size of sizes) {
  const info = await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`icon-${size}.png: ${info.width}x${info.height}, ${info.size} bytes`);
}
```

- [ ] **Step 4: Betiği çalıştır ve çıktıyı doğrula**

Run: `node generate-icons.mjs`

Expected: Üç satır çıktı, her biri doğru boyutu gösterir:
```
icon-192.png: 192x192, <N> bytes
icon-512.png: 512x512, <N> bytes
icon-180.png: 180x180, <N> bytes
```

`public/icons/` altında üç PNG dosyasının gerçekten oluştuğunu `ls
public/icons/` ile doğrula.

- [ ] **Step 5: Geçici betiği ve `sharp` bağımlılığını kaldır**

Run:
```bash
rm generate-icons.mjs
npm uninstall sharp
```

Expected: `package.json`/`package-lock.json`'da `sharp` artık görünmüyor;
`git status` sadece `public/icons/` altındaki 4 yeni dosyayı (SVG + 3 PNG)
ve `package.json`/`package-lock.json`'daki `sharp` kaldırma değişikliğini
gösteriyor.

- [ ] **Step 6: Commit**

```bash
git add public/icons/icon-source.svg public/icons/icon-192.png public/icons/icon-512.png public/icons/icon-180.png package.json package-lock.json
git commit -m "PWA için uygulama ikonlarını ekle (192, 512, 180)"
```

---

### Task 2: Web App Manifest

**Files:**
- Create: `public/manifest.webmanifest`

**Interfaces:**
- Consumes: `public/icons/icon-192.png`, `public/icons/icon-512.png` (Task 1).
- Produces: `/manifest.webmanifest` — Task 3 (`index.html`) buna bağlanır.

- [ ] **Step 1: `public/manifest.webmanifest` dosyasını oluştur**

```json
{
  "name": "Kartokuma — Kartvizit Okuma",
  "short_name": "Kartokuma",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f4f4f5",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Geçerliliği doğrula**

Run: `node -e "const m = JSON.parse(require('fs').readFileSync('public/manifest.webmanifest', 'utf8')); console.log('valid JSON, icons:', m.icons.length)"`

Expected: `valid JSON, icons: 2` yazdırır, hata vermez.

Ayrıca `public/icons/icon-192.png` ve `public/icons/icon-512.png`
dosyalarının gerçekten var olduğunu (Task 1'den) doğrula: `ls
public/icons/icon-192.png public/icons/icon-512.png`.

- [ ] **Step 3: Commit**

```bash
git add public/manifest.webmanifest
git commit -m "Web App Manifest ekle"
```

---

### Task 3: `index.html` Güncellemeleri

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `/manifest.webmanifest` (Task 2), `/icons/icon-180.png` (Task 1).
- Produces: yok — bu, tarayıcının PWA/iOS meta etiketlerini okuduğu son nokta.

- [ ] **Step 1: `<head>` içine, mevcut `<link rel="stylesheet" href="style.css" />` satırından hemen sonra şu satırları ekle**

```html
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#2563eb" />
  <link rel="apple-touch-icon" href="/icons/icon-180.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

`<head>` bloğunun tamamı şöyle görünmeli:

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kartokuma — Kartvizit Okuma</title>
  <link rel="stylesheet" href="style.css" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#2563eb" />
  <link rel="apple-touch-icon" href="/icons/icon-180.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
</head>
```

Dosyanın geri kalanı (body içeriği, `<script src="app.js"></script>`)
değişmeden kalır.

- [ ] **Step 2: Doğrula**

`public/index.html`'i oku ve yukarıdaki beş satırın `<head>` içinde,
`</head>`'den önce, tam olarak yazıldığı gibi bulunduğunu doğrula.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "index.html: manifest, tema rengi ve iOS PWA meta etiketlerini ekle"
```

---

### Task 4: Servis Worker

**Files:**
- Create: `public/sw.js`

**Interfaces:**
- Consumes: `/`, `/style.css`, `/app.js`, `/manifest.webmanifest`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-180.png` (önbelleğe alınacak dosyalar; Task 1-3'ten).
- Produces: `/sw.js` — Task 5 (`app.js`) bunu kaydeder (`register`).

- [ ] **Step 1: `public/sw.js` dosyasını oluştur**

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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/api/scan') {
    return; // /api/scan asla önbellekten karşılanmaz — her zaman ağa git
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
```

- [ ] **Step 2: Sözdizimi doğrulaması**

Run: `node --check public/sw.js`

Expected: Çıktı yok, hata yok (dosya geçerli JavaScript).

**Not:** Bu dosya tarayıcı-only API'ler (`self`, `caches`, `fetch` olayları)
kullandığı için Node'da çalıştırılamaz — sadece sözdizimi kontrolü yapılır.
Gerçek davranış (kayıt, önbellekleme, `/api/scan`'ın atlandığı) Task 6'da
canlı ortamda tarayıcı DevTools ile doğrulanacak.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "Sayfa kabuğunu önbelleğe alan servis worker ekle"
```

---

### Task 5: `app.js` Güncellemeleri — Servis Worker Kaydı ve Çevrimdışı Mesajı

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- Consumes: `/sw.js` (Task 4).
- Produces: yok — bu, kullanıcıya gösterilen son nokta.

- [ ] **Step 1: Dosyanın en üstüne, mevcut `const fileInput = ...` satırından önce servis worker kaydını ekle**

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Servis worker kaydı başarısız:', err);
    });
  });
}

```

- [ ] **Step 2: Mevcut `catch (err) { ... }` bloğunu, çevrimdışı durumu ve doğru zaman aşımı hata adını da ele alacak şekilde güncelle**

Şu anki blok (`fileInput.addEventListener('change', ...)` içinde):

```javascript
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
```

Bunu şununla değiştir:

```javascript
  } catch (err) {
    hide(statusEl);
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      show(errorEl, 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
    } else if (!navigator.onLine || err instanceof TypeError) {
      show(errorEl, 'İnternet bağlantısı yok. Kartvizit taramak için bağlantı gerekli.');
    } else {
      show(errorEl, err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  } finally {
    fileInput.value = '';
  }
```

**Not:** `err.name === 'AbortError'` kontrolü daha önceki bir final code
review'da bulunan bilinen bir hatanın düzeltmesini de içeriyor —
`AbortSignal.timeout()` tetiklendiğinde tarayıcılar aslında `'TimeoutError'`
adında bir `DOMException` fırlatır, `'AbortError'` değil. Her iki adı da
kontrol ederek bu düzeltilmiş oluyor.

Dosyanın geri kalanı (`resizeImage`, `show`, `hide` fonksiyonları, `fetch`
çağrısının kendisi) değişmeden kalır.

- [ ] **Step 3: Sözdizimi ve mantık doğrulaması**

Run: `node --check public/app.js`

Expected: Çıktı yok, hata yok.

Dosyayı oku ve şunları doğrula:
- Servis worker kaydı dosyanın başında, `'serviceWorker' in navigator`
  kontrolüyle sarmalanmış.
- `catch` bloğu üç dalı da içeriyor: zaman aşımı (`AbortError`/`TimeoutError`),
  çevrimdışı (`navigator.onLine` / `TypeError`), ve genel hata.
- `finally` bloğundaki `fileInput.value = '';` satırı korunmuş.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "app.js: servis worker kaydı ve çevrimdışı hata mesajı ekle"
```

---

### Task 6: Deploy ve Canlı Doğrulama

**Files:**
- Modify: yok (yalnızca git/deployment işlemleri)

**Interfaces:**
- Consumes: Task 1-5'te oluşturulan tüm dosyalar.
- Produces: `https://kartokuma.vercel.app` üzerinde çalışan, ana ekrana
  eklenebilir PWA.

**Not:** Bu görev, önceki plandaki Task 6 gibi, gerçek bir GitHub push'u ve
Vercel deploy'u içerir. Mevcut repo (`mtncod/kartokuma`) ve Vercel projesi
(`metingencay-9195/kartokuma`) zaten bağlı olduğu için yeni bir repo/proje
oluşturulmaz — sadece mevcut `master` dalına push edilip yeniden deploy
edilir.

- [ ] **Step 1: Tüm test/doğrulama adımlarını son kez çalıştır**

Run: `npm test && node --check public/sw.js && node --check public/app.js`

Expected: Mevcut test paketi (19 test) geçer, iki `--check` komutu da
sessizce başarılı olur.

- [ ] **Step 2: `master` dalına push et**

```bash
git push origin <mevcut-dal>:master
```

- [ ] **Step 3: Vercel'e yeniden deploy et**

Run: `npx vercel --prod --yes`

Expected: Build başarılı, `https://kartokuma.vercel.app` adresine alias
edilir.

- [ ] **Step 4: Canlı ortamda statik dosyaları doğrula**

```bash
curl -s -o /dev/null -w "manifest: %{http_code}\n" https://kartokuma.vercel.app/manifest.webmanifest
curl -s -o /dev/null -w "sw.js: %{http_code}\n" https://kartokuma.vercel.app/sw.js
curl -s -o /dev/null -w "icon-192: %{http_code}\n" https://kartokuma.vercel.app/icons/icon-192.png
curl -s -o /dev/null -w "icon-512: %{http_code}\n" https://kartokuma.vercel.app/icons/icon-512.png
curl -s -o /dev/null -w "icon-180: %{http_code}\n" https://kartokuma.vercel.app/icons/icon-180.png
```

Expected: Hepsi `HTTP 200` döner.

- [ ] **Step 5: `/api/scan`'ın hâlâ doğru çalıştığını doğrula (regresyon kontrolü)**

```bash
curl -s -X POST https://kartokuma.vercel.app/api/scan -H "Content-Type: application/json" -d '{}' -w "\nHTTP %{http_code}\n"
```

Expected: `{"error":"imageBase64 ve mediaType alanları gerekli."}` ve `HTTP
400` (servis worker'ın `/api/scan`'ı önbelleklemediğini, isteğin gerçekten
sunucuya ulaştığını doğrular).

- [ ] **Step 6: Kullanıcıya manuel telefon testi talimatı ver**

Bu adım otomatikleştirilemez — kullanıcının kendi telefonunda yapması
gerekir:
1. Telefonda `https://kartokuma.vercel.app` adresini aç.
2. Tarayıcı menüsünden "Ana Ekrana Ekle" / "Add to Home Screen" seçeneğini
   kullan (Android Chrome'da otomatik bir "Yükle" istemi de çıkabilir).
3. Ana ekrandaki yeni ikonu kontrol et (mavi kare, beyaz kartvizit motifi).
4. İkona dokunup uygulamanın adres çubuğu olmadan, tam ekran açıldığını
   doğrula.
5. Bir kartvizit fotoğrafı tarayıp normal şekilde çalıştığını doğrula.
