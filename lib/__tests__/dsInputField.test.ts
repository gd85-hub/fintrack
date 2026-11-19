import { describe, expect, test } from '@jest/globals';

import {
  type InputFieldAppearance,
  type InputFieldColors,
  inputFieldContentHeight,
  inputFieldLabelFloats,
  inputFieldMetrics,
  inputFieldShowsPlaceholder,
  inputFieldState,
  inputFieldSurface,
} from '../../components/ds/InputField';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

// Asserts the Figma Input Field spec (set 596:1014) against the tokens it
// must bind, not against raw hex values.
const appearances: InputFieldAppearance[] = ['softFilled', 'cleanOutline'];

const themes: [string, InputFieldColors][] = [
  ['light', theme.color],
  ['dark', darkColor],
];

// The published palettes give several semantically different field tokens the
// same hex in light, so the labelled palette is the run that can fail on a
// misbinding.
const palettes: [string, InputFieldColors][] = [
  ...themes,
  ['labelled', labelledPalette()],
];

describe('inputFieldMetrics', () => {
  test('the field is 56 tall with a 16 corner', () => {
    expect(inputFieldMetrics.height).toBe(56);
    expect(inputFieldMetrics.radius).toBe(16);
    expect(inputFieldMetrics.height).toBe(theme.scale.size.controlLg);
    expect(inputFieldMetrics.radius).toBe(theme.scale.radius.md);
  });

  test('the border is 1 and thickens to 2 on focus', () => {
    expect(inputFieldMetrics.borderWidth).toBe(1);
    expect(inputFieldMetrics.focusBorderWidth).toBe(2);
  });

  test('padding is 16 left, 12 right, 8 top and bottom', () => {
    expect(inputFieldMetrics.paddingLeft).toBe(16);
    expect(inputFieldMetrics.paddingRight).toBe(12);
    expect(inputFieldMetrics.paddingVertical).toBe(8);
  });

  test('icons are 20 with a 2 stroke and a 12 gap to the text', () => {
    expect(inputFieldMetrics.iconSize).toBe(20);
    expect(inputFieldMetrics.iconStrokeWidth).toBe(2);
    expect(inputFieldMetrics.iconGap).toBe(12);
  });

  test('the floating text block is 14 + 4 + 22 = 40', () => {
    expect(inputFieldMetrics.floatingLabelHeight).toBe(14);
    expect(inputFieldMetrics.labelGap).toBe(4);
    expect(inputFieldMetrics.valueHeight).toBe(22);
    expect(inputFieldContentHeight).toBe(40);
  });

  test('the content block plus its padding is exactly the field height', () => {
    // This is what keeps the field 56 tall whatever the border does.
    expect(
      inputFieldContentHeight + inputFieldMetrics.paddingVertical * 2,
    ).toBe(inputFieldMetrics.height);
  });

  test('supporting text is one 18px line, 8 under a hint and 4 under an error', () => {
    expect(inputFieldMetrics.supportingHeight).toBe(18);
    expect(inputFieldMetrics.hintGap).toBe(8);
    expect(inputFieldMetrics.errorGap).toBe(4);
  });

  test('the resting label is the 16/22 style and the floating one 12/14', () => {
    expect(theme.type.labelLarge).toEqual({
      fontFamily: 'Inter_500Medium',
      fontSize: 16,
      letterSpacing: 0,
      lineHeight: 22,
    });
    expect(theme.type.inputFloatingLabel).toEqual({
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 14,
    });
  });
});

describe('inputFieldState', () => {
  test('nothing set is the resting state', () => {
    expect(inputFieldState()).toBe('default');
    expect(inputFieldState({})).toBe('default');
  });

  test('each state on its own resolves to itself', () => {
    expect(inputFieldState({ hovered: true })).toBe('hover');
    expect(inputFieldState({ focused: true })).toBe('focus');
    expect(inputFieldState({ error: true })).toBe('error');
    expect(inputFieldState({ readOnly: true })).toBe('readOnly');
    expect(inputFieldState({ disabled: true })).toBe('disabled');
  });

  test('the most restrictive state wins', () => {
    // Disabled > Read-only > Error > Focus > Hover > Default.
    const everything = {
      disabled: true,
      error: true,
      focused: true,
      hovered: true,
      readOnly: true,
    };
    expect(inputFieldState(everything)).toBe('disabled');
    expect(inputFieldState({ ...everything, disabled: false })).toBe('readOnly');
    expect(
      inputFieldState({ ...everything, disabled: false, readOnly: false }),
    ).toBe('error');
    expect(
      inputFieldState({ error: true, focused: true, hovered: true }),
    ).toBe('error');
    expect(inputFieldState({ focused: true, hovered: true })).toBe('focus');
  });
});

