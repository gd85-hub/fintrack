import Feather from '@expo/vector-icons/Feather';
import { type ComponentProps, type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { type ColorShape, type Colors, theme } from '../../lib/theme';
import {
  isButtonPressable,
  isKeyboardFocus,
  rendersFocusRing,
} from './Button';

// Fintrack DS · Icon Button.
// Component: Figma "Components" page, set 105:47 (105 variants).
// Types Primary / Neutral / Outline / Surface / Ghost / Danger / On media in
// Small, Medium and Large, with default, hover, pressed, loading and disabled
// states, plus an independent focused state rendered on web.
//
// Small is the one size where the touch target and the visible button differ:
// a 40 surface centred in a 44 target, so the control stays finger-sized
// without hitSlop reaching into whatever sits next to it.
//
// Button's own pure helpers for pressability and the focus ring are reused
// rather than copied; everything else here is this component's.

export type IconButtonVariant =
  | 'primary'
  | 'neutral'
  | 'outline'
  | 'surface'
  | 'ghost'
  | 'danger'
  | 'onMedia';

export type IconButtonSize = 'small' | 'medium' | 'large';

// The project draws its icons with Feather from @expo/vector-icons; no other
// icon library is introduced here.
export type IconButtonIconName = ComponentProps<typeof Feather>['name'];

// What the button hands its icon. The caller picks the glyph, the button owns
// its size, colour and stroke, so a screen can never drift from the DS.
export type IconButtonIconProps = {
  size: number;
  color: string;
  strokeWidth: number;
};

export type IconButtonIcon =
  | IconButtonIconName
  | ((props: IconButtonIconProps) => ReactNode);

// The palette shape the component reads, so light, dark and a test palette
// built from distinct values all fit.
export type IconButtonColors = ColorShape<Colors>;

export type IconButtonProps = {
  icon: IconButtonIcon;
  /** Required: an icon alone never says what the button does. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export type IconButtonVisualState = {
  disabled?: boolean;
  hovered?: boolean;
  pressed?: boolean;
};

export type IconButtonSurface = {
  background: string;
  border: string | null;
  /** Painted over the fill, never instead of it: On media tints this way. */
  overlay: string | null;
  icon: string;
};

export type IconButtonSizeSpec = {
  /** The area that answers a finger. */
  target: number;
  /** The painted button inside it. */
  surface: number;
  radius: number;
  focusRadius: number;
  iconSize: number;
  iconStrokeWidth: number;
  borderWidth: number;
};

// Figma 105:47: the target is size/touch-target, size/control-md and
// size/control-lg; the surface is size/icon-button at Small and the control
// height at the other two. The focus radius is what an outline 2 wide at 2
// offset draws around each corner, which is also radius/button/focus-*.
export function iconButtonSizeSpec(size: IconButtonSize): IconButtonSizeSpec {
  if (size === 'large') {
    return {
      target: theme.scale.size.controlLg,
      surface: theme.scale.size.controlLg,
      radius: theme.scale.radius.md,
      focusRadius: theme.scale.radius.buttonFocusLarge,
      iconSize: theme.scale.size.iconLg,
      iconStrokeWidth: theme.scale.stroke.icon,
      borderWidth: theme.scale.stroke.hairline,
    };
  }
  if (size === 'medium') {
    return {
      target: theme.scale.size.controlMd,
      surface: theme.scale.size.controlMd,
      radius: theme.scale.radius.buttonMedium,
      focusRadius: theme.scale.radius.buttonFocusMedium,
      iconSize: theme.scale.size.iconMd,
      iconStrokeWidth: theme.scale.stroke.icon,
      borderWidth: theme.scale.stroke.hairline,
    };
  }
  return {
    target: theme.scale.size.touchTarget,
    surface: theme.scale.size.iconButton,
    radius: theme.scale.radius.sm,
    focusRadius: theme.scale.radius.md,
    iconSize: theme.scale.size.iconMd,
    iconStrokeWidth: theme.scale.stroke.icon,
    borderWidth: theme.scale.stroke.hairline,
  };
}

// On media is a round button at every size; the rest take their size's corner.
export function iconButtonRadius(
  variant: IconButtonVariant,
  size: IconButtonSize,
): number {
  return variant === 'onMedia'
    ? theme.scale.radius.pill
    : iconButtonSizeSpec(size).radius;
}

// Resolves fill, border, overlay and icon for one type in one state.
// Pressed wins over hover, and disabled wins over both.
export function iconButtonSurface(
  colors: IconButtonColors,
  variant: IconButtonVariant,
  state: IconButtonVisualState = {},
): IconButtonSurface {
  const { action, border, icon, overlay, state: tint, text } = colors;

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
            overlay: null,
            icon: action.primary.disabledContent,
          }
        : {
            background: pick(
              action.neutral.fill,
              action.neutral.hover,
              action.neutral.pressed,
            ),
            border: null,
            overlay: null,
            icon: action.neutral.content,
          };
    case 'outline':
      // The only type with a stroke, and it keeps it in every state.
      return state.disabled
        ? {
            background: action.secondary.disabledFill,
            border: border.default,
            overlay: null,
            icon: action.secondary.disabledContent,
          }
        : {
            background: pick('transparent', tint.hover, tint.pressed),
            border: border.default,
            overlay: null,
            icon: text.primary,
          };
    case 'surface':
      return state.disabled
        ? {
            background: action.secondary.disabledFill,
            border: null,
            overlay: null,
            icon: action.secondary.disabledContent,
          }
        : {
            background: pick(
              action.secondary.fill,
              action.secondary.hover,
              action.secondary.pressed,
            ),
            border: null,
            overlay: null,
            icon: text.primary,
          };
    case 'ghost':
      return state.disabled
        ? {
            // Ghost stays invisible even when off: only the icon greys out.
            background: 'transparent',
            border: null,
            overlay: null,
            icon: action.secondary.disabledContent,
          }
        : {
            background: pick('transparent', tint.hover, tint.pressed),
            border: null,
            overlay: null,
            icon: text.primary,
          };
    case 'danger':
      // Disabled Danger drops the destructive hue and inherits primary's.
      return state.disabled
        ? {
            background: action.primary.disabled,
            border: null,
            overlay: null,
            icon: action.primary.disabledContent,
          }
        : {
            background: pick(
              action.destructive.fill,
              action.destructive.hover,
              action.destructive.pressed,
            ),
            border: null,
            overlay: null,
            icon: action.destructive.content,
          };
    case 'onMedia':
      // The scrim is the button; hover and pressed tint it rather than
      // replace it, so the photo underneath stays covered.
      return {
        background: overlay.scrim,
        border: null,
        overlay: state.disabled
          ? null
          : state.pressed
            ? tint.pressed
            : state.hovered
              ? tint.hover
              : null,
        // Figma keeps the white icon in disabled too, over the same scrim.
        icon: icon.onMedia,
      };
    default:
      return state.disabled
        ? {
            background: action.primary.disabled,
            border: null,
            overlay: null,
            icon: action.primary.disabledContent,
          }
        : {
            background: pick(
              action.primary.fill,
              action.primary.hover,
              action.primary.pressed,
            ),
            border: null,
            overlay: null,
            icon: action.primary.content,
          };
  }
}

