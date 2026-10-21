import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { Fragment, type ReactNode, useCallback, useState } from 'react';
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
import {
  type Language,
  useLanguage,
} from '../../contexts/LanguageContext';
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

function SettingsDisabledRow({
  comingSoon,
  label,
}: {
  comingSoon: string;
  label: string;
}) {
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      style={styles.row}
    >
      <Text style={styles.disabledRowLabel}>{label}</Text>
      <View style={styles.soonTag}>
        <Text style={styles.soonText}>{comingSoon}</Text>
      </View>
    </View>
  );
}

const languageOptions: readonly {
  labelKey:
    | 'settings.language.system'
    | 'settings.language.russian'
    | 'settings.language.english';
  value: Language;
}[] = [
  { labelKey: 'settings.language.system', value: 'system' },
  { labelKey: 'settings.language.russian', value: 'ru' },
  { labelKey: 'settings.language.english', value: 'en' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut, updateName, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  const [hasSignOutError, setHasSignOutError] = useState(false);
  const [nameEditorVisible, setNameEditorVisible] = useState(false);
  const [languageSelectorVisible, setLanguageSelectorVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameInputFocused, setNameInputFocused] = useState(false);
  const [hasNameError, setHasNameError] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const metadataName = user?.user_metadata.name;
  const currentName =
    typeof metadataName === 'string' ? metadataName.trim() : '';

  function openNameEditor() {
    setNameInput(currentName);
    setHasNameError(false);
    setNameEditorVisible(true);
  }

  function closeNameEditor() {
    if (savingName) {
      return;
    }

    setNameEditorVisible(false);
    setHasNameError(false);
    setNameInputFocused(false);
  }

  async function handleSaveName() {
    setSavingName(true);
    setHasNameError(false);

    const { error } = await updateName(nameInput);
    if (error) {
      setHasNameError(true);
      setSavingName(false);
      return;
    }

    setSavingName(false);
    setNameEditorVisible(false);
    setNameInputFocused(false);
  }

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setHasSignOutError(false);

    const { error } = await signOut();
    if (error) {
      setHasSignOutError(true);
      setSigningOut(false);
    }
  }, [signOut]);

  const currentLanguageLabel =
    languageOptions.find((option) => option.value === language)?.labelKey ??
    'settings.language.system';

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('settings.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection title={t('settings.section.account')}>
          <Pressable
            accessibilityLabel={`${t('settings.name.label')}, ${
              currentName || t('settings.name.add')
            }`}
            accessibilityRole="button"
            onPress={openNameEditor}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
            ]}
          >
            <Text style={styles.rowLabel}>
              {t('settings.name.label')}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.rowValue,
                !currentName && styles.placeholderValue,
              ]}
            >
              {currentName || t('settings.name.add')}
            </Text>
            <Feather
              color={theme.color.icon.secondary}
              name="chevron-right"
              size={theme.spacing.lg}
            />
          </Pressable>

          <View style={styles.separator} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.email')}</Text>
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
              {signingOut
                ? t('settings.signingOut')
                : t('settings.signOut')}
            </Text>
            <Feather
              color={theme.color.action.destructive.fill}
              name="log-out"
              size={theme.spacing.lg}
            />
          </Pressable>
        </SettingsSection>

        {hasSignOutError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {t('settings.signOutError')}
          </Text>
        ) : null}

        <SettingsSection title={t('settings.section.management')}>
          <SettingsRouteRow
            label={t('settings.managePlaces')}
            onPress={() => router.push('/(app)/merchants')}
          />
          <View style={styles.separator} />
          <SettingsRouteRow
            label={t('settings.manageCategories')}
            onPress={() => router.push('/(app)/categories')}
          />
          <View style={styles.separator} />
          <SettingsDisabledRow
            comingSoon={t('settings.comingSoon')}
            label={t('settings.manageCurrencies')}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.section.preferences')}>
          <SettingsDisabledRow
            comingSoon={t('settings.comingSoon')}
            label={t('settings.theme')}
          />
          <View style={styles.separator} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: languageSelectorVisible }}
            onPress={() => setLanguageSelectorVisible(true)}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
            ]}
          >
            <Text style={styles.rowLabel}>
              {t('settings.language.label')}
            </Text>
            <Text numberOfLines={1} style={styles.rowValue}>
              {t(currentLanguageLabel)}
            </Text>
            <Feather
              color={theme.color.icon.secondary}
              name="chevron-right"
              size={theme.spacing.lg}
            />
          </Pressable>
        </SettingsSection>

        <SettingsSection title={t('settings.section.data')}>
          <SettingsDisabledRow
            comingSoon={t('settings.comingSoon')}
            label={t('settings.export')}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.section.about')}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutText}>{t('settings.about.privacy')}</Text>
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
            accessibilityLabel={t('settings.name.close')}
            accessibilityRole="button"
            disabled={savingName}
            onPress={closeNameEditor}
            style={styles.scrim}
          />
          <View accessibilityViewIsModal={true} style={styles.modalPanel}>
            <Text style={styles.modalTitle}>{t('settings.name.edit')}</Text>
            <TextInput
              accessibilityLabel={t('settings.name.label')}
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
              placeholder={t('settings.name.label')}
              placeholderTextColor={theme.color.field.placeholder}
              returnKeyType="done"
              selectTextOnFocus={true}
              style={[
                styles.nameInput,
                nameInputFocused && styles.nameInputFocused,
                hasNameError && styles.nameInputError,
              ]}
              value={nameInput}
            />

            {hasNameError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {t('settings.name.error')}
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
                <Text style={styles.cancelButtonText}>
                  {t('settings.name.cancel')}
                </Text>
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
                  {savingName
                    ? t('settings.name.saving')
                    : t('settings.name.save')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setLanguageSelectorVisible(false)}
        transparent={true}
        visible={languageSelectorVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={t('settings.language.close')}
            accessibilityRole="button"
            onPress={() => setLanguageSelectorVisible(false)}
            style={styles.scrim}
          />
          <View accessibilityViewIsModal={true} style={styles.modalPanel}>
            <Text style={styles.modalTitle}>
              {t('settings.language.title')}
            </Text>
            <View style={styles.languageOptions}>
              {languageOptions.map((option, index) => {
                const selected = language === option.value;

                return (
                  <Fragment key={option.value}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        setLanguage(option.value);
                        setLanguageSelectorVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.languageOption,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <Text style={styles.languageOptionLabel}>
                        {t(option.labelKey)}
                      </Text>
                      {selected ? (
                        <Feather
                          color={theme.color.icon.action}
                          name="check"
                          size={theme.spacing.lg}
                        />
                      ) : null}
                    </Pressable>
                    {index < languageOptions.length - 1 ? (
                      <View style={styles.separator} />
                    ) : null}
                  </Fragment>
                );
              })}
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
  languageOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  languageOptionLabel: {
    color: theme.color.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  languageOptions: {
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.input,
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
    ...StyleSheet.absoluteFill,
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
