import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColors } from '../../contexts/ThemeContext';
import {
  deleteMerchant,
  listMerchantsForManagement,
  type ManagedMerchant,
  mergeMerchants,
  renameMerchant,
} from '../../lib/db';
import { findMerchantRenameCollision } from '../../lib/merchantManagement';
import { filterAndSortMerchants } from '../../lib/merchantSearch';
import { theme, type Colors } from '../../lib/theme';

type PendingAction =
  | {
      kind: 'delete';
      merchant: ManagedMerchant;
    }
  | {
      expenseCount: number;
      kind: 'merge';
      sourceIds: string[];
      target: ManagedMerchant;
    };

export default function MerchantsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [merchants, setMerchants] = useState<ManagedMerchant[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameCollision, setRenameCollision] =
    useState<ManagedMerchant | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergeSourceIds, setMergeSourceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingAction, setPendingAction] =
    useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setErrorMessage('');

      void listMerchantsForManagement()
        .then((rows) => {
          if (active) {
            setMerchants(rows);
          }
        })
        .catch((error: unknown) => {
          console.error('Unable to load merchants:', error);
          if (active) {
            setErrorMessage(t('merchant.loadFailed'));
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [refreshKey, t]),
  );

  const displayedMerchants = useMemo(
    () => filterAndSortMerchants(merchants, query),
    [merchants, query],
  );
  const mergeTarget = useMemo(
    () =>
      merchants.find((merchant) => merchant.id === mergeTargetId) ??
      null,
    [mergeTargetId, merchants],
  );
  const mergeCandidates = useMemo(
    () =>
      displayedMerchants.filter(
        (merchant) => merchant.id !== mergeTargetId,
      ),
    [displayedMerchants, mergeTargetId],
  );
  const selectedMergeExpenseCount = useMemo(
    () =>
      merchants.reduce(
        (total, merchant) =>
          total +
          (mergeSourceIds.has(merchant.id) ? merchant.usageCount : 0),
        0,
      ),
    [merchants, mergeSourceIds],
  );

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function cancelRename() {
    setEditingId(null);
    setRenameValue('');
    setRenameError('');
    setRenameCollision(null);
  }

  function startRename(merchant: ManagedMerchant) {
    setEditingId(merchant.id);
    setRenameValue(merchant.name);
    setRenameError('');
    setRenameCollision(null);
  }

  function startMerge(targetId: string, sourceIds: readonly string[] = []) {
    cancelRename();
    setQuery('');
    setMergeTargetId(targetId);
    setMergeSourceIds(new Set(sourceIds));
  }

  function cancelMerge() {
    setMergeTargetId(null);
    setMergeSourceIds(new Set());
    setQuery('');
  }

  function toggleMergeSource(merchantId: string) {
    setMergeSourceIds((current) => {
      const next = new Set(current);
      if (next.has(merchantId)) {
        next.delete(merchantId);
      } else {
        next.add(merchantId);
      }
      return next;
    });
  }

  async function handleRename(merchant: ManagedMerchant) {
    const trimmedName = renameValue.trim();
    if (!trimmedName) {
      setRenameError(t('merchant.nameRequired'));
      return;
    }
    const collision = findMerchantRenameCollision(
      merchants,
      merchant.id,
      trimmedName,
    );
    if (collision) {
      setRenameCollision(collision);
      setRenameError(t('merchant.existsRename', { name: collision.name }));
      return;
    }

    setSaving(true);
    setRenameError('');
    setRenameCollision(null);
    try {
      const result = await renameMerchant(merchant.id, trimmedName);
      if (result.kind === 'collision') {
        const existing = merchants.find(
          (item) => item.id === result.merchantId,
        );
        setRenameCollision(existing ?? null);
        setRenameError(
          t('merchant.existsRename', { name: result.merchantName }),
        );
        return;
      }
      cancelRename();
      refresh();
    } catch (error: unknown) {
      console.error('Unable to rename merchant:', error);
      setRenameError(t('merchant.renameFailed'));
    } finally {
      setSaving(false);
    }
  }

  function prepareMerge() {
    if (!mergeTarget || mergeSourceIds.size === 0) {
      return;
    }
    setPendingAction({
      expenseCount: selectedMergeExpenseCount,
      kind: 'merge',
      sourceIds: [...mergeSourceIds],
      target: mergeTarget,
    });
  }

  async function confirmPendingAction() {
    if (!pendingAction) {
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      if (pendingAction.kind === 'merge') {
        await mergeMerchants(
          pendingAction.target.id,
          pendingAction.sourceIds,
        );
        cancelMerge();
      } else {
        await deleteMerchant(pendingAction.merchant.id);
      }
      setPendingAction(null);
      refresh();
    } catch (error: unknown) {
      console.error('Unable to manage merchant:', error);
      setPendingAction(null);
      setErrorMessage(
        pendingAction.kind === 'merge'
          ? t('merchant.mergeFailed')
          : t('merchant.deleteFailed'),
      );
    } finally {
      setSaving(false);
    }
  }

  const confirmationTitle =
    pendingAction?.kind === 'merge'
      ? t('merchant.confirmMerge', {
          count: pendingAction.expenseCount,
          target: pendingAction.target.name,
        })
      : pendingAction?.kind === 'delete'
        ? pendingAction.merchant.usageCount > 0
          ? t('merchant.confirmDeleteWithUsage', {
              count: pendingAction.merchant.usageCount,
              name: pendingAction.merchant.name,
            })
          : t('merchant.confirmDeleteEmpty', {
              name: pendingAction.merchant.name,
            })
        : '';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          onPress={() => router.replace('/(app)/settings')}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('merchant.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          accessibilityLabel={t('merchant.searchA11y')}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder={t('merchant.searchPlaceholder')}
          placeholderTextColor={colors.text.secondary}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />

        {errorMessage ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={refresh}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.retryText}>{t('home.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.action.primary.fill} />
        ) : errorMessage && merchants.length === 0 ? null : mergeTarget ? (
          <View style={styles.mergePanel}>
            <Text style={styles.sectionTitle}>
              {t('merchant.mergeWith', { name: mergeTarget.name })}
            </Text>
            <Text style={styles.hintText}>{t('merchant.mergeHint')}</Text>

            <View style={styles.mergeList}>
              {mergeCandidates.map((merchant) => {
                const selected = mergeSourceIds.has(merchant.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={merchant.id}
                    onPress={() => toggleMergeSource(merchant.id)}
                    style={({ pressed }) => [
                      styles.mergeRow,
                      selected && styles.mergeRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.checkbox}>
                      <Text style={styles.checkboxText}>
                        {selected ? '✓' : ''}
                      </Text>
                    </View>
                    <View style={styles.merchantCopy}>
                      <Text style={styles.merchantName}>
                        {merchant.name}
                      </Text>
                      <Text style={styles.merchantMeta}>
                        {t('merchant.usage', {
                          count: merchant.usageCount,
                        })}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {query.trim() && mergeCandidates.length === 0 ? (
              <Text style={styles.emptyText}>
                {t('common.nothingFound')}
              </Text>
            ) : null}

            <Text style={styles.mergeSummary}>
              {t('merchant.mergeSummary', {
                moved: selectedMergeExpenseCount,
                selected: mergeSourceIds.size,
              })}
            </Text>
            <View style={styles.formActions}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={cancelMerge}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving || mergeSourceIds.size === 0}
                onPress={prepareMerge}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || saving || mergeSourceIds.size === 0) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {t('common.continue')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.list}>
            {displayedMerchants.map((merchant) => (
              <View key={merchant.id} style={styles.merchantCard}>
                {editingId === merchant.id ? (
                  <View style={styles.renameForm}>
                    <Text style={styles.sectionTitle}>
                      {t('merchant.rename')}
                    </Text>
                    <TextInput
                      autoCapitalize="sentences"
                      autoFocus
                      maxLength={80}
                      onChangeText={(value) => {
                        setRenameValue(value);
                        setRenameError('');
                        setRenameCollision(null);
                      }}
                      placeholder={t('merchant.namePlaceholder')}
                      placeholderTextColor={colors.text.secondary}
                      style={styles.renameInput}
                      value={renameValue}
                    />
                    {renameError ? (
                      <Text style={styles.errorText}>{renameError}</Text>
                    ) : null}
                    {renameCollision ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={() =>
                          startMerge(renameCollision.id, [merchant.id])
                        }
                        style={({ pressed }) => [
                          styles.mergeSuggestion,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.mergeSuggestionText}>
                          {t('merchant.mergeWith', {
                            name: renameCollision.name,
                          })}
                        </Text>
                      </Pressable>
                    ) : null}
                    <View style={styles.formActions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={cancelRename}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {t('common.cancel')}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={() => void handleRename(merchant)}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          (pressed || saving) && styles.disabled,
                        ]}
                      >
                        <Text style={styles.primaryButtonText}>
                          {saving ? t('common.saving') : t('common.save')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.merchantCopy}>
                      <Text style={styles.merchantName}>
                        {merchant.name}
                      </Text>
                      <Text style={styles.merchantMeta}>
                        {t('merchant.usage', {
                          count: merchant.usageCount,
                        })}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => startRename(merchant)}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Text style={styles.actionText}>
                          {t('merchant.rename')}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => startMerge(merchant.id)}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Text style={styles.actionText}>
                          {t('merchant.merge')}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setPendingAction({ kind: 'delete', merchant })
                        }
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Text style={styles.deleteText}>
                          {t('common.delete')}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}

            {displayedMerchants.length === 0 ? (
              <Text style={styles.emptyText}>
                {query.trim()
                  ? t('common.nothingFound')
                  : t('merchant.empty')}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        confirmLabel={
          pendingAction?.kind === 'merge'
            ? t('merchant.merge')
            : t('common.delete')
        }
        confirming={saving}
        confirmingLabel={
          pendingAction?.kind === 'merge'
            ? t('merchant.merging')
            : t('common.deleting')
        }
        onCancel={() => {
          if (!saving) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => void confirmPendingAction()}
        title={confirmationTitle}
        visible={pendingAction !== null}
      />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  actionText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  backText: {
    color: c.text.primary,
    fontSize: theme.fontSizes.title,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: c.border.default,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  checkboxText: {
    color: c.icon.action,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
  },
  deleteText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  emptyText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
    paddingVertical: theme.spacing.xl,
    textAlign: 'center',
  },
  errorState: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  errorText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.caption,
  },
  formActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: c.border.default,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  headerButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  hintText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
  },
  list: {
    gap: theme.spacing.sm,
  },
  merchantCard: {
    borderColor: c.border.subtle,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  merchantCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  merchantMeta: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
  },
  merchantName: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  mergeList: {
    gap: theme.spacing.xs,
  },
  mergePanel: {
    gap: theme.spacing.md,
  },
  mergeRow: {
    alignItems: 'center',
    borderColor: c.border.default,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  mergeRowSelected: {
    backgroundColor: c.action.container,
    borderColor: c.icon.action,
  },
  mergeSuggestion: {
    alignItems: 'center',
    borderColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  mergeSuggestionText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  mergeSummary: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  primaryButtonText: {
    color: c.action.primary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  renameForm: {
    gap: theme.spacing.sm,
  },
  renameInput: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  retryText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
  },
  searchInput: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: c.surface.default,
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: c.text.primary,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  sectionTitle: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  title: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
});
