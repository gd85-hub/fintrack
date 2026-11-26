import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { StyleSheet, TextInput, type ViewStyle } from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import { Button, type ButtonColors } from '../../components/ds/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CategoryPicker } from '../../components/CategoryPicker';
import type { Category, Expense, Merchant } from '../db';
import { theme } from '../theme';

// The expense editor lives behind Supabase auth, so it cannot be opened in a
// browser without the owner's credentials. These tests drive the real screen
// with its data layer mocked, so no expense is ever created, changed or
// deleted, and cover what the browser would have shown: which state the save
// button is in, that a save never starts twice, and that delete and the
// error-screen back button are wired as before.

const mockPalette: ButtonColors = theme.color;
const mockBack = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockInsertExpense = jest.fn<(input: unknown) => Promise<void>>();
const mockUpdateExpense = jest.fn<(id: string, input: unknown) => Promise<void>>();
const mockDeleteExpense = jest.fn<(id: string) => Promise<void>>();
const mockGetExpense = jest.fn<(id: string) => Promise<Expense | null>>();
const mockListCategories = jest.fn<() => Promise<Category[]>>();
const mockListMerchants = jest.fn<() => Promise<Merchant[]>>();

// Controllable focus lifecycle. useFocusEffect stores the latest callback; a
// test drives focus/blur so a single mounted screen can be revisited, which is
// how Expo Router keeps expense/new alive between visits. Left untriggered it
// behaves like the previous no-op, so existing tests are unaffected.
type FocusCallback = () => void | (() => void);
const mockFocusState: {
  callback: FocusCallback | null;
  cleanup: void | (() => void);
} = { callback: null, cleanup: undefined };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useFocusEffect: (callback: FocusCallback) => {
    mockFocusState.callback = callback;
  },
}));

jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, locale: 'en' }),
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => mockPalette,
}));

jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ error: mockToastError, success: mockToastSuccess }),
}));

const mockUser = { id: 'user-1' };
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockHomeCurrency = { value: 'RSD' };
jest.mock('../../contexts/HomeCurrencyContext', () => ({
  useHomeCurrency: () => ({
    homeCurrency: mockHomeCurrency.value,
    loading: false,
    setHomeCurrency: () => {},
  }),
}));

const mockReadLastManualCurrency =
  jest.fn<(accountId: string | null) => Promise<string | null>>();
const mockRememberLastManualCurrency =
  jest.fn<(accountId: string | null, currency: string) => Promise<void>>();
jest.mock('../lastCurrency', () => ({
  readLastManualCurrency: (accountId: string | null) =>
    mockReadLastManualCurrency(accountId),
  rememberLastManualCurrency: (accountId: string | null, currency: string) =>
    mockRememberLastManualCurrency(accountId, currency),
}));

jest.mock('../../lib/db', () => ({
  deleteExpense: (id: string) => mockDeleteExpense(id),
  getExpense: (id: string) => mockGetExpense(id),
  insertExpense: (input: unknown) => mockInsertExpense(input),
  listCategories: () => mockListCategories(),
  listMerchants: () => mockListMerchants(),
  updateExpense: (id: string, input: unknown) => mockUpdateExpense(id, input),
}));

// The conversion preview is a side panel of its own; it must not reach the
// network while the button states are under test.
jest.mock('../../lib/fx', () => ({
  RateUnavailableError: class RateUnavailableError extends Error {},
  // Never settles: the preview must not race the assertions or update
  // state after a test has finished.
  ratesForExpense: () => new Promise(() => {}),
}));

jest.mock('../../lib/anchorRates', () => ({
  AnchorRateUnavailableError: class AnchorRateUnavailableError extends Error {},
  anchorRateForExpense: () => new Promise(() => {}),
}));

