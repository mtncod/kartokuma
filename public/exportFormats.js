function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function escapeCsvCell(value) {
  let str = String(value ?? '');
  // Excel/Sheets formül enjeksiyonu: '=', '+', '-', '@' (veya TAB/CR) ile
  // başlayan bir hücre formül olarak yorumlanır. Tek tırnak öneki ekleyerek
  // metne zorla — bu hem kötü niyetli formülleri hem de +90 ile başlayan
  // sıradan Türkiye telefon numaralarının yanlış yorumlanmasını önler.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

export function buildFormCsv(text) {
  const bom = '\uFEFF';
  const header = 'Form Metni';
  const cell = escapeCsvCell(text);
  return bom + header + '\r\n' + cell + '\r\n';
}

export function buildFormXml(text) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + '<form>\n' + `  <metin>${escapeXml(text)}</metin>\n` + '</form>\n';
}

export function buildFormFileName(extension, dateStamp) {
  const stamp =
    dateStamp ||
    new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[-:]/g, '')
      .replace('T', '-');
  return `form-${stamp}.${extension}`;
}
