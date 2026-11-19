import Feather from '@expo/vector-icons/Feather';
import { type ComponentProps, type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { type ColorShape, type Colors, theme } from '../../lib/theme';

// Fintrack DS · Button.
// Component: Figma "Components" page, frame 591:1212.
// Token contract: frame 1041:2624 ("Button - frontend token contract").
// Types Primary / Neutral / Surface / Outline / Ghost / Danger in Medium and
// Large, with default, hover, pressed, loading and disabled states, plus an
// independent focused state rendered on web.
// Every variant carries two independent icon slots, as the component does
// (591:853 "Icon" and 591:856 "Trailing icon"): either, both or neither may
// be filled, and an empty slot occupies no space.

export type ButtonVariant =
  | 'primary'
  | 'neutral'
  | 'surface'
  | 'outline'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'medium' | 'large';

// The project draws its icons with Feather from @expo/vector-icons; no other
// icon library is introduced here.
export type ButtonIconName = ComponentProps<typeof Feather>['name'];

// What the Button hands an icon slot. The caller picks the glyph, the Button
// owns its size, colour and stroke, so a screen can never drift from the DS.
export type ButtonIconProps = {
  size: number;
  color: string;
  strokeWidth: number;
};

// A slot takes either a Feather glyph name, which the Button draws itself, or
// a render function that receives the resolved icon props.
export type ButtonIcon =
  | ButtonIconName
  | ((props: ButtonIconProps) => ReactNode);

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: ButtonIcon;
  trailingIcon?: ButtonIcon;
  /** @deprecated Use leadingIcon / trailingIcon; the Button cannot size or
   * colour a node that the caller already built. */
  icon?: ReactNode;
  /** @deprecated Paired with the deprecated `icon`. */
  iconPosition?: 'leading' | 'trailing';
  fullWidth?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  testID?: string;
};

export type ButtonTypography = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

export type ButtonSizeSpec = {
  height: number;
  radius: number;
  focusRadius: number;
  paddingHorizontal: number;
  minWidth: number;
  gap: number;
  iconSize: number;
  iconStrokeWidth: number;
  typography: ButtonTypography;
};

export type ButtonVisualState = {
  disabled?: boolean;
  hovered?: boolean;
  pressed?: boolean;
};

export type ButtonSurface = {
  background: string;
  border: string | null;
  content: string;
};

// The palette shape the component reads, so light, dark and a test palette
// built from distinct values all fit.
export type ButtonColors = ColorShape<Colors>;

// Medium and Large bind different height, corner and padding tokens.
export function buttonSizeSpec(size: ButtonSize): ButtonSizeSpec {
  if (size === 'large') {
    return {
      height: theme.scale.size.controlLg,
      radius: theme.scale.radius.buttonLarge,
      focusRadius: theme.scale.radius.buttonFocusLarge,
      paddingHorizontal: theme.scale.space[6],
      minWidth: theme.scale.size.controlMinWidth,
      gap: theme.scale.space[2],
      iconSize: theme.scale.size.iconLg,
      iconStrokeWidth: theme.scale.stroke.icon,
      typography: theme.type.buttonLarge,
    };
  }
  return {
    height: theme.scale.size.controlMd,
    radius: theme.scale.radius.buttonMedium,
    focusRadius: theme.scale.radius.buttonFocusMedium,
    paddingHorizontal: theme.scale.space[5],
    minWidth: theme.scale.size.controlMinWidth,
    gap: theme.scale.space[2],
    iconSize: theme.scale.size.iconMd,
    iconStrokeWidth: theme.scale.stroke.icon,
    typography: theme.type.buttonMedium,
  };
}