// Pickers and chrome are other components' business; they render nothing here
// except CategoryPicker, whose onChange the tests need to make a form valid.
jest.mock('../../components/MerchantPicker', () => ({
  MerchantPicker: () => null,
}));
jest.mock('../../components/DatePicker', () => ({ DatePicker: () => null }));
jest.mock('../../components/ReceiptCurrencySelector', () => ({
  ReceiptCurrencySelector: () => null,
}));
jest.mock('../../components/LoadingScreen', () => ({
  LoadingScreen: () => null,
}));
jest.mock('../../components/CategoryPicker', () => ({
  CategoryPicker: () => null,
}));
jest.mock('../../components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

// Imported after the mocks so the screen picks them up.
import { ExpenseEditorScreen } from '../../components/ExpenseEditorScreen';
import { ReceiptCurrencySelector } from '../../components/ReceiptCurrencySelector';

type DsButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  size?: string;
  variant?: string;
};

const CATEGORY: Category = {
  id: 'category-1',
  name: 'Food',
  slug: 'food',
  color: '#000000',
  icon: null,
  group: null,
  userId: 'user-1',
} as unknown as Category;

const EXPENSE: Expense = {
  id: 'expense-1',
  originalAmountCents: 1500,
  originalCurrency: 'EUR',
  amountRsdCents: 0,
  categoryId: 'category-1',
  merchantId: null,
  occurredOn: '2026-11-10',
  description: 'lunch',
  note: '',
} as unknown as Expense;

async function renderEditor(expenseId?: string) {
  let tree: ReturnType<typeof create> | undefined;
  await act(async () => {
    tree = create(<ExpenseEditorScreen expenseId={expenseId} />);
  });
  if (!tree) {
    throw new Error('Expense editor did not render');
  }
  return tree;
}

// Re-enters the screen the way Expo Router does: runs the previous focus's
// cleanup, then the focus callback, and flushes the async currency resolution.
async function focusScreen() {
  await act(async () => {
    if (typeof mockFocusState.cleanup === 'function') {
      mockFocusState.cleanup();
    }
    mockFocusState.cleanup = mockFocusState.callback?.();
  });
}

