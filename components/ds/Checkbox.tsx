import Feather from '@expo/vector-icons/Feather';
import { useId, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { type ColorShape, type Colors, theme } from '../../lib/theme';
import { isKeyboardFocus, rendersFocusRing } from './Button';

// Fintrack DS · Checkbox.
// Component: Figma "Components" page, set 409:755 (36 variants: Checked
// No/Yes/Mixed x State Default/Hover/Pressed/Disabled x Size
// Small/Medium/Large).
//
// Anatomy, from the Figma variants:
//   State background  control + 16, centred, the hover/pressed tint only
//   Control           16 / 20 / 24, the square that is actually the checkbox
//   Checkmark         the "check" glyph at 12 / 14 / 16, centred
//   Mixed mark        a 2-tall bar half the control wide, centred
//   Focus ring        a rect 4 outside the control, i.e. offset 2 + width 2
//   Copy              Label, then Description 4 below it
//
// The component is controlled: it owns no checked state. `checked` may be
// `'mixed'`, which is a display state only - pressing a mixed checkbox turns
// it on, exactly as `aria-checked="mixed"` is specified to behave.

export type CheckboxSize = 'small' | 'medium' | 'large';

/** Three display states; `'mixed'` is the partial-selection one. */
export type CheckboxChecked = boolean | 'mixed';

// The palette shape the component reads, so light, dark and a test palette
// built from distinct values all fit.
export type CheckboxColors = ColorShape<Colors>;

// A checkbox with no visible label still has to say what it is, so the two
// ways of naming it travel as one either/or.
export type CheckboxLabelling =
  | { label: string; accessibilityLabel?: string }
  | { label?: undefined; accessibilityLabel: string };

export type CheckboxProps = CheckboxLabelling & {
  checked: CheckboxChecked;
  /** Called with the value the press asks for, never with `'mixed'`. */
  onChange: (checked: boolean) => void;
  /** Secondary line under the label. */
  description?: string;
  size?: CheckboxSize;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export type CheckboxVisualState = {
  checked: CheckboxChecked;
  disabled?: boolean;
  hovered?: boolean;
  pressed?: boolean;
};

export type CheckboxSurface = {
  /** The control's fill. */
  background: string;
  /** Null when the control is filled rather than outlined. */
  border: string | null;
  /** Checkmark and mixed bar share one colour. */
  mark: string;
  /** The soft square behind the control; null when nothing is tinting it. */
  stateTint: string | null;
  label: string;
  description: string;
};

type CheckboxTextStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

export type CheckboxSizeSpec = {
  /** The square itself. */
  control: number;
  controlRadius: number;
  /** The hover/pressed square behind it: always the control plus 16. */
  stateSize: number;
  stateRadius: number;
  /** The "check" glyph. */
  markSize: number;
  /** The partial bar: half the control wide, one stroke tall. */
  mixedWidth: number;
  mixedHeight: number;
  borderWidth: number;
  /** Padding that lifts the whole thing to a 44 target. */
  targetPadding: number;
  /** Label to description. */
  copyGap: number;
  labelType: CheckboxTextStyle;
  descriptionType: CheckboxTextStyle;
};

// Figma binds the control to size/selection/small, size/icon-md and
// size/selection/large, and its corner to radius/selection/small (4),
// radius/2xs (6) and radius/selection/large (8). Only the middle one has a
// code token today, so 4 and 8 are written out; the same goes for the state
// background's 10, which Figma calls radius/xs - a name the code already
// spends on 6. Naming drift, not a new scale: this is recorded rather than
// resolved by inventing global tokens.
export function checkboxSizeSpec(size: CheckboxSize): CheckboxSizeSpec {
  if (size === 'small') {
    return {
      control: theme.scale.size.iconSm,
      controlRadius: 4,
      stateSize: theme.scale.size.iconSm + 2 * theme.scale.space[2],
      stateRadius: 10,
      markSize: 12,
      mixedWidth: theme.scale.size.iconSm / 2,
      mixedHeight: theme.scale.stroke.icon,
      borderWidth: theme.scale.stroke.hairline,
      targetPadding:
        (theme.scale.size.touchTarget -
          (theme.scale.size.iconSm + 2 * theme.scale.space[2])) /
        2,
      copyGap: theme.scale.space[1],
      labelType: theme.type.labelSmall,
      descriptionType: theme.type.captionSmall,
    };
  }
  if (size === 'large') {
    return {
      control: theme.scale.size.iconLg,
      controlRadius: 8,
      stateSize: theme.scale.size.iconLg + 2 * theme.scale.space[2],
      stateRadius: theme.scale.radius.buttonMedium,
      markSize: theme.scale.size.iconSm,
      mixedWidth: theme.scale.size.iconLg / 2,
      mixedHeight: theme.scale.stroke.icon,
      borderWidth: theme.scale.stroke.hairline,
      targetPadding:
        (theme.scale.size.touchTarget -
          (theme.scale.size.iconLg + 2 * theme.scale.space[2])) /
        2,
      copyGap: theme.scale.space[1],
      labelType: theme.type.labelLarge,
      descriptionType: theme.type.bodySmall,
    };
  }
  return {
    control: theme.scale.size.iconMd,
    controlRadius: theme.scale.radius.xs,
    stateSize: theme.scale.size.iconMd + 2 * theme.scale.space[2],
    stateRadius: theme.scale.radius.sm,
    markSize: 14,
    mixedWidth: theme.scale.size.iconMd / 2,
    mixedHeight: theme.scale.stroke.icon,
    borderWidth: theme.scale.stroke.hairline,
    targetPadding:
      (theme.scale.size.touchTarget -
        (theme.scale.size.iconMd + 2 * theme.scale.space[2])) /
      2,
    copyGap: theme.scale.space[1],
    labelType: theme.type.labelLarge,
    descriptionType: theme.type.captionDefault,
  };
}

/** On and mixed are drawn the same way: a filled square with a mark in it. */
export function isCheckboxSelected(checked: CheckboxChecked): boolean {
  return checked === true || checked === 'mixed';
}

/** What a press asks for. Mixed resolves upward, like a native tri-state. */
export function checkboxNextChecked(checked: CheckboxChecked): boolean {
  return checked !== true;
}

/** The value screen readers are given, on web and native alike. */
export function checkboxAriaChecked(
  checked: CheckboxChecked,
): boolean | 'mixed' {
  return checked === 'mixed' ? 'mixed' : checked;
}

// Fill, stroke, mark, tint and the two text colours for one state. Disabled
// wins over everything; pressed wins over hover.
export function checkboxSurface(
  colors: CheckboxColors,
  state: CheckboxVisualState,
): CheckboxSurface {
  const { action, border, field, state: tint, surface, text } = colors;
  const selected = isCheckboxSelected(state.checked);

  if (state.disabled) {
    return {
      background: selected ? action.primary.disabled : field.disabledFill,
      border: selected ? null : field.disabledBorder,
      mark: action.primary.disabledContent,
      // A disabled control answers no pointer, so it never tints.
      stateTint: null,
      label: text.disabled,
      description: text.disabled,
    };
  }

  const stateTint = state.pressed
    ? tint.pressed
    : state.hovered
      ? tint.hover
      : null;

  return {
    background: selected ? action.primary.fill : surface.raised,
    border: selected ? null : border.strong,
    mark: action.primary.content,
    stateTint,
    label: text.primary,
    description: text.secondary,
  };
}

export type CheckboxFocusRing = {
  outlineColor: string;
  outlineOffset: number;
  outlineStyle: 'solid';
  outlineWidth: number;
};

// The browser's own outline draws the ring around the control: it takes no
// part in layout, it follows the control's corner and grows by the offset -
// which puts its outer edge 4 outside the square, where Figma draws it - and
// setting it replaces the user-agent ring instead of stacking a second one
// on top. Cleared, it suppresses that ring too.
export function checkboxFocusRing(
  colors: CheckboxColors,
  visible: boolean,
): CheckboxFocusRing {
  if (!visible) {
    return {
      outlineColor: 'transparent',
      outlineOffset: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
    };
  }
  return {
    outlineColor: colors.border.focus,
    outlineOffset: theme.scale.stroke.focusRing,
    outlineStyle: 'solid',
    outlineWidth: theme.scale.stroke.focusRing,
  };
}

/**
 * How far the copy column drops so the label's first line sits level with
 * the middle of the control.
 */
export function checkboxCopyOffset(spec: CheckboxSizeSpec): number {
  return Math.max(0, (spec.stateSize - spec.labelType.lineHeight) / 2);
}

/**
 * The key that toggles a checkbox. Space, and only Space: Enter belongs to
 * buttons and submits the form a checkbox sits in.
 */
export function isCheckboxToggleKey(key: string): boolean {
  // 'Spacebar' is what older engines report for the same key.
  return key === ' ' || key === 'Spacebar';
}

// react-native-web wires Enter and Space to role="button" and to links, and
// to nothing else - so a checkbox has to bind its own key. Space is also the
// page-scroll key, which is why the handler always swallows it.
type CheckboxKeyEvent = {
  key: string;
  repeat?: boolean;
  preventDefault: () => void;
};

type CheckboxKeyboardProps = {
  onKeyDown?: (event: CheckboxKeyEvent) => void;
};

export function Checkbox({
  accessibilityHint,
  accessibilityLabel,
  checked,
  description,
  disabled = false,
  label,
  onChange,
  size = 'medium',
  testID,
}: CheckboxProps) {
  const colors = useColors();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const spec = useMemo(() => checkboxSizeSpec(size), [size]);
  const styles = useMemo(() => makeStyles(spec), [spec]);
  const descriptionId = `${useId()}-description`;

  const hasCopy = label !== undefined || description !== undefined;
  const focusRing = rendersFocusRing(Platform.OS, { disabled, focused });

  const toggle = () => {
    if (disabled) {
      return;
    }
    onChange(checkboxNextChecked(checked));
  };

  const webKeyboard: CheckboxKeyboardProps =
    Platform.OS === 'web'
      ? {
          onKeyDown: (event) => {
            if (!isCheckboxToggleKey(event.key)) {
              return;
            }
            // Swallowed even when disabled, so the page never scrolls out
            // from under a checkbox the user is sitting on.
            event.preventDefault();
            if (event.repeat === true) {
              return;
            }
            toggle();
          },
        }
      : {};

  return (
    <Pressable
      {...webKeyboard}
      accessibilityHint={accessibilityHint ?? description}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: checkboxAriaChecked(checked),
        disabled,
      }}
      // react-native-web reads the aria-* props and never looks at
      // accessibilityState, so the web half of the contract travels here.
      aria-checked={checkboxAriaChecked(checked)}
      aria-describedby={description === undefined ? undefined : descriptionId}
      aria-disabled={disabled}
      disabled={disabled}
      focusable={!disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(isKeyboardFocus())}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => {
        toggle();
      }}
      style={[
        hasCopy ? styles.rootWithCopy : styles.rootBare,
        // Web only: the ring belongs to the control below, so the row that
        // actually takes focus must not grow one of its own.
        Platform.OS === 'web' && SUPPRESSED_RING,
      ]}
      testID={testID}
    >
      {({ pressed }) => {
        const surface = checkboxSurface(colors, {
          checked,
          disabled,
          hovered: hovered && !disabled,
          pressed: pressed && !disabled,
        });

        return (
          <>
            <View
              style={[
                styles.stateBackground,
                {
                  backgroundColor: surface.stateTint ?? 'transparent',
                },
              ]}
            >
              <View
                style={[
                  styles.control,
                  {
                    backgroundColor: surface.background,
                    borderColor: surface.border ?? 'transparent',
                    borderWidth: surface.border ? spec.borderWidth : 0,
                  },
                  Platform.OS === 'web' &&
                    checkboxFocusRing(colors, focusRing),
                ]}
              >
                {checked === 'mixed' ? (
                  <View
                    style={[styles.mixedMark, { backgroundColor: surface.mark }]}
                  />
                ) : checked ? (
                  <Feather
                    color={surface.mark}
                    name="check"
                    size={spec.markSize}
                  />
                ) : null}
              </View>
            </View>

            {hasCopy ? (
              <View style={styles.copy}>
                {label === undefined ? null : (
                  <Text style={[styles.label, { color: surface.label }]}>
                    {label}
                  </Text>
                )}
                {description === undefined ? null : (
                  // Named so the row can point at it: on web the hint has no
                  // DOM equivalent, and aria-describedby is what carries a
                  // second line to a screen reader there.
                  <Text
                    id={descriptionId}
                    style={[styles.description, { color: surface.description }]}
                  >
                    {description}
                  </Text>
                )}
              </View>
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

// Suppressing the user-agent ring needs an author outline-style of its own;
// width zero is what hides it. React Native types the property without
// 'none', and this says the same thing.
const SUPPRESSED_RING = {
  outlineColor: 'transparent',
  outlineOffset: 0,
  outlineStyle: 'solid',
  outlineWidth: 0,
} as const;

function makeStyles(spec: CheckboxSizeSpec) {
  return StyleSheet.create({
    control: {
      alignItems: 'center',
      borderRadius: spec.controlRadius,
      height: spec.control,
      justifyContent: 'center',
      width: spec.control,
    },
    copy: {
      // Figma's Medium master puts the copy at the control's right edge,
      // which is 8 of clear space once the state background's own 8 is
      // counted off. The hidden Copy frames of the other two sizes were
      // never moved off that x, so this is the one measurement taken from
      // the size where the file is self-consistent.
      flexShrink: 1,
      gap: spec.copyGap,
      // Drops the first line to the middle of the control.
      marginTop: checkboxCopyOffset(spec),
    },
    description: {
      ...spec.descriptionType,
    },
    label: {
      ...spec.labelType,
    },
    mixedMark: {
      borderRadius: spec.mixedHeight / 2,
      height: spec.mixedHeight,
      width: spec.mixedWidth,
    },
    rootBare: {
      alignItems: 'center',
      justifyContent: 'center',
      // No label to widen the row, so the padding alone carries the control
      // up to a finger-sized target without touching the square.
      padding: spec.targetPadding,
    },
    rootWithCopy: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      // The label already makes the row wide; only the height needs lifting.
      paddingVertical: spec.targetPadding,
    },
    stateBackground: {
      alignItems: 'center',
      borderRadius: spec.stateRadius,
      height: spec.stateSize,
      justifyContent: 'center',
      width: spec.stateSize,
    },
  });
}
