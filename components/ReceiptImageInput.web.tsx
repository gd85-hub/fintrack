import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  useCallback,
  useRef,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  maximumReceiptImages,
  type ReceiptImageSource,
} from '../lib/receiptImage';
import { imageFilesFromClipboardItems } from '../lib/receiptClipboard.web';
import { theme } from '../lib/theme';

type ReceiptImageInputProps = {
  disabled: boolean;
  onError: (message: string) => void;
  onSelect: (sources: ReceiptImageSource[]) => void | Promise<void>;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('read_failed'));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

function imageDimensions(uri: string) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.onerror = () => reject(new Error('read_failed'));
    image.src = uri;
  });
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA')
  );
}

async function filesToSources(files: readonly File[]) {
  if (files.length === 0 || files.length > maximumReceiptImages) {
    throw new Error('bad_count');
  }
  return Promise.all(
    files.map(async (file) => {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        throw new Error('bad_type');
      }
      const uri = await readFileAsDataUrl(file);
      const dimensions = await imageDimensions(uri);
      return { uri, ...dimensions };
    }),
  );
}

export function ReceiptImageInput({
  disabled,
  onError,
  onSelect,
}: ReceiptImageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | readonly File[]) => {
      if (disabled) return;
      try {
        const sources = await filesToSources(Array.from(files));
        await onSelect(sources);
      } catch (error: unknown) {
        onError(
          error instanceof Error && error.message === 'bad_count'
            ? 'Выберите от одного до пяти изображений.'
            : error instanceof Error && error.message === 'bad_type'
              ? 'Поддерживаются только изображения JPG и PNG.'
              : 'Не удалось прочитать выбранное изображение.',
        );
      }
    },
    [disabled, onError, onSelect],
  );

  useFocusEffect(
    useCallback(() => {
      const handlePaste = (event: ClipboardEvent) => {
        if (
          disabled ||
          event.defaultPrevented ||
          isEditableTarget(event.target)
        ) {
          return;
        }

        const clipboardItems = event.clipboardData?.items ?? [];
        const hasImage = Array.from(clipboardItems).some((item) =>
          item.type.startsWith('image/'),
        );
        if (!hasImage) {
          return;
        }

        event.preventDefault();
        void handleFiles(imageFilesFromClipboardItems(clipboardItems));
      };

      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }, [disabled, handleFiles]),
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files) {
      void handleFiles(event.currentTarget.files);
    }
    event.currentTarget.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) {
      void handleFiles(event.dataTransfer.files);
    }
  };

  return (
    <View style={styles.wrapper}>
      <div
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        style={{
          ...dropZoneStyle,
          ...(disabled ? disabledDropZoneStyle : {}),
        }}
        tabIndex={disabled ? -1 : 0}
      >
        <Text style={styles.title}>Выберите фото или скриншоты</Text>
        <Text style={styles.hint}>
          До пяти файлов JPG или PNG. Можно перетащить сюда или вставить из
          буфера (Ctrl+V).
        </Text>
        <Text style={styles.action}>Выбрать файлы</Text>
      </div>
      <input
        accept="image/jpeg,image/png"
        disabled={disabled}
        multiple
        onChange={handleChange}
        ref={inputRef}
        style={hiddenInputStyle}
        type="file"
      />
    </View>
  );
}

const dropZoneStyle: CSSProperties = {
  alignItems: 'center',
  borderColor: theme.colors.border,
  borderRadius: theme.radii.card,
  borderStyle: 'dashed',
  borderWidth: theme.sizes.border,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing.sm,
  padding: theme.spacing.xl,
  textAlign: 'center',
};

const disabledDropZoneStyle: CSSProperties = {
  cursor: 'default',
  opacity: theme.opacity.disabled,
};

const hiddenInputStyle: CSSProperties = { display: 'none' };

const styles = StyleSheet.create({
  action: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.label,
    textAlign: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  wrapper: {
    width: '100%',
  },
});
