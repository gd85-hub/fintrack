import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import { supabase } from '../supabase';
import {
  extractMerchantBrand,
  findMatchingMerchant,
  fetchAndParseReceipt,
  merchantAliasesWithIncoming,
  normalizeMerchantName,
  type ParsedReceipt,
} from '../receipts';

jest.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const invokeMock = jest.mocked(supabase.functions.invoke);
const originalFetch = globalThis.fetch;
const supportedUrl =
  'https://suf.purs.gov.rs/v/?vl=valid-verification-token';
const html = '<!DOCTYPE html><pre>receipt journal</pre>';
const parsedReceipt: ParsedReceipt = {
  ok: true,
  merchantName: 'UNIVEREXPORT',
  merchantLabel: 'UNIVEREXPORT',
  taxId: '101692669',
  occurredAt: '2026-07-29T15:41:15+02:00',
  totalCents: 124295,
  currency: 'RSD',
  paymentType: 'Карта',
  items: [
    {
      name: 'COCA-COLA ZERO 1L (KOM)',
      quantity: 1,
      unitPriceCents: 10900,
      lineTotalCents: 10900,
      vatLabel: 'Ђ',
    },
  ],
};

function responseWith(body: string, ok = true) {
  return {
    ok,
    text: jest.fn(async () => body),
  } as unknown as Response;
}

describe('device receipt loading', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('fetches HTML on-device and sends html/sourceUrl to the function', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
    fetchMock.mockResolvedValue(responseWith(html));
    invokeMock.mockResolvedValue({
      data: parsedReceipt,
      error: null,
    });

    await expect(fetchAndParseReceipt(` ${supportedUrl} `)).resolves.toEqual(
      parsedReceipt,
    );
    expect(fetchMock).toHaveBeenCalledWith(supportedUrl, {
      headers: {
        Accept: 'text/html',
      },
      signal: expect.any(AbortSignal),
    });
    expect(invokeMock).toHaveBeenCalledWith('parse-receipt', {
      body: {
        html,
        sourceUrl: supportedUrl,
        debug: false,
      },
    });
  });

  test('keeps a QR merchant label while deriving its brand', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
    fetchMock.mockResolvedValue(responseWith(html));
    invokeMock.mockResolvedValue({
      data: {
        ...parsedReceipt,
        merchantName: 'MIX MARKT 38103 NS CENTAR',
      },
      error: null,
    });

    await expect(fetchAndParseReceipt(supportedUrl)).resolves.toMatchObject({
      ok: true,
      merchantName: 'MIX MARKT',
      merchantLabel: 'MIX MARKT 38103 NS CENTAR',
    });
  });

  test('rejects an unsupported URL before fetching', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;

    await expect(
      fetchAndParseReceipt('https://example.com/v/?vl=not-suf'),
    ).resolves.toEqual({ ok: false, error: 'unsupported_url' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test('maps network and non-success responses to fetch_failed', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(responseWith('blocked', false));
    await expect(fetchAndParseReceipt(supportedUrl)).resolves.toEqual({
      ok: false,
      error: 'fetch_failed',
    });

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(fetchAndParseReceipt(supportedUrl)).resolves.toEqual({
      ok: false,
      error: 'fetch_failed',
    });
  });

  test('aborts a device fetch after twenty seconds', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

    const result = fetchAndParseReceipt(supportedUrl);
    await jest.advanceTimersByTimeAsync(20_000);

    await expect(result).resolves.toEqual({
      ok: false,
      error: 'timeout',
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('merchant name unification', () => {
  test.each([
    ['MIX MARKT 38103 NS CENTAR', 'MIX MARKT'],
    ['UNIVEREXPORT 1369800-MP190', 'UNIVEREXPORT'],
    ['IDEA 111880-IDEA 505', 'IDEA'],
    ['SKROZ DOBRA PEKARA 73 SU', 'SKROZ DOBRA PEKARA'],
    ['Lidl', 'Lidl'],
    ['  SHOP   d.o.o.  101 CENTER  ', 'SHOP'],
    ['101 CENTER', '101 CENTER'],
    ['', ''],
    ['---', '---'],
  ])('extracts the merchant brand from %s', (fullName, expected) => {
    expect(extractMerchantBrand(fullName)).toBe(expected);
  });

  test('collapses arbitrary branch labels through the shared brand key', () => {
    const firstBrand = extractMerchantBrand(
      'MIX MARKT 38103 NS CENTAR',
    );
    const secondBrand = extractMerchantBrand(
      'MIX MARKT 41027 NS LIMAN',
    );
    const merchant = { name: firstBrand, aliases: [] };

    expect(secondBrand).toBe(firstBrand);
    expect(findMatchingMerchant([merchant], secondBrand)).toBe(merchant);
  });

  test.each([
    'Lidl',
    'LIDL',
    '  lidl   store ',
    'Lidl market',
    'LIDL d.o.o.',
    'ЛИДЛ',
  ])(
    'normalizes %s to the same merchant key',
    (name) => {
      expect(normalizeMerchantName(name)).toBe('lidl');
    },
  );

  test('matches aliases and learns a new incoming spelling', () => {
    const merchant = {
      id: 'merchant-lidl',
      name: 'Lidl',
      aliases: ['LIDL'],
    };
    const matched = findMatchingMerchant([merchant], 'lidl store');

    expect(matched).toBe(merchant);
    expect(
      merchantAliasesWithIncoming(matched ?? merchant, 'lidl store'),
    ).toEqual(['LIDL', 'lidl store']);
    expect(merchantAliasesWithIncoming(merchant, 'LIDL')).toEqual([
      'LIDL',
    ]);
  });
});
