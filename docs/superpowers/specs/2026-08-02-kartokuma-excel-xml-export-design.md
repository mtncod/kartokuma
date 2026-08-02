# Kartokuma — Excel/XML Rapor İndirme Tasarımı

**Tarih:** 2026-08-02
**Durum:** Onaylandı

## Amaç

Kullanıcı, taradığı bir kartvizitin bilgilerini (şirket, ad soyad, il, adres,
telefon ve mevcut diğer alanlar) Excel veya XML formatında bir dosya olarak
indirip raporlayabilsin.

## Kapsam

- Tek kartvizit için, tarama sonrası ekranda iki yeni buton: "Excel İndir"
  ve "XML İndir".
- Claude'un çıkardığı alanlara yeni bir **İl** alanı eklenir.
- Tamamen istemci tarafında (tarayıcıda) çalışır — yeni bir backend
  endpoint'i veya sunucu tarafı depolama gerekmez.

Kapsam dışı: birden fazla kartın biriktirildiği bir liste/veritabanı
(kullanıcı bu oturumda sadece tek-kart indirmeyi istedi); gerçek `.xlsx`
dosyası (CSV kullanılacak, Excel'de sorunsuz açılır); dış kütüphane/CDN
bağımlılığı.

## Veri Modeli Değişikliği

`CardData` tipine yeni bir alan eklenir:

```typescript
export interface CardData {
  fullName: string;
  jobTitle: string;
  company: string;
  phones: string[];
  email: string;
  il: string;        // YENİ — şehir/il, adres metninden bağımsız olarak
  address: string;
  website: string;
}
```

`lib/extractCard.ts` içindeki `CARD_SCHEMA` ve prompt metni, Claude'un
kartvizitten ili (varsa) doğrudan ayrı bir alan olarak çıkarması için
güncellenir — bulunamazsa boş string (`""`).

## Rapor Alan Sırası

Hem CSV hem XML çıktısında, hem de ekrandaki metin raporunda aynı sıra
kullanılır: **Ad Soyad, Unvan, Şirket, Telefon, E-posta, İl, Adres, Web
Sitesi**.

## CSV ("Excel İndir")

- Noktalı virgül (`;`) ile ayrılmış — Türkçe Excel'in varsayılan CSV
  ayracı.
- Dosyanın başına UTF-8 BOM (`﻿`) eklenir — Türkçe karakterlerin
  (ç, ğ, ı, ö, ş, ü) Excel'de bozulmadan görünmesi için.
- Birden fazla telefon numarası tek hücrede `" / "` ile birleştirilir
  (mevcut ekran raporuyla tutarlı).
- Başlık satırı: `Ad Soyad;Unvan;Şirket;Telefon;E-posta;İl;Adres;Web Sitesi`

## XML ("XML İndir")

Basit, okunabilir bir yapı:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kartvizit>
  <adSoyad>Ayşe Yılmaz</adSoyad>
  <unvan>Satış Müdürü</unvan>
  <sirket>Acme A.Ş.</sirket>
  <telefon>0212 555 11 22</telefon>
  <telefon>0532 111 22 33</telefon>
  <eposta>ayse@acme.com</eposta>
  <il>İstanbul</il>
  <adres>Levent, İstanbul</adres>
  <webSitesi>acme.com</webSitesi>
</kartvizit>
```

Birden fazla telefon numarası için tekrar eden `<telefon>` etiketleri
kullanılır. Boş alanlar boş etiket olarak yazılır (`<eposta></eposta>`).
XML özel karakterleri (`&`, `<`, `>`, `"`, `'`) escape edilir.

## İndirme Mekanizması

- Yeni backend endpoint'i yok — tarama sonucundaki `card` verisi zaten
  tarayıcıda mevcut (`/api/scan` yanıtından).
- `public/app.js` içinde iki saf fonksiyon: `buildCsv(card)` ve
  `buildXml(card)`, ikisi de string döner.
- Standart tarayıcı indirme deseni: `Blob` oluştur → `URL.createObjectURL`
  → geçici bir `<a download>` linkine tıkla → `URL.revokeObjectURL` ile
  temizle. Dış kütüphane eklenmez.
- Dosya adı, kişi adından veya şirket adından türetilen bir slug + tarih
  damgası içerir (örn. `kartvizit-ayse-yilmaz-20260802.csv`), böylece art
  arda taranan kartların dosyaları üzerine yazılmaz. İkisi de boşsa sadece
  tarih damgası kullanılır.

## Arayüz Değişikliği

`public/index.html`'deki sonuç bölümüne (`#result`), mevcut "Panoya
Kopyala" butonunun yanına iki yeni buton eklenir: "Excel İndir" ve "XML
İndir". Bu butonlar sadece başarılı bir tarama sonrası (mevcut `copyBtn`
gibi) görünür olur.

## Test Planı

- `lib/formatReport.ts`'nin güncellenmiş hali (İl satırı eklenmiş) için
  birim testleri.
- `buildCsv`/`buildXml` fonksiyonları için birim testleri (vitest,
  DOM/tarayıcı API'si gerektirmeyen saf string üretimi test edilir — özel
  karakter escape'i, boş alanlar, çoklu telefon, BOM varlığı gibi durumlar
  dahil).
- Gerçek dosya indirme/Blob davranışı (tarayıcı-only API), önceki web
  arayüzü görevlerinde olduğu gibi canlı ortamda manuel test edilir.

## Deployment

Mevcut `mtncod/kartokuma` reposuna ve Vercel projesine eklenir — yeni
repo/proje gerekmez.
