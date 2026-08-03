import { beforeEach, describe, expect, it, vi } from 'vitest';

const transcribeFormMock = vi.fn();

vi.mock('../lib/transcribeForm.js', () => ({
  transcribeForm: transcribeFormMock,
}));

const { default: handler } = await import('../api/transcribe.js');

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

describe('POST /api/transcribe handler', () => {
  beforeEach(() => {
    transcribeFormMock.mockReset();
  });

  it('rejects non-POST methods with 405', async () => {
    const req: any = { method: 'GET' };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.body).toEqual({ error: 'Sadece POST istekleri desteklenir.' });
  });

  it('rejects a request missing imageBase64 or mediaType with 400', async () => {
    const req: any = { method: 'POST', body: { mediaType: 'image/jpeg' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: 'imageBase64 ve mediaType alanları gerekli.' });
  });

  it('rejects a request missing mediaType (imageBase64 present) with 400', async () => {
    const req: any = { method: 'POST', body: { imageBase64: 'validbase64' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: 'imageBase64 ve mediaType alanları gerekli.' });
  });

  it('rejects an oversized image with 413', async () => {
    const req: any = {
      method: 'POST',
      body: { imageBase64: 'a'.repeat(4_000_001), mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.body).toEqual({
      error: 'Görsel çok büyük. Lütfen daha küçük bir fotoğraf yükleyin.',
    });
  });

  it('returns 200 with text and empty:false on a successful non-empty transcription', async () => {
    transcribeFormMock.mockResolvedValue('Ad Soyad: Ali Veli');

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ text: 'Ad Soyad: Ali Veli', empty: false });
  });

  it('returns 200 with empty:true when the transcribed text is blank', async () => {
    transcribeFormMock.mockResolvedValue('   ');

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ text: '   ', empty: true });
  });

  it('returns 502 when transcription fails', async () => {
    transcribeFormMock.mockRejectedValue(new Error('boom'));

    const req: any = {
      method: 'POST',
      body: { imageBase64: 'validbase64', mediaType: 'image/jpeg' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.body).toEqual({ error: 'Form okunamadı. Lütfen tekrar deneyin.' });
  });
});
