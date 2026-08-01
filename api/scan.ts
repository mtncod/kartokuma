import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractCard } from '../lib/extractCard.js';
import { formatReport, isEmptyCard } from '../lib/formatReport.js';

const MAX_BASE64_LENGTH = 6_000_000; // ~4.5MB base64 kodlanmış görsel

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
    const card = await extractCard(imageBase64, mediaType);
    res.status(200).json({
      card,
      report: formatReport(card),
      empty: isEmptyCard(card),
    });
  } catch (err) {
    console.error('Kartvizit okuma hatası:', err);
    res.status(502).json({ error: 'Kart okunamadı. Lütfen tekrar deneyin.' });
  }
}
