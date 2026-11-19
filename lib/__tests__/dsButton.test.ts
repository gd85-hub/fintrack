import { describe, expect, test } from '@jest/globals';

import {
  type ButtonColors,
  type ButtonSurface,
  type ButtonVariant,
  type ButtonVisualState,
  buttonFocusColor,
  buttonIconColor,
  buttonSizeSpec,
  buttonSpinnerSize,
  buttonSurface,
  isButtonPressable,
  rendersFocusRing,
  showsFocusRing,
} from '../../components/ds/Button';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

// Asserts the Figma Button spec (component 591:1212, token contract 1041:2624)
// against the tokens it must bind, not against raw hex values.
const colors = theme.color;

// Every colour rule is checked in both themes: the component reads one palette
// through useColors() and may not special-case either scheme.
const themes: [string, ButtonColors][] = [
  ['light', colors],
  ['dark', darkColor],
];

const variants: ButtonVariant[] = [
  'primary',
  'neutral',
  'surface',
  'outline',
  'ghost',
  'danger',
];

const interactionStates = [
  {},
  { hovered: true },
  { pressed: true },
  { disabled: true },
];

describe('buttonSizeSpec', () => {
  test('medium binds the DS medium height, corner and padding', () => {
    expect(buttonSizeSpec('medium')).toMatchObject({
      height: theme.scale.size.controlMd,
      radius: theme.scale.radius.buttonMedium,
      focusRadius: theme.scale.radius.buttonFocusMedium,
      paddingHorizontal: theme.scale.space[5],
      minWidth: theme.scale.size.controlMinWidth,
      gap: theme.scale.space[2],
    });
    expect(buttonSizeSpec('medium').typography.fontSize).toBe(14);
  });

  test('large binds the DS large height, corner and padding', () => {
    expect(buttonSizeSpec('large')).toMatchObject({
      height: theme.scale.size.controlLg,
      radius: theme.scale.radius.buttonLarge,
      focusRadius: theme.scale.radius.buttonFocusLarge,
      paddingHorizontal: theme.scale.space[6],
      minWidth: theme.scale.size.controlMinWidth,
      gap: theme.scale.space[2],
    });
    expect(buttonSizeSpec('large').typography.fontSize).toBe(16);
  });

  test('each size binds its own icon box at a 2px stroke', () => {
    // Figma 591:853 / 591:856 are 20x20 in Medium (591:852) and 24x24 in
    // Large (591:897); the DS draws icon strokes at stroke/icon = 2.
    expect(buttonSizeSpec('medium')).toMatchObject({
      iconSize: theme.scale.size.iconMd,
      iconStrokeWidth: theme.scale.stroke.icon,
    });
    expect(buttonSizeSpec('large')).toMatchObject({
      iconSize: theme.scale.size.iconLg,
      iconStrokeWidth: theme.scale.stroke.icon,
    });
    expect(buttonSizeSpec('medium').iconSize).toBe(20);
    expect(buttonSizeSpec('large').iconSize).toBe(24);
    expect(buttonSizeSpec('medium').iconStrokeWidth).toBe(2);
  });

  test('the spinner shares the icon box at both sizes', () => {
    // Figma draws Spinner 20x20 in Medium (591:858, 901:1240) and 24x24 in
    // Large (591:903, 591:1200) - the same box as the icon slots.
    expect(buttonSpinnerSize('medium')).toBe(20);
    expect(buttonSpinnerSize('large')).toBe(24);
    for (const size of ['medium', 'large'] as const) {
      expect(buttonSpinnerSize(size)).toBe(buttonSizeSpec(size).iconSize);
    }
  });

  test('the spinner grows with the button, unlike a fixed small indicator', () => {
    // The defect this replaces: ActivityIndicator size="small" is a flat 20 on
    // every platform, so Large showed a Medium spinner.
    expect(buttonSpinnerSize('large')).toBeGreaterThan(
      buttonSpinnerSize('medium'),
    );
    expect(buttonSpinnerSize('large')).not.toBe(20);
  });

  test('the icon gap is 8 at both sizes', () => {
    for (const size of ['medium', 'large'] as const) {
      expect(buttonSizeSpec(size).gap).toBe(8);
    }
  });

  test('large is taller and rounder than medium', () => {
    const medium = buttonSizeSpec('medium');
    const large = buttonSizeSpec('large');
    expect(large.height).toBeGreaterThan(medium.height);
    expect(large.radius).toBeGreaterThan(medium.radius);
    expect(large.paddingHorizontal).toBeGreaterThan(medium.paddingHorizontal);
  });

  test('the focus radius leaves a 2px gap outside a 2px ring', () => {
    // Contract: 2px clear gap + 2px outline, so the outer corner grows by 4.
    const ring = theme.scale.stroke.focusRing;
    for (const size of ['medium', 'large'] as const) {
      const spec = buttonSizeSpec(size);
      expect(spec.focusRadius - spec.radius).toBe(ring * 2);
    }
  });
});

