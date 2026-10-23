import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import { localizeCategoryName, localizeGroup } from '../lib/catalog';
import type { Category } from '../lib/db';
import { theme, type Colors } from '../lib/theme';

type CategoryPickerProps = {
  categories: Category[];
  label?: string;
  value: string | null;
  onChange: (categoryId: string) => void;
};

export function CategoryPicker({
  categories,
  label,
  value,
  onChange,
}: CategoryPickerProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const resolvedLabel = label ?? t('common.category');
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
        <Text style={styles.label}>{resolvedLabel}</Text>
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
              ? `${selected.emoji} ${localizeCategoryName(selected.name, t)}`
              : t('common.selectCategory')}
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
              <Text style={styles.modalTitle}>{resolvedLabel}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisible(false)}
              >
                <Text style={styles.close}>{t('common.close')}</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
            >
              {groupedCategories.map(([group, groupCategories]) => (
                <View key={group} style={styles.group}>
                  <Text style={styles.groupTitle}>
                    {localizeGroup(group, t)}
                  </Text>
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
                        <Text style={styles.rowText}>
                          {localizeCategoryName(category.name, t)}
                        </Text>
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

const makeStyles = (c: Colors) => StyleSheet.create({
  chevron: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.title,
  },
  close: {
    color: c.action.link.rest,
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
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  label: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  list: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  modal: {
    backgroundColor: c.surface.overlay,
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
    color: c.text.primary,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: c.overlay.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  placeholder: {
    color: c.text.secondary,
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
    backgroundColor: c.action.container,
  },
  rowText: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
  selector: {
    alignItems: 'center',
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  value: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
  },
});
