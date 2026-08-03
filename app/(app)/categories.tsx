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

function typeLabel(type: ExpenseCategoryType) {
  return type === 'fixed' ? 'Постоянная' : 'Переменная';
}

export default function CategoriesScreen() {
  const router = useRouter();
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
            setErrorMessage(
              'Не удалось загрузить категории. Попробуйте ещё раз.',
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
      setEditorError(
        'Не удалось сохранить категорию. Проверьте поля и попробуйте ещё раз.',
      );
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
      setEditorError('Заполните название, эмодзи и группу.');
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
          ? 'Не удалось объединить категории. Изменения отменены; попробуйте ещё раз.'
          : actionKind === 'delete'
            ? 'Не удалось удалить категорию. Изменения отменены; попробуйте ещё раз.'
            : 'Не удалось изменить тип категории. Попробуйте ещё раз.',
      );
    } finally {
      setSaving(false);
    }
  }

  const confirmationTitle =
    pendingAction?.kind === 'merge'
      ? `Объединить выбранные категории с «${pendingAction.target.name}»? Будет перенесено трат: ${pendingAction.expenseCount}. Выбранные свои категории будут удалены.`
      : pendingAction?.kind === 'delete'
        ? `Удалить «${pendingAction.category.name}»? ${pendingAction.category.usageCount} трат станут «${uncategorized?.name ?? 'без категории'}». Если это дубликат, лучше выбрать «Объединить».`
        : pendingAction?.kind === 'type-change'
          ? `Изменить тип «${pendingAction.category.name}» на «${typeLabel(pendingAction.input.type)}»? Это изменит разделение постоянных и переменных трат в аналитике. Затронуто трат: ${pendingAction.category.usageCount}.`
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
        <Text style={styles.title}>Управление категориями</Text>
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
            <Text style={styles.primaryButtonText}>
              Создать категорию
            </Text>
          </Pressable>
        ) : null}

        {!editor && mergeSourceIds.size === 0 ? (
          <TextInput
            accessibilityLabel="Поиск категории"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Поиск категории…"
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
              <Text style={styles.actionText}>Повторить</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : errorMessage && categories.length === 0 ? null : editor ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              {editor.category
                ? `Изменить «${editor.category.name}»`
                : 'Новая категория'}
            </Text>

            <View style={styles.fieldRow}>
              <View style={styles.emojiField}>
                <Text style={styles.label}>Эмодзи</Text>
                <TextInput
                  accessibilityLabel="Эмодзи категории"
                  maxLength={8}
                  onChangeText={(emoji) => updateEditorInput({ emoji })}
                  placeholder="🍬"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={editor.input.emoji}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={styles.label}>Название</Text>
                <TextInput
                  accessibilityLabel="Название категории"
                  autoCapitalize="sentences"
                  maxLength={80}
                  onChangeText={(name) => updateEditorInput({ name })}
                  placeholder="Сладости"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={editor.input.name}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Группа</Text>
              <TextInput
                accessibilityLabel="Группа категории"
                autoCapitalize="sentences"
                maxLength={80}
                onChangeText={(group) => updateEditorInput({ group })}
                placeholder="Еда"
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
              <Text style={styles.label}>Тип</Text>
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
                <Text style={styles.secondaryButtonText}>Отмена</Text>
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
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : mergeSourceIds.size > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Объединить категории</Text>
            <Text style={styles.hintText}>
              Выберите категорию, которая останется. Системная категория
              может быть целью, но никогда не удаляется.
            </Text>
            <CategoryPicker
              categories={mergeTargetCandidates}
              label="Целевая категория"
              onChange={chooseMergeTarget}
              value={mergeTargetId}
            />

            <View style={styles.field}>
              <Text style={styles.label}>
                Свои категории, которые будут удалены
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
                          {category.group} · Трат: {category.usageCount}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Text style={styles.summaryText}>
              Выбрано категорий: {mergeSourceIds.size} · Будет
              перенесено трат: {selectedMergeExpenseCount}
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
                <Text style={styles.primaryButtonText}>Продолжить</Text>
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
                      {category.group} · {typeLabel(category.type)} · Трат:{' '}
                      {category.usageCount}
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
                        ? 'своя'
                        : 'системная'}
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
                      <Text style={styles.actionText}>Изменить</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => startMerge(category)}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.actionText}>Объединить</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setPendingAction({ category, kind: 'delete' })
                      }
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.deleteText}>Удалить</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.systemHint}>
                    Встроенная категория · только чтение
                  </Text>
                )}
              </View>
            ))}

            {displayedCategories.length === 0 ? (
              <Text style={styles.emptyText}>
                {query.trim()
                  ? 'Ничего не найдено'
                  : 'Категорий пока нет'}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        confirmLabel={
          pendingAction?.kind === 'merge'
            ? 'Объединить'
            : pendingAction?.kind === 'type-change'
              ? 'Изменить тип'
              : 'Удалить'
        }
        confirming={saving}
        confirmingLabel={
          pendingAction?.kind === 'merge'
            ? 'Объединение…'
            : pendingAction?.kind === 'type-change'
              ? 'Изменение…'
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
