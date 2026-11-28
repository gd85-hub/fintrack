import { describe, expect, test } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  ReceiptDraftProvider,
  useReceiptDraft,
} from '../../contexts/ReceiptDraftContext';
import type { ParsedReceipt } from '../receipts';

// The draft must be scoped to the authenticated account: one account's in-progress
// receipt can never be inherited by another, even though the provider itself sits
// above the account-keyed review screen.

let latest: ReturnType<typeof useReceiptDraft> | null = null;

function Capture() {
  latest = useReceiptDraft();
  return null;
}

const sampleDraft = { ok: true } as unknown as ParsedReceipt;

function renderWith(accountId: string | null) {
  return (
    <ReceiptDraftProvider accountId={accountId}>
      <Capture />
    </ReceiptDraftProvider>
  );
}

describe('ReceiptDraftProvider account scoping', () => {
  test('keeps the draft across re-renders with the same account', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(renderWith('user-1'));
    });
    await act(async () => {
      latest!.setDraft(sampleDraft);
    });
    expect(latest!.draft).not.toBeNull();

    await act(async () => {
      renderer.update(renderWith('user-1'));
    });
    expect(latest!.draft).not.toBeNull();

    await act(async () => {
      renderer.unmount();
    });
  });

  test('resets the draft when the account changes', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(renderWith('user-1'));
    });
    await act(async () => {
      latest!.setDraft(sampleDraft);
    });
    expect(latest!.draft).not.toBeNull();

    // Switching account must not expose the previous account's draft.
    await act(async () => {
      renderer.update(renderWith('user-2'));
    });
    expect(latest!.draft).toBeNull();

    await act(async () => {
      renderer.unmount();
    });
  });

  test('a sign-out then a different account does not inherit the draft', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(renderWith('user-1'));
    });
    await act(async () => {
      latest!.setDraft(sampleDraft);
    });

    // Sign-out (null) then sign-in as another account.
    await act(async () => {
      renderer.update(renderWith(null));
    });
    expect(latest!.draft).toBeNull();

    await act(async () => {
      latest!.setDraft(sampleDraft);
      renderer.update(renderWith('user-2'));
    });
    expect(latest!.draft).toBeNull();

    await act(async () => {
      renderer.unmount();
    });
  });
});