// Focus ring colour: every type rings in border/focus, except On media, which
// rings in border/on-inverse so it reads against a photo.
export function iconButtonFocusColor(
  colors: IconButtonColors,
  variant: IconButtonVariant,
): string {
  return variant === 'onMedia' ? colors.border.onInverse : colors.border.focus;
}

export type IconButtonFocusRing = {
  outlineColor: string;
  outlineOffset: number;
  outlineStyle: 'solid';
  outlineWidth: number;
};

// The browser's own outline draws the ring: it takes no part in layout, it
// follows the button's corner and grows by the offset - so a 12 corner rings
// at 16, a 14 at 18 and a 16 at 20 - and setting it replaces the user-agent
// ring instead of stacking a second one on top. Cleared, it suppresses that
// ring too.
export function iconButtonFocusRing(
  colors: IconButtonColors,
  variant: IconButtonVariant,
  visible: boolean,
): IconButtonFocusRing {
  if (!visible) {
    return {
      outlineColor: 'transparent',
      outlineOffset: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
    };
  }
  return {
    outlineColor: iconButtonFocusColor(colors, variant),
    outlineOffset: theme.scale.stroke.focusRing,
    outlineStyle: 'solid',
    outlineWidth: theme.scale.stroke.focusRing,
  };
}

// The spinner takes the type's icon colour and the icon's box: Figma binds
// the visible Spinner of every Loading variant to the same token its icon
// uses, not to anything of its own.
export function iconButtonSpinnerSize(size: IconButtonSize): number {
  return iconButtonSizeSpec(size).iconSize;
}

