import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transcribeForm } from '../lib/transcribeForm.js';

const MAX_BASE64_LENGTH = 4_000_000; // Vercel'in ~4.5MB istek gövdesi limitinin altında kalır

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Sadece POST istekleri desteklenir.' });
    return;
  }

  const body = req.body as { imageBase64?: unknown; mediaType?: unknown } | undefined;
  const imageBase64 = body?.imageBase64;
  const mediaType = body?.mediaType;

  if (
    typeof imageBase64 !== 'string' ||
    typeof mediaType !== 'string' ||
    !imageBase64 ||
    !mediaType
  ) {
    res.status(400).json({ error: 'imageBase64 ve mediaType alanları gerekli.' });
    return;
  }

  if (imageBase64.length > MAX_BASE64_LENGTH) {
    res.status(413).json({ error: 'Görsel çok büyük. Lütfen daha küçük bir fotoğraf yükleyin.' });
    return;
  }

  try {
    const text = await transcribeForm(imageBase64, mediaType);
    res.status(200).json({
      text,
      empty: text.trim().length === 0,
    });
  } catch (err) {
    console.error('Form okuma hatası:', err);
    res.status(502).json({ error: 'Form okunamadı. Lütfen tekrar deneyin.' });
  }
}
