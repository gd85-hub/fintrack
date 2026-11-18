import { describe, expect, test } from '@jest/globals';

import {
  buttonSizeSpec,
  buttonSurface,
  isButtonPressable,
} from '../../components/ds/Button';
import { theme } from '../theme';

// Asserts the Figma Button spec (Components page, frame 591:1212) against the
// tokens it must bind, not against raw hex values.
const colors = theme.color;

describe('buttonSizeSpec', () => {
  test('medium binds the DS medium height, corner and padding', () => {
    expect(buttonSizeSpec('medium')).toMatchObject({
      height: theme.scale.size.buttonHeight,
      radius: theme.scale.radius.md,
      paddingHorizontal: theme.scale.space[5],
      minWidth: theme.scale.size.controlMinWidth,
      gap: theme.scale.space[2],
    });
    expect(buttonSizeSpec('medium').typography.fontSize).toBe(14);
  });

  test('large binds the DS large height, corner and padding', () => {
    expect(buttonSizeSpec('large')).toMatchObject({
      height: theme.scale.size.controlLg,
      radius: theme.scale.radius.buttonLg,
      paddingHorizontal: theme.scale.space[6],
      minWidth: theme.scale.size.controlMinWidth,
      gap: theme.scale.space[2],
    });
    expect(buttonSizeSpec('large').typography.fontSize).toBe(16);
  });
});

describe('buttonSurface', () => {
  test('primary walks fill -> hover -> pressed and has no border', () => {
    expect(buttonSurface(colors, 'primary')).toEqual({
      background: colors.action.primary.fill,
      border: null,
      content: colors.action.primary.content,
    });
    expect(buttonSurface(colors, 'primary', { hovered: true }).background).toBe(
      colors.action.primary.hover,
    );
    expect(buttonSurface(colors, 'primary', { pressed: true }).background).toBe(
      colors.action.primary.pressed,
    );
  });

  test('pressed wins over hovered', () => {
    expect(
      buttonSurface(colors, 'primary', { hovered: true, pressed: true })
        .background,
    ).toBe(colors.action.primary.pressed);
  });

  test('disabled wins over every interaction state', () => {
    expect(
      buttonSurface(colors, 'primary', {
        disabled: true,
        hovered: true,
        pressed: true,
      }),
    ).toEqual({
      background: colors.action.primary.disabled,
      border: null,
      content: colors.action.primary.disabledContent,
    });
  });

  test('outline is the only variant with a resting border', () => {
    expect(buttonSurface(colors, 'outline')).toEqual({
      background: colors.surface.default,
      border: colors.border.default,
      content: colors.action.secondary.content,
    });
    expect(buttonSurface(colors, 'surface').border).toBeNull();
    expect(buttonSurface(colors, 'ghost').border).toBeNull();
    expect(buttonSurface(colors, 'danger').border).toBeNull();
  });

  test('ghost rests transparent and tints with the state overlays', () => {
    expect(buttonSurface(colors, 'ghost').background).toBe('transparent');
    expect(buttonSurface(colors, 'ghost', { hovered: true }).background).toBe(
      colors.state.hover,
    );
    expect(buttonSurface(colors, 'ghost', { pressed: true }).background).toBe(
      colors.state.pressed,
    );
    // Disabled ghost stays fill-less: only the label dims.
    expect(buttonSurface(colors, 'ghost', { disabled: true })).toEqual({
      background: 'transparent',
      border: null,
      content: colors.action.secondary.disabledContent,
    });
  });

  test('surface and danger bind their own action tokens', () => {
    expect(buttonSurface(colors, 'surface')).toEqual({
      background: colors.action.secondary.fill,
      border: null,
      content: colors.action.secondary.content,
    });
    expect(buttonSurface(colors, 'danger')).toEqual({
      background: colors.action.destructive.fill,
      border: null,
      content: colors.action.destructive.content,
    });
  });
});

describe('isButtonPressable', () => {
  test('a resting button is pressable', () => {
    expect(isButtonPressable({})).toBe(true);
  });

  test('loading blocks repeated presses', () => {
    expect(isButtonPressable({ loading: true })).toBe(false);
  });

  test('disabled blocks presses', () => {
    expect(isButtonPressable({ disabled: true })).toBe(false);
  });
});
