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

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useFocusEffect: () => {},
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