// The token each variant/state pair must bind, written from the Figma Button
// component set 591:1212 rather than from the implementation. That set holds
// all 60 variants (6 types x 2 sizes x 5 states); a variant's node id prefix
// says nothing about which set it belongs to, so Surface (901:1218 and
// siblings) and Neutral (901:1156 / 901:1181) live in the same set as
// Primary 591:852, Outline 591:942, Ghost 591:1032 and Danger 591:1122.
// Medium nodes are cited below; Large repeats their colours (checked on
// 591:1023 and 591:1203), so colour is size-independent.
// Surface, Outline and Ghost all label with text/primary while active.
type ContractState = 'default' | 'hover' | 'pressed' | 'disabled';

const figmaContract: Record<
  ButtonVariant,
  Record<ContractState, (c: ButtonColors) => ButtonSurface>
> = {
  primary: {
    default: (c) => ({
      background: c.action.primary.fill,
      border: null,
      content: c.action.primary.content,
    }),
    hover: (c) => ({
      background: c.action.primary.hover,
      border: null,
      content: c.action.primary.content,
    }),
    pressed: (c) => ({
      background: c.action.primary.pressed,
      border: null,
      content: c.action.primary.content,
    }),
    disabled: (c) => ({
      background: c.action.primary.disabled,
      border: null,
      content: c.action.primary.disabledContent,
    }),
  },
  neutral: {
    default: (c) => ({
      background: c.action.neutral.fill,
      border: null,
      content: c.action.neutral.content,
    }),
    hover: (c) => ({
      background: c.action.neutral.hover,
      border: null,
      content: c.action.neutral.content,
    }),
    pressed: (c) => ({
      background: c.action.neutral.pressed,
      border: null,
      content: c.action.neutral.content,
    }),
    // Neutral has no disabled tokens of its own: 901:1181 binds the primary pair.
    disabled: (c) => ({
      background: c.action.primary.disabled,
      border: null,
      content: c.action.primary.disabledContent,
    }),
  },
  // 901:1218 / 901:1224 / 901:1230: own fill, label text/primary.
  surface: {
    default: (c) => ({
      background: c.action.secondary.fill,
      border: null,
      content: c.text.primary,
    }),
    hover: (c) => ({
      background: c.action.secondary.hover,
      border: null,
      content: c.text.primary,
    }),
    pressed: (c) => ({
      background: c.action.secondary.pressed,
      border: null,
      content: c.text.primary,
    }),
    disabled: (c) => ({
      background: c.action.secondary.disabledFill,
      border: null,
      content: c.action.secondary.disabledContent,
    }),
  },
  outline: {
    // 591:942 binds no fill at all — only a border and the label.
    default: (c) => ({
      background: 'transparent',
      border: c.border.default,
      content: c.text.primary,
    }),
    hover: (c) => ({
      background: c.state.hover,
      border: c.border.default,
      content: c.text.primary,
    }),
    pressed: (c) => ({
      background: c.state.pressed,
      border: c.border.default,
      content: c.text.primary,
    }),
    // 591:978 keeps border/default; it does not switch to a disabled border.
    disabled: (c) => ({
      background: c.action.secondary.disabledFill,
      border: c.border.default,
      content: c.action.secondary.disabledContent,
    }),
  },
  // 591:1032 / 591:1041 / 591:1050: no fill, no border, label text/primary.
  ghost: {
    default: (c) => ({
      background: 'transparent',
      border: null,
      content: c.text.primary,
    }),
    hover: (c) => ({
      background: c.state.hover,
      border: null,
      content: c.text.primary,
    }),
    pressed: (c) => ({
      background: c.state.pressed,
      border: null,
      content: c.text.primary,
    }),
    disabled: (c) => ({
      background: 'transparent',
      border: null,
      content: c.action.secondary.disabledContent,
    }),
  },
  danger: {
    default: (c) => ({
      background: c.action.destructive.fill,
      border: null,
      content: c.action.destructive.content,
    }),
    hover: (c) => ({
      background: c.action.destructive.hover,
      border: null,
      content: c.action.destructive.content,
    }),
    pressed: (c) => ({
      background: c.action.destructive.pressed,
      border: null,
      content: c.action.destructive.content,
    }),
    // 591:1158 drops the destructive hue and binds the primary disabled pair.
    disabled: (c) => ({
      background: c.action.primary.disabled,
      border: null,
      content: c.action.primary.disabledContent,
    }),
  },
};

