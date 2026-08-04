# Kartokuma Kartvizit + Form Birleşik Rapor Tasarımı

**Tarih:** 2026-08-04

## Amaç

Kartvizit ve Form Tara bölümleri şu ana kadar tamamen bağımsız iki akıştı (ayrı taramalar, ayrı Excel/XML indirmeleri). Kullanıcı artık ikisini **aynı satırda** görmek istiyor: kartvizit tablosuna, form taramasından gelen serbest metnin ek bir sütun olarak eklendiği tek bir Excel/XML raporu.

## Kapsam ve Kısıtlar

- Bu, önceki turda bilinçli olarak alınan "form akışı kartvizit akışından tamamen bağımsız kalır" kararını **kısmen** geri alıyor — sadece indirme/rapor aşamasında birleşiyorlar, taramalar (fotoğraf yükleme, API çağrıları, ekran gösterimi, hata yönetimi) hâlâ tamamen ayrı kalıyor.
- Form metni yine yapılandırılmış alanlara ayrılmıyor — kartvizit tablosuna tek bir serbest metin sütunu/etiketi olarak ekleniyor.
- Form bölümünün kendi bağımsız "Excel İndir"/"XML İndir" butonları (sadece form metni, kart bilgisi yok) değişmeden kalıyor.
- Backend değişikliği yok — bu tamamen client-side (`public/exportFormats.js`, `public/app.js`).

## Davranış

- Kartvizit bölümündeki **"Excel İndir"** ve **"XML İndir"** butonları, tıklandıkları anda mevcut olan hem kartvizit verisini (`lastCard`) hem de form metnini (`lastFormText`) birlikte kullanır.
- Form henüz taranmamışsa (`lastFormText` boş/`null`), rapor yine üretilir — sadece "Form Açıklamaları" sütunu/etiketi boş kalır. İndirme hiçbir zaman form eksikliği yüzünden engellenmez.
- Yeni bir kartvizit taratmak `lastFormText`'i **sıfırlamaz** — bir form bir kez taranınca, ardından taranan birden fazla kartvizit aynı form metniyle eşleşebilir (kullanıcı yeni bir form taratana kadar). Bu, mevcut davranışın (kart taraması `lastFormText`'e dokunmuyor) değişmeden korunması anlamına geliyor — ek bir kod değişikliği gerekmiyor, sadece bu varsayılan davranışın bilinçli olarak korunması.
- Simetrik olarak, yeni bir form taratmak `lastCard`'ı sıfırlamaz (bu da zaten mevcut davranış).

## Rapor Formatı

**CSV** (`buildCsv(card, formText)` — mevcut fonksiyona ikinci, opsiyonel parametre eklenir):
- Sütun sırası: `Ad Soyad;Unvan;Şirket;Telefon;E-posta;İl;Adres;Web Sitesi;Form Açıklamaları`
- `formText` verilmemiş veya boşsa, son hücre boş kalır (diğer skaler alanlar gibi — sütun her zaman var, sadece içerik boş).
- Hücre, mevcut `escapeCsvCell` ile kaçışlanır (çok satırlı form metni için tırnaklama, formül enjeksiyonu koruması aynen uygulanır).

**XML** (`buildXml(card, formText)` — mevcut fonksiyona ikinci, opsiyonel parametre eklenir):
- `<webSitesi>` etiketinden sonra `<formAciklamalari>...</formAciklamalari>` eklenir.
- Diğer skaler alanlar (`<unvan>`, `<sirket>` vb.) gibi, `formText` boşsa etiket yine de var olur, içeriği boş kalır (telefon etiketlerinin aksine — onlar liste olduğu için boşken tamamen atlanıyor, bu farklı bir durum).
- `escapeXml` ile kaçışlanır.

**Form'un kendi bağımsız butonları** (`formCsvBtn`/`formXmlBtn`) değişmez — `buildFormCsv(text)`/`buildFormXml(text)` aynen çağrılmaya devam eder, kart bilgisi hiç karışmaz.

## Bileşenler ve Veri Akışı

1. **`public/exportFormats.js`** — `buildCsv` ve `buildXml` fonksiyonlarının imzası `(card, formText)` olarak genişletilir (`formText` opsiyonel, varsayılan `undefined`/boş). Mevcut tek-parametreli çağrılar (`buildCsv(card)`) geriye dönük uyumlu kalır — form sütunu/etiketi boş üretilir.

2. **`public/app.js`** — Kartvizit `csvBtn`/`xmlBtn` handler'ları güncellenir:
   - `csvBtn`: `buildCsv(lastCard)` → `buildCsv(lastCard, lastFormText)`
   - `xmlBtn`: `buildXml(lastCard)` → `buildXml(lastCard, lastFormText)`
   - Kart taraması (`fileInput` change handler) ve form taraması (`formFileInput` change handler) birbirinin state'ini sıfırlamaya devam etmez — mevcut kod zaten bu şekilde, dokunulmuyor.

3. Backend, `index.html`, `sw.js` — değişiklik yok.

## Hata Yönetimi

Ek bir hata senaryosu yok. Kartvizit indirme butonları hâlâ sadece `lastCard` doluyken işlevseldir (mevcut `if (!lastCard) return;` deseni korunur) — form verisinin olup olmaması indirmeyi engellemez, sadece o sütunun/etiketin içeriğini belirler.

## Test Planı

`tests/exportFormats.test.ts`'e, mevcut kartvizit testleriyle aynı desende yeni testler eklenir:
- `buildCsv(card, formText)`: form metni verildiğinde 9. sütunun doğru üretildiği, çok satırlı form metninin doğru tırnaklandığı, formül enjeksiyonu denemesinin form sütununda da kaçışlandığı.
- `buildCsv(card)` (form parametresi verilmeden, tek argümanla): mevcut geriye dönük uyumluluk testlerinin hâlâ geçtiği (son sütun boş).
- `buildXml(card, formText)`: `<formAciklamalari>` etiketinin doğru üretildiği, özel karakterlerin kaçışlandığı.
- `buildXml(card)` (form parametresi verilmeden): `<formAciklamalari></formAciklamalari>` şeklinde boş ama var olan etiket üretildiği.

Mevcut `buildFormCsv`/`buildFormXml` testlerinde ve `pwa.test.ts`'de regresyon olmamalı.

## Kapsam Dışı

- Formun yapılandırılmış alanlara ayrıştırılması — hâlâ gündemde değil.
- Taramaların kendisinin (fotoğraf yükleme, API çağrıları) birleştirilmesi — hâlâ iki ayrı akış, sadece rapor birleşiyor.
- Form metninin kartvizit taramasından önce/sonra zorunlu tutulması — hiçbir sıralama zorunluluğu yok, hangisi önce taranırsa taransın rapor üretilir.
