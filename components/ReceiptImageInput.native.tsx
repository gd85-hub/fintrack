import * as ImagePicker from 'expo-image-picker';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import type { ReceiptImageSource } from '../lib/receiptImage';
import { maximumReceiptImages } from '../lib/receiptImage';
import { theme, type Colors } from '../lib/theme';

type ReceiptImageInputProps = {
  disabled: boolean;
  onError: (message: string) => void;
  onSelect: (sources: ReceiptImageSource[]) => void | Promise<void>;
};

function assetSources(assets: readonly ImagePicker.ImagePickerAsset[]) {
  return assets.slice(0, maximumReceiptImages).map((asset) => ({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  }));
}

export function ReceiptImageInput({
  disabled,
  onError,
  onSelect,
}: ReceiptImageInputProps) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        onError(t('imagePicker.cameraPermission'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!result.canceled) {
        await onSelect(assetSources(result.assets));
      }
    } catch {
      onError(t('imagePicker.cameraFailed'));
    }
  };

  const chooseFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onError(t('imagePicker.galleryPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        mediaTypes: ['images'],
        orderedSelection: true,
        quality: 1,
        selectionLimit: maximumReceiptImages,
      });
      if (!result.canceled) {
        await onSelect(assetSources(result.assets));
      }
    } catch {
      onError(t('imagePicker.galleryFailed'));
    }
  };

  const chooseFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        legacy: true,
        mediaTypes: ['images'],
        orderedSelection: true,
        quality: 1,
        selectionLimit: maximumReceiptImages,
      });
      if (!result.canceled) {
        await onSelect(assetSources(result.assets));
      }
    } catch {
      onError(t('imagePicker.filesFailed'));
    }
  };

  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => void takePhoto()}
        style={({ pressed }) => [
          styles.primaryButton,
          (pressed || disabled) && styles.disabled,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {t('imagePicker.takePhoto')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => void chooseFromGallery()}
        style={({ pressed }) => [
          styles.secondaryButton,
          (pressed || disabled) && styles.disabled,
        ]}
      >
        <Text style={styles.secondaryButtonText}>
          {t('imagePicker.pickGallery')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => void chooseFile()}
        style={({ pressed }) => [
          styles.secondaryButton,
          (pressed || disabled) && styles.disabled,
        ]}
      >
        <Text style={styles.secondaryButtonText}>
          {t('imagePicker.chooseFile')}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  actions: {
    gap: theme.spacing.sm,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  primaryButtonText: {
    color: c.action.primary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: c.border.default,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryButtonText: {
    color: c.text.primary,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
});
