import { useId, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { type ColorShape, type Colors, theme } from '../../lib/theme';
import { isKeyboardFocus, rendersFocusRing } from './Button';

// Fintrack DS · Toggle.
// Figma set 107:91: Checked On/Off × State Default/Hover/Pressed/Disabled ×
// Size Small/Medium/Large × Position Leading/Trailing (48 variants).

export type ToggleSize = 'small' | 'medium' | 'large';
export type TogglePosition = 'leading' | 'trailing';
export type ToggleColors = ColorShape<Colors>;

export type ToggleLabelling =
  | { label: string; accessibilityLabel?: string }
  | { label?: undefined; accessibilityLabel: string };

export type ToggleProps = ToggleLabelling & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: ToggleSize;
  position?: TogglePosition;
  disabled?: boolean;
  description?: string;
  accessibilityHint?: string;
  testID?: string;
};

type ToggleTextStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

export type ToggleSizeSpec = {
  trackWidth: number;
  trackHeight: number;
  thumb: number;
  thumbOffX: number;
  thumbOnX: number;
  thumbY: number;
  focusWidth: number;
  focusHeight: number;
  targetWidth: number;
  targetHeight: number;
  copyGap: number;
  rowGap: number;
  labelType: ToggleTextStyle;
  descriptionType: ToggleTextStyle;
};

export function toggleSizeSpec(size: ToggleSize): ToggleSizeSpec {
  const shared = {
    thumbY: 3,
    targetHeight: theme.scale.size.touchTarget,
    copyGap: theme.scale.space[1],
    // Figma's hidden Copy layer cannot define the live row gap. Twelve is
    // the existing DS spacing step used between a compact control and copy.
    rowGap: theme.scale.space[3],
  } as const;

  if (size === 'small') {
    return {
      ...shared,
      trackWidth: 32,
      trackHeight: 20,
      thumb: 14,
      thumbOffX: 3,
      thumbOnX: 15,
      focusWidth: 40,
      focusHeight: 28,
      targetWidth: theme.scale.size.touchTarget,
      labelType: theme.type.labelSmall,
      descriptionType: theme.type.captionSmall,
    };
  }
  if (size === 'large') {
    return {
      ...shared,
      trackWidth: 48,
      trackHeight: 28,
      thumb: 22,
      thumbOffX: 3,
      thumbOnX: 23,
      focusWidth: 56,
      focusHeight: 36,
      targetWidth: 48,
      labelType: theme.type.labelLarge,
      descriptionType: theme.type.bodySmall,
    };
  }
  return {
    ...shared,
    trackWidth: 40,
    trackHeight: 24,
    thumb: 18,
    thumbOffX: 3,
    thumbOnX: 19,
    focusWidth: 48,
    focusHeight: 32,
    targetWidth: theme.scale.size.touchTarget,
    labelType: theme.type.labelLarge,
    descriptionType: theme.type.captionDefault,
  };
}

export type ToggleVisualState = {
  checked: boolean;
  disabled?: boolean;
  hovered?: boolean;
  pressed?: boolean;
};

export type ToggleSurface = {
  track: string;
  overlay: string | null;
  thumb: string;
  label: string;
  description: string;
};

export function toggleSurface(
  colors: ToggleColors,
  state: ToggleVisualState,
): ToggleSurface {
  if (state.disabled) {
    return {
      track: colors.surface.muted,
      overlay: null,
      thumb: colors.icon.disabled,
      label: colors.text.disabled,
      description: colors.text.disabled,
    };
  }

  if (state.checked) {
    return {
      track: state.pressed
        ? colors.action.primary.pressed
        : state.hovered
          ? colors.action.primary.hover
          : colors.action.primary.fill,
      overlay: null,
      thumb: colors.control.knob,
      label: colors.text.primary,
      description: colors.text.secondary,
    };
  }

  return {
    track: colors.control.trackOff,
    overlay: state.pressed
      ? colors.state.pressed
      : state.hovered
        ? colors.state.hover
        : null,
    thumb: colors.control.knob,
    label: colors.text.primary,
    description: colors.text.secondary,
  };
}

export type ToggleFocusRing = {
  outlineColor: string;
  outlineOffset: number;
  outlineStyle: 'solid';
  outlineWidth: number;
};

