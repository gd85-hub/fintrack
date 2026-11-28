import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type { ParsedReceipt } from '../lib/receipts';

type ReceiptDraftContextValue = {
  draft: ParsedReceipt | null;
  clearDraft: () => void;
  setDraft: (draft: ParsedReceipt) => void;
};

const ReceiptDraftContext = createContext<ReceiptDraftContextValue | null>(
  null,
);

export function ReceiptDraftProvider({
  children,
  accountId = null,
}: {
  children: ReactNode;
  accountId?: string | null;
}) {
  const [draft, setDraftState] = useState<ParsedReceipt | null>(null);
  // Scope the draft to the authenticated account: when it changes, reset the
  // draft during render (React's reset-state-on-prop-change pattern) so one
  // account's in-progress receipt can never be inherited by another, with no
  // window where a stale draft is read between the change and an effect.
  const [lastAccountId, setLastAccountId] = useState<string | null>(accountId);
  if (accountId !== lastAccountId) {
    setLastAccountId(accountId);
    setDraftState(null);
  }
  const clearDraft = useCallback(() => setDraftState(null), []);
  const setDraft = useCallback((value: ParsedReceipt) => {
    setDraftState(value);
  }, []);
  const value = useMemo(
    () => ({ draft, clearDraft, setDraft }),
    [clearDraft, draft, setDraft],
  );

  return (
    <ReceiptDraftContext.Provider value={value}>
      {children}
    </ReceiptDraftContext.Provider>
  );
}

export function useReceiptDraft() {
  const context = useContext(ReceiptDraftContext);
  if (!context) {
    throw new Error(
      'useReceiptDraft must be used inside ReceiptDraftProvider.',
    );
  }
  return context;
}