// Resolves fill, border and content for one variant in one visual state.
// Pressed wins over hover, and disabled wins over both.
export function buttonSurface(
  colors: ButtonColors,
  variant: ButtonVariant,
  state: ButtonVisualState = {},
): ButtonSurface {
  const { action, border, state: overlay, text } = colors;

  const pick = (rest: string, hover: string, press: string): string => {
    if (state.pressed) {
      return press;
    }
    if (state.hovered) {
      return hover;
    }
    return rest;
  };

  switch (variant) {
    case 'neutral':
      // Disabled is inherited from primary by the token contract.
      return state.disabled
        ? {
            background: action.primary.disabled,
            border: null,
            content: action.primary.disabledContent,
          }
        : {
            background: pick(
              action.neutral.fill,
              action.neutral.hover,
              action.neutral.pressed,
            ),
            border: null,
            content: action.neutral.content,
          };
    case 'surface':
      return state.disabled
        ? {
            background: action.secondary.disabledFill,
            border: null,
            content: action.secondary.disabledContent,
          }
        : {
            background: pick(
              action.secondary.fill,
              action.secondary.hover,
              action.secondary.pressed,
            ),
            border: null,
            content: text.primary,
          };
    case 'outline':
      // Outline has no fill of its own: it rests transparent and only the
      // state overlays tint it. The border stays border/default in every
      // state, disabled included.
      return state.disabled
        ? {
            background: action.secondary.disabledFill,
            border: border.default,
            content: action.secondary.disabledContent,
          }
        : {
            background: pick('transparent', overlay.hover, overlay.pressed),
            border: border.default,
            content: text.primary,
          };
    case 'ghost':
      return state.disabled
        ? {
            background: 'transparent',
            border: null,
            content: action.secondary.disabledContent,
          }
        : {
            background: pick('transparent', overlay.hover, overlay.pressed),
            border: null,
            content: text.primary,
          };
    case 'danger':
      // Disabled Danger drops the destructive hue entirely and inherits the
      // primary disabled pair, like Neutral does.
      return state.disabled
        ? {
            background: action.primary.disabled,
            border: null,
            content: action.primary.disabledContent,
          }
        : {
            background: pick(
              action.destructive.fill,
              action.destructive.hover,
              action.destructive.pressed,
            ),
            border: null,
            content: action.destructive.content,
          };
    default:
      return state.disabled
        ? {
            background: action.primary.disabled,
            border: null,
            content: action.primary.disabledContent,
          }
        : {
            background: pick(
              action.primary.fill,
              action.primary.hover,
              action.primary.pressed,
            ),
            border: null,
            content: action.primary.content,
          };
  }
}

// Focus ring colour per the token contract: Primary and Neutral take the
// primary focus token, Surface / Outline / Ghost the secondary one, Danger
// the destructive one.
export function buttonFocusColor(
  colors: ButtonColors,
  variant: ButtonVariant,
): string {
  switch (variant) {
    case 'danger':
      return colors.action.destructive.focus;
    case 'surface':
    case 'outline':
    case 'ghost':
      return colors.action.secondary.focus;
    default:
      return colors.action.primary.focus;
  }
}

// The ring the browser draws for us. An outline takes no part in layout, it
// follows the button's own corner (its radius grows by the offset, so a 14
// corner rings at 18 and a 16 at 20, matching radius/button/focus-*), and
// setting it replaces the user-agent ring instead of stacking a second one
// on top of it. Cleared, it also suppresses that user-agent ring, so the
// component is the only thing that can light the button up.
export type ButtonFocusRing = {
  outlineColor: string;
  outlineOffset: number;
  outlineStyle: 'solid';
  outlineWidth: number;
};

export function buttonFocusRing(
  colors: ButtonColors,
  variant: ButtonVariant,
  visible: boolean,
): ButtonFocusRing {
  if (!visible) {
    // Width zero rather than 'none': an author outline-style of its own is
    // what overrides the user-agent's `outline-style: auto` ring, and RN
    // types the property without 'none' anyway.
    return {
      outlineColor: 'transparent',
      outlineOffset: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
    };
  }
  return {
    outlineColor: buttonFocusColor(colors, variant),
    outlineOffset: theme.scale.stroke.focusRing,
    outlineStyle: 'solid',
    outlineWidth: theme.scale.stroke.focusRing,
  };
}

