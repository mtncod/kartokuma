import { beforeEach, describe, expect, it, vi } from 'vitest';

const extractCardMock = vi.fn();
const formatReportMock = vi.fn();
const isEmptyCardMock = vi.fn();

vi.mock('../lib/extractCard.js', () => ({
  extractCard: extractCardMock,
}));

vi.mock('../lib/formatReport.js', () => ({
  formatReport: formatReportMock,
  isEmptyCard: isEmptyCardMock,
}));

const { default: handler } = await import('../api/scan.js');

function createMockRes() {
  const res: any = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('POST /api/scan handler', () => {
  beforeEach(() => {
    extractCardMock.mockReset();
    formatReportMock.mockReset();
    isEmptyCardMock.mockReset();
  });

  it('rejects non-POST methods with 405', async () => {
    const req: any = { method: 'GET' };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request missing imageBase64 or mediaType with 400', async () => {
    const req: any = { method: 'POST', body: { mediaType: 'image/jpeg' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an oversized image with 413', async () => {
    const req: any = {
      method: 'POST',
      body: { imageBase64: 'a'.repeat(6_000_001), mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
  });

  it('returns 200 with card, report, and empty flag on success', async () => {
    const card = {
      fullName: 'Ayşe Yılmaz',
      jobTitle: '',
      company: '',
      phones: [],
      email: '',
      address: '',
      website: '',
    };
    extractCardMock.mockResolvedValue(card);
    formatReportMock.mockReturnValue('Ad Soyad: Ayşe Yılmaz');
    isEmptyCardMock.mockReturnValue(false);

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ card, report: 'Ad Soyad: Ayşe Yılmaz', empty: false });
  });

  it('returns 502 when extraction fails', async () => {
    extractCardMock.mockRejectedValue(new Error('boom'));

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
  });
});