const contractStates: Record<ContractState, ButtonVisualState> = {
  default: {},
  hover: { hovered: true },
  pressed: { pressed: true },
  disabled: { disabled: true },
};

describe('Figma colour contract', () => {
  test('every variant and state binds the token the Figma component binds', () => {
    for (const [themeName, palette] of themes) {
      for (const variant of variants) {
        for (const stateName of Object.keys(
          contractStates,
        ) as ContractState[]) {
          const expected = figmaContract[variant][stateName](palette);
          const actual = buttonSurface(
            palette,
            variant,
            contractStates[stateName],
          );
          expect({ themeName, variant, stateName, ...actual }).toEqual({
            themeName,
            variant,
            stateName,
            ...expected,
          });
        }
      }
    }
  });

  test('outline never paints a fill of its own', () => {
    for (const [, palette] of themes) {
      // Resting and loading share the resting surface: no fill, only a border.
      expect(buttonSurface(palette, 'outline').background).toBe('transparent');
      expect(buttonSurface(palette, 'outline').background).not.toBe(
        palette.surface.default,
      );
    }
  });

  test('disabled danger carries no destructive hue', () => {
    for (const [, palette] of themes) {
      const disabled = buttonSurface(palette, 'danger', { disabled: true });
      expect(disabled.background).not.toBe(palette.action.destructive.fill);
      expect(disabled.background).toBe(palette.action.primary.disabled);
      expect(disabled.content).toBe(palette.action.primary.disabledContent);
    }
  });

  test('surface, outline and ghost all label with text/primary', () => {
    // 901:1218, 591:942 and 591:1032 and their hover/pressed siblings bind
    // color/text/primary, not an action token.
    for (const [, palette] of themes) {
      for (const variant of ['surface', 'outline', 'ghost'] as const) {
        for (const state of [{}, { hovered: true }, { pressed: true }]) {
          expect(buttonSurface(palette, variant, state).content).toBe(
            palette.text.primary,
          );
        }
        // Disabled still drops to the secondary disabled content token.
        expect(
          buttonSurface(palette, variant, { disabled: true }).content,
        ).toBe(palette.action.secondary.disabledContent);
      }
    }
  });

  test('disabled outline keeps the default border', () => {
    for (const [, palette] of themes) {
      expect(buttonSurface(palette, 'outline', { disabled: true }).border).toBe(
        palette.border.default,
      );
    }
  });

});

