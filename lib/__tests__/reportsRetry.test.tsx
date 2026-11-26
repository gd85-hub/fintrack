import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { ActivityIndicator, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Button } from '../../components/ds/Button';
import { StatusBanner } from '../../components/ds/StatusBanner';

// Reports lives behind Supabase auth, so it cannot be opened in a browser
// without the owner's credentials. These tests drive the real screen with its
// data and export-delivery layers mocked, covering what the browser would show
// after a failed data load: a Retry action, that Retry refetches both datasets
// for the selected month, that export stays unavailable until both succeed, and
// that Retry never starts a CSV/XLSX/PDF export.

// Stable identity (mock-prefixed so jest.mock factories may reference it): the
// screen's load effect depends on `t`, so a fresh function each render would
// re-run the effect every render.
const mockT = (key: string) => key;

// useFocusEffect(useCallback(fn, deps)) runs the effect on mount and whenever
// the memoized callback changes (month or retry key), mirroring focus/retry.
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(() => callback(), [callback]),
  };
});

jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT, locale: 'en' }),
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => require('../theme').theme.color,
}));

const mockListExpensesByMonth =
  jest.fn<(month: string) => Promise<unknown[]>>();
const mockListCategoriesForManagement =
  jest.fn<() => Promise<unknown[]>>();

jest.mock('../db', () => ({
  listExpensesByMonth: (month: string) => mockListExpensesByMonth(month),
  listCategoriesForManagement: () => mockListCategoriesForManagement(),
}));

const mockDeliverText = jest.fn();
const mockDeliverBinary = jest.fn();
const mockBeginPdfExport = jest.fn();

jest.mock('../exportDelivery', () => ({
  deliverText: (...args: unknown[]) => mockDeliverText(...args),
  deliverBinary: (...args: unknown[]) => mockDeliverBinary(...args),
  ShareUnavailableError: class ShareUnavailableError extends Error {},
}));

jest.mock('../exportPdfIntegration', () => ({
  beginPdfExport: (...args: unknown[]) => mockBeginPdfExport(...args),
  disposePreparedPdf: jest.fn(),
  savePreparedPdf: jest.fn(),
}));

jest.mock('../../components/MonthPicker', () => ({ MonthPicker: () => null }));
jest.mock('../../components/ScreenHeader', () => ({ ScreenHeader: () => null }));

// Imported after the mocks so the screen picks them up.
import ReportsScreen from '../../app/(app)/reports';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

const categoryRow = { id: 'category-1', group: 'Food', type: 'variable' };

function hasText(renderer: ReactTestRenderer, value: string): boolean {
  return (
    renderer.root.findAll(
      (node) => node.type === Text && node.props.children === value,
    ).length > 0
  );
}

function statusBannerAction(renderer: ReactTestRenderer) {
  return renderer.root.findByType(StatusBanner).props.action as
    | { label: string; onPress: () => void }
    | undefined;
}

function hasStatusBanner(renderer: ReactTestRenderer): boolean {
  return renderer.root.findAllByType(StatusBanner).length > 0;
}

function exportButtonCount(renderer: ReactTestRenderer): number {
  return renderer.root.findAllByType(Button).length;
}

function pressExport(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root
    .findAllByType(Button)
    .find((node) => node.props.label === label);
  if (!button) {
    throw new Error(`No export button labelled ${label}`);
  }
  (button.props.onPress as () => void)();
}

const EXPORT_LABELS = ['CSV', 'Excel', 'PDF'];

function exportButtonsDisabled(renderer: ReactTestRenderer): boolean {
  const buttons = renderer.root
    .findAllByType(Button)
    .filter((node) => EXPORT_LABELS.includes(node.props.label as string));
  return (
    buttons.length === EXPORT_LABELS.length &&
    buttons.every((node) => node.props.disabled === true)
  );
}

function hasSavePdfButton(renderer: ReactTestRenderer): boolean {
  return renderer.root
    .findAllByType(Button)
    .some((node) => node.props.label === 'export.savePdf');
}

