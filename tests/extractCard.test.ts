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
});
