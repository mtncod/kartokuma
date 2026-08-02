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