describe('inputFieldSurface', () => {
  test('soft filled rests on its own fill and border', () => {
    for (const [scheme, palette] of palettes) {
      const surface = inputFieldSurface(palette, 'softFilled');
      expect({ scheme, ...surface }).toEqual({
        scheme,
        background: palette.field.softFill,
        border: palette.field.softBorder,
        borderWidth: 1,
        overlay: null,
        label: palette.text.secondary,
        content: palette.text.primary,
        placeholder: palette.field.softPlaceholder,
        icon: palette.field.placeholder,
      });
    }
  });

  test('clean outline rests on the outline pair instead', () => {
    for (const [scheme, palette] of palettes) {
      const surface = inputFieldSurface(palette, 'cleanOutline');
      expect({ scheme, background: surface.background, border: surface.border }).toEqual({
        scheme,
        background: palette.field.outlineFill,
        border: palette.field.outlineBorder,
      });
    }
  });

  test('hover tints through an overlay and never swaps the fill', () => {
    // The overlay is painted over the resting fill, so a hovered field is
    // still recognisably its own appearance.
    for (const [scheme, palette] of palettes) {
      for (const appearance of appearances) {
        const resting = inputFieldSurface(palette, appearance);
        const hovered = inputFieldSurface(palette, appearance, { hovered: true });
        expect({ scheme, appearance, background: hovered.background }).toEqual({
          scheme,
          appearance,
          background: resting.background,
        });
        expect(hovered.overlay).toBe(palette.field.hoverOverlay);
      }
    }
  });

  test('only clean outline changes its border on hover', () => {
    for (const [, palette] of palettes) {
      expect(inputFieldSurface(palette, 'softFilled', { hovered: true }).border).toBe(
        palette.field.softBorder,
      );
      expect(
        inputFieldSurface(palette, 'cleanOutline', { hovered: true }).border,
      ).toBe(palette.field.outlineBorderHover);
    }
  });

  test('focus draws a 2px border in the focus token', () => {
    for (const [scheme, palette] of palettes) {
      for (const appearance of appearances) {
        const focused = inputFieldSurface(palette, appearance, { focused: true });
        expect({ scheme, appearance, border: focused.border, width: focused.borderWidth }).toEqual({
          scheme,
          appearance,
          border: palette.field.softFocusBorder,
          width: 2,
        });
      }
    }
  });

  test('error draws the error token and keeps it when focused', () => {
    for (const [scheme, palette] of palettes) {
      for (const appearance of appearances) {
        const errored = inputFieldSurface(palette, appearance, { error: true });
        expect({ scheme, appearance, border: errored.border, width: errored.borderWidth }).toEqual({
          scheme,
          appearance,
          border: palette.field.softErrorBorder,
          width: 1,
        });

        // Error wins the colour, focus still wins the thickness.
        const both = inputFieldSurface(palette, appearance, {
          error: true,
          focused: true,
        });
        expect({ border: both.border, width: both.borderWidth }).toEqual({
          border: palette.field.softErrorBorder,
          width: 2,
        });
      }
    }
  });

  test('read-only keeps a border and reads in its own content colour', () => {
    for (const [scheme, palette] of palettes) {
      for (const appearance of appearances) {
        const surface = inputFieldSurface(palette, appearance, { readOnly: true });
        expect({
          scheme,
          appearance,
          background: surface.background,
          content: surface.content,
          label: surface.label,
          border: surface.border,
        }).toEqual({
          scheme,
          appearance,
          background: palette.field.subtleReadOnlyFill,
          content: palette.field.readOnlyContent,
          // The label stays secondary; only disabled recolours it.
          label: palette.text.secondary,
          border:
            appearance === 'softFilled'
              ? palette.field.softBorder
              : palette.field.outlineBorder,
        });
      }
    }
  });

  test('disabled recolours the label too, unlike every other state', () => {
    for (const [scheme, palette] of palettes) {
      for (const appearance of appearances) {
        const surface = inputFieldSurface(palette, appearance, { disabled: true });
        expect({ scheme, appearance, ...surface }).toEqual({
          scheme,
          appearance,
          background: palette.field.subtleDisabledFill,
          border:
            appearance === 'softFilled'
              ? palette.field.softBorder
              : palette.field.outlineBorder,
          borderWidth: 1,
          overlay: null,
          label: palette.field.disabledContent,
          content: palette.field.disabledContent,
          placeholder: palette.field.disabledContent,
          icon: palette.field.disabledContent,
        });
      }
    }
  });

  test('icons bind the legacy placeholder token, not the new soft one', () => {
    // Figma: the icon vectors kept field/placeholder when the soft family
    // was introduced. The two share a hex in light and differ in dark.
    const palette = labelledPalette();
    for (const appearance of appearances) {
      for (const state of [{}, { hovered: true }, { focused: true }, { error: true }, { readOnly: true }]) {
        expect(inputFieldSurface(palette, appearance, state).icon).toBe(
          palette.field.placeholder,
        );
      }
    }
    expect(palette.field.placeholder).not.toBe(palette.field.softPlaceholder);
  });

  test('the placeholder follows the state, never the plain value colour', () => {
    const palette = labelledPalette();
    expect(inputFieldSurface(palette, 'softFilled').placeholder).toBe(
      palette.field.softPlaceholder,
    );
    expect(
      inputFieldSurface(palette, 'softFilled', { readOnly: true }).placeholder,
    ).toBe(palette.field.readOnlyContent);
    expect(
      inputFieldSurface(palette, 'softFilled', { disabled: true }).placeholder,
    ).toBe(palette.field.disabledContent);
  });

  test('the dark family is softer than the legacy one it replaces', () => {
    // The whole reason the soft tokens exist: in dark they are barely-there
    // white overlays where the legacy field tokens are opaque greys.
    expect(darkColor.field.softFill).toBe('#ffffff0a');
    expect(darkColor.field.softFill).not.toBe(darkColor.field.fill);
    expect(darkColor.field.subtleDisabledFill).not.toBe(darkColor.field.disabledFill);
    expect(darkColor.field.subtleReadOnlyFill).not.toBe(darkColor.field.readOnlyFill);
    expect(darkColor.field.outlineFill).toBe('#ffffff00');
  });

  test('no state is ever left without a border to draw', () => {
    for (const [, palette] of palettes) {
      for (const appearance of appearances) {
        for (const state of [
          {},
          { hovered: true },
          { focused: true },
          { error: true },
          { readOnly: true },
          { disabled: true },
        ]) {
          const surface = inputFieldSurface(palette, appearance, state);
          expect(surface.border).toBeTruthy();
          expect(surface.borderWidth).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('inputFieldLabelFloats', () => {
  test('an empty resting field keeps its label in the middle', () => {
    expect(inputFieldLabelFloats({})).toBe(false);
  });

  test('focus floats the label even with nothing typed', () => {
    expect(inputFieldLabelFloats({ focused: true })).toBe(true);
  });

  test('a value floats the label even without focus', () => {
    expect(inputFieldLabelFloats({ filled: true })).toBe(true);
  });

  test('clearing a focused field leaves the label up', () => {
    // Otherwise the label would drop back down mid-edit, under the caret.
    expect(inputFieldLabelFloats({ filled: false, focused: true })).toBe(true);
  });
});

describe('inputFieldShowsPlaceholder', () => {
  test('with a label the placeholder waits for focus', () => {
    expect(inputFieldShowsPlaceholder({ hasLabel: true })).toBe(false);
    expect(inputFieldShowsPlaceholder({ hasLabel: true, focused: true })).toBe(true);
  });

  test('without a label it is always there', () => {
    expect(inputFieldShowsPlaceholder({ hasLabel: false })).toBe(true);
    expect(inputFieldShowsPlaceholder({ hasLabel: false, focused: true })).toBe(true);
  });
});
