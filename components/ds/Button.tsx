import { type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { theme } from '../../lib/theme';

// Fintrack DS · Button (Figma "Components" page, frame 591:1212).
// Types Primary / Surface / Outline / Ghost / Danger in Medium and Large,
// with Default, Hover, Pressed, Loading and Disabled states.
// The DS also defines a Neutral type, which has no action.neutral token in
// lib/theme.ts yet and is therefore not implemented here.

export type ButtonVariant =
  | 'primary'
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
  paddingHorizontal: number;
  minWidth: number;
  gap: number;
  typography: ButtonTypography;
};

// The palette the active theme hands out, so light and dark both fit.
export type ButtonColors = ReturnType<typeof useColors>;

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

// Medium and Large bind different height, corner and padding tokens.
export function buttonSizeSpec(size: ButtonSize): ButtonSizeSpec {
  if (size === 'large') {
    return {
      height: theme.scale.size.controlLg,
      radius: theme.scale.radius.buttonLg,
      paddingHorizontal: theme.scale.space[6],
      minWidth: theme.scale.size.controlMinWidth,
      gap: theme.scale.space[2],
      typography: theme.type.buttonLarge,
    };
  }
  return {
    height: theme.scale.size.buttonHeight,
    radius: theme.scale.radius.md,
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
  const { action, border, state: overlay, surface } = colors;

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
      return state.disabled
        ? {
            background: action.secondary.disabledFill,
            border: action.secondary.disabledBorder,
            content: action.secondary.disabledContent,
          }
        : {
            background: pick(
              surface.default,
              overlay.hover,
              overlay.pressed,
            ),
            border: border.default,
            content: action.secondary.content,
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
      return state.disabled
        ? {
            background: action.destructive.disabledFill,
            border: null,
            content: action.destructive.disabledContent,
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

// A loading button must not fire again, so it is inert while it works.
export function isButtonPressable(state: {
  disabled?: boolean;
  loading?: boolean;
}): boolean {
  return !state.disabled && !state.loading;
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
  const sizeSpec = useMemo(() => buttonSizeSpec(size), [size]);
  const styles = useMemo(() => makeStyles(sizeSpec), [sizeSpec]);

  const pressable = isButtonPressable({ disabled, loading });
  // Loading keeps the disabled look off: the button is busy, not unavailable.
  const inactive = disabled;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: !pressable }}
      disabled={!pressable}
      focusable={pressable}
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
          disabled: inactive,
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
          disabled: inactive,
          hovered: hovered && pressable,
          pressed: pressed && pressable,
        });
        return (
          <>
            {/* Kept mounted while loading so the button does not resize. */}
            <View style={[styles.content, loading && styles.contentHidden]}>
              {icon && iconPosition === 'leading' ? icon : null}
              <Text numberOfLines={1} style={[styles.label, { color: surface.content }]}>
                {label}
              </Text>
              {icon && iconPosition === 'trailing' ? icon : null}
            </View>
            {loading ? (
              <View pointerEvents="none" style={styles.loader}>
                <ActivityIndicator color={surface.content} size="small" />
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
