import Anthropic from '@anthropic-ai/sdk';
import type { CardData } from './types.js';

const CARD_SCHEMA = {
  type: 'object',
  properties: {
    fullName: {
      type: 'string',
      description: 'Kartvizitteki ad soyad. Bulunamazsa boş string ("") döndür.',
    },
    jobTitle: {
      type: 'string',
      description: 'Unvan veya pozisyon. Bulunamazsa boş string.',
    },
    company: {
      type: 'string',
      description: 'Şirket adı. Bulunamazsa boş string.',
    },
    phones: {
      type: 'array',
      items: { type: 'string' },
      description: 'Kartvizitteki tüm telefon numaraları. Yoksa boş dizi.',
    },
    email: {
      type: 'string',
      description: 'E-posta adresi. Bulunamazsa boş string.',
    },
    address: {
      type: 'string',
      description: 'Açık adres. Bulunamazsa boş string.',
    },
    website: {
      type: 'string',
      description: 'Web sitesi. Bulunamazsa boş string.',
    },
  },
  required: ['fullName', 'jobTitle', 'company', 'phones', 'email', 'address', 'website'],
  additionalProperties: false,
} as const;

const PROMPT =
  'Bu bir kartvizit fotoğrafı. Kartvizitten şu bilgileri çıkar: ad soyad, unvan, ' +
  'şirket adı, telefon numarası/numaraları, e-posta, adres, web sitesi. Kartvizitte ' +
  'olmayan alanlar için boş string ("") veya boş dizi ([]) kullan. Bilgiyi olduğu ' +
  'gibi, çeviri veya yorum yapmadan çıkar.';

export interface AnthropicMessagesClient {
  messages: {
    create: (params: unknown) => Promise<{
      stop_reason: string;
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}

let defaultClient: AnthropicMessagesClient | undefined;

function getDefaultClient(): AnthropicMessagesClient {
  if (!defaultClient) {
    defaultClient = new Anthropic() as unknown as AnthropicMessagesClient;
  }
  return defaultClient;
}

export async function extractCard(
  imageBase64: string,
  mediaType: string,
  client: AnthropicMessagesClient = getDefaultClient(),
): Promise<CardData> {
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: CARD_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude bu isteği reddetti.');
  }

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Claude yanıtı tamamlanamadı.');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || typeof textBlock.text !== 'string') {
    throw new Error('Claude yanıtında metin bulunamadı.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('Claude yanıtı çözümlenemedi.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { phones?: unknown }).phones)
  ) {
    throw new Error('Claude yanıtı çözümlenemedi.');
  }

  return parsed as CardData;
}
