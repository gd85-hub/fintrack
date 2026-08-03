import { describe, expect, test } from '@jest/globals';

import { imageFilesFromClipboardItems } from '../receiptClipboard.web';

function clipboardItem(
  type: string,
  file: File | null,
): Pick<DataTransferItem, 'getAsFile' | 'type'> {
  return {
    getAsFile: () => file,
    type,
  };
}

describe('web receipt clipboard images', () => {
  test('returns image files and drops non-image clipboard items', () => {
    const png = { name: 'receipt.png' } as File;
    const gif = { name: 'receipt.gif' } as File;
    const text = { name: 'note.txt' } as File;

    expect(
      imageFilesFromClipboardItems([
        clipboardItem('image/png', png),
        clipboardItem('text/plain', text),
        clipboardItem('image/gif', gif),
        clipboardItem('image/jpeg', null),
      ]),
    ).toEqual([png, gif]);
  });
});
