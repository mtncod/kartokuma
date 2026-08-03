import { describe, expect, it } from 'vitest';
import { transcribeForm, type AnthropicMessagesClient } from '../lib/transcribeForm.js';

function fakeClient(responseText: string, stopReason = 'end_turn'): AnthropicMessagesClient {
  return {
    messages: {
      create: async () => ({
        stop_reason: stopReason,
        content: [{ type: 'text', text: responseText }],
      }),
    },
  };
}

describe('transcribeForm', () => {
  it('returns the transcribed text from a well-formed response', async () => {
    const client = fakeClient('Ad Soyad: Ali Veli\nTarih: 01.08.2026\nAçıklama: Test formu');

    const result = await transcribeForm('base64data', 'image/jpeg', client);

    expect(result).toBe('Ad Soyad: Ali Veli\nTarih: 01.08.2026\nAçıklama: Test formu');
  });

  it('returns an empty string when the form has no readable text', async () => {
    const client = fakeClient('');

    const result = await transcribeForm('base64data', 'image/jpeg', client);

    expect(result).toBe('');
  });

  it('throws when the response has no text content block', async () => {
    const client: AnthropicMessagesClient = {
      messages: {
        create: async () => ({ stop_reason: 'end_turn', content: [] }),
      },
    };

    await expect(transcribeForm('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtında metin bulunamadı.',
    );
  });

  it('throws when Claude refuses the request', async () => {
    const client = fakeClient('', 'refusal');

    await expect(transcribeForm('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude bu isteği reddetti.',
    );
  });

  it('throws when the response was truncated by the token budget', async () => {
    const client = fakeClient('yarım kalan metin', 'max_tokens');

    await expect(transcribeForm('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtı tamamlanamadı.',
    );
  });

  it('sends the expected request params to Claude', async () => {
    let capturedParams: any;
    const client: AnthropicMessagesClient = {
      messages: {
        create: async (params) => {
          capturedParams = params;
          return {
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: '' }],
          };
        },
      },
    };

    await transcribeForm('the-image-base64', 'image/png', client);

    expect(capturedParams.model).toBe('claude-opus-5');

    const imageBlock = capturedParams.messages[0].content.find(
      (block: any) => block.type === 'image',
    );
    expect(imageBlock.source.data).toBe('the-image-base64');
    expect(imageBlock.source.media_type).toBe('image/png');
  });
});
