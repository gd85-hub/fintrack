import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { type ComponentProps, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
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

const sidebarTabs: readonly RouteTab[] = [...leftTabs, ...rightTabs];

// Fixed web navigation width; the Scale tokens do not cover page-level rails.
export const SIDEBAR_WIDTH = 240;

const sidebarPosition = Platform.select({
  default: 'absolute',
  web: 'fixed',
}) as ViewStyle['position'];

export function TabBar({ navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  function renderRouteTab(tab: RouteTab, placement: 'bottom' | 'sidebar') {
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
        onPress={() => handleRoutePress(routeIndex)}
        style={({ pressed }) => [
          placement === 'sidebar' ? styles.sidebarRouteTab : styles.routeTab,
          placement === 'sidebar' && focused && styles.sidebarRouteTabActive,
          pressed && styles.routeTabPressed,
        ]}
      >
        {focused && placement === 'bottom' ? (
          <View style={styles.activeIndicator} />
        ) : null}
        <Feather
          color={iconColor}
          name={tab.icon}
          size={
            placement === 'sidebar'
              ? theme.scale.size.iconLg
              : theme.spacing.lg
          }
        />
        <Text
          style={[
            placement === 'sidebar'
              ? styles.sidebarRouteLabel
              : styles.routeLabel,
            { color: textColor },
          ]}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  function handleRoutePress(routeIndex: number) {
    const route = state.routes[routeIndex];

    if (!route) {
      return;
    }

    const event = navigation.emit({
      canPreventDefault: true,
      target: route.key,
      type: 'tabPress',
    });

    if (state.index !== routeIndex && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  }

  function openAddRoute(
    route:
      | '/(app)/expense/new'
      | '/(app)/receipt/scan'
      | '/(app)/receipt/scan?mode=image',
  ) {
    setAddSheetVisible(false);
    router.push(route);
  }

  return (
    <>
      {Platform.OS === 'web' ? (
        <View style={styles.sidebar}>
          <Pressable
            accessibilityLabel="Добавить"
            accessibilityRole="button"
            accessibilityState={{ expanded: addSheetVisible }}
            onPress={() => setAddSheetVisible(true)}
            style={({ pressed }) => [
              styles.sidebarAddButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Feather
              color={theme.color.action.primary.icon}
              name="plus"
              size={theme.scale.size.iconLg}
            />
            <Text style={styles.sidebarAddLabel}>Добавить</Text>
          </Pressable>

          <View style={styles.sidebarNav}>
            {sidebarTabs.map((tab) => renderRouteTab(tab, 'sidebar'))}
          </View>
        </View>
      ) : (
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
          {leftTabs.map((tab) => renderRouteTab(tab, 'bottom'))}

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

          {rightTabs.map((tab) => renderRouteTab(tab, 'bottom'))}
        </View>
      )}

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
              {Platform.OS !== 'web' ? (
                <>
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
                    <Text style={styles.sheetActionLabel}>
                      Сканировать чек
                    </Text>
                  </Pressable>

                  <View style={styles.sheetSeparator} />
                </>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  openAddRoute('/(app)/receipt/scan?mode=image')
                }
                style={({ pressed }) => [
                  styles.sheetAction,
                  pressed && styles.sheetActionPressed,
                ]}
              >
                <Feather
                  color={theme.color.icon.primary}
                  name="image"
                  size={theme.spacing.lg}
                />
                <Text style={styles.sheetActionLabel}>
                  Загрузить фото
                </Text>
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
                <Text style={styles.sheetActionLabel}>
                  Добавить вручную
                </Text>
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
  sidebar: {
    backgroundColor: theme.color.surface.default,
    borderRightColor: theme.color.border.subtle,
    borderRightWidth: theme.scale.stroke.hairline,
    bottom: 0,
    left: 0,
    paddingHorizontal: theme.scale.space[3],
    paddingVertical: theme.scale.space[6],
    position: sidebarPosition,
    top: 0,
    width: SIDEBAR_WIDTH,
  },
  sidebarAddButton: {
    alignItems: 'center',
    backgroundColor: theme.color.action.primary.fill,
    borderRadius: theme.scale.radius.md,
    flexDirection: 'row',
    gap: theme.scale.space[2],
    justifyContent: 'center',
    minHeight: theme.scale.size.touchTarget,
    paddingHorizontal: theme.scale.space[3],
  },
  sidebarAddLabel: {
    ...theme.type.labelDefault,
    color: theme.color.action.primary.content,
  },
  sidebarNav: {
    gap: theme.scale.space[2],
    paddingTop: theme.scale.space[6],
  },
  sidebarRouteLabel: {
    ...theme.type.labelDefault,
  },
  sidebarRouteTab: {
    alignItems: 'center',
    borderRadius: theme.scale.radius.md,
    flexDirection: 'row',
    gap: theme.scale.space[3],
    minHeight: theme.scale.size.touchTarget,
    paddingHorizontal: theme.scale.space[3],
  },
  sidebarRouteTabActive: {
    backgroundColor: theme.color.surface.selected,
  },
});
