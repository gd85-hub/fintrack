import { type ReactNode, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { theme } from '../../lib/theme';

// Fintrack DS · Button.
// Component: Figma "Components" page, frame 591:1212.
// Token contract: frame 1041:2624 ("Button - frontend token contract").
// Types Primary / Neutral / Surface / Outline / Ghost / Danger in Medium and
// Large, with default, hover, pressed, loading and disabled states, plus an
// independent focused state rendered on web.

export type ButtonVariant =
  | 'primary'
  | 'neutral'
  | 'surface'
  | 'outline'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'medium' | 'large';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
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

// The palette the active theme hands out, so light and dark both fit.
export type ButtonColors = ReturnType<typeof useColors>;

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
            content: action.secondary.content,
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
            content: action.secondary.content,
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
  // Approximates :focus-visible - a focus that arrives with a pointer press
  // does not raise the ring, a focus that arrives from the keyboard does.
  const pointerFocus = useRef(false);
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
      onBlur={() => {
        setFocused(false);
        pointerFocus.current = false;
      }}
      onFocus={() => setFocused(!pointerFocus.current)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => {
        if (!pressable) {
          return;
        }
        onPress();
      }}
      onPressIn={() => {
        pointerFocus.current = true;
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
        return (
          <>
            {/* Kept mounted while loading so the button does not resize. */}
            <View style={[styles.content, loading && styles.contentHidden]}>
              {icon && iconPosition === 'leading' ? icon : null}
              <Text
                numberOfLines={1}
                style={[styles.label, { color: surface.content }]}
              >
                {label}
              </Text>
              {icon && iconPosition === 'trailing' ? icon : null}
            </View>
            {loading ? (
              <View pointerEvents="none" style={styles.loader}>
                <ActivityIndicator color={surface.content} size="small" />
              </View>
            ) : null}
            {focusRing ? (
              <View
                pointerEvents="none"
                style={[
                  styles.focusRing,
                  { borderColor: buttonFocusColor(colors, variant) },
                ]}
              />
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

function makeStyles(size: ButtonSizeSpec) {
  // The ring sits outside the button: a clear gap, then the outline. Both are
  // absolute, so focus never moves anything around it.
  const ringOffset = size.focusRadius - size.radius;

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
    focusRing: {
      borderRadius: size.focusRadius,
      borderWidth: theme.scale.stroke.focusRing,
      bottom: -ringOffset,
      left: -ringOffset,
      position: 'absolute',
      right: -ringOffset,
      top: -ringOffset,
    },
    fullWidth: {
      alignSelf: 'stretch',
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
      position: 'absolute',
      right: 0,
      top: 0,
    },
  });
}
