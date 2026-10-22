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

import { CategoryPicker } from '../../components/CategoryPicker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { filterAndSortCategories } from '../../lib/categoryManagement';
import {
  createCategory,
  deleteCategory,
  type CategoryInput,
  type ExpenseCategoryType,
  listCategoriesForManagement,
  type ManagedCategory,
  mergeCategories,
  updateCategory,
} from '../../lib/db';
import { theme } from '../../lib/theme';

type EditorState = {
  category: ManagedCategory | null;
  input: CategoryInput;
};

type PendingAction =
  | {
      category: ManagedCategory;
      input: CategoryInput;
      kind: 'type-change';
    }
  | {
      category: ManagedCategory;
      kind: 'delete';
    }
  | {
      expenseCount: number;
      kind: 'merge';
      sourceIds: string[];
      target: ManagedCategory;
    };

const emptyCategoryInput: CategoryInput = {
  emoji: '',
  group: '',
  name: '',
  type: 'variable',
};

export default function CategoriesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergeSourceIds, setMergeSourceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingAction, setPendingAction] =
    useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);

  function typeLabel(type: ExpenseCategoryType) {
    return type === 'fixed' ? t('cat.typeFixed') : t('cat.typeVariable');
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setErrorMessage('');

      void listCategoriesForManagement()
        .then((rows) => {
          if (active) {
            setCategories(rows);
          }
        })
        .catch((error: unknown) => {
          console.error('Unable to load categories:', error);
          if (active) {
            setErrorMessage(t('cat.loadFailed'));
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

  const displayedCategories = useMemo(
    () => filterAndSortCategories(categories, query),
    [categories, query],
  );
  const existingGroups = useMemo(
    () =>
      [...new Set(categories.map((category) => category.group))].sort(
        (left, right) => left.localeCompare(right, 'ru'),
      ),
    [categories],
  );
  const mergeTarget = useMemo(
    () =>
      categories.find((category) => category.id === mergeTargetId) ??
      null,
    [categories, mergeTargetId],
  );
  const mergeSourceCandidates = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.isOwnedByCurrentUser &&
          category.id !== mergeTargetId,
      ),
    [categories, mergeTargetId],
  );
  const mergeTargetCandidates = useMemo(
    () =>
      categories.filter(
        (category) => !mergeSourceIds.has(category.id),
      ),
    [categories, mergeSourceIds],
  );
  const selectedMergeExpenseCount = useMemo(
    () =>
      categories.reduce(
        (total, category) =>
          total +
          (mergeSourceIds.has(category.id) ? category.usageCount : 0),
        0,
      ),
    [categories, mergeSourceIds],
  );
  const uncategorized = useMemo(
    () =>
      categories.find(
        (category) => category.slug === 'uncategorized',
      ) ?? null,
    [categories],
  );

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function closeEditor() {
    setEditor(null);
    setEditorError('');
  }

  function startCreate() {
    cancelMerge();
    setEditor({
      category: null,
      input: { ...emptyCategoryInput },
    });
    setEditorError('');
  }

  function startEdit(category: ManagedCategory) {
    if (!category.isOwnedByCurrentUser) {
      return;
    }
    cancelMerge();
    setEditor({
      category,
      input: {
        emoji: category.emoji,
        group: category.group,
        name: category.name,
        type: category.type,
      },
    });
    setEditorError('');
  }

  function updateEditorInput(patch: Partial<CategoryInput>) {
    setEditor((current) =>
      current
        ? { ...current, input: { ...current.input, ...patch } }
        : null,
    );
    setEditorError('');
  }

  async function persistEditor(currentEditor: EditorState) {
    setSaving(true);
    setEditorError('');
    try {
      if (currentEditor.category) {
        await updateCategory(
          currentEditor.category.id,
          currentEditor.input,
        );
      } else {
        await createCategory(currentEditor.input);
      }
      closeEditor();
      refresh();
    } catch (error: unknown) {
      console.error('Unable to save category:', error);
      setEditorError(t('cat.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function prepareEditorSave() {
    if (!editor) {
      return;
    }
    if (
      !editor.input.name.trim() ||
      !editor.input.emoji.trim() ||
      !editor.input.group.trim()
    ) {
      setEditorError(t('cat.fillFields'));
      return;
    }

    if (
      editor.category &&
      editor.category.usageCount > 0 &&
      editor.category.type !== editor.input.type
    ) {
      setPendingAction({
        category: editor.category,
        input: editor.input,
        kind: 'type-change',
      });
      return;
    }

    void persistEditor(editor);
  }

  function startMerge(source: ManagedCategory) {
    if (!source.isOwnedByCurrentUser) {
      return;
    }
    closeEditor();
    setQuery('');
    setMergeTargetId(null);
    setMergeSourceIds(new Set([source.id]));
  }

  function cancelMerge() {
    setMergeTargetId(null);
    setMergeSourceIds(new Set());
  }

  function chooseMergeTarget(categoryId: string) {
    setMergeTargetId(categoryId);
    setMergeSourceIds((current) => {
      const next = new Set(current);
      next.delete(categoryId);
      return next;
    });
  }

  function toggleMergeSource(categoryId: string) {
    setMergeSourceIds((current) => {
      if (current.has(categoryId) && current.size === 1) {
        return current;
      }
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
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
        await mergeCategories(
          pendingAction.target.id,
          pendingAction.sourceIds,
        );
        cancelMerge();
      } else if (pendingAction.kind === 'delete') {
        await deleteCategory(pendingAction.category.id);
      } else {
        await updateCategory(
          pendingAction.category.id,
          pendingAction.input,
        );
        closeEditor();
      }
      setPendingAction(null);
      refresh();
    } catch (error: unknown) {
      console.error('Unable to manage category:', error);
      const actionKind = pendingAction.kind;
      setPendingAction(null);
      setErrorMessage(
        actionKind === 'merge'
          ? t('cat.mergeFailed')
          : actionKind === 'delete'
            ? t('cat.deleteFailed')
            : t('cat.typeChangeFailed'),
      );
    } finally {
      setSaving(false);
    }
  }

  const confirmationTitle =
    pendingAction?.kind === 'merge'
      ? t('cat.confirmMerge', {
          count: pendingAction.expenseCount,
          target: pendingAction.target.name,
        })
      : pendingAction?.kind === 'delete'
        ? t('cat.confirmDelete', {
            count: pendingAction.category.usageCount,
            fallback: uncategorized?.name ?? t('cat.noCategory'),
            name: pendingAction.category.name,
          })
        : pendingAction?.kind === 'type-change'
          ? t('cat.confirmType', {
              count: pendingAction.category.usageCount,
              name: pendingAction.category.name,
              type: typeLabel(pendingAction.input.type),
            })
          : '';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('cat.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!editor && !mergeTargetId && mergeSourceIds.size === 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={startCreate}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{t('cat.create')}</Text>
          </Pressable>
        ) : null}

        {!editor && mergeSourceIds.size === 0 ? (
          <TextInput
            accessibilityLabel={t('cat.searchA11y')}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder={t('cat.searchPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
        ) : null}

        {errorMessage ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={refresh}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.actionText}>{t('home.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : errorMessage && categories.length === 0 ? null : editor ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              {editor.category
                ? t('cat.editTitle', { name: editor.category.name })
                : t('cat.newTitle')}
            </Text>

            <View style={styles.fieldRow}>
              <View style={styles.emojiField}>
                <Text style={styles.label}>{t('cat.emoji')}</Text>
                <TextInput
                  accessibilityLabel={t('cat.emojiA11y')}
                  maxLength={8}
                  onChangeText={(emoji) => updateEditorInput({ emoji })}
                  placeholder="🍬"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={editor.input.emoji}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={styles.label}>{t('common.name')}</Text>
                <TextInput
                  accessibilityLabel={t('cat.nameA11y')}
                  autoCapitalize="sentences"
                  maxLength={80}
                  onChangeText={(name) => updateEditorInput({ name })}
                  placeholder={t('cat.namePlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={editor.input.name}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('cat.group')}</Text>
              <TextInput
                accessibilityLabel={t('cat.groupA11y')}
                autoCapitalize="sentences"
                maxLength={80}
                onChangeText={(group) => updateEditorInput({ group })}
                placeholder={t('cat.groupPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={editor.input.group}
              />
              <View style={styles.chipList}>
                {existingGroups.map((group) => (
                  <Pressable
                    accessibilityRole="button"
                    key={group}
                    onPress={() => updateEditorInput({ group })}
                    style={({ pressed }) => [
                      styles.chip,
                      editor.input.group === group && styles.chipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        editor.input.group === group &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {group}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('cat.type')}</Text>
              <View style={styles.typeSelector}>
                {(['fixed', 'variable'] as const).map((type) => {
                  const selected = editor.input.type === type;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={type}
                      onPress={() => updateEditorInput({ type })}
                      style={({ pressed }) => [
                        styles.typeButton,
                        selected && styles.typeButtonSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          selected && styles.typeButtonTextSelected,
                        ]}
                      >
                        {typeLabel(type)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {editorError ? (
              <Text style={styles.errorText}>{editorError}</Text>
            ) : null}
            <View style={styles.formActions}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={closeEditor}
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
                onPress={prepareEditorSave}
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
        ) : mergeSourceIds.size > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>{t('cat.mergeTitle')}</Text>
            <Text style={styles.hintText}>{t('cat.mergeHint')}</Text>
            <CategoryPicker
              categories={mergeTargetCandidates}
              label={t('cat.targetLabel')}
              onChange={chooseMergeTarget}
              value={mergeTargetId}
            />

            <View style={styles.field}>
              <Text style={styles.label}>
                {t('cat.sourcesTitle')}
              </Text>
              <View style={styles.mergeList}>
                {mergeSourceCandidates.map((category) => {
                  const selected = mergeSourceIds.has(category.id);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      key={category.id}
                      onPress={() => toggleMergeSource(category.id)}
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
                      <View style={styles.categoryCopy}>
                        <Text style={styles.categoryName}>
                          {category.emoji} {category.name}
                        </Text>
                        <Text style={styles.categoryMeta}>
                          {t('cat.groupUsage', {
                            count: category.usageCount,
                            group: category.group,
                          })}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Text style={styles.summaryText}>
              {t('cat.mergeSummary', {
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
                disabled={
                  saving || !mergeTarget || mergeSourceIds.size === 0
                }
                onPress={prepareMerge}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed ||
                    saving ||
                    !mergeTarget ||
                    mergeSourceIds.size === 0) &&
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
            {displayedCategories.map((category) => (
              <View key={category.id} style={styles.categoryCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                  <View style={styles.categoryCopy}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryMeta}>
                      {t('cat.groupTypeUsage', {
                        count: category.usageCount,
                        group: category.group,
                        type: typeLabel(category.type),
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.marker,
                      category.isOwnedByCurrentUser && styles.ownMarker,
                    ]}
                  >
                    <Text
                      style={[
                        styles.markerText,
                        category.isOwnedByCurrentUser &&
                          styles.ownMarkerText,
                      ]}
                    >
                      {category.isOwnedByCurrentUser
                        ? t('cat.custom')
                        : t('cat.system')}
                    </Text>
                  </View>
                </View>

                {category.isOwnedByCurrentUser ? (
                  <View style={styles.cardActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => startEdit(category)}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.actionText}>
                        {t('common.edit')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => startMerge(category)}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.actionText}>{t('cat.merge')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setPendingAction({ category, kind: 'delete' })
                      }
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.deleteText}>
                        {t('common.delete')}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.systemHint}>
                    {t('cat.builtinReadonly')}
                  </Text>
                )}
              </View>
            ))}

            {displayedCategories.length === 0 ? (
              <Text style={styles.emptyText}>
                {query.trim()
                  ? t('common.nothingFound')
                  : t('cat.empty')}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        confirmLabel={
          pendingAction?.kind === 'merge'
            ? t('cat.merge')
            : pendingAction?.kind === 'type-change'
              ? t('cat.changeType')
              : t('common.delete')
        }
        confirming={saving}
        confirmingLabel={
          pendingAction?.kind === 'merge'
            ? t('cat.merging')
            : pendingAction?.kind === 'type-change'
              ? t('cat.changingType')
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
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  categoryCard: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  categoryCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  categoryEmoji: {
    fontSize: theme.fontSizes.title,
  },
  categoryMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
  },
  categoryName: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
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
  chip: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  chipSelected: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
  },
  chipText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.caption,
  },
  chipTextSelected: {
    color: theme.colors.accent,
    fontWeight: '600',
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
  emojiField: {
    flex: 1,
    gap: theme.spacing.xs,
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
  field: {
    gap: theme.spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
  input: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  list: {
    gap: theme.spacing.sm,
  },
  marker: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xxs,
  },
  markerText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.small,
    fontWeight: '600',
  },
  mergeList: {
    gap: theme.spacing.xs,
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
  nameField: {
    flex: 3,
    gap: theme.spacing.xs,
  },
  ownMarker: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
  },
  ownMarkerText: {
    color: theme.colors.accent,
  },
  panel: {
    gap: theme.spacing.md,
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
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
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
  summaryText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  systemHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
  },
  title: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  typeButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.xs,
  },
  typeButtonSelected: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
  },
  typeButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  typeButtonTextSelected: {
    color: theme.colors.accent,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
});
