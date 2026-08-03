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
import {
  deleteMerchant,
  listMerchantsForManagement,
  type ManagedMerchant,
  mergeMerchants,
  renameMerchant,
} from '../../lib/db';
import { findMerchantRenameCollision } from '../../lib/merchantManagement';
import { filterAndSortMerchants } from '../../lib/merchantSearch';
import { theme } from '../../lib/theme';

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
            setErrorMessage(
              'Не удалось загрузить места. Попробуйте ещё раз.',
            );
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
    }, [refreshKey]),
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
      setRenameError('Укажите название места.');
      return;
    }
    const collision = findMerchantRenameCollision(
      merchants,
      merchant.id,
      trimmedName,
    );
    if (collision) {
      setRenameCollision(collision);
      setRenameError(
        `Место «${collision.name}» уже существует. Объедините записи вместо переименования.`,
      );
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
          `Место «${result.merchantName}» уже существует. Объедините записи вместо переименования.`,
        );
        return;
      }
      cancelRename();
      refresh();
    } catch (error: unknown) {
      console.error('Unable to rename merchant:', error);
      setRenameError(
        'Не удалось переименовать место. Попробуйте ещё раз.',
      );
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
          ? 'Не удалось объединить места. Изменения отменены; попробуйте ещё раз.'
          : 'Не удалось удалить место. Попробуйте ещё раз.',
      );
    } finally {
      setSaving(false);
    }
  }

  const confirmationTitle =
    pendingAction?.kind === 'merge'
      ? `Объединить выбранные места с «${pendingAction.target.name}»? Будет перенесено трат: ${pendingAction.expenseCount}. Дубликаты будут удалены.`
      : pendingAction?.kind === 'delete'
        ? pendingAction.merchant.usageCount > 0
          ? `Удалить «${pendingAction.merchant.name}»? Связанные траты (${pendingAction.merchant.usageCount}) останутся без места; чеки и подписки также будут отвязаны. Для дубликата безопаснее выбрать «Объединить».`
          : `Удалить «${pendingAction.merchant.name}»? Связанных трат нет; чеки и подписки также будут отвязаны.`
        : '';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Назад"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Управление местами</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          accessibilityLabel="Поиск места"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Поиск места…"
          placeholderTextColor={theme.colors.textMuted}
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
              <Text style={styles.retryText}>Повторить</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : errorMessage && merchants.length === 0 ? null : mergeTarget ? (
          <View style={styles.mergePanel}>
            <Text style={styles.sectionTitle}>
              Объединить с «{mergeTarget.name}»
            </Text>
            <Text style={styles.hintText}>
              Выберите один или несколько дубликатов. Все связанные
              траты, чеки и подписки перейдут к целевому месту.
            </Text>

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
                        {merchant.typeEmoji} {merchant.typeName} · Трат:{' '}
                        {merchant.usageCount}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {query.trim() && mergeCandidates.length === 0 ? (
              <Text style={styles.emptyText}>Ничего не найдено</Text>
            ) : null}

            <Text style={styles.mergeSummary}>
              Выбрано мест: {mergeSourceIds.size} · Будет перенесено трат:{' '}
              {selectedMergeExpenseCount}
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
                <Text style={styles.secondaryButtonText}>Отмена</Text>
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
                <Text style={styles.primaryButtonText}>Продолжить</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.list}>
            {displayedMerchants.map((merchant) => (
              <View key={merchant.id} style={styles.merchantCard}>
                {editingId === merchant.id ? (
                  <View style={styles.renameForm}>
                    <Text style={styles.sectionTitle}>Переименовать</Text>
                    <TextInput
                      autoCapitalize="sentences"
                      autoFocus
                      maxLength={80}
                      onChangeText={(value) => {
                        setRenameValue(value);
                        setRenameError('');
                        setRenameCollision(null);
                      }}
                      placeholder="Название места"
                      placeholderTextColor={theme.colors.textMuted}
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
                          Объединить с «{renameCollision.name}»
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
                          Отмена
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
                          {saving ? 'Сохранение…' : 'Сохранить'}
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
                        {merchant.typeEmoji} {merchant.typeName} · Трат:{' '}
                        {merchant.usageCount}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => startRename(merchant)}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Text style={styles.actionText}>
                          Переименовать
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => startMerge(merchant.id)}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Text style={styles.actionText}>Объединить</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setPendingAction({ kind: 'delete', merchant })
                        }
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Text style={styles.deleteText}>Удалить</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}

            {displayedMerchants.length === 0 ? (
              <Text style={styles.emptyText}>
                {query.trim() ? 'Ничего не найдено' : 'Мест пока нет'}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        confirmLabel={
          pendingAction?.kind === 'merge' ? 'Объединить' : 'Удалить'
        }
        confirming={saving}
        confirmingLabel={
          pendingAction?.kind === 'merge'
            ? 'Объединение…'
            : 'Удаление…'
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

const styles = StyleSheet.create({
  actionText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  backText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  checkboxText: {
    color: theme.colors.accent,
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
    color: theme.colors.danger,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
    paddingVertical: theme.spacing.xl,
    textAlign: 'center',
  },
  errorState: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.caption,
  },
  formActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
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
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
  },
  list: {
    gap: theme.spacing.sm,
  },
  merchantCard: {
    borderColor: theme.colors.border,
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
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
  },
  merchantName: {
    color: theme.colors.text,
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
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  mergeRowSelected: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
  },
  mergeSuggestion: {
    alignItems: 'center',
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  mergeSuggestionText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  mergeSummary: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  renameForm: {
    gap: theme.spacing.sm,
  },
  renameInput: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  retryText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  searchInput: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  title: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
});
