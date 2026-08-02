import { describe, expect, it } from 'vitest';
import { extractCard, type AnthropicMessagesClient } from '../lib/extractCard.js';

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

describe('extractCard', () => {
  it('parses a well-formed structured JSON response into CardData', async () => {
    const client = fakeClient(
      JSON.stringify({
        fullName: 'Ayşe Yılmaz',
        jobTitle: 'Satış Müdürü',
        company: 'Acme A.Ş.',
        phones: ['0212 555 11 22'],
        email: 'ayse@acme.com',
        il: 'İstanbul',
        address: 'Levent, İstanbul',
        website: 'acme.com',
      }),
    );

    const result = await extractCard('base64data', 'image/jpeg', client);

    expect(result).toEqual({
      fullName: 'Ayşe Yılmaz',
      jobTitle: 'Satış Müdürü',
      company: 'Acme A.Ş.',
      phones: ['0212 555 11 22'],
      email: 'ayse@acme.com',
      il: 'İstanbul',
      address: 'Levent, İstanbul',
      website: 'acme.com',
    });
  });

  it('throws when the response has no text content block', async () => {
    const client: AnthropicMessagesClient = {
      messages: {
        create: async () => ({ stop_reason: 'end_turn', content: [] }),
      },
    };

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtında metin bulunamadı.',
    );
  });

  it('throws when Claude refuses the request', async () => {
    const client = fakeClient('{}', 'refusal');

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude bu isteği reddetti.',
    );
  });

  it('throws when the response was truncated by the token budget', async () => {
    const client = fakeClient('{"fullName": "eksik', 'max_tokens');

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtı tamamlanamadı.',
    );
  });

  it('throws when the text block is not valid JSON', async () => {
    const client = fakeClient('bu json değil {{{');

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtı çözümlenemedi.',
    );
  });

  it('throws when the parsed JSON does not match the expected shape', async () => {
    const client = fakeClient(JSON.stringify({ fullName: 'Ayşe Yılmaz', phones: 'not-an-array' }));

    await expect(extractCard('base64data', 'image/jpeg', client)).rejects.toThrow(
      'Claude yanıtı çözümlenemedi.',
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
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  fullName: '',
                  jobTitle: '',
                  company: '',
                  phones: [],
                  email: '',
                  il: '',
                  address: '',
                  website: '',
                }),
              },
            ],
          };
        },
      },
    };

    await extractCard('the-image-base64', 'image/png', client);

    expect(capturedParams.model).toBe('claude-opus-5');
    expect(capturedParams.output_config.format.schema.required).toEqual([
      'fullName',
      'jobTitle',
      'company',
      'phones',
      'email',
      'il',
      'address',
      'website',
    ]);

    const imageBlock = capturedParams.messages[0].content.find(
      (block: any) => block.type === 'image',
    );
    expect(imageBlock.source.data).toBe('the-image-base64');
    expect(imageBlock.source.media_type).toBe('image/png');
  });
});
