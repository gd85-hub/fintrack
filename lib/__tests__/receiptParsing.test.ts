import { describe, expect, test } from '@jest/globals';

import {
  extractJournalText,
  parseJournal,
  parseReceiptHtml,
  parseSerbianCents,
  parseStructuredReceipt,
  validateReceiptUrl,
} from '../../supabase/functions/parse-receipt/parser';

const liveJournal = `
============ ФИСКАЛНИ РАЧУН ============
               101692669
              UNIVEREXPORT
             1369800-MP190
            ЋИРПАНОВА 14
                Нови Сад
Касир:                            118227
ЕСИР број:                         617/4
-------------ПРОМЕТ ПРОДАЈА-------------
Артикли
========================================
Назив   Цена         Кол.         Укупно
COCA-COLA ZERO 1L (KOM) (Ђ)
       109,00          1          109,00
KESA TREGERICA BIORAZGRADIVA UNIVER (KOM
) (Ђ)
        19,99          1           19,99
CIGARETE WINSTON XSPRESSION LONG (KOM) (
Ђ)
       450,00          1          450,00
HLEB 7 ZRNA SECENI TVOJIH 5 MINUTA 450G
(KOM) (Е)
       117,99          1          117,99
COCA-COLA ZERO 0,5L (KOM) (Ђ)
        99,99          1           99,99
JAJA KOKOSIJA BELA KLASA M EGG TRADE 10/
1 (KOM) (Е)
       263,99          1          263,99
KOBASICA CURECA KLASIK YUHOR 325G (KOM)
(Ђ)
       181,99          1          181,99
----------------------------------------
Укупан износ:                   1.242,95
Платна картица:                 1.242,95
========================================
Ознака       Име      Стопа        Порез
Ђ           О-ПДВ   20,00%        143,50
Е           П-ПДВ   10,00%         34,73
----------------------------------------
Укупан износ пореза:              178,23
========================================
ПФР време:          29.07.2026. 15:41:15
ПФР број рачуна: GU3NGD2C-GU3NGD2C-14797
8
Бројач рачуна:           147430/147978ПП
========================================
`;

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
      paymentType: 'Наличные',
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

  test('parses the exact live SUF fixed-width journal', () => {
    const parsed = parseJournal(liveJournal);

    expect(parsed).not.toBeNull();
    if (!parsed) {
      throw new Error('Live journal was not parsed.');
    }

    expect(parsed.merchantName).toBe('UNIVEREXPORT');
    expect(parsed.taxId).toBe('101692669');
    expect(parsed.paymentType).toBe('Карта');
    expect(parsed.occurredAt).toBe('2026-07-29T15:41:15+02:00');
    expect(parsed.totalCents).toBe(124295);
    expect(parsed.items).toHaveLength(7);
    expect(parsed.items.map((item) => item.lineTotalCents)).toEqual([
      10900, 1999, 45000, 11799, 9999, 26399, 18199,
    ]);
    expect(
      parsed.items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    ).toBe(parsed.totalCents);
    expect(parsed.items[1]).toMatchObject({
      name: 'KESA TREGERICA BIORAZGRADIVA UNIVER (KOM)',
      vatLabel: 'Ђ',
    });
    expect(parsed.items[2]).toMatchObject({
      name: 'CIGARETE WINSTON XSPRESSION LONG (KOM)',
      vatLabel: 'Ђ',
    });
  });

  test('parses a decimal quantity from a fixed-width amount line', () => {
    const parsed = parseJournal(`
============ FISKALNI RACUN ============
123456789
BANANA MARKET
SHOP-1
ADDRESS
CITY
-------------PROMET PRODAJA-------------
Artikli
========================================
Naziv   Cena         Kol.         Ukupno
BANANA (KG) (E)
       129,99      0,464           60,32
----------------------------------------
Ukupan iznos:                       60,32
Gotovina:                            60,32
========================================
PFR vreme:          15.01.2026. 10:00:00
========================================
`);

    expect(parsed?.items).toEqual([
      {
        name: 'BANANA (KG)',
        quantity: 0.464,
        unitPriceCents: 12999,
        lineTotalCents: 6032,
        vatLabel: 'E',
      },
    ]);
    expect(parsed?.paymentType).toBe('Наличные');
  });

  test('extracts an entity-encoded journal from an unlabelled pre block', () => {
    const encodedJournal = liveJournal
      .replace('Ф', '&#x424;')
      .replace('И', '&#x418;')
      .replace('РАЧУН', '&#x420;&#x410;&#x427;&#x423;&#x41D;');
    const inlineImage = 'A'.repeat(50_000);
    const html = `
      <html>
        <body>
          <pre style="font-family:monospace">${encodedJournal}<br/><img src="data:image/gif;base64,${inlineImage}" width="250">========================================</pre>
        </body>
      </html>
    `;
    const extracted = extractJournalText(html);

    expect(extracted).not.toBeNull();
    expect(extracted).toContain('ФИСКАЛНИ РАЧУН');
    expect(extracted).toContain('UNIVEREXPORT');
    expect(extracted).not.toContain('<br');
    expect(extracted).not.toContain('<img');
    expect(extracted).not.toContain('data:image');
    expect(extracted).not.toContain('&#x');
    expect(extracted).not.toContain('\r');
    expect(parseReceiptHtml(html)?.items).toHaveLength(7);
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
