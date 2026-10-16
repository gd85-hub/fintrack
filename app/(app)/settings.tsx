import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../lib/theme';

type SettingsRouteRowProps = {
  label: string;
  onPress: () => void;
};

function SettingsRouteRow({ label, onPress }: SettingsRouteRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Feather
        color={theme.color.icon.secondary}
        name="chevron-right"
        size={theme.spacing.lg}
      />
    </Pressable>
  );
}

function SettingsDisabledRow({ label }: { label: string }) {
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      style={styles.row}
    >
      <Text style={styles.disabledRowLabel}>{label}</Text>
      <View style={styles.soonTag}>
        <Text style={styles.soonText}>Coming soon</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setErrorMessage('');

    const { error } = await signOut();
    if (error) {
      setErrorMessage("Couldn't sign out. Try again.");
      setSigningOut(false);
    }
  }, [signOut]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.list}>
          <SettingsRouteRow
            label="Manage places"
            onPress={() => router.push('/(app)/merchants')}
          />
          <View style={styles.separator} />
          <SettingsRouteRow
            label="Manage categories"
            onPress={() => router.push('/(app)/categories')}
          />
          <View style={styles.separator} />
          <SettingsDisabledRow label="Manage currencies" />
          <View style={styles.separator} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: signingOut }}
            disabled={signingOut}
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.destructiveRowPressed,
              signingOut && styles.disabled,
            ]}
          >
            <Text style={styles.destructiveLabel}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Text>
            <Feather
              color={theme.color.action.destructive.fill}
              name="log-out"
              size={theme.spacing.lg}
            />
          </Pressable>
        </View>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    gap: theme.spacing.md,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: '100%',
  },
  destructiveLabel: {
    color: theme.color.action.destructive.fill,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  destructiveRowPressed: {
    backgroundColor: theme.color.status.error.container,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  disabledRowLabel: {
    color: theme.color.text.disabled,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  errorText: {
    color: theme.color.status.error.content,
    fontSize: theme.fontSizes.caption,
  },
  list: {
    backgroundColor: theme.color.surface.default,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  rowLabel: {
    color: theme.color.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  rowPressed: {
    backgroundColor: theme.color.state.pressed,
  },
  screen: {
    backgroundColor: theme.color.bg.base,
    flex: 1,
  },
  separator: {
    backgroundColor: theme.color.separatorInset,
    height: theme.sizes.border,
    marginLeft: theme.spacing.md,
  },
  soonTag: {
    backgroundColor: theme.color.surface.muted,
    borderRadius: theme.radii.chip,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
  },
  soonText: {
    color: theme.color.text.tertiary,
    fontSize: theme.fontSizes.small,
    fontWeight: '600',
  },
});