export function renderIconButtonIcon(
  icon: IconButtonIcon,
  props: IconButtonIconProps,
): ReactNode {
  if (typeof icon === 'function') {
    return icon(props);
  }
  // Feather ships as an icon font: its stroke is baked into the glyph and
  // cannot be set per instance.
  return <Feather color={props.color} name={icon} size={props.size} />;
}

export function IconButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  icon,
  loading = false,
  onPress,
  size = 'medium',
  testID,
  variant = 'primary',
}: IconButtonProps) {
  const colors = useColors();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const spec = useMemo(() => iconButtonSizeSpec(size), [size]);
  const styles = useMemo(() => makeStyles(spec), [spec]);

  const pressable = isButtonPressable({ disabled, loading });
  const focusRing = rendersFocusRing(Platform.OS, { disabled, focused });
  const radius = iconButtonRadius(variant, size);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      // React Native's documented alias for accessibilityState.busy, and the
      // only one that reaches the DOM: react-native-web reads the aria-*
      // props and never looks at accessibilityState.
      aria-busy={loading}
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
      style={[
        styles.target,
        // Web only: the ring belongs to the painted surface below, so the
        // target itself must not grow one of its own.
        Platform.OS === 'web' && SUPPRESSED_RING,
      ]}
      testID={testID}
    >
      {({ pressed }) => {
        const surface = iconButtonSurface(colors, variant, {
          disabled,
          hovered: hovered && pressable,
          pressed: pressed && pressable,
        });
        const iconProps: IconButtonIconProps = {
          size: spec.iconSize,
          color: surface.icon,
          strokeWidth: spec.iconStrokeWidth,
        };

        return (
          <View
            style={[
              styles.surface,
              {
                backgroundColor: surface.background,
                borderColor: surface.border ?? 'transparent',
                borderWidth: surface.border ? spec.borderWidth : 0,
                borderRadius: radius,
              },
              Platform.OS === 'web' &&
                iconButtonFocusRing(colors, variant, focusRing),
            ]}
          >
            {surface.overlay ? (
              <View
                style={[
                  styles.overlay,
                  {
                    backgroundColor: surface.overlay,
                    borderRadius: radius,
                  },
                ]}
              />
            ) : null}

            {/* Kept mounted while loading so nothing about the button moves. */}
            <View style={loading ? styles.iconHidden : undefined}>
              {renderIconButtonIcon(icon, iconProps)}
            </View>

            {loading ? (
              <View style={styles.spinner}>
                <ActivityIndicator
                  color={surface.icon}
                  size={iconButtonSpinnerSize(size)}
                />
              </View>
            ) : null}
          </View>
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

function makeStyles(spec: IconButtonSizeSpec) {
  return StyleSheet.create({
    iconHidden: {
      opacity: 0,
    },
    overlay: {
      bottom: 0,
      left: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      top: 0,
    },
    spinner: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      // The spinner is a state, not a control: it swallows nothing.
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      top: 0,
    },
    surface: {
      alignItems: 'center',
      height: spec.surface,
      justifyContent: 'center',
      width: spec.surface,
    },
    target: {
      alignItems: 'center',
      // The finger-sized area. At Small it is larger than the paint, which
      // is what keeps a 40 button reachable without hitSlop.
      height: spec.target,
      justifyContent: 'center',
      width: spec.target,
    },
  });
}
