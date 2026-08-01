import type { CardData } from './types.js';

export function formatReport(data: CardData): string {
  const lines: string[] = [];

  if (data.fullName) lines.push(`Ad Soyad: ${data.fullName}`);
  if (data.jobTitle) lines.push(`Unvan: ${data.jobTitle}`);
  if (data.company) lines.push(`Şirket: ${data.company}`);
  if (data.phones.length > 0) lines.push(`Telefon: ${data.phones.join(' / ')}`);
  if (data.email) lines.push(`E-posta: ${data.email}`);
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
    !data.address &&
    !data.website
  );
}
