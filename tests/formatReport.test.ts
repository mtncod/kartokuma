import { describe, expect, it } from 'vitest';
import { formatReport, isEmptyCard } from '../lib/formatReport.js';
import type { CardData } from '../lib/types.js';

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    fullName: '',
    jobTitle: '',
    company: '',
    phones: [],
    email: '',
    il: '',
    address: '',
    website: '',
    ...overrides,
  };
}

describe('formatReport', () => {
  it('formats a fully populated card with all labeled lines in order', () => {
    const card = makeCard({
      fullName: 'Ayşe Yılmaz',
      jobTitle: 'Satış Müdürü',
      company: 'Acme A.Ş.',
      phones: ['0212 555 11 22'],
      email: 'ayse@acme.com',
      il: 'İstanbul',
      address: 'Levent, İstanbul',
      website: 'acme.com',
    });

    expect(formatReport(card)).toBe(
      [
        'Ad Soyad: Ayşe Yılmaz',
        'Unvan: Satış Müdürü',
        'Şirket: Acme A.Ş.',
        'Telefon: 0212 555 11 22',
        'E-posta: ayse@acme.com',
        'İl: İstanbul',
        'Adres: Levent, İstanbul',
        'Web Sitesi: acme.com',
      ].join('\n'),
    );
  });

  it('omits empty fields', () => {
    const card = makeCard({ fullName: 'Ayşe Yılmaz', email: 'ayse@acme.com' });

    expect(formatReport(card)).toBe('Ad Soyad: Ayşe Yılmaz\nE-posta: ayse@acme.com');
  });

  it('joins multiple phone numbers with a slash', () => {
    const card = makeCard({ phones: ['0212 555 11 22', '0532 111 22 33'] });

    expect(formatReport(card)).toBe('Telefon: 0212 555 11 22 / 0532 111 22 33');
  });

  it('includes the İl line when present', () => {
    const card = makeCard({ il: 'Ankara' });

    expect(formatReport(card)).toBe('İl: Ankara');
  });
});

describe('isEmptyCard', () => {
  it('returns true when every field is empty', () => {
    expect(isEmptyCard(makeCard())).toBe(true);
  });

  it('returns false when at least one scalar field is populated', () => {
    expect(isEmptyCard(makeCard({ company: 'Acme' }))).toBe(false);
  });

  it('returns false when only phones has entries', () => {
    expect(isEmptyCard(makeCard({ phones: ['0212 555 11 22'] }))).toBe(false);
  });

  it('returns false when only il is populated', () => {
    expect(isEmptyCard(makeCard({ il: 'İzmir' }))).toBe(false);
  });
});
