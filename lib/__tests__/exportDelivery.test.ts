import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Platform } from 'react-native';

let mockCacheDirectory: string | null = 'file:///cache/';
const mockWriteAsString = jest.fn<
  (uri: string, content: string, options: unknown) => Promise<void>
>();
const mockCopy = jest.fn<(input: unknown) => Promise<void>>();
const mockPrintToFile = jest.fn<
  (input: unknown) => Promise<{ uri: string }>
>();
const mockSharingAvailable = jest.fn<() => Promise<boolean>>();
const mockShare = jest.fn<(uri: string, options: unknown) => Promise<void>>();

jest.mock('expo-file-system/legacy', () => ({
  get cacheDirectory() {
    return mockCacheDirectory;
  },
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  copyAsync: (input: unknown) => mockCopy(input),
  writeAsStringAsync: (uri: string, content: string, options: unknown) =>
    mockWriteAsString(uri, content, options),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: (input: unknown) => mockPrintToFile(input),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockSharingAvailable(),
  shareAsync: (uri: string, options: unknown) => mockShare(uri, options),
}));

import {
  deliverBinary,
  deliverPdf,
  deliverText,
  ShareUnavailableError,
  uint8ToBase64,
} from '../exportDelivery';

type AnchorProbe = {
  href: string;
  download: string;
  rel: string;
  click: ReturnType<typeof jest.fn>;
};

const originalDocument = globalThis.document;
const originalNavigator = globalThis.navigator;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
const mutablePlatform = Platform as unknown as { OS: string };
const originalPlatformOs = mutablePlatform.OS;

let anchor: AnchorProbe;
let appendChild: ReturnType<typeof jest.fn>;
let removeChild: ReturnType<typeof jest.fn>;
let createObjectUrl: ReturnType<typeof jest.fn>;
let revokeObjectUrl: ReturnType<typeof jest.fn>;

function setNavigator(value: Partial<Navigator>): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mutablePlatform.OS = 'web';
  mockCacheDirectory = 'file:///cache/';
  mockWriteAsString.mockReset().mockResolvedValue(undefined);
  mockCopy.mockReset().mockResolvedValue(undefined);
  mockPrintToFile.mockReset().mockResolvedValue({ uri: 'file:///print/tmp.pdf' });
  mockSharingAvailable.mockReset().mockResolvedValue(true);
  mockShare.mockReset().mockResolvedValue(undefined);

  anchor = { href: '', download: '', rel: '', click: jest.fn() };
  appendChild = jest.fn();
  removeChild = jest.fn();
  createObjectUrl = jest.fn(() => 'blob:export');
  revokeObjectUrl = jest.fn();

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: { appendChild, removeChild },
      createElement: jest.fn(() => anchor),
    } as unknown as Document,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectUrl,
  });
  setNavigator({ platform: 'Win32', userAgent: 'Chrome' });
});

afterEach(() => {
  jest.useRealTimers();
  mutablePlatform.OS = originalPlatformOs;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: originalNavigator,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: originalRevokeObjectUrl,
  });
});