// Only the part of an element the focus check needs, so a test can stand in
// for one.
export type FocusVisibleQuery = { matches: (selector: string) => boolean };

// Whether the focus that just arrived is one the browser would indicate.
// Asking it through :focus-visible is the only reliable answer: guessing from
// the order of press and focus events cannot work, because the browser
// focuses on mousedown while react-native-web delays onPressIn by 50ms, so
// the press flag is always still unset when focus arrives.
export function isKeyboardFocusTarget(
  element: FocusVisibleQuery | null | undefined,
): boolean {
  if (element == null) {
    return false;
  }
  try {
    return element.matches(':focus-visible');
  } catch {
    // A browser too old for :focus-visible: show the ring rather than hide
    // keyboard focus altogether.
    return true;
  }
}

export function isKeyboardFocus(): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return false;
  }
  // Inside the focus event the element that just took focus is the active
  // one, so this asks the browser about the button itself.
  return isKeyboardFocusTarget(document.activeElement);
}

// Icon tint per the token contract. It is not always the label colour:
// Primary binds its own action/primary/icon, and the quiet types - Surface,
// Outline and Ghost - fall back to the secondary disabled content when the
// button is off, while the solid ones take the primary disabled content.
export function buttonIconColor(
  colors: ButtonColors,
  variant: ButtonVariant,
  state: { disabled?: boolean } = {},
): string {
  const quiet = variant === 'surface' || variant === 'outline' || variant === 'ghost';

  if (state.disabled) {
    return quiet
      ? colors.action.secondary.disabledContent
      : colors.action.primary.disabledContent;
  }

  switch (variant) {
    case 'neutral':
      return colors.action.neutral.content;
    case 'danger':
      return colors.action.destructive.content;
    case 'surface':
    case 'outline':
    case 'ghost':
      return colors.text.primary;
    default:
      return colors.action.primary.icon;
  }
}

// Draws one slot. A Feather name is rendered by the Button itself; a render
// function gets the same resolved props, so an SVG icon can honour the stroke
// width that a font glyph cannot.
export function renderButtonIcon(
  icon: ButtonIcon | undefined,
  props: ButtonIconProps,
): ReactNode {
  if (icon === undefined) {
    return null;
  }
  if (typeof icon === 'function') {
    return icon(props);
  }
  // Feather ships as an icon font: its 2px stroke is baked into the glyph at
  // the 24px grid and cannot be set per instance.
  return <Feather color={props.color} name={icon} size={props.size} />;
}

// The spinner occupies the same box as the icon slots: Figma draws it 20x20
// in Medium (591:858, 901:1240) and 24x24 in Large (591:903, 591:1200),
// centred on the button. One field in the size spec therefore covers both,
// and no token is duplicated to say the same thing twice.
export function buttonSpinnerSize(size: ButtonSize): number {
  return buttonSizeSpec(size).iconSize;
}

// A loading button must not fire again, so activation is blocked while it
// works - but it stays focusable, so keyboard focus is not lost.
export function isButtonPressable(state: {
  disabled?: boolean;
  loading?: boolean;
}): boolean {
  return !state.disabled && !state.loading;
}

// Disabled can never show the ring; loading still can.
export function showsFocusRing(state: {
  disabled?: boolean;
  focused?: boolean;
}): boolean {
  return Boolean(state.focused) && !state.disabled;
}