export function toggleFocusRing(
  colors: ToggleColors,
  visible: boolean,
): ToggleFocusRing {
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

export function toggleCopyOffset(spec: ToggleSizeSpec): number {
  return Math.max(0, (spec.targetHeight - spec.labelType.lineHeight) / 2);
}

export function isToggleKey(key: string): boolean {
  return key === ' ' || key === 'Spacebar';
}

export type ToggleKeyEvent = {
  key: string;
  repeat?: boolean;
  preventDefault: () => void;
};

export type ToggleKeyboardProps = {
  onKeyDown?: (event: ToggleKeyEvent) => void;
};

export function toggleKeyboardProps(
  platform: string,
  toggle: () => void,
): ToggleKeyboardProps {
  if (platform !== 'web') {
    return {};
  }
  return {
    onKeyDown: (event) => {
      if (!isToggleKey(event.key)) {
        return;
      }
      event.preventDefault();
      if (event.repeat === true) {
        return;
      }
      toggle();
    },
  };
}

const SUPPRESSED_RING = {
  outlineColor: 'transparent',
  outlineOffset: 0,
  outlineStyle: 'solid',
  outlineWidth: 0,
} as const;

export function Toggle({
  accessibilityHint,
  accessibilityLabel,
  checked,
  description,
  disabled = false,
  label,
  onChange,
  position = 'trailing',
  size = 'medium',
  testID,
}: ToggleProps) {
  const colors = useColors();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const spec = useMemo(() => toggleSizeSpec(size), [size]);
  const styles = useMemo(() => makeStyles(spec), [spec]);
  const descriptionId = `${useId()}-description`;
  const hasCopy = label !== undefined || description !== undefined;
  const focusRing = rendersFocusRing(Platform.OS, { disabled, focused });

  const toggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <Pressable
      {...toggleKeyboardProps(Platform.OS, toggle)}
      accessibilityHint={accessibilityHint ?? description}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      aria-describedby={description === undefined ? undefined : descriptionId}
      aria-disabled={disabled}
      disabled={disabled}
      focusable={!disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(isKeyboardFocus())}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={toggle}
      style={[
        hasCopy ? styles.rootWithCopy : styles.rootBare,
        hasCopy &&
          (position === 'leading' ? styles.leading : styles.trailing),
        Platform.OS === 'web' && SUPPRESSED_RING,
      ]}
      tabIndex={disabled ? -1 : 0}
      testID={testID}
    >
      {({ pressed }) => {
        const surface = toggleSurface(colors, {
          checked,
          disabled,
          hovered: hovered && !disabled,
          pressed: pressed && !disabled,
        });

        const control = (
          <View style={styles.target} testID={testID ? `${testID}-target` : undefined}>
            <View
              style={[
                styles.track,
                { backgroundColor: surface.track },
                Platform.OS === 'web' && toggleFocusRing(colors, focusRing),
              ]}
              testID={testID ? `${testID}-track` : undefined}
            >
              {surface.overlay === null ? null : (
                <View
                  style={[styles.overlay, { backgroundColor: surface.overlay }]}
                  testID={testID ? `${testID}-overlay` : undefined}
                />
              )}
              <View
                style={[
                  styles.thumb,
                  {
                    backgroundColor: surface.thumb,
                    left: checked ? spec.thumbOnX : spec.thumbOffX,
                  },
                ]}
                testID={testID ? `${testID}-thumb` : undefined}
              />
            </View>
          </View>
        );

        const copy = hasCopy ? (
          <View
            style={styles.copy}
            testID={testID ? `${testID}-copy` : undefined}
          >
            {label === undefined ? null : (
              <Text style={[styles.label, { color: surface.label }]}>{label}</Text>
            )}
            {description === undefined ? null : (
              <Text
                id={descriptionId}
                style={[styles.description, { color: surface.description }]}
              >
                {description}
              </Text>
            )}
          </View>
        ) : null;

        return position === 'leading' ? (
          <>{control}{copy}</>
        ) : (
          <>{copy}{control}</>
        );
      }}
    </Pressable>
  );
}

function makeStyles(spec: ToggleSizeSpec) {
  return StyleSheet.create({
    copy: {
      flex: 1,
      flexShrink: 1,
      gap: spec.copyGap,
      marginTop: toggleCopyOffset(spec),
      minWidth: 0,
    },
    description: {
      ...spec.descriptionType,
    },
    label: {
      ...spec.labelType,
    },
    leading: {
      flexDirection: 'row',
    },
    overlay: {
      borderRadius: theme.scale.radius.pill,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    rootBare: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: spec.targetHeight,
      minWidth: spec.targetWidth,
    },
    rootWithCopy: {
      alignItems: 'flex-start',
      alignSelf: 'stretch',
      gap: spec.rowGap,
      maxWidth: '100%',
      minHeight: spec.targetHeight,
      width: '100%',
    },
    target: {
      alignItems: 'center',
      flexShrink: 0,
      height: spec.targetHeight,
      justifyContent: 'center',
      width: spec.targetWidth,
    },
    thumb: {
      borderRadius: theme.scale.radius.pill,
      height: spec.thumb,
      position: 'absolute',
      top: spec.thumbY,
      width: spec.thumb,
    },
    track: {
      borderRadius: theme.scale.radius.pill,
      height: spec.trackHeight,
      overflow: 'visible',
      position: 'relative',
      width: spec.trackWidth,
    },
    trailing: {
      flexDirection: 'row',
    },
  });
}
