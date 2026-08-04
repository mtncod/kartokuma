import { describe, expect, it } from 'vitest';
import { buildCsv, buildXml, buildFileName, slugify } from '../public/exportFormats.js';

function makeCard(overrides = {}) {
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

describe('buildCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = buildCsv(makeCard());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('produces a semicolon-delimited header and data row for a fully populated card', () => {
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

    const csv = buildCsv(card);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');

    expect(lines[0]).toBe('Ad Soyad;Unvan;Şirket;Telefon;E-posta;İl;Adres;Web Sitesi;Form Açıklamaları');
    expect(lines[1]).toBe(
      'Ayşe Yılmaz;Satış Müdürü;Acme A.Ş.;0212 555 11 22;ayse@acme.com;İstanbul;Levent, İstanbul;acme.com;',
    );
  });

  it('joins multiple phone numbers with a slash inside a single cell', () => {
    const card = makeCard({ phones: ['0212 555 11 22', '0532 111 22 33'] });
    const csv = buildCsv(card);
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain('0212 555 11 22 / 0532 111 22 33');
  });

  it('quotes a cell containing a semicolon', () => {
    const card = makeCard({ address: 'Levent; Beşiktaş' });
    const csv = buildCsv(card);
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain('"Levent; Beşiktaş"');
  });

  it('neutralizes a formula-injection payload with a leading apostrophe', () => {
    const card = makeCard({ company: '=SUM(1,2)' });
    const csv = buildCsv(card);
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain("'=SUM(1,2)");
    expect(dataLine).not.toMatch(/;=SUM/);
  });

  it('preserves a Turkish international-format phone number as text, not a formula', () => {
    const card = makeCard({ phones: ['+90 212 555 11 22'] });
    const csv = buildCsv(card);
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain("'+90 212 555 11 22");
  });

  it('quotes a cell containing a bare carriage return', () => {
    const card = makeCard({ address: 'Levent\rBeşiktaş' });
    const csv = buildCsv(card);
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain('"Levent\rBeşiktaş"');
  });

  it('appends a Form Açıklamaları column with the form text when provided', () => {
    const card = makeCard({ fullName: 'Ayşe Yılmaz' });
    const csv = buildCsv(card, 'Ad: Ali Veli\nTarih: 01.08.2026');
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');

    expect(lines[0]).toBe('Ad Soyad;Unvan;Şirket;Telefon;E-posta;İl;Adres;Web Sitesi;Form Açıklamaları');
    expect(lines[1]).toBe(
      'Ayşe Yılmaz;;;;;;;;"Ad: Ali Veli\nTarih: 01.08.2026"',
    );
  });

  it('leaves the Form Açıklamaları column empty when formText is not provided', () => {
    const card = makeCard({ fullName: 'Ayşe Yılmaz' });
    const csv = buildCsv(card);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');

    expect(lines[0]).toBe('Ad Soyad;Unvan;Şirket;Telefon;E-posta;İl;Adres;Web Sitesi;Form Açıklamaları');
    expect(lines[1]).toBe('Ayşe Yılmaz;;;;;;;;');
  });

  it('neutralizes a formula-injection payload in the form text column', () => {
    const card = makeCard();
    const csv = buildCsv(card, '=SUM(1,2)');
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];

    expect(dataLine).toContain("'=SUM(1,2)");
  });
});

describe('buildXml', () => {
  it('produces well-formed XML with all fields for a fully populated card', () => {
    const card = makeCard({
      fullName: 'Ayşe Yılmaz',
      jobTitle: 'Satış Müdürü',
      company: 'Acme A.Ş.',
      phones: ['0212 555 11 22', '0532 111 22 33'],
      email: 'ayse@acme.com',
      il: 'İstanbul',
      address: 'Levent, İstanbul',
      website: 'acme.com',
    });

    const xml = buildXml(card);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<adSoyad>Ayşe Yılmaz</adSoyad>');
    expect(xml).toContain('<unvan>Satış Müdürü</unvan>');
    expect(xml).toContain('<sirket>Acme A.Ş.</sirket>');
    expect(xml).toContain('<telefon>0212 555 11 22</telefon>');
    expect(xml).toContain('<telefon>0532 111 22 33</telefon>');
    expect(xml).toContain('<eposta>ayse@acme.com</eposta>');
    expect(xml).toContain('<il>İstanbul</il>');
    expect(xml).toContain('<adres>Levent, İstanbul</adres>');
    expect(xml).toContain('<webSitesi>acme.com</webSitesi>');
  });

  it('omits telefon tags entirely when there are no phone numbers', () => {
    const xml = buildXml(makeCard());
    expect(xml).not.toContain('<telefon>');
  });

  it('escapes XML special characters', () => {
    const card = makeCard({ company: 'A & B <Ltd> "Şti"' });
    const xml = buildXml(card);

    expect(xml).toContain('<sirket>A &amp; B &lt;Ltd&gt; &quot;Şti&quot;</sirket>');
  });

  it('strips illegal XML control characters', () => {
    const card = makeCard({ fullName: 'Ay\u0000şe' });
    const xml = buildXml(card);

    expect(xml).toContain('<adSoyad>Ayşe</adSoyad>');
  });

  it('includes a formAciklamalari tag with the form text when provided', () => {
    const xml = buildXml(makeCard(), 'Ad: Ali Veli\nTarih: 01.08.2026');
    expect(xml).toContain('<formAciklamalari>Ad: Ali Veli\nTarih: 01.08.2026</formAciklamalari>');
  });

  it('includes an empty formAciklamalari tag when formText is not provided', () => {
    const xml = buildXml(makeCard());
    expect(xml).toContain('<formAciklamalari></formAciklamalari>');
  });

  it('escapes XML special characters in the form text', () => {
    const xml = buildXml(makeCard(), 'A & B <Ltd>');
    expect(xml).toContain('<formAciklamalari>A &amp; B &lt;Ltd&gt;</formAciklamalari>');
  });
});

describe('slugify', () => {
  it('converts Turkish characters and spaces to a URL-safe slug', () => {
    expect(slugify('Ayşe Yılmaz Öğüt')).toBe('ayse-yilmaz-ogut');
  });

  it('returns an empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });
});

describe('buildFileName', () => {
  it('derives the filename from fullName when present', () => {
    const card = makeCard({ fullName: 'Ayşe Yılmaz', company: 'Acme' });
    expect(buildFileName(card, 'csv', '20260802')).toBe('kartvizit-ayse-yilmaz-20260802.csv');
  });

  it('falls back to company when fullName is empty', () => {
    const card = makeCard({ company: 'Acme A.Ş.' });
    expect(buildFileName(card, 'xml', '20260802')).toBe('kartvizit-acme-a-s-20260802.xml');
  });

  it('falls back to just the date stamp when both are empty', () => {
    const card = makeCard();
    expect(buildFileName(card, 'csv', '20260802')).toBe('kartvizit-20260802.csv');
  });
});