describe('buttonSurface', () => {
  test('primary walks fill -> hover -> pressed and has no border', () => {
    for (const [, palette] of themes) {
      expect(buttonSurface(palette, 'primary')).toEqual({
        background: palette.action.primary.fill,
        border: null,
        content: palette.action.primary.content,
      });
      expect(
        buttonSurface(palette, 'primary', { hovered: true }).background,
      ).toBe(palette.action.primary.hover);
      expect(
        buttonSurface(palette, 'primary', { pressed: true }).background,
      ).toBe(palette.action.primary.pressed);
    }
  });

  test('neutral walks its own fill -> hover -> pressed', () => {
    for (const [, palette] of themes) {
      expect(buttonSurface(palette, 'neutral')).toEqual({
        background: palette.action.neutral.fill,
        border: null,
        content: palette.action.neutral.content,
      });
      expect(
        buttonSurface(palette, 'neutral', { hovered: true }).background,
      ).toBe(palette.action.neutral.hover);
      expect(
        buttonSurface(palette, 'neutral', { pressed: true }).background,
      ).toBe(palette.action.neutral.pressed);
    }
  });

  test('neutral disabled is inherited from primary', () => {
    for (const [, palette] of themes) {
      expect(buttonSurface(palette, 'neutral', { disabled: true })).toEqual(
        buttonSurface(palette, 'primary', { disabled: true }),
      );
    }
  });

  test('neutral inverts between the themes', () => {
    // Dark fill in Light, light fill in Dark: the two must not coincide.
    expect(darkColor.action.neutral.fill).not.toBe(colors.action.neutral.fill);
    expect(darkColor.action.neutral.content).not.toBe(
      colors.action.neutral.content,
    );
  });

  test('pressed wins over hovered', () => {
    for (const [, palette] of themes) {
      for (const variant of variants) {
        expect(
          buttonSurface(palette, variant, { hovered: true, pressed: true }),
        ).toEqual(buttonSurface(palette, variant, { pressed: true }));
      }
    }
  });

  test('disabled wins over every interaction state', () => {
    for (const [, palette] of themes) {
      for (const variant of variants) {
        expect(
          buttonSurface(palette, variant, {
            disabled: true,
            hovered: true,
            pressed: true,
          }),
        ).toEqual(buttonSurface(palette, variant, { disabled: true }));
      }
    }
  });

  test('every variant resolves a fill and a content colour in both themes', () => {
    for (const [, palette] of themes) {
      for (const variant of variants) {
        for (const state of interactionStates) {
          const surface = buttonSurface(palette, variant, state);
          expect(surface.background.length).toBeGreaterThan(0);
          expect(surface.content.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('outline is the only variant with a resting border', () => {
    for (const [, palette] of themes) {
      expect(buttonSurface(palette, 'outline')).toEqual({
        background: 'transparent',
        border: palette.border.default,
        content: palette.text.primary,
      });
      expect(buttonSurface(palette, 'primary').border).toBeNull();
      expect(buttonSurface(palette, 'neutral').border).toBeNull();
      expect(buttonSurface(palette, 'surface').border).toBeNull();
      expect(buttonSurface(palette, 'ghost').border).toBeNull();
      expect(buttonSurface(palette, 'danger').border).toBeNull();
    }
  });

  test('ghost rests transparent and tints with the state overlays', () => {
    for (const [, palette] of themes) {
      expect(buttonSurface(palette, 'ghost').background).toBe('transparent');
      expect(buttonSurface(palette, 'ghost', { hovered: true }).background).toBe(
        palette.state.hover,
      );
      expect(buttonSurface(palette, 'ghost', { pressed: true }).background).toBe(
        palette.state.pressed,
      );
      // Disabled ghost stays fill-less: only the label dims.
      expect(buttonSurface(palette, 'ghost', { disabled: true })).toEqual({
        background: 'transparent',
        border: null,
        content: palette.action.secondary.disabledContent,
      });
    }
  });

  test('surface and danger bind their own action tokens', () => {
    for (const [, palette] of themes) {
      // Surface owns its fill but not its label: that is text/primary.
      expect(buttonSurface(palette, 'surface')).toEqual({
        background: palette.action.secondary.fill,
        border: null,
        content: palette.text.primary,
      });
      expect(buttonSurface(palette, 'danger')).toEqual({
        background: palette.action.destructive.fill,
        border: null,
        content: palette.action.destructive.content,
      });
    }
  });
});

describe('buttonFocusColor', () => {
  test('primary and neutral share the primary focus token', () => {
    for (const [, palette] of themes) {
      expect(buttonFocusColor(palette, 'primary')).toBe(
        palette.action.primary.focus,
      );
      expect(buttonFocusColor(palette, 'neutral')).toBe(
        palette.action.primary.focus,
      );
    }
  });

  test('surface, outline and ghost share the secondary focus token', () => {
    for (const [, palette] of themes) {
      for (const variant of ['surface', 'outline', 'ghost'] as const) {
        expect(buttonFocusColor(palette, variant)).toBe(
          palette.action.secondary.focus,
        );
      }
    }
  });

  test('danger focuses with the destructive token', () => {
    for (const [, palette] of themes) {
      expect(buttonFocusColor(palette, 'danger')).toBe(
        palette.action.destructive.focus,
      );
    }
  });
});

describe('buttonIconColor', () => {
  // The icon slot is not simply the label colour: Primary binds its own
  // action/primary/icon, and disabled splits into the solid types (primary
  // disabled content) and the quiet ones (secondary disabled content).
  const iconContract: Record<
    ButtonVariant,
    { active: (c: ButtonColors) => string; disabled: (c: ButtonColors) => string }
  > = {
    primary: {
      active: (c) => c.action.primary.icon,
      disabled: (c) => c.action.primary.disabledContent,
    },
    neutral: {
      active: (c) => c.action.neutral.content,
      disabled: (c) => c.action.primary.disabledContent,
    },
    surface: {
      active: (c) => c.text.primary,
      disabled: (c) => c.action.secondary.disabledContent,
    },
    outline: {
      active: (c) => c.text.primary,
      disabled: (c) => c.action.secondary.disabledContent,
    },
    ghost: {
      active: (c) => c.text.primary,
      disabled: (c) => c.action.secondary.disabledContent,
    },
    danger: {
      active: (c) => c.action.destructive.content,
      disabled: (c) => c.action.primary.disabledContent,
    },
  };

  // Light and dark share hex values across semantically different tokens, so
  // the labelled palette is the run that can actually fail on a misbinding.
  const palettes: [string, ButtonColors][] = [
    ...themes,
    ['labelled', labelledPalette()],
  ];

  test('every type binds its contract icon token in both states', () => {
    for (const [scheme, palette] of palettes) {
      for (const variant of variants) {
        const expected = iconContract[variant];
        expect({
          scheme,
          variant,
          active: buttonIconColor(palette, variant),
          disabled: buttonIconColor(palette, variant, { disabled: true }),
        }).toEqual({
          scheme,
          variant,
          active: expected.active(palette),
          disabled: expected.disabled(palette),
        });
      }
    }
  });

  test('the labelled palette really does separate every token under test', () => {
    // Guards the guard: if these collapsed, the table above would stop
    // discriminating and quietly pass on a wrong binding.
    const palette = labelledPalette();
    const probes = [
      palette.action.primary.icon,
      palette.action.primary.content,
      palette.action.primary.disabledContent,
      palette.action.neutral.content,
      palette.action.secondary.content,
      palette.action.secondary.disabledContent,
      palette.action.destructive.content,
      palette.text.primary,
    ];
    expect(new Set(probes).size).toBe(probes.length);
    expect(palette.action.primary.icon).toBe('action.primary.icon');
  });

  test('primary reads its icon token, not its label token', () => {
    // They are the same hex in both published palettes (#ffffff / #001727),
    // which is exactly why this is checked on the labelled palette.
    const palette = labelledPalette();
    expect(buttonIconColor(palette, 'primary')).toBe(palette.action.primary.icon);
    expect(buttonIconColor(palette, 'primary')).not.toBe(
      palette.action.primary.content,
    );
  });

  test('disabled icons split solid types from quiet ones', () => {
    const palette = labelledPalette();
    for (const variant of ['primary', 'neutral', 'danger'] as const) {
      expect(buttonIconColor(palette, variant, { disabled: true })).toBe(
        palette.action.primary.disabledContent,
      );
    }
    for (const variant of ['surface', 'outline', 'ghost'] as const) {
      expect(buttonIconColor(palette, variant, { disabled: true })).toBe(
        palette.action.secondary.disabledContent,
      );
    }
  });

  test('no disabled icon keeps a live hue', () => {
    for (const [, palette] of themes) {
      for (const variant of variants) {
        expect(buttonIconColor(palette, variant, { disabled: true })).not.toBe(
          buttonIconColor(palette, variant),
        );
      }
    }
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

describe('rendersFocusRing', () => {
  test('web raises the ring for a focused enabled button', () => {
    expect(rendersFocusRing('web', { focused: true })).toBe(true);
  });

  test('web never rings a disabled button', () => {
    expect(rendersFocusRing('web', { disabled: true, focused: true })).toBe(
      false,
    );
  });

  test('native draws no ring', () => {
    // The DS specifies focus as a web interaction; touch targets get no ring.
    for (const platform of ['android', 'ios']) {
      expect(rendersFocusRing(platform, { focused: true })).toBe(false);
    }
  });
});

describe('showsFocusRing', () => {
  test('an unfocused button shows no ring', () => {
    expect(showsFocusRing({})).toBe(false);
  });

  test('a focused enabled button shows the ring', () => {
    expect(showsFocusRing({ focused: true })).toBe(true);
  });

  test('disabled never shows the ring, even while focused', () => {
    expect(showsFocusRing({ disabled: true, focused: true })).toBe(false);
  });

  test('loading keeps the ring while blocking activation', () => {
    // Loading is not disabled: focus survives, the press does not.
    expect(showsFocusRing({ focused: true })).toBe(true);
    expect(isButtonPressable({ loading: true })).toBe(false);
  });
});
