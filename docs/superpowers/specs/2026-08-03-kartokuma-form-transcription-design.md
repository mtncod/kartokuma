# Kartokuma — Form Tarama (Serbest Metin Transkripsiyonu) Tasarımı

**Tarih:** 2026-08-03
**Durum:** Onaylandı

## Amaç

Kullanıcı, elle veya bilgisayarda doldurulmuş herhangi bir formun fotoğrafını
çekip/yükleyip, formdaki tüm metni raporlamak amacıyla düz metne
çevirebilsin.

## Kapsam

- Kartvizit tarama alanının altına, tamamen bağımsız yeni bir "Form Tara"
  bölümü eklenir.
- Form, önceden bilinen sabit bir şablon değildir — serbest formatta,
  herhangi bir form olabilir. Claude, fotoğraftaki tüm metni yapılandırılmış
  alanlara ayırmadan, olduğu gibi düz metne çevirir.
- Sonuç ekranda gösterilir, "Panoya Kopyala" butonuyla kopyalanabilir.

Kapsam dışı: kartvizit sonucuyla birleştirme (iki özellik tamamen bağımsız
kalır); dosya indirme (Excel/XML/txt — bu özellik için yok); sabit
alan/şablon çıkarımı (kartvizitteki gibi yapılandırılmış JSON şeması yok).

## Backend

### Yeni endpoint: `POST /api/transcribe`

Kartvizit endpoint'inden (`/api/scan`) tamamen ayrı, yeni bir serverless
function. İstek gövdesi kartvizitle aynı şekli kullanır:
`{ imageBase64: string, mediaType: string }`.

Başarılı yanıt (200): `{ text: string, empty: boolean }`. Metin boşsa
(form okunamadıysa) `empty: true`.

Hata yanıtları, kartvizit endpoint'iyle aynı desen: 400 (eksik alan), 405
(yanlış metod), 413 (çok büyük görsel), 502 (çıkarım başarısız) — hepsi
`{ error: string }` gövdesiyle, Türkçe mesajlarla.

### Yeni modül: `lib/transcribeForm.ts`

`lib/extractCard.ts`'ye benzer yapıda, ama **yapılandırılmış JSON şeması
yok** — Claude'dan direkt düz metin istenir. Aynı hata yönetimi deseni
uygulanır:
- `stop_reason === 'refusal'` → Türkçe hata.
- `stop_reason === 'max_tokens'` → Türkçe hata (metin tamamlanamadı).
- Metin bloğu bulunamazsa → Türkçe hata.
- Aksi halde, metin bloğunun içeriği olduğu gibi döner (JSON.parse yok).

Test edilebilirlik için `extractCard`'daki gibi enjekte edilebilir bir
Anthropic client parametresi kullanılır.

## Frontend

- `public/index.html`'e, mevcut `#result` bölümünden sonra, yeni bir
  `<section>`: kendi dosya seçici/kamera girişi (`accept="image/*"
  capture="environment"`), durum/hata alanları, sonuç alanı (`<pre>` metin
  + "Panoya Kopyala" butonu). Mevcut kartvizit bölümüyle aynı görsel stil.
- `public/app.js`'e yeni, bağımsız bir olay dinleyici seti eklenir. Mevcut
  `resizeImage`, `show`, `hide` fonksiyonları paylaşılarak yeniden
  kullanılır — kartvizit tarama akışına (mevcut `fileInput`, `lastCard`,
  vb.) dokunulmaz.
- Yeni statik dosya eklenmediği için `public/sw.js` (servis worker)
  değişmez.

## Test Planı

- `lib/transcribeForm.ts` için birim testleri (mock Claude client ile):
  başarılı transkripsiyon, refusal, max_tokens, metin bloğu yok, boş
  metin durumları.
- `api/transcribe.ts` handler'ı için testler (mevcut `tests/scan.test.ts`
  deseniyle aynı: 405/400/413/200/502 durumları, mock edilmiş
  `transcribeForm`).
- Web arayüzü kısmı, kartvizit özelliğindeki gibi canlı ortamda manuel
  test edilir.

## Deployment

Mevcut `mtncod/kartokuma` reposuna ve Vercel projesine eklenir — yeni
repo/proje gerekmez.
