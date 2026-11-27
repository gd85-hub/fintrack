import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  DuplicateWarningDialog,
} from '../../components/DuplicateWarningDialog';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBanner } from '../../components/ds/StatusBanner';

// Receipt review lives behind Supabase auth. These tests drive the real screen
// with its data, navigation and child pickers mocked, covering the probable-
// duplicate warning: that the check runs before any write, that the warning is
// advisory, and that the save lifecycle resists double writes and stale results.

const mockT = (key: string) => key;

const mockParams: { receiptId?: string } = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

const mockDraftHolder: { draft: unknown } = { draft: null };
const mockClearDraft = jest.fn();
jest.mock('../../contexts/ReceiptDraftContext', () => ({
  useReceiptDraft: () => ({
    draft: mockDraftHolder.draft,
    clearDraft: mockClearDraft,
  }),
}));

jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT, locale: 'en' }),
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => require('../theme').theme.color,
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

const mockListCategories = jest.fn<() => Promise<unknown[]>>();
const mockListMerchants = jest.fn<() => Promise<unknown[]>>();
const mockGetFiscalReceiptForEdit = jest.fn<(id: string) => Promise<unknown>>();
const mockSaveFiscalReceipt = jest.fn<(input: unknown) => Promise<void>>();
const mockUpdateFiscalReceipt =
  jest.fn<(id: string, input: unknown) => Promise<unknown>>();
const mockFindReceiptDuplicates =
  jest.fn<(input: unknown) => Promise<unknown[]>>();

jest.mock('../db', () => ({
  listCategories: () => mockListCategories(),
  listMerchants: () => mockListMerchants(),
  getFiscalReceiptForEdit: (id: string) => mockGetFiscalReceiptForEdit(id),
  saveFiscalReceipt: (input: unknown) => mockSaveFiscalReceipt(input),
  updateFiscalReceipt: (id: string, input: unknown) =>
    mockUpdateFiscalReceipt(id, input),
  findReceiptDuplicates: (input: unknown) => mockFindReceiptDuplicates(input),
}));

jest.mock('../itemCategorization', () => ({
  resolveCategoriesForItems: async (items: unknown[]) =>
    (items as unknown[]).map(() => null),
  learnItemCategoryRules: async () => {},
}));

jest.mock('../supabase', () => ({ supabase: {} }));

jest.mock('../../components/CategoryPicker', () => ({
  CategoryPicker: () => null,
}));
jest.mock('../../components/MerchantPicker', () => ({
  MerchantPicker: () => null,
}));
jest.mock('../../components/LoadingScreen', () => ({ LoadingScreen: () => null }));

// Kept controllable so a test can drive date/currency corrections.
const DatePickerMock = () => null;
jest.mock('../../components/DatePicker', () => ({ DatePicker: DatePickerMock }));
const CurrencySelectorMock = () => null;
jest.mock('../../components/ReceiptCurrencySelector', () => ({
  ReceiptCurrencySelector: CurrencySelectorMock,
}));

// Imported after the mocks so the screen picks them up.
import ReviewReceiptScreen from '../../app/(app)/receipt/review';
// The mocked expo-router singleton the screen navigates with.
import { router as mockRouter } from 'expo-router';
import { DatePicker } from '../../components/DatePicker';
import { ReceiptCurrencySelector } from '../../components/ReceiptCurrencySelector';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

const uncategorized = {
  id: 'cat-unc',
  slug: 'uncategorized',
  name: 'Uncategorized',
  group: 'Other',
  color: '#000',
  icon: null,
  userId: 'user-1',
};

function newDraft() {
  return {
    ok: true as const,
    source: 'fiscal_qr' as const,
    merchantName: 'UNIVEREXPORT',
    merchantLabel: 'UNIVEREXPORT 1369800',
    taxId: '101692669',
    occurredAt: '2026-11-10T19:30:00+02:00',
    occurredOn: null,
    totalCents: 123456,
    currency: 'RSD',
    paymentType: 'Карточка',
    items: [
      {
        name: 'Хлеб',
        rawName: 'HLEB',
        quantity: 1,
        unitPriceCents: 123456,
        lineTotalCents: 123456,
        vatLabel: 'E',
      },
    ],
  };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    receiptId: 'r-existing',
    source: 'ocr_photo',
    merchantId: null,
    merchantName: 'UNIVEREXPORT',
    merchantLabel: 'UNIVEREXPORT 1369800',
    occurredOn: '2026-11-10',
    occurredAt: null,
    totalCents: 123456,
    currency: 'RSD',
    match: {
      isProbableDuplicate: true,
      confidence: 'probable',
      evidence: {},
    },
    ...overrides,
  };
}

async function renderReview() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ReviewReceiptScreen />);
  });
  return renderer;
}

function saveButton(renderer: ReactTestRenderer) {
  return renderer.root.findByProps({ testID: 'save-receipt' });
}

async function flush() {
  await act(async () => {});
}

