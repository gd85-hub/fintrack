import { describe, expect, test } from '@jest/globals';

import {
  parseJournal,
  parseSerbianCents,
  parseStructuredReceipt,
  validateReceiptUrl,
} from '../../supabase/functions/parse-receipt/parser';

const representativeJournal = `
-------------ФИСКАЛНИ РАЧУН-------------
Назив обвезника: ПРОБА МАРКЕТ
ПИБ: 109876543
Артикли
========================================
Назив Цена Количина Укупно
Хлеб бели (Ђ)
89,90 2,000 179,80
Млеко 1л (Е)
159,99 1,000 159,99
----------------------------------------
Укупан износ: 339,79
Начин плаћања: Готовина
ПФР време: 29.07.2026. 12:34:56
`;

describe('Serbian fiscal receipt parsing', () => {
  test('parses Serbian decimal and thousands separators into cents', () => {
    expect(parseSerbianCents('1.234,56')).toBe(123456);
    expect(parseSerbianCents('89,90')).toBe(8990);
    expect(parseSerbianCents('not money')).toBeNull();
  });

  test('accepts only supported SUF verification URLs', () => {
    expect(
      validateReceiptUrl(
        'https://suf.purs.gov.rs/v/?vl=valid-verification-token',
      ),
    ).toBe(true);
    expect(
      validateReceiptUrl('https://example.com/v/?vl=valid-verification-token'),
    ).toBe(false);
    expect(validateReceiptUrl('https://suf.purs.gov.rs/v/')).toBe(false);
  });

  test('parses a representative journal and preserves local receipt date', () => {
    expect(parseJournal(representativeJournal)).toEqual({
      merchantName: 'ПРОБА МАРКЕТ',
      taxId: '109876543',
      occurredAt: '2026-07-29T12:34:56+02:00',
      totalCents: 33979,
      paymentType: 'Готовина',
      items: [
        {
          name: 'Хлеб бели',
          quantity: 2,
          unitPriceCents: 8990,
          lineTotalCents: 17980,
          vatLabel: 'Ђ',
        },
        {
          name: 'Млеко 1л',
          quantity: 1,
          unitPriceCents: 15999,
          lineTotalCents: 15999,
          vatLabel: 'Е',
        },
      ],
    });
  });

  test('prefers documented structured fields and adds Belgrade offset', () => {
    expect(
      parseStructuredReceipt({
        request: {
          items: [
            {
              name: 'Voda',
              quantity: 2,
              unitPrice: 50,
              totalAmount: 100,
              labels: [{ label: 'Ђ' }],
            },
          ],
          payment: [{ amount: 100, paymentType: 2 }],
        },
        result: {
          businessName: 'STRUKTURIRANI MARKET',
          tin: 123456789,
          sdcDateTime: '2026-07-29T06:15:00.1234567Z',
          totalAmount: 100,
        },
      }),
    ).toEqual({
      merchantName: 'STRUKTURIRANI MARKET',
      taxId: '123456789',
      occurredAt: '2026-07-29T08:15:00+02:00',
      totalCents: 10000,
      paymentType: 'Карта',
      items: [
        {
          name: 'Voda',
          quantity: 2,
          unitPriceCents: 5000,
          lineTotalCents: 10000,
          vatLabel: 'Ђ',
        },
      ],
    });
  });
});
