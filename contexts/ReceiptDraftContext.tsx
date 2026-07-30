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

export function ReceiptDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<ParsedReceipt | null>(null);
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