describe('Reports data-loading retry', () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    mockListExpensesByMonth.mockReset();
    mockListCategoriesForManagement.mockReset();
    mockDeliverText.mockReset();
    mockDeliverBinary.mockReset();
    mockBeginPdfExport.mockReset();
    // The screen logs load failures; these are expected here.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test('a failed load shows the report-load error with a Retry action', async () => {
    mockListExpensesByMonth.mockRejectedValue(new Error('network down'));
    mockListCategoriesForManagement.mockResolvedValue([categoryRow]);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });

    expect(hasText(renderer, 'export.loadFailed')).toBe(true);
    // The export-failure copy must not be used for a data-load failure.
    expect(hasText(renderer, 'export.failed')).toBe(false);
    const action = statusBannerAction(renderer);
    expect(action?.label).toBe('home.retry');
    // Export actions are unavailable while the load has failed.
    expect(exportButtonCount(renderer)).toBe(0);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('Retry refetches both datasets for the selected month and no export runs', async () => {
    mockListExpensesByMonth.mockRejectedValue(new Error('network down'));
    mockListCategoriesForManagement.mockResolvedValue([categoryRow]);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });

    const month = mockListExpensesByMonth.mock.calls[0]?.[0];
    expect(mockListExpensesByMonth).toHaveBeenCalledTimes(1);
    expect(mockListCategoriesForManagement).toHaveBeenCalledTimes(1);

    mockListExpensesByMonth.mockResolvedValue([{ id: 'expense-1' }]);
    await act(async () => {
      statusBannerAction(renderer)?.onPress();
    });

    expect(mockListExpensesByMonth).toHaveBeenCalledTimes(2);
    expect(mockListCategoriesForManagement).toHaveBeenCalledTimes(2);
    // The retry targets the same month that was selected.
    expect(mockListExpensesByMonth.mock.calls[1]?.[0]).toBe(month);
    // Retry never triggers export delivery.
    expect(mockDeliverText).not.toHaveBeenCalled();
    expect(mockDeliverBinary).not.toHaveBeenCalled();
    expect(mockBeginPdfExport).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });
  });

  test('during retry the loading state returns and export stays unavailable', async () => {
    mockListExpensesByMonth.mockRejectedValue(new Error('network down'));
    mockListCategoriesForManagement.mockResolvedValue([categoryRow]);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });
    expect(hasStatusBanner(renderer)).toBe(true);

    const pendingExpenses = deferred<unknown[]>();
    const pendingCategories = deferred<unknown[]>();
    mockListExpensesByMonth.mockReturnValue(pendingExpenses.promise);
    mockListCategoriesForManagement.mockReturnValue(
      pendingCategories.promise,
    );

    await act(async () => {
      statusBannerAction(renderer)?.onPress();
    });

    // Error cleared, loading indicator back, export actions still unavailable.
    expect(hasStatusBanner(renderer)).toBe(false);
    expect(renderer.root.findAllByType(ActivityIndicator).length).toBe(1);
    expect(exportButtonCount(renderer)).toBe(0);

    await act(async () => {
      pendingExpenses.resolve([{ id: 'expense-1' }]);
      pendingCategories.resolve([categoryRow]);
    });

    expect(exportButtonCount(renderer)).toBe(3);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a successful retry restores the export actions', async () => {
    mockListExpensesByMonth.mockRejectedValue(new Error('network down'));
    mockListCategoriesForManagement.mockResolvedValue([categoryRow]);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });

    mockListExpensesByMonth.mockResolvedValue([{ id: 'expense-1' }]);
    await act(async () => {
      statusBannerAction(renderer)?.onPress();
    });

    expect(hasStatusBanner(renderer)).toBe(false);
    expect(exportButtonCount(renderer)).toBe(3);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a successful retry with no expenses shows the empty state', async () => {
    mockListExpensesByMonth.mockRejectedValue(new Error('network down'));
    mockListCategoriesForManagement.mockResolvedValue([categoryRow]);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });

    mockListExpensesByMonth.mockResolvedValue([]);
    await act(async () => {
      statusBannerAction(renderer)?.onPress();
    });

    expect(hasStatusBanner(renderer)).toBe(false);
    expect(hasText(renderer, 'export.empty')).toBe(true);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a repeated failure stays recoverable with another Retry', async () => {
    mockListExpensesByMonth.mockRejectedValue(new Error('network down'));
    mockListCategoriesForManagement.mockResolvedValue([categoryRow]);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });

    // Retry, still failing.
    await act(async () => {
      statusBannerAction(renderer)?.onPress();
    });

    expect(mockListExpensesByMonth).toHaveBeenCalledTimes(2);
    expect(hasText(renderer, 'export.loadFailed')).toBe(true);
    expect(statusBannerAction(renderer)?.label).toBe('home.retry');

    // Recover on a later attempt.
    mockListExpensesByMonth.mockResolvedValue([{ id: 'expense-1' }]);
    await act(async () => {
      statusBannerAction(renderer)?.onPress();
    });

    expect(hasStatusBanner(renderer)).toBe(false);
    expect(exportButtonCount(renderer)).toBe(3);

    await act(async () => {
      renderer.unmount();
    });
  });
});

