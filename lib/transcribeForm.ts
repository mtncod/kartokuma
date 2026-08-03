import Anthropic from '@anthropic-ai/sdk';

const PROMPT =
  'Bu, elle veya bilgisayarda doldurulmuş bir form fotoğrafı. Fotoğraftaki tüm metni ' +
  '(başlıklar, alan adları, doldurulmuş değerler dahil) olduğu gibi, yorum veya çeviri ' +
  'yapmadan düz metin olarak çıkar. Formun yapısını satır satır, okunabilir şekilde ' +
  'koru. Fotoğrafta hiç metin yoksa veya okunamıyorsa boş string ("") döndür.';

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

export async function transcribeForm(
  imageBase64: string,
  mediaType: string,
  client: AnthropicMessagesClient = getDefaultClient(),
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    output_config: {
      effort: 'low',
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

  return textBlock.text;
}