describe('web export delivery', () => {
  test('keeps the Blob URL alive until after the browser consumes the download', async () => {
    await deliverText('fintrack.csv', 'Продукты', 'text/csv;charset=utf-8');

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    const blob = createObjectUrl.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(anchor).toMatchObject({
      href: 'blob:export',
      download: 'fintrack.csv',
      rel: 'noopener',
    });
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60_000);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:export');
  });

  test('uses the iOS share sheet with a correctly named binary File', async () => {
    const canShare = jest.fn(() => true);
    const share = jest
      .fn<(data?: ShareData) => Promise<void>>()
      .mockResolvedValue(undefined);
    setNavigator({
      canShare,
      platform: 'iPhone',
      share,
      userAgent: 'iPhone Safari',
    });

    await deliverBinary(
      'fintrack.xlsx',
      new Uint8Array([0x50, 0x4b]),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    expect(canShare).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0];
    if (!payload) {
      throw new Error('Expected Web Share payload');
    }
    expect(payload.files?.[0]).toMatchObject({
      name: 'fintrack.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  test('falls back to a named Blob download when iOS cannot share files', async () => {
    const canShare = jest.fn(() => false);
    const share = jest.fn<(data?: ShareData) => Promise<void>>();
    setNavigator({
      canShare,
      platform: 'iPhone',
      share,
      userAgent: 'iPhone Safari',
    });

    await deliverText('fintrack.csv', 'Продукты', 'text/csv;charset=utf-8');

    expect(canShare).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
    expect(anchor).toMatchObject({
      href: 'blob:export',
      download: 'fintrack.csv',
    });
    expect(anchor.click).toHaveBeenCalledTimes(1);
  });

  test('does not hide a synchronous browser download failure', async () => {
    anchor.click.mockImplementation(() => {
      throw new Error('download blocked');
    });

    await expect(
      deliverText('fintrack.csv', 'x', 'text/csv;charset=utf-8'),
    ).rejects.toThrow('download blocked');
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:export');
  });
});

describe('native export delivery', () => {
  beforeEach(() => {
    mutablePlatform.OS = 'android';
  });

  test('writes UTF-8 text to the named cache file and shares its MIME type', async () => {
    await deliverText('fintrack.csv', 'Продукты', 'text/csv;charset=utf-8');

    expect(mockWriteAsString).toHaveBeenCalledWith(
      'file:///cache/fintrack.csv',
      'Продукты',
      { encoding: 'utf8' },
    );
    expect(mockShare).toHaveBeenCalledWith('file:///cache/fintrack.csv', {
      mimeType: 'text/csv;charset=utf-8',
    });
  });

  test('writes exact base64 bytes for XLSX and shares the named file', async () => {
    await deliverBinary(
      'fintrack.xlsx',
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      'application/xlsx',
    );

    expect(mockWriteAsString).toHaveBeenCalledWith(
      'file:///cache/fintrack.xlsx',
      'UEsDBA==',
      { encoding: 'base64' },
    );
    expect(mockShare).toHaveBeenCalledWith('file:///cache/fintrack.xlsx', {
      mimeType: 'application/xlsx',
    });
  });

  test('copies the generated PDF to the requested filename before sharing', async () => {
    await deliverPdf('<html></html>', 'fintrack-2026-11.pdf');

    expect(mockPrintToFile).toHaveBeenCalledWith({ html: '<html></html>' });
    expect(mockCopy).toHaveBeenCalledWith({
      from: 'file:///print/tmp.pdf',
      to: 'file:///cache/fintrack-2026-11.pdf',
    });
    expect(mockShare).toHaveBeenCalledWith(
      'file:///cache/fintrack-2026-11.pdf',
      { mimeType: 'application/pdf' },
    );
  });

  test('fails explicitly when native cache or sharing is unavailable', async () => {
    mockCacheDirectory = null;
    await expect(
      deliverText('fintrack.csv', 'x', 'text/csv'),
    ).rejects.toBeInstanceOf(ShareUnavailableError);

    mockCacheDirectory = 'file:///cache/';
    mockSharingAvailable.mockResolvedValue(false);
    await expect(
      deliverText('fintrack.csv', 'x', 'text/csv'),
    ).rejects.toBeInstanceOf(ShareUnavailableError);
  });

  test('does not hide native write or share failures', async () => {
    mockWriteAsString.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      deliverBinary(
        'fintrack.xlsx',
        new Uint8Array([0x50, 0x4b]),
        'application/xlsx',
      ),
    ).rejects.toThrow('write failed');

    mockShare.mockRejectedValueOnce(new Error('share failed'));
    await expect(
      deliverText('fintrack.csv', 'x', 'text/csv'),
    ).rejects.toThrow('share failed');
  });
});

test('base64 encoder preserves arbitrary byte tails', () => {
  expect(uint8ToBase64(new Uint8Array([]))).toBe('');
  expect(uint8ToBase64(new Uint8Array([0xff]))).toBe('/w==');
  expect(uint8ToBase64(new Uint8Array([0xff, 0xee]))).toBe('/+4=');
  expect(uint8ToBase64(new Uint8Array([0xff, 0xee, 0xdd]))).toBe('/+7d');
});
