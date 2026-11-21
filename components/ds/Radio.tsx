import { forwardRef, useId, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { type ColorShape, type Colors, theme } from '../../lib/theme';
import { isKeyboardFocus, rendersFocusRing } from './Button';

// Fintrack DS · Radio and RadioGroup.
// Component: Figma "Components" page, set 409:796 (24 variants: Checked
// No/Yes x State Default/Hover/Pressed/Disabled x Size Small/Medium/Large).
//
// Anatomy, from the Figma variants:
//   State background  control + 16, centred, the hover/pressed tint only
//   Control           16 / 20 / 24, the circle that is actually the radio
//   Dot               6 / 8 / 10, centred, only when selected
//   Focus ring        a circle 4 outside the control, i.e. offset 2 + width 2
//   Copy              Label, then Description 4 below it
//
// Every shape in the set binds radius/pill, so the radio is round where the
// checkbox is square; otherwise the two share their geometry, their tokens
// and their interaction rules.
//
// Radio is controlled and one-way: pressing a selected radio does nothing,
// because a radio is only ever turned off by another radio in its group.
// RadioGroup is that group - the smallest composition that makes one choice
// out of several, nothing more.

export type RadioSize = 'small' | 'medium' | 'large';

// The palette shape the components read, so light, dark and a test palette
// built from distinct values all fit.
export type RadioColors = ColorShape<Colors>;

// A radio with no visible label still has to say what it is, so the two ways
// of naming it travel as one either/or.
export type RadioLabelling =
  | { label: string; accessibilityLabel?: string }
  | { label?: undefined; accessibilityLabel: string };

export type RadioProps = RadioLabelling & {
  checked: boolean;
  /** Called only when the press actually changes the choice. */
  onSelect: () => void;
  /** Secondary line under the label. */
  description?: string;
  size?: RadioSize;
  disabled?: boolean;
  /**
   * Whether this radio is a Tab stop. RadioGroup hands `false` to every
   * radio but one, which is what makes a group a single stop; a radio used
   * on its own keeps the default and is reachable like any other control.
   */
  tabbable?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export type RadioVisualState = {
  checked: boolean;
  disabled?: boolean;
  hovered?: boolean;
  pressed?: boolean;
};

export type RadioSurface = {
  /** The control's fill. */
  background: string;
  /** Null when the control is filled rather than outlined. */
  border: string | null;
  /** The inner dot; read only when the radio is selected. */
  dot: string;
  /** The soft circle behind the control; null when nothing is tinting it. */
  stateTint: string | null;
  label: string;
  description: string;
};

type RadioTextStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

export type RadioSizeSpec = {
  /** The circle itself. */
  control: number;
  /** The hover/pressed circle behind it: always the control plus 16. */
  stateSize: number;
  /** The inner dot. */
  dot: number;
  borderWidth: number;
  /** Padding that lifts the whole thing to a 44 target. */
  targetPadding: number;
  /** Label to description. */
  copyGap: number;
  labelType: RadioTextStyle;
  descriptionType: RadioTextStyle;
};

// Figma binds the control to size/selection/small (16), size/icon-md (20)
// and size/selection/large (24). The dot has no size variable of its own in
// the file - it is drawn at 6 / 8 / 10, which is the control halved less 2 -
// so those three are written out rather than turned into global tokens.
export function radioSizeSpec(size: RadioSize): RadioSizeSpec {
  if (size === 'small') {
    return {
      control: theme.scale.size.iconSm,
      stateSize: theme.scale.size.iconSm + 2 * theme.scale.space[2],
      dot: 6,
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
      stateSize: theme.scale.size.iconLg + 2 * theme.scale.space[2],
      dot: 10,
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
    stateSize: theme.scale.size.iconMd + 2 * theme.scale.space[2],
    dot: 8,
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

/**
 * Whether a press on this radio should reach the caller. A radio never
 * clears itself, so pressing the selected one is a no-op rather than a
 * toggle, and a disabled one answers nothing at all.
 */
export function radioShouldSelect(state: {
  checked: boolean;
  disabled?: boolean;
}): boolean {
  return !state.checked && state.disabled !== true;
}

// Fill, stroke, dot, tint and the two text colours for one state. Disabled
// wins over everything; pressed wins over hover.
export function radioSurface(
  colors: RadioColors,
  state: RadioVisualState,
): RadioSurface {
  const { action, border, field, state: tint, surface, text } = colors;

  if (state.disabled) {
    return {
      background: state.checked ? action.primary.disabled : field.disabledFill,
      border: state.checked ? null : field.disabledBorder,
      dot: action.primary.disabledContent,
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
    background: state.checked ? action.primary.fill : surface.raised,
    border: state.checked ? null : border.strong,
    dot: action.primary.content,
    stateTint,
    label: text.primary,
    description: text.secondary,
  };
}

export type RadioFocusRing = {
  outlineColor: string;
  outlineOffset: number;
  outlineStyle: 'solid';
  outlineWidth: number;
};

// The browser's own outline draws the ring around the control: it takes no
// part in layout, it follows the control's corner - a full circle here - and
// grows by the offset, which puts its outer edge 4 outside the control,
// where Figma draws it. Setting it replaces the user-agent ring instead of
// stacking a second one on top; cleared, it suppresses that ring too.
export function radioFocusRing(
  colors: RadioColors,
  visible: boolean,
): RadioFocusRing {
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
export function radioCopyOffset(spec: RadioSizeSpec): number {
  return Math.max(0, (spec.stateSize - spec.labelType.lineHeight) / 2);
}

/**
 * The key that selects a radio. Space, and only Space: Enter belongs to
 * buttons and submits the form a radio sits in.
 */
export function isRadioSelectKey(key: string): boolean {
  // 'Spacebar' is what older engines report for the same key.
  return key === ' ' || key === 'Spacebar';
}

// react-native-web wires Enter and Space to role="button" and to links, and
// to nothing else - so a radio has to bind its own keys. Space is also the
// page-scroll key and the arrows scroll too, which is why both handlers
// swallow what they recognise.
export type RadioKeyEvent = {
  key: string;
  repeat?: boolean;
  preventDefault: () => void;
};

export type RadioKeyboardProps = {
  onKeyDown?: (event: RadioKeyEvent) => void;
};

/**
 * The key binding a single radio needs on web, and nothing at all anywhere
 * else: `onKeyDown` has no meaning on Android, so it is never handed to a
 * native view.
 */
export function radioKeyboardProps(
  platform: string,
  select: () => void,
): RadioKeyboardProps {
  if (platform !== 'web') {
    return {};
  }
  return {
    onKeyDown: (event) => {
      if (!isRadioSelectKey(event.key)) {
        return;
      }
      // Swallowed even when the press changes nothing, so the page never
      // scrolls out from under a radio the user is sitting on.
      event.preventDefault();
      if (event.repeat === true) {
        return;
      }
      select();
    },
  };
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

export const Radio = forwardRef<View, RadioProps>(function Radio(
  {
    accessibilityHint,
    accessibilityLabel,
    checked,
    description,
    disabled = false,
    label,
    onSelect,
    size = 'medium',
    tabbable = true,
    testID,
  },
  ref,
) {
  const colors = useColors();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const spec = useMemo(() => radioSizeSpec(size), [size]);
  const styles = useMemo(() => makeStyles(spec), [spec]);
  const descriptionId = `${useId()}-description`;

  const hasCopy = label !== undefined || description !== undefined;
  const focusRing = rendersFocusRing(Platform.OS, { disabled, focused });
  // Whether this radio is the group's one Tab stop. Both props say it:
  // native reads `focusable`, while react-native-web's Pressable writes a
  // tabIndex of its own from `disabled` alone and never looks at
  // `focusable`, so only an explicit tabIndex can take a radio out of the
  // tab order there without disabling it.
  const stop = !disabled && tabbable;

  const select = () => {
    if (radioShouldSelect({ checked, disabled })) {
      onSelect();
    }
  };

  return (
    <Pressable
      {...radioKeyboardProps(Platform.OS, select)}
      accessibilityHint={accessibilityHint ?? description}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      // react-native-web reads the aria-* props and never looks at
      // accessibilityState, so the web half of the contract travels here.
      aria-checked={checked}
      aria-describedby={description === undefined ? undefined : descriptionId}
      aria-disabled={disabled}
      disabled={disabled}
      focusable={stop}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(isKeyboardFocus())}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => {
        select();
      }}
      ref={ref}
      style={[
        hasCopy ? styles.rootWithCopy : styles.rootBare,
        // Web only: the ring belongs to the control below, so the row that
        // actually takes focus must not grow one of its own.
        Platform.OS === 'web' && SUPPRESSED_RING,
      ]}
      tabIndex={stop ? 0 : -1}
      testID={testID}
    >
      {({ pressed }) => {
        const surface = radioSurface(colors, {
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
                { backgroundColor: surface.stateTint ?? 'transparent' },
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
                  Platform.OS === 'web' && radioFocusRing(colors, focusRing),
                ]}
              >
                {checked ? (
                  <View
                    style={[styles.dot, { backgroundColor: surface.dot }]}
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
});

function makeStyles(spec: RadioSizeSpec) {
  return StyleSheet.create({
    control: {
      alignItems: 'center',
      borderRadius: theme.scale.radius.pill,
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
      marginTop: radioCopyOffset(spec),
    },
    description: {
      ...spec.descriptionType,
    },
    dot: {
      borderRadius: theme.scale.radius.pill,
      height: spec.dot,
      width: spec.dot,
    },
    label: {
      ...spec.labelType,
    },
    rootBare: {
      alignItems: 'center',
      justifyContent: 'center',
      // No label to widen the row, so the padding alone carries the control
      // up to a finger-sized target without touching the circle.
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
      borderRadius: theme.scale.radius.pill,
      height: spec.stateSize,
      justifyContent: 'center',
      width: spec.stateSize,
    },
  });
}

// ---------------------------------------------------------------------------
// RadioGroup
// ---------------------------------------------------------------------------

export type RadioGroupOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type RadioGroupProps = {
  /** Null while nothing is chosen yet. The group stores no choice of its own. */
  value: string | null;
  onChange: (value: string) => void;
  options: RadioGroupOption[];
  /** What the set of options is for; a group needs a name of its own. */
  accessibilityLabel: string;
  size?: RadioSize;
  testID?: string;
};

export type RadioGroupMove = 'next' | 'previous';

/**
 * The one option that is a Tab stop, which is also where an arrow press
 * starts from. The chosen option when there is one, otherwise the first
 * option a user can actually reach; null when every option is disabled.
 *
 * Arrows move the choice along with the focus, so after any arrow press the
 * chosen option is the focused one - which is why the group needs no record
 * of where the focus currently sits.
 */
export function radioGroupTabbableValue(
  options: RadioGroupOption[],
  value: string | null,
): string | null {
  const reachable = options.filter((option) => option.disabled !== true);
  if (reachable.length === 0) {
    return null;
  }
  const chosen = reachable.find((option) => option.value === value);
  return (chosen ?? reachable[0]).value;
}

/**
 * Which way an arrow key moves. Both axes move the same way, as the WAI-ARIA
 * radio group pattern asks: the layout may be a column or a row, and a user
 * should not have to know which.
 */
export function radioGroupMoveKey(key: string): RadioGroupMove | null {
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return 'next';
  }
  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return 'previous';
  }
  return null;
}

/**
 * The option an arrow press lands on: the next reachable one in that
 * direction, wrapping round the ends and stepping over disabled options.
 * Null when there is nowhere to go.
 */
export function radioGroupNextValue(
  options: RadioGroupOption[],
  from: string | null,
  move: RadioGroupMove,
): string | null {
  const reachable = options.filter((option) => option.disabled !== true);
  if (reachable.length === 0) {
    return null;
  }
  const start = reachable.findIndex((option) => option.value === from);
  if (start < 0) {
    // Nothing to move from - an empty or disabled starting point - so the
    // press enters the group from the end it came from.
    return move === 'next'
      ? reachable[0].value
      : reachable[reachable.length - 1].value;
  }
  const step = move === 'next' ? 1 : -1;
  const next = (start + step + reachable.length) % reachable.length;
  return reachable[next].value;
}

/**
 * The arrow bindings a group needs on web, and nothing at all anywhere
 * else. Android has no arrow keys to bind and no web-only props to receive:
 * there a group is a `radiogroup` whose radios the platform's own focus
 * model walks.
 */
export function radioGroupKeyboardProps(
  platform: string,
  move: (direction: RadioGroupMove) => void,
): RadioKeyboardProps {
  if (platform !== 'web') {
    return {};
  }
  return {
    onKeyDown: (event) => {
      const direction = radioGroupMoveKey(event.key);
      if (direction === null) {
        return;
      }
      // Swallowed before anything else, so the arrows never scroll the page
      // out from under the group.
      event.preventDefault();
      if (event.repeat === true) {
        return;
      }
      move(direction);
    },
  };
}

// Only the node's focus() is wanted here, and only on web, where moving the
// focus is what the arrow keys are for.
type RadioFocusTarget = { focus?: () => void };

export function RadioGroup({
  accessibilityLabel,
  onChange,
  options,
  size = 'medium',
  testID,
  value,
}: RadioGroupProps) {
  const nodes = useRef(new Map<string, View | null>()).current;
  const tabbable = radioGroupTabbableValue(options, value);

  const moveTo = (next: string) => {
    onChange(next);
    // The choice and the focus travel together; the row is already mounted,
    // so this reaches the right node even before the re-render lands.
    const node = nodes.get(next) as RadioFocusTarget | null | undefined;
    node?.focus?.();
  };

  const keyboard = radioGroupKeyboardProps(Platform.OS, (direction) => {
    const next = radioGroupNextValue(options, tabbable, direction);
    if (next !== null) {
      moveTo(next);
    }
  });

  return (
    <View
      {...keyboard}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={groupStyles.group}
      testID={testID}
    >
      {options.map((option) => (
        <Radio
          checked={option.value === value}
          description={option.description}
          disabled={option.disabled}
          key={option.value}
          label={option.label}
          onSelect={() => onChange(option.value)}
          ref={(node) => {
            nodes.set(option.value, node);
          }}
          size={size}
          tabbable={option.value === tabbable}
          testID={testID === undefined ? undefined : `${testID}-${option.value}`}
        />
      ))}
    </View>
  );
}

const groupStyles = StyleSheet.create({
  group: {
    alignItems: 'flex-start',
  },
});
