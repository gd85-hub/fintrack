type ClipboardItem = Pick<DataTransferItem, 'getAsFile' | 'type'>;

export function imageFilesFromClipboardItems(
  items: ArrayLike<ClipboardItem>,
): File[] {
  return Array.from(items).flatMap((item) => {
    if (!item.type.startsWith('image/')) {
      return [];
    }
    const file = item.getAsFile();
    return file ? [file] : [];
  });
}
