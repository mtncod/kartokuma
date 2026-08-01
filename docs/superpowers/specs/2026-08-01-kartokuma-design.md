# Kartokuma — Kartvizit Okuma Uygulaması Tasarımı

**Tarih:** 2026-08-01
**Durum:** Onay bekliyor

## Amaç

Kullanıcı bir kartvizit fotoğrafı çektiğinde/yüklediğinde, kartvizitteki bilgiler
(şirket adı, ad soyad, telefon, adres ve diğer alanlar) otomatik olarak
metin/yapılandırılmış rapor halinde çıkarılsın. HubSpot'un kartvizit tarama
aracı, hangi alanların çıkarılacağı konusunda referans/ilham olarak
kullanıldı — gerçek bir HubSpot CRM entegrasyonu yok.

## Kapsam

- **iOS uygulaması** (SwiftUI, native)
- **Web uygulaması** (düz HTML/CSS/JS, framework yok)
- **Ortak backend** (Vercel Serverless Function, Node.js + TypeScript)
- **GitHub reposu:** `mtncod/kartokuma` (yeni, ayrı; mevcut `bizcard-miuwl`
  reposundan bağımsız)
- **Deployment:** Vercel (kullanıcının mevcut Vercel hesabı üzerinden)

Kapsam dışı: geçmiş/liste kaydı, telefon rehberine ekleme, gerçek HubSpot CRM
entegrasyonu.

## Mimari

```
mtncod/kartokuma (GitHub repo)
├── api/
│   └── scan.ts          # Vercel Serverless Function — POST /api/scan
├── public/               # Web uygulaması (statik: index.html, script, css)
├── ios/                  # Xcode/SwiftUI projesi
└── docs/
```

- **Backend**: Tek bir Vercel Serverless Function (`api/scan.ts`). Standalone
  Express sunucusu yerine Vercel'in native Node.js handler yapısı
  (`export default async function handler(req, res)`) kullanılır — bu, ayrı
  bir sunucu barındırmayı gerektirmeden Vercel'e doğrudan deploy edilebilir.
- **Web**: `public/` altında statik dosyalar; aynı Vercel deploy'u içinde
  `/api/scan` endpoint'ini çağırır (aynı origin, CORS sorunu yok).
- **iOS**: Ayrı bir Xcode projesi; backend'in production URL'ini
  (`https://kartokuma.vercel.app/api/scan` gibi) çağırır.

## Veri akışı

1. Kullanıcı (iOS'ta kamera/galeri, web'de dosya seçme) bir kartvizit
   fotoğrafı seçer.
2. İstemci, yüklemeden önce görseli makul bir boyuta küçültür (uzun kenar
   ~1600px) — hız ve maliyet için.
3. Fotoğraf `multipart/form-data` ile `POST /api/scan` endpoint'ine
   gönderilir.
4. Backend, görseli Claude API'ye (model: `claude-opus-5`) vision content
   block olarak gönderir; `output_config.format` ile yapılandırılmış JSON
   şeması zorunlu kılınır. Çıkarılacak alanlar:
   - Ad Soyad
   - Unvan (job title)
   - Şirket Adı
   - Telefon(lar) — dizi (birden fazla numara olabilir)
   - E-posta
   - Adres
   - Web Sitesi
5. Backend, eksik alanları `null`/boş bırakır, hem yapılandırılmış JSON hem
   de Türkçe etiketli, kopyalanabilir düz metin rapor olarak istemciye döner.
6. İstemci sonucu ekranda gösterir; kullanıcı panoya kopyalayabilir veya
   (iOS'ta) sistem paylaşım sayfasıyla paylaşabilir.

## Hata yönetimi

- Tüm alanlar boş dönerse (kart okunamadı) → "Kart okunamadı, tekrar
  deneyin" mesajı.
- Ağ/timeout hatası → genel hata mesajı + tekrar dene seçeneği.
- Backend, Claude API anahtarını (`ANTHROPIC_API_KEY`) yalnızca Vercel
  environment variable olarak tutar; hiçbir istemciye gömülmez.

## Test planı

- **Backend**: JSON ayrıştırma/doğrulama mantığı için birim testleri
  (Claude yanıtı mock'lanarak); gerçek bir kartvizit fotoğrafıyla
  manuel/entegrasyon testi.
- **iOS**: Xcode Simulator'a örnek kartvizit görselleri sürükle-bırakla
  eklenip "galeriden seç" akışı test edilir; gerçek kamera testi için
  fiziksel cihaza Xcode üzerinden yüklenir.
- **Web**: Backend lokal çalıştırılır (`vercel dev` veya benzeri), tarayıcıda
  dosya yükleme akışı ve kopyalama butonu manuel test edilir.

## Deployment

- `mtncod/kartokuma` GitHub reposu oluşturulur (boş, yeni).
- Kod bu repoya push edilir.
- Vercel'de yeni bir proje bu repoya bağlanır (kullanıcının
  `metingencay-9195` Vercel hesabı altında).
- `ANTHROPIC_API_KEY` Vercel proje ayarlarında environment variable olarak
  eklenir.
- iOS uygulaması bu Vercel production URL'ini backend adresi olarak
  kullanır.
