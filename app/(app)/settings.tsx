import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
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
import { useColors } from '../../contexts/ThemeContext';
import { theme, type Colors } from '../../lib/theme';

type SettingsRouteRowProps = {
  label: string;
  onPress: () => void;
};

type SettingsSectionProps = {
  children: ReactNode;
  title: string;
};

function useSettingsStyles() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  return { colors, styles };
}

function SettingsSection({ children, title }: SettingsSectionProps) {
  const { styles } = useSettingsStyles();

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
  const { colors, styles } = useSettingsStyles();

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
        color={colors.icon.secondary}
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
  const { styles } = useSettingsStyles();

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
  const { colors, styles } = useSettingsStyles();
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
              color={colors.icon.secondary}
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
              color={colors.action.destructive.fill}
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
              color={colors.icon.secondary}
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
              placeholderTextColor={colors.field.placeholder}
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
                          color={colors.icon.action}
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

const makeStyles = (c: Colors) => StyleSheet.create({
  aboutRow: {
    justifyContent: 'center',
    minHeight: theme.sizes.floatingButton,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  aboutText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
  },
  cancelButton: {
    backgroundColor: c.action.secondary.fill,
    borderColor: c.action.secondary.border,
    borderWidth: theme.sizes.border,
  },
  cancelButtonText: {
    color: c.action.secondary.content,
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
    color: c.action.destructive.fill,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  destructiveRowPressed: {
    backgroundColor: c.status.error.container,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  disabledRowLabel: {
    color: c.text.disabled,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  errorText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.caption,
  },
  list: {
    backgroundColor: c.surface.default,
    borderColor: c.border.default,
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
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  languageOptions: {
    borderColor: c.border.default,
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
    backgroundColor: c.surface.raised,
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
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  nameInput: {
    backgroundColor: c.field.fill,
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    height: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  nameInputError: {
    borderColor: c.field.borderError,
  },
  nameInputFocused: {
    borderColor: c.field.borderFocus,
  },
  placeholderValue: {
    color: c.text.tertiary,
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
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  rowValue: {
    color: c.text.secondary,
    flexShrink: 1,
    fontSize: theme.fontSizes.caption,
    textAlign: 'right',
  },
  rowPressed: {
    backgroundColor: c.state.pressed,
  },
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: c.overlay.scrim,
  },
  section: {
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: c.text.tertiary,
    fontSize: theme.fontSizes.caption,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.xs,
    textTransform: 'uppercase',
  },
  saveButton: {
    backgroundColor: c.action.primary.fill,
  },
  saveButtonText: {
    color: c.action.primary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  separator: {
    backgroundColor: c.separatorInset,
    height: theme.sizes.border,
    marginLeft: theme.spacing.md,
  },
  soonTag: {
    backgroundColor: c.surface.muted,
    borderRadius: theme.radii.chip,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
  },
  soonText: {
    color: c.text.tertiary,
    fontSize: theme.fontSizes.small,
    fontWeight: '600',
  },
});
