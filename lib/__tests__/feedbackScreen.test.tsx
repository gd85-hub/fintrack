import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { StyleSheet, TextInput, type ViewStyle } from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import { Button, type ButtonColors } from '../../components/ds/Button';
import { darkColor, theme } from '../theme';

// The feedback screen lives behind Supabase auth, so it cannot be opened in a
// browser without the owner's credentials. These tests drive the real screen
// with its data layer mocked, which covers what the browser would have shown:
// which state the submit button is in, and that sending never starts twice.

let mockPalette: ButtonColors = theme.color;
const mockBack = jest.fn();
const mockToastError = jest.fn();
const mockSubmitFeedback =
  jest.fn<(message: string) => Promise<{ error: Error | null }>>();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, locale: 'en' }),
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => mockPalette,
}));

jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ error: mockToastError }),
}));

jest.mock('../../components/ScreenHeader', () => ({
  ScreenHeader: () => null,
}));

jest.mock('../../lib/db/feedback', () => ({
  submitFeedback: (message: string) => mockSubmitFeedback(message),
}));

// Imported after the mocks so the screen picks them up.
import FeedbackScreen from '../../app/(app)/feedback';

type SubmitButtonProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  fullWidth?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  size?: string;
  variant?: string;
};

function renderScreen() {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(<FeedbackScreen />);
  });
  if (!tree) {
    throw new Error('Feedback screen did not render');
  }
  return tree;
}

function buttons(root: ReactTestInstance): SubmitButtonProps[] {
  return root.findAllByType(Button).map((node) => node.props as SubmitButtonProps);
}

function type(root: ReactTestInstance, value: string) {
  act(() => {
    root.findByType(TextInput).props.onChangeText(value);
  });
}

beforeEach(() => {
  mockPalette = theme.color;
  mockBack.mockReset();
  mockToastError.mockReset();
  mockSubmitFeedback.mockReset();
  mockSubmitFeedback.mockResolvedValue({ error: null });
});

describe('Feedback screen buttons', () => {
  test('submit is the DS primary button, full width', () => {
    for (const palette of [theme.color, darkColor]) {
      mockPalette = palette;
      const tree = renderScreen();
      const [submit] = buttons(tree.root);
      expect({
        variant: submit.variant,
        size: submit.size,
        fullWidth: submit.fullWidth,
        label: submit.label,
      }).toEqual({
        variant: 'primary',
        size: 'medium',
        fullWidth: true,
        label: 'settings.feedback.submit',
      });
      act(() => {
        tree.unmount();
      });
    }
  });

  test('an empty message disables the button rather than busying it', () => {
    const [submit] = buttons(renderScreen().root);
    expect({ disabled: submit.disabled, loading: submit.loading }).toEqual({
      disabled: true,
      loading: false,
    });
  });

  test('a message of spaces is still nothing to send', () => {
    const tree = renderScreen();
    type(tree.root, '   \n\t  ');
    const [submit] = buttons(tree.root);
    expect({ disabled: submit.disabled, loading: submit.loading }).toEqual({
      disabled: true,
      loading: false,
    });
  });

  test('a real message enables the button', () => {
    const tree = renderScreen();
    type(tree.root, 'the receipt scanner missed a line');
    const [submit] = buttons(tree.root);
    expect({ disabled: submit.disabled, loading: submit.loading }).toEqual({
      disabled: false,
      loading: false,
    });
  });

  test('sending is loading, not disabled, and cannot start twice', async () => {
    // Hold the request open so the in-flight state can be read.
    let release: (value: { error: Error | null }) => void = () => {};
    mockSubmitFeedback.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const tree = renderScreen();
    type(tree.root, 'a real message');
    act(() => {
      buttons(tree.root)[0].onPress();
    });

    const sending = buttons(tree.root)[0];
    expect({ disabled: sending.disabled, loading: sending.loading }).toEqual({
      disabled: false,
      loading: true,
    });
    expect(sending.accessibilityLabel).toBe('settings.feedback.submitting');

    // The screen's own guard refuses a second send even if the press ever
    // got through the component.
    act(() => {
      buttons(tree.root)[0].onPress();
      buttons(tree.root)[0].onPress();
    });
    expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);

    await act(async () => {
      release({ error: null });
    });
  });

  test('a failed send shows the toast and hands the button back', async () => {
    mockSubmitFeedback.mockResolvedValue({ error: new Error('network down') });

    const tree = renderScreen();
    type(tree.root, 'a real message');
    await act(async () => {
      buttons(tree.root)[0].onPress();
    });

    expect(mockToastError).toHaveBeenCalledWith('settings.feedback.error');
    const after = buttons(tree.root)[0];
    expect({ disabled: after.disabled, loading: after.loading }).toEqual({
      disabled: false,
      loading: false,
    });
    expect(after.accessibilityLabel).toBe('settings.feedback.submit');
    // Still the form, not the confirmation.
    expect(after.label).toBe('settings.feedback.submit');
  });

  test('a successful send swaps the form for the confirmation and its Done button', async () => {
    const tree = renderScreen();
    type(tree.root, 'a real message');
    await act(async () => {
      buttons(tree.root)[0].onPress();
    });

    const [done] = buttons(tree.root);
    expect({
      label: done.label,
      variant: done.variant,
      size: done.size,
      fullWidth: done.fullWidth,
    }).toEqual({
      label: 'settings.feedback.done',
      variant: 'primary',
      size: 'medium',
      // Done hugs its label; only submit spans the form.
      fullWidth: undefined,
    });
    expect(mockToastError).not.toHaveBeenCalled();

    // Done stayed in the middle of the card. Button sets alignSelf itself,
    // which beats the card's alignItems, so a row with justifyContent is
    // what keeps it centred.
    const wrapper = tree.root.findAllByType(Button)[0].parent;
    const wrapperStyle = StyleSheet.flatten(wrapper?.props.style as ViewStyle);
    expect({
      flexDirection: wrapperStyle.flexDirection,
      justifyContent: wrapperStyle.justifyContent,
    }).toEqual({ flexDirection: 'row', justifyContent: 'center' });

    act(() => {
      done.onPress();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
