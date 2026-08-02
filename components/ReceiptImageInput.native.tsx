import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReceiptImageSource } from '../lib/receiptImage';
import { maximumReceiptImages } from '../lib/receiptImage';
import { theme } from '../lib/theme';

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
  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        onError('Разрешите доступ к камере, чтобы сфотографировать чек.');
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
      onError('Не удалось открыть камеру. Попробуйте ещё раз.');
    }
  };

  const chooseFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onError('Разрешите доступ к галерее, чтобы выбрать чек.');
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
      onError('Не удалось открыть галерею. Попробуйте ещё раз.');
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
      onError('Не удалось открыть выбор файлов. Попробуйте ещё раз.');
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
        <Text style={styles.primaryButtonText}>Сфотографировать</Text>
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
        <Text style={styles.secondaryButtonText}>Выбрать из галереи</Text>
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
        <Text style={styles.secondaryButtonText}>Выбрать файл</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: theme.spacing.sm,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
});
