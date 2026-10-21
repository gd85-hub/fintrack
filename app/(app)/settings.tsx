import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../lib/theme';

type SettingsRouteRowProps = {
  label: string;
  onPress: () => void;
};

type SettingsSectionProps = {
  children: ReactNode;
  title: string;
};

function SettingsSection({ children, title }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.list}>{children}</View>
    </View>
  );
}

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
  const { signOut, updateName, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [nameEditorVisible, setNameEditorVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameInputFocused, setNameInputFocused] = useState(false);
  const [nameErrorMessage, setNameErrorMessage] = useState('');
  const [savingName, setSavingName] = useState(false);
  const metadataName = user?.user_metadata.name;
  const currentName =
    typeof metadataName === 'string' ? metadataName.trim() : '';

  function openNameEditor() {
    setNameInput(currentName);
    setNameErrorMessage('');
    setNameEditorVisible(true);
  }

  function closeNameEditor() {
    if (savingName) {
      return;
    }

    setNameEditorVisible(false);
    setNameErrorMessage('');
    setNameInputFocused(false);
  }

  async function handleSaveName() {
    setSavingName(true);
    setNameErrorMessage('');

    const { error } = await updateName(nameInput);
    if (error) {
      setNameErrorMessage("Couldn't save. Try again.");
      setSavingName(false);
      return;
    }

    setSavingName(false);
    setNameEditorVisible(false);
    setNameInputFocused(false);
  }

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
        <SettingsSection title="Account">
          <Pressable
            accessibilityLabel={`Name, ${currentName || 'Add name'}`}
            accessibilityRole="button"
            onPress={openNameEditor}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
            ]}
          >
            <Text style={styles.rowLabel}>Name</Text>
            <Text
              numberOfLines={1}
              style={[
                styles.rowValue,
                !currentName && styles.placeholderValue,
              ]}
            >
              {currentName || 'Add name'}
            </Text>
            <Feather
              color={theme.color.icon.secondary}
              name="chevron-right"
              size={theme.spacing.lg}
            />
          </Pressable>

          <View style={styles.separator} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text numberOfLines={1} style={styles.rowValue}>
              {user?.email ?? ''}
            </Text>
          </View>

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
        </SettingsSection>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        <SettingsSection title="Management">
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
        </SettingsSection>

        <SettingsSection title="Preferences">
          <SettingsDisabledRow label="Theme" />
          <View style={styles.separator} />
          <SettingsDisabledRow label="Language" />
        </SettingsSection>

        <SettingsSection title="Data">
          <SettingsDisabledRow label="Export" />
        </SettingsSection>

        <SettingsSection title="About">
          <View style={styles.aboutRow}>
            <Text style={styles.aboutText}>
              Receipt photos aren't stored on our servers.
            </Text>
          </View>
        </SettingsSection>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closeNameEditor}
        transparent={true}
        visible={nameEditorVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close name editor"
            accessibilityRole="button"
            disabled={savingName}
            onPress={closeNameEditor}
            style={styles.scrim}
          />
          <View accessibilityViewIsModal={true} style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Edit name</Text>
            <TextInput
              accessibilityLabel="Name"
              autoCapitalize="words"
              autoFocus={true}
              editable={!savingName}
              onBlur={() => setNameInputFocused(false)}
              onChangeText={setNameInput}
              onFocus={() => setNameInputFocused(true)}
              onSubmitEditing={() => {
                if (!savingName) {
                  void handleSaveName();
                }
              }}
              placeholder="Name"
              placeholderTextColor={theme.color.field.placeholder}
              returnKeyType="done"
              selectTextOnFocus={true}
              style={[
                styles.nameInput,
                nameInputFocused && styles.nameInputFocused,
                nameErrorMessage && styles.nameInputError,
              ]}
              value={nameInput}
            />

            {nameErrorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {nameErrorMessage}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={savingName}
                onPress={closeNameEditor}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.cancelButton,
                  (pressed || savingName) && styles.disabled,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: savingName }}
                disabled={savingName}
                onPress={() => void handleSaveName()}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.saveButton,
                  (pressed || savingName) && styles.disabled,
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {savingName ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  aboutRow: {
    justifyContent: 'center',
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  aboutText: {
    color: theme.color.text.secondary,
    fontSize: theme.fontSizes.caption,
  },
  cancelButton: {
    backgroundColor: theme.color.action.secondary.fill,
    borderColor: theme.color.action.secondary.border,
    borderWidth: theme.sizes.border,
  },
  cancelButtonText: {
    color: theme.color.action.secondary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
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
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalButton: {
    alignItems: 'center',
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  modalPanel: {
    backgroundColor: theme.color.surface.raised,
    borderRadius: theme.radii.modal,
    gap: theme.spacing.md,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: theme.sizes.modalWidth,
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  modalTitle: {
    color: theme.color.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  nameInput: {
    backgroundColor: theme.color.field.fill,
    borderColor: theme.color.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.color.text.primary,
    fontSize: theme.fontSizes.body,
    height: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  nameInputError: {
    borderColor: theme.color.field.borderError,
  },
  nameInputFocused: {
    borderColor: theme.color.field.borderFocus,
  },
  placeholderValue: {
    color: theme.color.text.tertiary,
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
  rowValue: {
    color: theme.color.text.secondary,
    flexShrink: 1,
    fontSize: theme.fontSizes.caption,
    textAlign: 'right',
  },
  rowPressed: {
    backgroundColor: theme.color.state.pressed,
  },
  screen: {
    backgroundColor: theme.color.bg.base,
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.overlay.scrim,
  },
  section: {
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.color.text.tertiary,
    fontSize: theme.fontSizes.caption,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.xs,
    textTransform: 'uppercase',
  },
  saveButton: {
    backgroundColor: theme.color.action.primary.fill,
  },
  saveButtonText: {
    color: theme.color.action.primary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
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