async function pressSave(renderer: ReactTestRenderer) {
  await act(async () => {
    (saveButton(renderer).props.onPress as () => void)();
  });
  // The button's handler is fire-and-forget; drain the save chain it started.
  await flush();
}

function warningDialog(renderer: ReactTestRenderer) {
  return renderer.root.findByType(DuplicateWarningDialog);
}

let errorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  (mockRouter.back as unknown as jest.Mock).mockReset();
  (mockRouter.replace as unknown as jest.Mock).mockReset();
  mockParams.receiptId = undefined;
  mockDraftHolder.draft = newDraft();
  mockClearDraft.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockListCategories.mockReset();
  mockListCategories.mockResolvedValue([uncategorized]);
  mockListMerchants.mockReset();
  mockListMerchants.mockResolvedValue([]);
  mockGetFiscalReceiptForEdit.mockReset();
  mockSaveFiscalReceipt.mockReset();
  mockSaveFiscalReceipt.mockResolvedValue(undefined);
  mockUpdateFiscalReceipt.mockReset();
  mockUpdateFiscalReceipt.mockResolvedValue({ deleted: false });
  mockFindReceiptDuplicates.mockReset();
  mockFindReceiptDuplicates.mockResolvedValue([]);
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('receipt review duplicate warning', () => {
  test('a receipt with no probable duplicates saves normally', async () => {
    const renderer = await renderReview();
    await pressSave(renderer);

    expect(mockFindReceiptDuplicates).toHaveBeenCalledTimes(1);
    expect(mockSaveFiscalReceipt).toHaveBeenCalledTimes(1);
    expect(mockClearDraft).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalled();
    expect(warningDialog(renderer).props.visible).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a probable duplicate shows the warning before any write', async () => {
    mockFindReceiptDuplicates.mockResolvedValue([candidate()]);

    const renderer = await renderReview();
    await pressSave(renderer);

    const dialog = warningDialog(renderer);
    expect(dialog.props.visible).toBe(true);
    expect(dialog.props.matches).toHaveLength(1);
    // Advisory only: nothing was written.
    expect(mockSaveFiscalReceipt).not.toHaveBeenCalled();
    expect(mockClearDraft).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a strong match is still only advisory', async () => {
    mockFindReceiptDuplicates.mockResolvedValue([
      candidate({
        match: { isProbableDuplicate: true, confidence: 'strong', evidence: {} },
      }),
    ]);

    const renderer = await renderReview();
    await pressSave(renderer);

    expect(warningDialog(renderer).props.visible).toBe(true);
    expect(mockSaveFiscalReceipt).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });
  });

  test('Back to review performs no write and keeps the form', async () => {
    mockFindReceiptDuplicates.mockResolvedValue([candidate()]);

    const renderer = await renderReview();
    await pressSave(renderer);
    await act(async () => {
      warningDialog(renderer).props.onBack();
    });

    expect(warningDialog(renderer).props.visible).toBe(false);
    expect(mockSaveFiscalReceipt).not.toHaveBeenCalled();
    // The save button is still enabled with the preserved form.
    expect(saveButton(renderer).props.disabled).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('Save anyway performs exactly one save', async () => {
    mockFindReceiptDuplicates.mockResolvedValue([candidate()]);

    const renderer = await renderReview();
    await pressSave(renderer);
    await act(async () => {
      warningDialog(renderer).props.onSaveAnyway();
    });
    await flush();

    expect(mockSaveFiscalReceipt).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });
  });

  test('rapid repeated presses do not create duplicate writes', async () => {
    const pending = deferred<unknown[]>();
    mockFindReceiptDuplicates.mockReturnValue(pending.promise);

    const renderer = await renderReview();
    await pressSave(renderer);
    await pressSave(renderer);

    // Only one check started despite two presses.
    expect(mockFindReceiptDuplicates).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve([]);
    });

    expect(mockSaveFiscalReceipt).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('corrected date, currency, total and merchant are used for detection', async () => {
    const renderer = await renderReview();

    // The user corrects the date and currency on the form.
    await act(async () => {
      renderer.root.findByType(DatePicker).props.onChange('2026-11-12');
      renderer.root.findByType(ReceiptCurrencySelector).props.onChange('EUR');
    });

    await pressSave(renderer);

    expect(mockFindReceiptDuplicates).toHaveBeenCalledWith(
      expect.objectContaining({
        occurredOn: '2026-11-12',
        currency: 'EUR',
        totalCents: 123456,
        merchantName: 'UNIVEREXPORT',
      }),
    );

    await act(async () => {
      renderer.unmount();
    });
  });

  test('changing a matching field after Back re-checks instead of reusing the old result', async () => {
    mockFindReceiptDuplicates.mockResolvedValueOnce([candidate()]);

    const renderer = await renderReview();
    await pressSave(renderer);
    expect(warningDialog(renderer).props.visible).toBe(true);

    await act(async () => {
      warningDialog(renderer).props.onBack();
    });
    await act(async () => {
      renderer.root.findByType(DatePicker).props.onChange('2026-11-12');
    });

    mockFindReceiptDuplicates.mockResolvedValueOnce([]);
    await pressSave(renderer);

    expect(mockFindReceiptDuplicates).toHaveBeenCalledTimes(2);
    expect(mockFindReceiptDuplicates).toHaveBeenLastCalledWith(
      expect.objectContaining({ occurredOn: '2026-11-12' }),
    );
    expect(mockSaveFiscalReceipt).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a stale check that resolves after leaving the screen does nothing', async () => {
    const pending = deferred<unknown[]>();
    mockFindReceiptDuplicates.mockReturnValue(pending.promise);

    const renderer = await renderReview();
    await pressSave(renderer);

    // Navigate away while the check is in flight.
    await act(async () => {
      renderer.unmount();
    });

    // The stale result must not drive a save or a warning.
    await act(async () => {
      pending.resolve([candidate()]);
    });

    expect(mockSaveFiscalReceipt).not.toHaveBeenCalled();
  });

  test('a failed check is distinguishable from no matches', async () => {
    mockFindReceiptDuplicates.mockRejectedValue(new Error('network down'));

    const renderer = await renderReview();
    await pressSave(renderer);

    expect(renderer.root.findAllByType(StatusBanner).length).toBe(1);
    expect(mockSaveFiscalReceipt).not.toHaveBeenCalled();
    expect(warningDialog(renderer).props.visible).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a failed check can be retried, then saves', async () => {
    mockFindReceiptDuplicates.mockRejectedValueOnce(new Error('network down'));

    const renderer = await renderReview();
    await pressSave(renderer);
    expect(renderer.root.findAllByType(StatusBanner).length).toBe(1);

    mockFindReceiptDuplicates.mockResolvedValueOnce([]);
    await act(async () => {
      renderer.root.findByType(StatusBanner).props.action.onPress();
    });
    await flush();

    expect(mockFindReceiptDuplicates).toHaveBeenCalledTimes(2);
    expect(mockSaveFiscalReceipt).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a failed check can save without checking', async () => {
    mockFindReceiptDuplicates.mockRejectedValue(new Error('network down'));

    const renderer = await renderReview();
    await pressSave(renderer);

    const withoutChecking = renderer.root
      .findAll(
        (node) =>
          node.props &&
          node.props.label === 'review.duplicate.saveWithoutChecking' &&
          typeof node.props.onPress === 'function',
      )[0];
    await act(async () => {
      withoutChecking.props.onPress();
    });
    await flush();

    expect(mockSaveFiscalReceipt).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a failed save can be retried', async () => {
    mockSaveFiscalReceipt.mockRejectedValueOnce(new Error('write failed'));

    const renderer = await renderReview();
    await pressSave(renderer);
    expect(mockSaveFiscalReceipt).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalled();

    await pressSave(renderer);
    expect(mockSaveFiscalReceipt).toHaveBeenCalledTimes(2);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('editing an existing receipt bypasses duplicate detection', async () => {
    mockParams.receiptId = 'r-edit';
    mockDraftHolder.draft = null;
    mockGetFiscalReceiptForEdit.mockResolvedValue({
      id: 'r-edit',
      merchantId: null,
      merchantName: 'UNIVEREXPORT',
      merchantLabel: 'UNIVEREXPORT 1369800',
      occurredOn: '2026-11-10',
      currency: 'RSD',
      totalCents: 123456,
      manualRsdTotalCents: null,
      paymentType: 'Карточка',
      items: [
        {
          id: 'e-1',
          amountCents: 123456,
          categoryId: 'cat-unc',
          description: 'Хлеб',
          rawName: 'HLEB',
        },
      ],
    });

    const renderer = await renderReview();
    await pressSave(renderer);

    expect(mockFindReceiptDuplicates).not.toHaveBeenCalled();
    expect(mockUpdateFiscalReceipt).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('the delete-all confirmation dialog is preserved and skips the duplicate check', async () => {
    mockParams.receiptId = 'r-edit';
    mockDraftHolder.draft = null;
    mockGetFiscalReceiptForEdit.mockResolvedValue({
      id: 'r-edit',
      merchantId: null,
      merchantName: 'UNIVEREXPORT',
      merchantLabel: 'UNIVEREXPORT 1369800',
      occurredOn: '2026-11-10',
      currency: 'RSD',
      totalCents: 123456,
      manualRsdTotalCents: null,
      paymentType: 'Карточка',
      items: [
        {
          id: 'e-1',
          amountCents: 123456,
          categoryId: 'cat-unc',
          description: 'Хлеб',
          rawName: 'HLEB',
        },
      ],
    });

    const renderer = await renderReview();
    // Confirming deletion still updates without any duplicate detection.
    await act(async () => {
      renderer.root.findByType(ConfirmDialog).props.onConfirm();
    });

    expect(mockFindReceiptDuplicates).not.toHaveBeenCalled();
    expect(mockUpdateFiscalReceipt).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });
});
