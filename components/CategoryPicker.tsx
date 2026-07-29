import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Category } from '../lib/db';
import { theme } from '../lib/theme';

type CategoryPickerProps = {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
};

export function CategoryPicker({
  categories,
  value,
  onChange,
}: CategoryPickerProps) {
  const [visible, setVisible] = useState(false);
  const selected = categories.find((category) => category.id === value);
  const groupedCategories = useMemo(() => {
    const groups = new Map<string, Category[]>();

    for (const category of categories) {
      const group = groups.get(category.group) ?? [];
      group.push(category);
      groups.set(category.group, group);
    }

    return [...groups.entries()];
  }, [categories]);

  function selectCategory(categoryId: string) {
    onChange(categoryId);
    setVisible(false);
  }

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Категория</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible(true)}
          style={({ pressed }) => [
            styles.selector,
            pressed && styles.pressed,
          ]}
        >
          <Text style={selected ? styles.value : styles.placeholder}>
            {selected
              ? `${selected.emoji} ${selected.name}`
              : 'Выберите категорию'}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Категория</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisible(false)}
              >
                <Text style={styles.close}>Закрыть</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
            >
              {groupedCategories.map(([group, groupCategories]) => (
                <View key={group} style={styles.group}>
                  <Text style={styles.groupTitle}>{group}</Text>
                  {groupCategories.map((category) => {
                    const isSelected = category.id === value;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        key={category.id}
                        onPress={() => selectCategory(category.id)}
                        style={({ pressed }) => [
                          styles.row,
                          isSelected && styles.rowSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.emoji}>{category.emoji}</Text>
                        <Text style={styles.rowText}>{category.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chevron: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.title,
  },
  close: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.body,
  },
  emoji: {
    fontSize: theme.fontSizes.body,
  },
  field: {
    gap: theme.spacing.xs,
  },
  group: {
    gap: theme.spacing.xs,
  },
  groupTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  list: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  modal: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.modal,
    maxHeight: theme.sizes.modalMaxHeight,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: theme.sizes.modalWidth,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  placeholder: {
    color: theme.colors.textMuted,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  row: {
    alignItems: 'center',
    borderRadius: theme.radii.button,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  rowSelected: {
    backgroundColor: theme.colors.accentMuted,
  },
  rowText: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
  selector: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  value: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
});
