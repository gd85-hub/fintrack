import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { theme, type Colors } from '../../lib/theme';

export type FieldErrorProps = {
  message?: string | null;
};

export function FieldError({ message }: FieldErrorProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  if (!message) {
    return null;
  }

  return (
    <Text
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={styles.error}
    >
      {message}
    </Text>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    error: {
      ...theme.type.captionDefault,
      color: c.status.error.content,
      marginTop: theme.scale.space[1],
    },
  });