// The DS specifies focus as a web interaction (:focus-visible). A touch target
// has no keyboard ring, and an overlay drawn outside the bounds of a rounded
// view can clip on Android, so the ring is web-only.
export function rendersFocusRing(
  platform: string,
  state: { disabled?: boolean; focused?: boolean },
): boolean {
  return platform === 'web' && showsFocusRing(state);
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  leadingIcon,
  trailingIcon,
  icon,
  iconPosition = 'leading',
  fullWidth = false,
  accessibilityHint,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const colors = useColors();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const sizeSpec = useMemo(() => buttonSizeSpec(size), [size]);
  const styles = useMemo(() => makeStyles(sizeSpec), [sizeSpec]);

  const pressable = isButtonPressable({ disabled, loading });
  const focusRing = rendersFocusRing(Platform.OS, { disabled, focused });

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      // Only a disabled button leaves the focus order; a loading one keeps it.
      disabled={disabled}
      focusable={!disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(isKeyboardFocus())}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => {
        if (!pressable) {
          return;
        }
        onPress();
      }}
      style={({ pressed }) => {
        const surface = buttonSurface(colors, variant, {
          disabled,
          hovered: hovered && pressable,
          pressed: pressed && pressable,
        });
        return [
          styles.base,
          fullWidth && styles.fullWidth,
          {
            backgroundColor: surface.background,
            borderColor: surface.border ?? 'transparent',
            borderWidth: surface.border ? theme.scale.stroke.hairline : 0,
          },
          // Web only: on native the outline props would be a second ring that
          // the platform never asked for, and an overlay outside a rounded
          // view can clip on Android.
          Platform.OS === 'web' &&
            buttonFocusRing(colors, variant, focusRing),
        ];
      }}
      testID={testID}
    >
      {({ pressed }) => {
        const surface = buttonSurface(colors, variant, {
          disabled,
          hovered: hovered && pressable,
          pressed: pressed && pressable,
        });
        const iconProps: ButtonIconProps = {
          size: sizeSpec.iconSize,
          color: buttonIconColor(colors, variant, { disabled }),
          strokeWidth: sizeSpec.iconStrokeWidth,
        };
        // The deprecated single-icon props feed whichever slot they named, and
        // only when that slot is otherwise empty.
        const leading =
          leadingIcon === undefined
            ? iconPosition === 'leading'
              ? icon
              : null
            : renderButtonIcon(leadingIcon, iconProps);
        const trailing =
          trailingIcon === undefined
            ? iconPosition === 'trailing'
              ? icon
              : null
            : renderButtonIcon(trailingIcon, iconProps);

        return (
          <>
            {/* Label and icons stay mounted while loading, so neither the
                button nor its slots change width. */}
            <View style={[styles.content, loading && styles.contentHidden]}>
              {leading}
              <Text
                numberOfLines={1}
                style={[styles.label, { color: surface.content }]}
              >
                {label}
              </Text>
              {trailing}
            </View>
            {loading ? (
              <View style={styles.loader}>
                {/* A numeric size is the only lever that ties the indicator
                    to the button: 'small' is a fixed 20 at both sizes. RN
                    turns the number into the view box, which the Android
                    drawable and the web SVG both fill. */}
                <ActivityIndicator
                  color={surface.content}
                  size={buttonSpinnerSize(size)}
                />
              </View>
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

function makeStyles(size: ButtonSizeSpec) {
  return StyleSheet.create({
    base: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: size.radius,
      flexDirection: 'row',
      height: size.height,
      justifyContent: 'center',
      minWidth: size.minWidth,
      paddingHorizontal: size.paddingHorizontal,
    },
    content: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: size.gap,
      justifyContent: 'center',
    },
    contentHidden: {
      opacity: 0,
    },
    fullWidth: {
      // alignSelf covers a column parent, where the cross axis is the width.
      // In a row parent the cross axis is the height, so stretch does nothing
      // for the width and the button would keep hugging its label: width
      // fills the container there. Sharing a row between several buttons
      // stays the parent's job.
      alignSelf: 'stretch',
      width: '100%',
    },
    label: {
      ...size.typography,
      textAlign: 'center',
    },
    loader: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      // In style, not as a prop: the prop form is deprecated in React Native
      // and warns on every render. The overlay still swallows nothing.
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      top: 0,
    },
  });
}
