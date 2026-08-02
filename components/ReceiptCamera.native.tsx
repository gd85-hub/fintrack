import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from 'expo-camera';

import { theme } from '../lib/theme';
import { LoadingScreen } from './LoadingScreen';

type ReceiptCameraProps = {
  active: boolean;
  onScan: (value: string) => void;
  onUseManual: () => void;
};

export function ReceiptCamera({
  active,
  onScan,
  onUseManual,
}: ReceiptCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (permission === null) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  if (permission === null) {
    return <LoadingScreen compact />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>Нет доступа к камере</Text>
        <Text style={styles.permissionText}>
          Разрешите доступ в настройках или введите ссылку из чека вручную.
        </Text>
        {permission.canAskAgain ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermission()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Разрешить камеру</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Открыть настройки</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onUseManual}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Ввести ссылку</Text>
        </Pressable>
      </View>
    );
  }

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (active) {
      onScan(data);
    }
  };

  return (
    <View style={styles.cameraShell}>
      <CameraView
        active={active}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        facing="back"
        onBarcodeScanned={active ? handleScan : undefined}
        onCameraReady={() => setCameraReady(true)}
        style={styles.camera}
      />
      {!cameraReady ? (
        <View pointerEvents="none" style={styles.cameraPlaceholder}>
          <Text style={styles.cameraPlaceholderText}>Запуск камеры…</Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.marker} />
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    height: theme.sizes.cameraHeight,
    width: '100%',
  },
  cameraPlaceholder: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    height: theme.sizes.cameraHeight,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  cameraPlaceholderText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
  },
  cameraShell: {
    backgroundColor: theme.colors.text,
    height: theme.sizes.cameraHeight,
    position: 'relative',
    width: '100%',
  },
  marker: {
    alignSelf: 'center',
    borderColor: theme.colors.white,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.cameraMarkerBorder,
    height: theme.sizes.cameraMarker,
    position: 'absolute',
    top: (theme.sizes.cameraHeight - theme.sizes.cameraMarker) / 2,
    width: theme.sizes.cameraMarker,
  },
  permissionCard: {
    alignItems: 'stretch',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  permissionText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
    lineHeight: theme.spacing.lg,
    textAlign: 'center',
  },
  permissionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
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
    borderColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
});