describe('Reports export feedback', () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    mockListExpensesByMonth.mockReset();
    mockListCategoriesForManagement.mockReset();
    mockDeliverText.mockReset();
    mockDeliverBinary.mockReset();
    mockBeginPdfExport.mockReset();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  // A fully-formed expense so the real CSV/XLSX row builders run without error;
  // only the delivery layer is mocked.
  const expenseRow = {
    id: 'expense-1',
    receiptId: null,
    occurredOn: '2026-11-10',
    merchantName: null,
    categoryId: 'category-1',
    categoryName: 'Food',
    description: '',
    rawName: null,
    originalAmountCents: 1000,
    originalCurrency: 'EUR',
    amountRsdCents: 0,
    amountEurCents: 1000,
    amountUsdCents: 0,
  };

  async function renderWithData() {
    mockListExpensesByMonth.mockResolvedValue([expenseRow]);
    mockListCategoriesForManagement.mockResolvedValue([categoryRow]);
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });
    return renderer;
  }

  test('CSV export shows CSV-specific feedback until it settles', async () => {
    const renderer = await renderWithData();
    const pending = deferred<void>();
    mockDeliverText.mockReturnValue(pending.promise);

    await act(async () => {
      pressExport(renderer, 'CSV');
    });

    expect(hasText(renderer, 'export.preparingCsv')).toBe(true);
    expect(hasText(renderer, 'export.preparingXlsx')).toBe(false);
    expect(hasText(renderer, 'export.generatingPdf')).toBe(false);
    expect(hasText(renderer, 'export.exporting')).toBe(false);
    // Export actions are unavailable while an export runs.
    expect(exportButtonsDisabled(renderer)).toBe(true);

    await act(async () => {
      pending.resolve();
    });
    expect(hasText(renderer, 'export.preparingCsv')).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('Excel export shows Excel-specific feedback', async () => {
    const renderer = await renderWithData();
    const pending = deferred<void>();
    mockDeliverBinary.mockReturnValue(pending.promise);

    await act(async () => {
      pressExport(renderer, 'Excel');
    });

    expect(hasText(renderer, 'export.preparingXlsx')).toBe(true);
    expect(hasText(renderer, 'export.preparingCsv')).toBe(false);
    expect(exportButtonsDisabled(renderer)).toBe(true);

    await act(async () => {
      pending.resolve();
    });
    expect(hasText(renderer, 'export.preparingXlsx')).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('PDF export shows PDF-specific feedback and keeps the Save PDF flow', async () => {
    const renderer = await renderWithData();
    const pending = deferred<unknown>();
    mockBeginPdfExport.mockReturnValue(pending.promise);

    await act(async () => {
      pressExport(renderer, 'PDF');
    });

    expect(hasText(renderer, 'export.generatingPdf')).toBe(true);
    expect(hasText(renderer, 'export.preparingCsv')).toBe(false);
    expect(exportButtonsDisabled(renderer)).toBe(true);
    // No prepared PDF yet, so no Save PDF action.
    expect(hasSavePdfButton(renderer)).toBe(false);

    // A prepared PDF resolves: feedback clears and the Save PDF action appears.
    await act(async () => {
      pending.resolve({ kind: 'prepared' });
    });
    expect(hasText(renderer, 'export.generatingPdf')).toBe(false);
    expect(hasSavePdfButton(renderer)).toBe(true);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('export feedback disappears after a failure', async () => {
    const renderer = await renderWithData();
    const pending = deferred<void>();
    mockDeliverText.mockReturnValue(pending.promise);

    await act(async () => {
      pressExport(renderer, 'CSV');
    });
    expect(hasText(renderer, 'export.preparingCsv')).toBe(true);

    await act(async () => {
      pending.reject(new Error('disk full'));
    });

    expect(hasText(renderer, 'export.preparingCsv')).toBe(false);
    expect(hasText(renderer, 'export.failed')).toBe(true);

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a second export press is ignored while one is running', async () => {
    const renderer = await renderWithData();
    const pending = deferred<void>();
    mockDeliverText.mockReturnValue(pending.promise);

    await act(async () => {
      pressExport(renderer, 'CSV');
    });
    await act(async () => {
      pressExport(renderer, 'CSV');
    });

    expect(mockDeliverText).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
    });

    await act(async () => {
      renderer.unmount();
    });
  });
});
