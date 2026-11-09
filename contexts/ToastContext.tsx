import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BOTTOM_TAB_BAR_HEIGHT,
  useIsDesktopWeb,
} from '../components/TabBar';
import {
  Toast,
  type ToastAction,
  type ToastTone,
} from '../components/ds/Toast';
import { theme } from '../lib/theme';

const DEFAULT_DURATION = {
  success: 3000,
  error: 6000,
  info: 4000,
} as const satisfies Record<ToastTone, number>;

// No motion tokens yet.
const MOTION_DURATION_MS = 200;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const toastHostPosition = Platform.select({
  default: 'absolute',
  web: 'fixed',
}) as ViewStyle['position'];

export type ToastOptions = {
  action?: ToastAction;
  duration?: number;
};

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  duration: number;
};

type ToastState = {
  toast: ToastItem | null;
  visible: boolean;
};

type ToastContextValue = {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  show: (
    tone: ToastTone,
    message: string,
    options?: ToastOptions,
  ) => void;
  dismiss: () => void;
};

type ToastHostProps = {
  toast: ToastItem | null;
  visible: boolean;
  onDismiss: () => void;
  onDismissed: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function ToastHost({
  toast,
  visible,
  onDismiss,
  onDismissed,
}: ToastHostProps) {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const { width } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const bottom =
    (isDesktopWeb ? 0 : BOTTOM_TAB_BAR_HEIGHT) +
    insets.bottom +
    theme.scale.space[3];

  useEffect(() => {
    if (!toast) {
      return;
    }

    if (visible) {
      opacity.setValue(0);
      pan.setValue({ x: 0, y: theme.scale.space[3] });
      const enterAnimation = Animated.parallel([
        Animated.timing(opacity, {
          duration: MOTION_DURATION_MS,
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pan.y, {
          duration: MOTION_DURATION_MS,
          toValue: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]);
      enterAnimation.start();
      return () => enterAnimation.stop();
    }

    const toastId = toast.id;
    const exitAnimation = Animated.parallel([
      Animated.timing(opacity, {
        duration: MOTION_DURATION_MS,
        toValue: 0,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(pan.y, {
        duration: MOTION_DURATION_MS,
        toValue: theme.scale.space[3],
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    exitAnimation.start(({ finished }) => {
      if (finished) {
        onDismissed(toastId);
      }
    });
    return () => exitAnimation.stop();
  }, [onDismissed, opacity, pan, toast, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) >= theme.scale.space[2] &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          pan.x.setValue(gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (
            toast &&
            Math.abs(gesture.dx) >= theme.scale.size.touchTarget
          ) {
            const direction = gesture.dx < 0 ? -1 : 1;
            const swipeTarget =
              direction * Math.max(width, theme.sizes.maxContentWidth);
            Animated.parallel([
              Animated.timing(opacity, {
                duration: MOTION_DURATION_MS,
                toValue: 0,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(pan.x, {
                duration: MOTION_DURATION_MS,
                toValue: swipeTarget,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
            ]).start(({ finished }) => {
              if (finished) {
                onDismissed(toast.id);
              }
            });
            return;
          }

          Animated.spring(pan.x, {
            toValue: 0,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan.x, {
            toValue: 0,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        },
      }),
    [onDismissed, opacity, pan, toast, width],
  );

  if (!toast) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="assertive"
      style={[styles.host, { bottom }]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.animatedToast,
          {
            opacity,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
            ],
          },
        ]}
      >
        <Toast
          action={toast.action}
          message={toast.message}
          onDismiss={onDismiss}
          tone={toast.tone}
        />
      </Animated.View>
    </View>
  );
}

export function ToastProvider({ children }: PropsWithChildren) {
  const nextId = useRef(0);
  const [state, setState] = useState<ToastState>({
    toast: null,
    visible: false,
  });

  const show = useCallback<ToastContextValue['show']>(
    (tone, message, options) => {
      nextId.current += 1;
      setState({
        toast: {
          id: nextId.current,
          tone,
          message,
          action: options?.action,
          duration: options?.duration ?? DEFAULT_DURATION[tone],
        },
        visible: true,
      });
    },
    [],
  );

  const dismiss = useCallback(() => {
    setState((current) =>
      current.toast ? { ...current, visible: false } : current,
    );
  }, []);

  const handleDismissed = useCallback((id: number) => {
    setState((current) =>
      current.toast?.id === id
        ? { toast: null, visible: false }
        : current,
    );
  }, []);

  useEffect(() => {
    if (!state.toast || !state.visible) {
      return;
    }

    const timer = setTimeout(dismiss, state.toast.duration);
    return () => clearTimeout(timer);
  }, [dismiss, state.toast, state.visible]);

  const success = useCallback<ToastContextValue['success']>(
    (message, options) => show('success', message, options),
    [show],
  );
  const error = useCallback<ToastContextValue['error']>(
    (message, options) => show('error', message, options),
    [show],
  );
  const info = useCallback<ToastContextValue['info']>(
    (message, options) => show('info', message, options),
    [show],
  );
  const value = useMemo<ToastContextValue>(
    () => ({ dismiss, error, info, show, success }),
    [dismiss, error, info, show, success],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost
        onDismiss={dismiss}
        onDismissed={handleDismissed}
        toast={state.toast}
        visible={state.visible}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider.');
  }

  return context;
}

const styles = StyleSheet.create({
  animatedToast: {
    maxWidth: theme.sizes.maxContentWidth,
    width: '100%',
  },
  host: {
    alignItems: 'center',
    left: theme.scale.space[4],
    pointerEvents: 'box-none',
    position: toastHostPosition,
    right: theme.scale.space[4],
  },
});
