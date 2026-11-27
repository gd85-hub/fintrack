import { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import { theme, type Colors } from '../lib/theme';
import { Button } from './ds/Button';

// One existing purchase shown as a possible duplicate, already formatted for
// display by the caller (it owns locale and money/date formatting).
export type DuplicateWarningRow = {
  receiptId: string;
  merchant: string;
  dateLabel: string;
  amountLabel: string;
  sourceLabel: string | null;
};

type DuplicateWarningDialogProps = {
  visible: boolean;
  matches: DuplicateWarningRow[];
  saving: boolean;
  onBack: () => void;
  onSaveAnyway: () => void;
};

// Advisory, non-destructive warning shown before saving a receipt that resembles
// an existing one. It never blocks: the user picks "Back to review" (the safe,
// primary action) or "Save anyway". It is intentionally not the destructive
// ConfirmDialog, which is styled for deletions.
export function DuplicateWarningDialog({
  visible,
  matches,
  saving,
  onBack,
  onSaveAnyway,
}: DuplicateWarningDialogProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onBack}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View accessibilityRole="alert" style={styles.dialog}>
          <Text style={styles.title}>{t('review.duplicate.title')}</Text>
          <Text style={styles.description}>
            {t('review.duplicate.description')}
          </Text>
          {matches.length > 1 ? (
            <Text style={styles.count}>
              {t('review.duplicate.count', { count: matches.length })}
            </Text>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.listContent}
            style={styles.list}
          >
            {matches.map((match) => (
              <View key={match.receiptId} style={styles.row}>
                <Text style={styles.rowMerchant}>{match.merchant}</Text>
                <Text style={styles.rowMeta}>
                  {[match.dateLabel, match.amountLabel, match.sourceLabel]
                    .filter((part): part is string => Boolean(part))
                    .join(' · ')}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <Button
                disabled={saving}
                fullWidth
                label={t('review.duplicate.back')}
                onPress={onBack}
                size="medium"
                variant="primary"
              />
            </View>
            <View style={styles.actionItem}>
              <Button
                fullWidth
                label={t('review.duplicate.saveAnyway')}
                loading={saving}
                onPress={onSaveAnyway}
                size="medium"
                variant="surface"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    actionItem: {
      flexBasis: 0,
      flexGrow: 1,
      minWidth: theme.scale.size.controlMinWidth,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    count: {
      color: c.text.secondary,
      fontSize: theme.fontSizes.caption,
    },
    description: {
      color: c.text.secondary,
      fontSize: theme.fontSizes.body,
    },
    dialog: {
      backgroundColor: c.surface.overlay,
      borderRadius: theme.radii.modal,
      gap: theme.spacing.md,
      maxWidth: theme.sizes.maxContentWidth,
      padding: theme.spacing.lg,
      width: theme.sizes.modalWidth,
    },
    list: {
      maxHeight: 220,
    },
    listContent: {
      gap: theme.spacing.sm,
    },
    overlay: {
      alignItems: 'center',
      backgroundColor: c.overlay.scrim,
      flex: 1,
      justifyContent: 'center',
      padding: theme.spacing.md,
    },
    row: {
      borderColor: c.border.default,
      borderRadius: theme.radii.input,
      borderWidth: theme.sizes.border,
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
    },
    rowMerchant: {
      color: c.text.primary,
      fontSize: theme.fontSizes.body,
      fontWeight: '700',
    },
    rowMeta: {
      color: c.text.secondary,
      fontSize: theme.fontSizes.caption,
    },
    title: {
      color: c.text.primary,
      fontSize: theme.fontSizes.title,
      fontWeight: '700',
    },
  });
