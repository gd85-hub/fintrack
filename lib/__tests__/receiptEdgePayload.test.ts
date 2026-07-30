import { describe, expect, jest, test } from '@jest/globals';

const { parseReceiptPayload } = jest.requireActual<{
  parseReceiptPayload: (body: unknown) => unknown;
}>('../../supabase/functions/parse-receipt/index');

const supportedUrl =
  'https://suf.purs.gov.rs/v/?vl=valid-verification-token';

describe('parse-receipt Edge payload', () => {
  test('rejects a non-allowlisted sourceUrl even when HTML is supplied', () => {
    expect(
      parseReceiptPayload({
        html: '<pre>plausible receipt HTML</pre>',
        sourceUrl: 'https://example.com/v/?vl=forged',
        debug: false,
      }),
    ).toEqual({ ok: false, error: 'unsupported_url' });
  });

  test('rejects missing, empty, and oversized HTML', () => {
    expect(
      parseReceiptPayload({
        sourceUrl: supportedUrl,
        debug: false,
      }),
    ).toEqual({ ok: false, error: 'parse_failed' });
    expect(
      parseReceiptPayload({
        html: '   ',
        sourceUrl: supportedUrl,
        debug: false,
      }),
    ).toEqual({ ok: false, error: 'parse_failed' });
    expect(
      parseReceiptPayload({
        html: 'x'.repeat(2 * 1024 * 1024 + 1),
        sourceUrl: supportedUrl,
        debug: false,
      }),
    ).toEqual({ ok: false, error: 'parse_failed' });
  });

  test('parses supplied receipt HTML without a server-side fetch', () => {
    const html = `
      <pre style="font-family:monospace">
============ FISKALNI RACUN ============
101692669
UNIVEREXPORT
SHOP-1
ADDRESS
CITY
-------------PROMET PRODAJA-------------
Artikli
========================================
Naziv Cena Kol. Ukupno
VODA (KOM) (E)
100,00 1 100,00
----------------------------------------
Ukupan iznos: 100,00
Gotovina: 100,00
========================================
PFR vreme: 29.07.2026. 15:41:15
========================================
      </pre>
    `;

    expect(
      parseReceiptPayload({
        html,
        sourceUrl: supportedUrl,
        debug: false,
      }),
    ).toMatchObject({
      ok: true,
      merchantName: 'UNIVEREXPORT',
      totalCents: 10000,
      currency: 'RSD',
    });
  });
});
