import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { type ComponentProps, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../lib/theme';

type FeatherIconName = ComponentProps<typeof Feather>['name'];

type RouteTab = {
  icon: FeatherIconName;
  label: string;
  routeName: 'index' | 'analytics' | 'reports' | 'settings';
};

const leftTabs: readonly RouteTab[] = [
  { icon: 'home', label: 'Home', routeName: 'index' },
  { icon: 'bar-chart-2', label: 'Analytics', routeName: 'analytics' },
];

const rightTabs: readonly RouteTab[] = [
  { icon: 'file-text', label: 'Reports', routeName: 'reports' },
  { icon: 'settings', label: 'Settings', routeName: 'settings' },
];

export function TabBar({ navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  function renderRouteTab(tab: RouteTab) {
    const routeIndex = state.routes.findIndex(
      (route) => route.name === tab.routeName,
    );
    const route = state.routes[routeIndex];

    if (!route) {
      return null;
    }

    const focused = state.index === routeIndex;
    const iconColor = focused
      ? theme.color.icon.action
      : theme.color.icon.secondary;
    const textColor = focused
      ? theme.color.icon.action
      : theme.color.text.tertiary;

    return (
      <Pressable
        accessibilityLabel={tab.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        key={tab.routeName}
        onLongPress={() => {
          navigation.emit({ target: route.key, type: 'tabLongPress' });
        }}
        onPress={() => {
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress',
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }}
        style={({ pressed }) => [
          styles.routeTab,
          pressed && styles.routeTabPressed,
        ]}
      >
        {focused ? <View style={styles.activeIndicator} /> : null}
        <Feather
          color={iconColor}
          name={tab.icon}
          size={theme.spacing.lg}
        />
        <Text style={[styles.routeLabel, { color: textColor }]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  function openAddRoute(
    route: '/(app)/expense/new' | '/(app)/receipt/scan',
  ) {
    setAddSheetVisible(false);
    router.push(route);
  }

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {leftTabs.map(renderRouteTab)}

        <View style={styles.addSlot}>
          <Pressable
            accessibilityLabel="Add"
            accessibilityRole="button"
            accessibilityState={{ expanded: addSheetVisible }}
            onPress={() => setAddSheetVisible(true)}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Feather
              color={theme.color.action.primary.icon}
              name="plus"
              size={theme.spacing.lg}
            />
          </Pressable>
        </View>

        {rightTabs.map(renderRouteTab)}
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setAddSheetVisible(false)}
        statusBarTranslucent={true}
        transparent={true}
        visible={addSheetVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close add menu"
            accessibilityRole="button"
            onPress={() => setAddSheetVisible(false)}
            style={styles.scrim}
          />
          <View style={styles.sheetFrame}>
            <View
              style={[
                styles.sheet,
                {
                  paddingBottom: Math.max(
                    insets.bottom,
                    theme.spacing.lg,
                  ),
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => openAddRoute('/(app)/receipt/scan')}
                style={({ pressed }) => [
                  styles.sheetAction,
                  pressed && styles.sheetActionPressed,
                ]}
              >
                <Feather
                  color={theme.color.icon.primary}
                  name="camera"
                  size={theme.spacing.lg}
                />
                <Text style={styles.sheetActionLabel}>Scan receipt</Text>
              </Pressable>

              <View style={styles.sheetSeparator} />

              <Pressable
                accessibilityRole="button"
                onPress={() => openAddRoute('/(app)/expense/new')}
                style={({ pressed }) => [
                  styles.sheetAction,
                  pressed && styles.sheetActionPressed,
                ]}
              >
                <Feather
                  color={theme.color.icon.primary}
                  name="edit-3"
                  size={theme.spacing.lg}
                />
                <Text style={styles.sheetActionLabel}>Add manually</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  activeIndicator: {
    backgroundColor: theme.color.icon.action,
    borderRadius: theme.radii.round,
    height: theme.spacing.xxs,
    position: 'absolute',
    top: -theme.spacing.xs,
    width: theme.spacing.lg,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: theme.color.action.primary.fill,
    borderRadius: theme.radii.round,
    height: theme.sizes.floatingButton,
    justifyContent: 'center',
    width: theme.sizes.floatingButton,
  },
  addButtonPressed: {
    backgroundColor: theme.color.action.primary.pressed,
  },
  addSlot: {
    alignItems: 'center',
    flex: 1,
    marginTop: -theme.spacing.lg,
    minHeight: theme.sizes.floatingButton,
  },
  bar: {
    alignItems: 'flex-start',
    backgroundColor: theme.color.surface.default,
    borderTopColor: theme.color.border.subtle,
    borderTopWidth: theme.sizes.border,
    flexDirection: 'row',
    paddingTop: theme.spacing.xs,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  routeLabel: {
    fontSize: theme.fontSizes.caption,
    fontWeight: '600',
  },
  routeTab: {
    alignItems: 'center',
    borderRadius: theme.radii.button,
    flex: 1,
    gap: theme.spacing.xxs,
    justifyContent: 'center',
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.xxs,
    position: 'relative',
  },
  routeTabPressed: {
    backgroundColor: theme.color.state.pressed,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.color.overlay.scrim,
  },
  sheet: {
    backgroundColor: theme.color.surface.overlay,
    borderTopColor: theme.color.border.subtle,
    borderTopLeftRadius: theme.radii.modal,
    borderTopRightRadius: theme.radii.modal,
    borderTopWidth: theme.sizes.border,
    maxWidth: theme.sizes.maxContentWidth,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    width: '100%',
  },
  sheetAction: {
    alignItems: 'center',
    borderRadius: theme.radii.button,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.md,
  },
  sheetActionLabel: {
    color: theme.color.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  sheetActionPressed: {
    backgroundColor: theme.color.state.pressed,
  },
  sheetFrame: {
    alignItems: 'center',
    width: '100%',
  },
  sheetSeparator: {
    backgroundColor: theme.color.separatorInset,
    height: theme.sizes.border,
    marginHorizontal: theme.spacing.md,
  },
});
