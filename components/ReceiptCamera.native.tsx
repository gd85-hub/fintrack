import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from 'expo-camera';

import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import { theme, type Colors } from '../lib/theme';
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
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
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
        <Text style={styles.permissionTitle}>
          {t('scan.camera.noAccessTitle')}
        </Text>
        <Text style={styles.permissionText}>
          {t('scan.camera.noAccessBody')}
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
            <Text style={styles.primaryButtonText}>
              {t('scan.camera.allow')}
            </Text>
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
            <Text style={styles.primaryButtonText}>
              {t('scan.camera.openSettings')}
            </Text>
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
          <Text style={styles.secondaryButtonText}>
            {t('scan.camera.enterLink')}
          </Text>
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
          <Text style={styles.cameraPlaceholderText}>
            {t('scan.camera.starting')}
          </Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.marker} />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  camera: {
    height: theme.sizes.cameraHeight,
    width: '100%',
  },
  cameraPlaceholder: {
    alignItems: 'center',
    backgroundColor: c.surface.default,
    height: theme.sizes.cameraHeight,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  cameraPlaceholderText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
  },
  cameraShell: {
    backgroundColor: c.surface.inverse,
    height: theme.sizes.cameraHeight,
    position: 'relative',
    width: '100%',
  },
  marker: {
    alignSelf: 'center',
    borderColor: c.receipt.scanGuide,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.cameraMarkerBorder,
    height: theme.sizes.cameraMarker,
    position: 'absolute',
    top: (theme.sizes.cameraHeight - theme.sizes.cameraMarker) / 2,
    width: theme.sizes.cameraMarker,
  },
  permissionCard: {
    alignItems: 'stretch',
    backgroundColor: c.surface.default,
    borderColor: c.border.subtle,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  permissionText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
    lineHeight: theme.spacing.lg,
    textAlign: 'center',
  },
  permissionTitle: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
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
    borderColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryButtonText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
});
