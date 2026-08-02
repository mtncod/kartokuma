# Kartokuma — PWA (Ana Ekrana Ekleme) Desteği Tasarımı

**Tarih:** 2026-08-02
**Durum:** Onaylandı

## Amaç

Kullanıcı, iOS için native bir uygulama yerine (Mac/Xcode erişimi olmadığı için
bu şu an mümkün değil — ayrı bir plana ertelendi), mevcut web uygulamasını
(`https://kartokuma.vercel.app`) telefonun ana ekranına eklenebilen, kendi
ikonuyla tam ekran açılan bir "uygulama benzeri" deneyime dönüştürmek istiyor.

## Kapsam

- Web App Manifest (`public/manifest.webmanifest`)
- Uygulama ikonları (192×192, 512×512, iOS için 180×180 apple-touch-icon)
- Servis worker (`public/sw.js`) — sayfa kabuğunu önbelleğe alır
- `public/index.html` ve `public/app.js` güncellemeleri

Kapsam dışı: tam çevrimdışı tarama (API her zaman internet gerektirir), özel
bir "yükle" butonu (tarayıcının native "Ana Ekrana Ekle" istemine güveniliyor),
native iOS uygulaması (ayrı, ertelenmiş bir plan).

## Bileşenler

### Web App Manifest

`public/manifest.webmanifest`:
- `name`: "Kartokuma — Kartvizit Okuma"
- `short_name`: "Kartokuma"
- `start_url`: `/`
- `display`: `standalone`
- `theme_color`: `#2563eb` (mevcut sitedeki buton/aksan rengi)
- `background_color`: `#f4f4f5` (mevcut site arkaplan rengi)
- `icons`: 192×192 ve 512×512 PNG, `purpose: "any maskable"`

### İkonlar

Basit bir SVG ikon tasarlanır (kartvizit/tarama motifi, mavi/gri site
paletiyle uyumlu), ardından gerekli PNG boyutlarına dönüştürülür:
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-180.png` (iOS `apple-touch-icon` için)

### Servis Worker

`public/sw.js`:
- Kurulumda (`install`), sayfa kabuğunu (`/`, `/style.css`, `/app.js`,
  `/manifest.webmanifest`, ikonlar) önbelleğe alır (cache-first).
- `/api/scan` isteği **her zaman ağdan** karşılanır — asla önbellekten
  yanıtlanmaz (tarama sonucu her zaman güncel olmalı).
- Aktivasyonda (`activate`), eski cache sürümlerini temizler (versiyon
  numarası `sw.js` içinde sabit bir `CACHE_NAME` olarak tutulur; gelecekte
  sayfa kabuğu değiştiğinde manuel olarak artırılır).

### `index.html` Güncellemeleri

- `<link rel="manifest" href="/manifest.webmanifest">`
- `<meta name="theme-color" content="#2563eb">`
- `<link rel="apple-touch-icon" href="/icons/icon-180.png">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`

(iOS Safari, Web App Manifest'i tam desteklemediği için bu meta
etiketleri/linkleri ayrıca gereklidir.)

### `app.js` Güncellemeleri

- Sayfa yüklendiğinde `navigator.serviceWorker.register('/sw.js')` çağrısı
  (tarayıcı desteklemiyorsa sessizce atlanır — `'serviceWorker' in
  navigator` kontrolü ile).
- `/api/scan` isteği ağ hatasıyla başarısız olduğunda (`TypeError: Failed to
  fetch` gibi), kullanıcıya "İnternet bağlantısı yok. Kartvizit taramak için
  bağlantı gerekli." mesajı gösterilir (mevcut genel hata mesajından ayrı,
  daha açıklayıcı).

## Test Planı

- Manifest dosyasının geçerli JSON olduğu ve tüm dosya yollarının doğru
  olduğu statik olarak doğrulanır.
- Servis worker'ın gerçekten kayıt olup çalıştığı, "Ana Ekrana Ekle"
  isteminin tetiklendiği ve önbelleğe alınan sayfanın ikinci açılışta hızlı
  yüklendiği, deploy sonrası canlı ortamda (telefon tarayıcısında) manuel
  olarak test edilir (Task 5'teki web arayüzü testiyle aynı desen — bu
  ortamda gerçek bir mobil tarayıcı bulunmuyor).

## Deployment

Mevcut `mtncod/kartokuma` reposuna ve Vercel projesine eklenir; ayrı bir
repo/proje gerekmez. Statik dosyalar zaten `public/` altında servis
edildiği için ek bir Vercel yapılandırması gerekmez.
