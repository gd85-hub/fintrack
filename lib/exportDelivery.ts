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
const OBJECT_URL_LIFETIME_MS = 60_000;

// Encode bytes to base64 without relying on btoa/Buffer (absent on native).
export function uint8ToBase64(bytes: Uint8Array): string {
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

export function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function downloadObjectUrlInBrowser(
  url: string,
  filename: string,
): void {
  if (typeof document === 'undefined') {
    throw new ShareUnavailableError();
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
  }
}

async function shareInIosBrowser(
  blob: Blob,
  filename: string,
): Promise<boolean> {
  if (
    !isIosBrowser() ||
    typeof File === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function'
  ) {
    return false;
  }

  const file = new File([blob], filename, { type: blob.type });
  const shareData: ShareData = { files: [file] };
  if (!navigator.canShare(shareData)) {
    return false;
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch (error: unknown) {
    // Cancelling the native share sheet is a completed user choice, not an
    // export failure and not a reason to start an unexpected download.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true;
    }
    return false;
  }
}

export async function downloadInBrowser(
  blob: Blob,
  filename: string,
): Promise<void> {
  if (await shareInIosBrowser(blob, filename)) {
    return;
  }

  const url = URL.createObjectURL(blob);
  try {
    downloadObjectUrlInBrowser(url, filename);
  } catch (error: unknown) {
    URL.revokeObjectURL(url);
    throw error;
  }
  // Revoking in the same task can invalidate the navigation before Safari or
  // Chromium has consumed the Blob. Keep it alive long enough for the browser
  // to finish the download, then release it.
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
}

function nativeCacheUri(filename: string): string {
  if (!FileSystem.cacheDirectory) {
    throw new ShareUnavailableError();
  }
  return `${FileSystem.cacheDirectory}${filename}`;
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
    await downloadInBrowser(new Blob([content], { type: mimeType }), filename);
    return;
  }
  const uri = nativeCacheUri(filename);
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
    await downloadInBrowser(
      new Blob([new Uint8Array(data)], { type: mimeType }),
      filename,
    );
    return;
  }
  const uri = nativeCacheUri(filename);
  await FileSystem.writeAsStringAsync(uri, uint8ToBase64(data), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await shareNativeFile(uri, mimeType);
}

function printHtmlInBrowser(html: string, filename: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  let removed = false;
  const cleanup = (): void => {
    if (removed) return;
    removed = true;
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 60000);
    win.focus();
    win.print();
  };

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document ?? iframe.contentDocument;
  if (!doc) {
    cleanup();
    throw new ShareUnavailableError();
  }
  doc.open();
  doc.write(html);
  const title = filename.replace(/\.[^.]+$/, '');
  if (title) doc.title = title;
  doc.close();
}

export async function deliverPdf(
  html: string,
  filename: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') throw new ShareUnavailableError();
    printHtmlInBrowser(html, filename);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const namedUri = nativeCacheUri(filename);
  if (uri !== namedUri) {
    await FileSystem.copyAsync({ from: uri, to: namedUri });
  }
  await shareNativeFile(namedUri, 'application/pdf');
}