async function blurScreen() {
  await act(async () => {
    if (typeof mockFocusState.cleanup === 'function') {
      mockFocusState.cleanup();
    }
    mockFocusState.cleanup = undefined;
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function buttons(root: ReactTestInstance): DsButtonProps[] {
  return root.findAllByType(Button).map((node) => node.props as DsButtonProps);
}

function instanceByLabel(root: ReactTestInstance, label: string) {
  const found = root
    .findAllByType(Button)
    .find((node) => (node.props as DsButtonProps).label === label);
  if (!found) {
    throw new Error(`No DS button labelled ${label}`);
  }
  return found;
}

function byLabel(root: ReactTestInstance, label: string): DsButtonProps {
  return instanceByLabel(root, label).props as DsButtonProps;
}

// Presses through the component, not through its onPress prop: the guard
// that refuses a second save while one is running lives inside Button.
function press(root: ReactTestInstance, label: string) {
  const pressable = instanceByLabel(root, label).find(
    (candidate) =>
      typeof candidate.type !== 'string' &&
      candidate.props.accessibilityRole === 'button' &&
      typeof candidate.props.onPress === 'function',
  );
  act(() => {
    pressable.props.onPress();
  });
}

function typeAmount(root: ReactTestInstance, value: string) {
  act(() => {
    root.findAllByType(TextInput)[0].props.onChangeText(value);
  });
}

function pickCategory(root: ReactTestInstance, id: string) {
  act(() => {
    root.findByType(CategoryPicker).props.onChange(id);
  });
}

beforeEach(() => {
  mockBack.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockInsertExpense.mockReset();
  mockInsertExpense.mockResolvedValue(undefined);
  mockUpdateExpense.mockReset();
  mockUpdateExpense.mockResolvedValue(undefined);
  mockDeleteExpense.mockReset();
  mockDeleteExpense.mockResolvedValue(undefined);
  mockGetExpense.mockReset();
  mockGetExpense.mockResolvedValue(EXPENSE);
  mockListCategories.mockReset();
  mockListCategories.mockResolvedValue([CATEGORY]);
  mockListMerchants.mockReset();
  mockListMerchants.mockResolvedValue([]);
  mockHomeCurrency.value = 'RSD';
  mockReadLastManualCurrency.mockReset();
  mockReadLastManualCurrency.mockResolvedValue(null);
  mockRememberLastManualCurrency.mockReset();
  mockRememberLastManualCurrency.mockResolvedValue(undefined);
  mockFocusState.callback = null;
  mockFocusState.cleanup = undefined;
});

describe('Expense editor buttons', () => {
  test('save is the DS primary button, full width', async () => {
    const tree = await renderEditor();
    const save = byLabel(tree.root, 'common.save');
    expect({
      variant: save.variant,
      size: save.size,
      fullWidth: save.fullWidth,
    }).toEqual({ variant: 'primary', size: 'medium', fullWidth: true });
  });

  test('an incomplete form disables save rather than busying it', async () => {
    // A new expense opens with no amount and no category.
    const tree = await renderEditor();
    const save = byLabel(tree.root, 'common.save');
    expect({ disabled: save.disabled, loading: save.loading }).toEqual({
      disabled: true,
      loading: false,
    });
  });

  test('an amount without a category is still incomplete', async () => {
    const tree = await renderEditor();
    typeAmount(tree.root, '12,50');
    expect(byLabel(tree.root, 'common.save').disabled).toBe(true);
  });

  test('an amount of zero is not a valid amount', async () => {
    const tree = await renderEditor();
    typeAmount(tree.root, '0');
    pickCategory(tree.root, CATEGORY.id);
    expect(byLabel(tree.root, 'common.save').disabled).toBe(true);
  });

  test('a complete form enables save', async () => {
    const tree = await renderEditor();
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);
    const save = byLabel(tree.root, 'common.save');
    expect({ disabled: save.disabled, loading: save.loading }).toEqual({
      disabled: false,
      loading: false,
    });
  });

  test('saving is loading, not disabled, and cannot start twice', async () => {
    let release: () => void = () => {};
    mockInsertExpense.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(undefined);
      }),
    );

    const tree = await renderEditor();
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);
    press(tree.root, 'common.save');

    const saving = byLabel(tree.root, 'common.save');
    expect({ disabled: saving.disabled, loading: saving.loading }).toEqual({
      disabled: false,
      loading: true,
    });
    expect(saving.accessibilityLabel).toBe('common.saving');

    press(tree.root, 'common.save');
    press(tree.root, 'common.save');
    expect(mockInsertExpense).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('toast.expenseSaved');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('a failed save raises the toast and hands the button back', async () => {
    mockInsertExpense.mockRejectedValue(new Error('network down'));

    const tree = await renderEditor();
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);
    await act(async () => {
      press(tree.root, 'common.save');
    });

    expect(mockToastError).toHaveBeenCalledWith('editor.saveFailed');
    expect(mockBack).not.toHaveBeenCalled();
    const after = byLabel(tree.root, 'common.save');
    expect({ disabled: after.disabled, loading: after.loading }).toEqual({
      disabled: false,
      loading: false,
    });
    expect(after.accessibilityLabel).toBe('common.save');
  });

  test('creating an expense offers no delete', async () => {
    const tree = await renderEditor();
    expect(
      buttons(tree.root).some((button) => button.label === 'common.delete'),
    ).toBe(false);
  });

  test('editing offers delete, which only opens the confirm dialog', async () => {
    const tree = await renderEditor('expense-1');
    const remove = byLabel(tree.root, 'common.delete');
    expect({
      variant: remove.variant,
      size: remove.size,
      fullWidth: remove.fullWidth,
    }).toEqual({ variant: 'danger', size: 'medium', fullWidth: true });

    expect(tree.root.findByType(ConfirmDialog).props.visible).toBe(false);
    press(tree.root, 'common.delete');
    expect(tree.root.findByType(ConfirmDialog).props.visible).toBe(true);
    // Opening the dialog deletes nothing by itself.
    expect(mockDeleteExpense).not.toHaveBeenCalled();
  });

  test('editing starts valid, so save is enabled straight away', async () => {
    const tree = await renderEditor('expense-1');
    expect(byLabel(tree.root, 'common.save').disabled).toBe(false);
  });

  test('the load error offers a surface back button that goes back', async () => {
    mockListCategories.mockRejectedValue(new Error('offline'));

    const tree = await renderEditor();
    const back = byLabel(tree.root, 'common.back');
    expect({
      variant: back.variant,
      size: back.size,
      fullWidth: back.fullWidth,
    }).toEqual({
      variant: 'surface',
      size: 'medium',
      // Hug, not full width.
      fullWidth: undefined,
    });

    // Button sets alignSelf itself, which beats the container's alignItems,
    // so a row with justifyContent is what keeps it centred.
    const wrapper = tree.root.findAllByType(Button)[0].parent;
    const wrapperStyle = StyleSheet.flatten(wrapper?.props.style as ViewStyle);
    expect({
      flexDirection: wrapperStyle.flexDirection,
      justifyContent: wrapperStyle.justifyContent,
    }).toEqual({ flexDirection: 'row', justifyContent: 'center' });

    press(tree.root, 'common.back');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

function currencyValue(root: ReactTestInstance): string {
  return root.findByType(ReceiptCurrencySelector).props.value as string;
}

function changeCurrency(root: ReactTestInstance, code: string) {
  act(() => {
    root.findByType(ReceiptCurrencySelector).props.onChange(code);
  });
}

describe('Expense editor remembered currency', () => {
  test('a new expense without a remembered currency opens in the home currency', async () => {
    mockHomeCurrency.value = 'EUR';
    mockReadLastManualCurrency.mockResolvedValue(null);

    const tree = await renderEditor();

    expect(currencyValue(tree.root)).toBe('EUR');
    expect(mockReadLastManualCurrency).toHaveBeenCalledWith('user-1');
  });

  test('a new expense restores a remembered currency over the home currency', async () => {
    mockHomeCurrency.value = 'RSD';
    mockReadLastManualCurrency.mockResolvedValue('EUR');

    const tree = await renderEditor();

    expect(currencyValue(tree.root)).toBe('EUR');
  });

  test('a new expense restores a remembered custom currency', async () => {
    mockHomeCurrency.value = 'RSD';
    mockReadLastManualCurrency.mockResolvedValue('THB');

    const tree = await renderEditor();

    expect(currencyValue(tree.root)).toBe('THB');
  });

  test('a successful creation remembers the saved currency', async () => {
    const tree = await renderEditor();
    changeCurrency(tree.root, 'EUR');
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);
    await act(async () => {
      press(tree.root, 'common.save');
    });

    expect(mockInsertExpense).toHaveBeenCalledTimes(1);
    expect(mockRememberLastManualCurrency).toHaveBeenCalledWith(
      'user-1',
      'EUR',
    );
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('a failed creation does not remember the currency', async () => {
    mockInsertExpense.mockRejectedValue(new Error('network down'));

    const tree = await renderEditor();
    changeCurrency(tree.root, 'EUR');
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);
    await act(async () => {
      press(tree.root, 'common.save');
    });

    expect(mockRememberLastManualCurrency).not.toHaveBeenCalled();
  });

  test('leaving the form without saving does not remember the currency', async () => {
    const tree = await renderEditor();
    changeCurrency(tree.root, 'EUR');
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);

    expect(mockRememberLastManualCurrency).not.toHaveBeenCalled();
  });

  test('editing an expense opens in its original currency and reads no preference', async () => {
    const tree = await renderEditor('expense-1');

    // EXPENSE.originalCurrency is EUR.
    expect(currencyValue(tree.root)).toBe('EUR');
    expect(mockReadLastManualCurrency).not.toHaveBeenCalled();
  });

  test('a successful edit does not remember the currency', async () => {
    const tree = await renderEditor('expense-1');
    await act(async () => {
      press(tree.root, 'common.save');
    });

    expect(mockUpdateExpense).toHaveBeenCalledTimes(1);
    expect(mockRememberLastManualCurrency).not.toHaveBeenCalled();
  });
});

// These keep one mounted screen alive across focus/blur, the way Expo Router
// keeps expense/new mounted between visits. A new instance per visit would hide
// the stale-currency regression entirely.
describe('Expense editor remembered currency across refocus', () => {
  test('reopening after a save in a new currency uses that currency, not the stale one', async () => {
    mockHomeCurrency.value = 'EUR';
    mockReadLastManualCurrency.mockResolvedValue(null);

    const tree = await renderEditor();
    expect(currencyValue(tree.root)).toBe('EUR');

    changeCurrency(tree.root, 'USD');
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);
    await act(async () => {
      press(tree.root, 'common.save');
    });
    expect(mockInsertExpense).toHaveBeenCalledTimes(1);

    // Reopen the same mounted screen.
    await blurScreen();
    await focusScreen();

    expect(currencyValue(tree.root)).toBe('USD');
  });

  test('an unsaved currency change is discarded on refocus, keeping the last saved one', async () => {
    mockHomeCurrency.value = 'RSD';
    mockReadLastManualCurrency.mockResolvedValue('EUR');

    const tree = await renderEditor();
    expect(currencyValue(tree.root)).toBe('EUR');

    changeCurrency(tree.root, 'USD');
    await blurScreen();
    await focusScreen();

    expect(currencyValue(tree.root)).toBe('EUR');
  });

  test('a stale pending read cannot override a newer focus session', async () => {
    mockHomeCurrency.value = 'RSD';
    const pending = deferred<string | null>();
    // The first focus session's read never resolves until later.
    mockReadLastManualCurrency.mockReturnValueOnce(pending.promise);

    const tree = await renderEditor();

    // A newer focus resolves to USD.
    mockReadLastManualCurrency.mockResolvedValue('USD');
    await focusScreen();
    expect(currencyValue(tree.root)).toBe('USD');

    // The superseded read now resolves to EUR; it must not win.
    await act(async () => {
      pending.resolve('EUR');
    });
    expect(currencyValue(tree.root)).toBe('USD');
  });

  test('an immediate reopen while the write is pending still restores the saved currency', async () => {
    mockHomeCurrency.value = 'EUR';
    mockReadLastManualCurrency.mockResolvedValue(null);
    // Persistence never settles, standing in for a slow or failing write.
    mockRememberLastManualCurrency.mockReturnValue(new Promise(() => {}));

    const tree = await renderEditor();
    changeCurrency(tree.root, 'USD');
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);
    await act(async () => {
      press(tree.root, 'common.save');
    });

    // Creation completes even though the write has not settled.
    expect(mockInsertExpense).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);

    await focusScreen();
    expect(currencyValue(tree.root)).toBe('USD');
  });

  test('a pending storage write never blocks creating the expense', async () => {
    mockReadLastManualCurrency.mockResolvedValue(null);
    mockRememberLastManualCurrency.mockReturnValue(new Promise(() => {}));

    const tree = await renderEditor();
    typeAmount(tree.root, '12,50');
    pickCategory(tree.root, CATEGORY.id);
    await act(async () => {
      press(tree.root, 'common.save');
    });

    expect(mockInsertExpense).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('toast.expenseSaved');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('editing keeps the original currency across refocus and reads no preference', async () => {
    const tree = await renderEditor('expense-1');
    expect(currencyValue(tree.root)).toBe('EUR');

    await blurScreen();
    await focusScreen();

    expect(currencyValue(tree.root)).toBe('EUR');
    expect(mockReadLastManualCurrency).not.toHaveBeenCalled();
  });
});
