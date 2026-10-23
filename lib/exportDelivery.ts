import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Platform file/share layer for exports — keeps Platform and the native
// modules out of the screen. The screen builds the file content (via the pure
// lib/export builders) and calls these; they throw typed errors that the screen
// maps to localized messages. No i18n/text here.

export class ShareUnavailableError extends Error {
  constructor() {
    super('share_unavailable');
    this.name = 'ShareUnavailableError';
  }
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Encode bytes to base64 without relying on btoa/Buffer (absent on native).
function uint8ToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const byte0 = bytes[index];
    const hasByte1 = index + 1 < bytes.length;
    const hasByte2 = index + 2 < bytes.length;
    const byte1 = hasByte1 ? bytes[index + 1] : 0;
    const byte2 = hasByte2 ? bytes[index + 2] : 0;

    output += BASE64_ALPHABET[byte0 >> 2];
    output += BASE64_ALPHABET[((byte0 & 0x03) << 4) | (byte1 >> 4)];
    output += hasByte1
      ? BASE64_ALPHABET[((byte1 & 0x0f) << 2) | (byte2 >> 6)]
      : '=';
    output += hasByte2 ? BASE64_ALPHABET[byte2 & 0x3f] : '=';
  }
  return output;
}

function downloadInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function shareNativeFile(uri: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ShareUnavailableError();
  }
  await Sharing.shareAsync(uri, { mimeType });
}

export async function deliverText(
  filename: string,
  content: string,
  mimeType: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    downloadInBrowser(new Blob([content], { type: mimeType }), filename);
    return;
  }
  const uri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await shareNativeFile(uri, mimeType);
}

export async function deliverBinary(
  filename: string,
  data: Uint8Array,
  mimeType: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    // Copy into a fresh ArrayBuffer-backed view so the Blob part type is exact.
    downloadInBrowser(new Blob([new Uint8Array(data)], { type: mimeType }), filename);
    return;
  }
  const uri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(uri, uint8ToBase64(data), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await shareNativeFile(uri, mimeType);
}

export async function deliverPdf(
  html: string,
  _filename: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    // Opens the browser print dialog → the user saves as PDF.
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await shareNativeFile(uri, 'application/pdf');
}
