import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { CategoryPicker } from '../../../components/CategoryPicker';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { DatePicker } from '../../../components/DatePicker';
import {
  DuplicateWarningDialog,
  type DuplicateWarningRow,
} from '../../../components/DuplicateWarningDialog';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { MerchantPicker } from '../../../components/MerchantPicker';
import { ReceiptCurrencySelector } from '../../../components/ReceiptCurrencySelector';
import { Button } from '../../../components/ds/Button';
import { StatusBanner } from '../../../components/ds/StatusBanner';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useReceiptDraft } from '../../../contexts/ReceiptDraftContext';
import { useColors } from '../../../contexts/ThemeContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  findReceiptDuplicates,
  getFiscalReceiptForEdit,
  listCategories,
  listMerchants,
  saveFiscalReceipt,
  updateFiscalReceipt,
  type Category,
  type FiscalReceiptEditDraft,
  type FiscalReceiptMerchantInput,
  type IncomingReceiptForDuplicates,
  type Merchant,
  type ReceiptDuplicateCandidate,
} from '../../../lib/db';
import {
  formatLongDate,
  parseLocalISO,
  todayLocalISO,
} from '../../../lib/dates';
import { RateUnavailableError } from '../../../lib/fx';
import {
  centsToInput,
  formatMoney,
  isCurrency,
  parseAmountInput,
} from '../../../lib/money';
import {
  learnItemCategoryRules,
  resolveCategoriesForItems,
  upsertItemCategoryRules,
} from '../../../lib/itemCategorization';
import {
  findMatchingMerchant,
  parsedReceiptDate,
} from '../../../lib/receipts';
import {
  needsManualRsdEquivalent,
  receiptDraftBlockers,
  reviewTotalsMismatch,
} from '../../../lib/receiptReview';
import { theme, type Colors } from '../../../lib/theme';

export { reviewTotalsMismatch } from '../../../lib/receiptReview';

type MerchantMode = 'existing' | 'new';

type ReviewItem = {
  amountCents: number | null;
  amountInput: string;
  categoryEdited: boolean;
  categoryId: string;
  description: string;
  descriptionEdited: boolean;
  expenseId: string | null;
  id: number | string;
  included: boolean;
  inclusionEdited: boolean;
  quantity: number | null;
  rawName: string;
  unitPriceCents: number | null;
  vatLabel: string | null;
};

function normalizeCategoryName(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

type ReviewTotalItem = {
  amountCents: number | null;
  included: boolean;
};

export function includedReviewTotal(
  items: readonly ReviewTotalItem[],
): number | null {
  let total = 0;

  for (const item of items) {
    if (!item.included) {
      continue;
    }
    if (item.amountCents === null) {
      return null;
    }

    total += item.amountCents;
    if (!Number.isSafeInteger(total)) {
      return null;
    }
  }

  return total;
}

export function parseReviewAmountInput(value: string): number | null {
  const amountCents = parseAmountInput(value);
  return amountCents !== null && amountCents > 0 ? amountCents : null;
}

function routeParam(
  value: string | string[] | undefined,
): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}

// Account-boundary wrapper: a change of authenticated account fully remounts the
// review screen, so the new account never inherits the previous account's loaded
// categories, merchants, items, pending duplicate check or approval.
export default function ReviewReceiptScreen() {
  const { user } = useAuth();
  const accountId = user?.id ?? null;
  return (
    <ReviewReceiptScreenInner
      accountId={accountId}
      key={accountId ?? 'anonymous'}
    />
  );
}

function ReviewReceiptScreenInner({
  accountId,
}: {
  accountId: string | null;
}) {
  const { t, locale } = useLanguage();
  const { draft, clearDraft } = useReceiptDraft();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const toast = useToast();
  const params = useLocalSearchParams<{
    receiptId?: string | string[];
  }>();
  const editReceiptId = routeParam(params.receiptId);
  const isEditMode = editReceiptId !== null;
  const [editDraft, setEditDraft] =
    useState<FiscalReceiptEditDraft | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [merchantMode, setMerchantMode] =
    useState<MerchantMode>('new');
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState(
    draft?.merchantName ?? '',
  );
  const [occurredOn, setOccurredOn] = useState('');
  // null = not read from the photo and not chosen yet. Never silently RSD:
  // a quiet guess is exactly what this screen must not do.
  const [receiptCurrency, setReceiptCurrency] = useState<string | null>(
    draft?.currency ?? null,
  );
  const [receiptTotalInput, setReceiptTotalInput] = useState('');
  const [confirmedReceiptTotalCents, setConfirmedReceiptTotalCents] =
    useState<number | null>(null);
  const [totalInputEdited, setTotalInputEdited] = useState(false);
  const [manualRsdInput, setManualRsdInput] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categorizing, setCategorizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // Probable-duplicate advisory state. `duplicateMatches` non-empty shows the
  // warning dialog; `checkingDuplicates` shows progress; `duplicateCheckFailed`
  // offers retry / save-without-checking.
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<
    ReceiptDuplicateCandidate[] | null
  >(null);
  const [duplicateCheckFailed, setDuplicateCheckFailed] = useState(false);
  // --- Duplicate-check / save lifecycle -------------------------------------
  // Two ownership axes are kept deliberately separate:
  //  * cancellable duplicate-check work (a session that invalidation voids), and
  //  * an active database write (never cancellable once it has started).
  // Invalidating a check must never release an active write's guard.

  // Monotonic id of the current cancellable review session, and the identity an
  // approval is bound to. Advanced by anything that voids outstanding work (a
  // draft or edit-target change, a persisted-field change, or leaving the screen)
  // AND at the start of every check attempt, so each check — even a repeat with
  // unchanged fields — gets a unique identity that an older confirmation/Back
  // callback cannot match. (Account changes remount the screen via the wrapper.)
  const sessionRef = useRef(0);
  // A duplicate check is awaiting its result. Synchronous guard against starting a
  // second check; released by invalidation, because a check is cancellable.
  const checkInFlightRef = useRef(false);
  // A database write is running. Synchronous guard against overlapping writes and
  // against confirming again mid-write. NEVER cleared by invalidation — only in
  // the write's own finally — because a started mutation cannot be cancelled.
  const writeInFlightRef = useRef(false);
  // The session an outstanding advisory warning / failed-check banner belongs to,
  // or null. A bypass ("save anyway" / "save without checking") is authorized for
  // exactly this session and is consumed once.
  const approvalRef = useRef<number | null>(null);
  // Render mirror of approvalRef so each dialog/banner render closes over the
  // session its buttons authorize. An older button closure carries an older
  // session and cannot drive a newer approval even when the field values match.
  const [approvalSession, setApprovalSession] = useState<number | null>(null);

  // Everything a save persists. A change to any of it voids an outstanding
  // check/approval, so a save can never write values that were never checked —
  // including per-item amount/inclusion/category/description and the manual FX
  // equivalent, not only the duplicate-match fields.
  const savePayloadKey = useMemo(
    () =>
      JSON.stringify({
        occurredOn,
        currency: receiptCurrency,
        total: confirmedReceiptTotalCents,
        manualRsd: manualRsdInput.trim(),
        merchantMode,
        merchantId,
        merchantName: merchantName.trim(),
        items: items.map((item) => ({
          amountCents: item.amountCents,
          included: item.included,
          categoryId: item.categoryId,
          description: item.description.trim() || item.rawName,
          rawName: item.rawName,
        })),
      }),
    [
      occurredOn,
      receiptCurrency,
      confirmedReceiptTotalCents,
      manualRsdInput,
      merchantMode,
      merchantId,
      merchantName,
      items,
    ],
  );

  // Voids outstanding cancellable work: advances the session, drops a pending
  // check and any approval, and clears the decision UI. It deliberately does NOT
  // touch writeInFlightRef — an active write keeps its guard and runs to
  // completion, with its UI effects gated on the session separately.
  const invalidatePendingDuplicateWork = () => {
    sessionRef.current += 1;
    checkInFlightRef.current = false;
    approvalRef.current = null;
    setApprovalSession(null);
    setCheckingDuplicates(false);
    setDuplicateMatches(null);
    setDuplicateCheckFailed(false);
  };

  // A save (check continuation, bypass or edit) may start only when neither a
  // check nor a write is already in flight.
  const canStartSave = () =>
    !checkInFlightRef.current && !writeInFlightRef.current;

  useEffect(() => {
    if (!isEditMode && !draft) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setCategorizing(false);
    setEditDraft(null);
    setErrorMessage('');
    setItems([]);
    setBulkCategoryId(null);
    setReceiptTotalInput('');
    setConfirmedReceiptTotalCents(null);
    setTotalInputEdited(false);

    void Promise.all([
      listCategories(),
      listMerchants(),
      editReceiptId
        ? getFiscalReceiptForEdit(editReceiptId)
        : Promise.resolve(null),
    ]).then(
      ([
        loadedCategories,
        loadedMerchants,
        loadedEditDraft,
      ]) => {
        if (!active) {
          return;
        }
        const uncategorized = loadedCategories.find(
          (category) => category.slug === 'uncategorized',
        );
        if (!uncategorized) {
          throw new Error(t('review.uncategorizedMissing'));
        }
        setCategories(loadedCategories);
        setMerchants(loadedMerchants);
        setBulkCategoryId(null);

        if (isEditMode) {
          if (!loadedEditDraft) {
            throw new Error(t('review.purchaseNotFound'));
          }

          setEditDraft(loadedEditDraft);
          setMerchantMode(
            loadedEditDraft.merchantId ? 'existing' : 'new',
          );
          setMerchantId(loadedEditDraft.merchantId);
          setMerchantName(loadedEditDraft.merchantName);
          setOccurredOn(loadedEditDraft.occurredOn);
          setReceiptCurrency(loadedEditDraft.currency);
          setReceiptTotalInput(centsToInput(loadedEditDraft.totalCents));
          setConfirmedReceiptTotalCents(loadedEditDraft.totalCents);
          setManualRsdInput(
            loadedEditDraft.manualRsdTotalCents === null ||
              loadedEditDraft.manualRsdTotalCents === undefined
              ? ''
              : centsToInput(loadedEditDraft.manualRsdTotalCents),
          );
          setItems(
            loadedEditDraft.items.map((item) => ({
              amountCents: item.amountCents,
              amountInput: centsToInput(item.amountCents),
              categoryEdited: false,
              categoryId: item.categoryId,
              description: item.description,
              descriptionEdited: false,
              expenseId: item.id,
              id: item.id,
              included: true,
              inclusionEdited: false,
              quantity: null,
              rawName: item.rawName,
              unitPriceCents: null,
              vatLabel: null,
            })),
          );
          return;
        }

        if (!draft) {
          throw new Error(t('review.receiptNotFound'));
        }

        setEditDraft(null);
        const matched = findMatchingMerchant(
          loadedMerchants,
          draft.merchantName,
        );
        const categoriesByName = new Map(
          loadedCategories.map((category) => [
            normalizeCategoryName(category.name),
            category.id,
          ]),
        );

        setMerchantMode(matched ? 'existing' : 'new');
        setMerchantId(matched?.id ?? null);
        setMerchantName(draft.merchantName);
        // An unreadable date arrives as null: leave the field empty so review
        // asks the human for it instead of throwing the analysis away.
        let draftDate = '';
        try {
          draftDate = parsedReceiptDate(draft);
        } catch {
          draftDate = '';
        }
        setOccurredOn(draftDate);
        setReceiptCurrency(draft.currency);
        const itemTotalCents = draft.items.reduce(
          (total, item) => total + item.lineTotalCents,
          0,
        );
        setReceiptTotalInput(
          centsToInput(draft.totalCents ?? itemTotalCents),
        );
        setConfirmedReceiptTotalCents(draft.totalCents);
        setTotalInputEdited(false);
        setManualRsdInput('');
        const preparedItems = draft.items.map((item, itemIndex) => {
          const suggestedCategoryId = item.categoryName
            ? categoriesByName.get(
                normalizeCategoryName(item.categoryName),
              )
            : null;
          return {
            amountCents: item.lineTotalCents,
            amountInput: centsToInput(item.lineTotalCents),
            categoryEdited: false,
            categoryId: suggestedCategoryId ?? uncategorized.id,
            description: item.name,
            descriptionEdited: false,
            expenseId: null,
            id: itemIndex,
            included: true,
            inclusionEdited: false,
            quantity: item.quantity,
            rawName: item.rawName?.trim() || item.name,
            unitPriceCents: item.unitPriceCents,
            vatLabel: item.vatLabel,
          };
        });
        setItems(preparedItems);
        setCategorizing(true);
        void resolveCategoriesForItems(
          preparedItems.map(({ rawName }) => ({ name: rawName })),
          loadedCategories,
        )
          .then((resolutions) => {
            if (!active) {
              return;
            }
            setItems((current) =>
              current.map((item, index) => {
                const resolution = resolutions[index];
                if (!resolution) {
                  return item;
                }
                return {
                  ...item,
                  categoryId: item.categoryEdited
                    ? item.categoryId
                    : resolution.categoryId,
                  description: item.descriptionEdited
                    ? item.description
                    : resolution.displayName,
                  included: item.inclusionEdited
                    ? item.included
                    : !resolution.excluded,
                };
              }),
            );
          })
          .catch(() => {
            console.error('Unable to resolve receipt item categories.');
          })
          .finally(() => {
            if (active) {
              setCategorizing(false);
            }
          });
      },
    )
      .catch((error: unknown) => {
        console.error('Unable to prepare receipt review:', error);
        if (active) {
          setErrorMessage(
            error instanceof RateUnavailableError
              ? t('editor.ratesLoadFailed')
              : error instanceof Error && error.message
                ? error.message
                : t('review.prepareFailed'),
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [draft, editReceiptId, isEditMode]);

  // Any change to the draft, edit target or a persisted save-payload field voids
  // an outstanding check or approval, so a stale result can never drive a write or
  // show an obsolete warning for values that have since moved on. (Account changes
  // are handled by the remount wrapper.)
  useEffect(() => {
    invalidatePendingDuplicateWork();
    // invalidate* only touches stable refs/setters; we key on the identity values
    // deliberately, not on the helper closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savePayloadKey, draft, editReceiptId]);

  // Leaving the screen (blur, and also unmount) invalidates any in-flight check so
  // a late result can never save or warn after the user has navigated away.
  useFocusEffect(
    useCallback(
      () => () => {
        invalidatePendingDuplicateWork();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    ),
  );

  const includedItems = useMemo(
    () => items.filter((item) => item.included),
    [items],
  );
  const validIncludedItems = useMemo(
    () =>
      includedItems.filter(
        (item): item is ReviewItem & { amountCents: number } =>
          item.amountCents !== null,
      ),
    [includedItems],
  );
  const includedTotal = includedReviewTotal(items);
  const receiptTotalInputCents = parseReviewAmountInput(receiptTotalInput);
  const receiptTotalCents = confirmedReceiptTotalCents;
  const hasInvalidIncludedAmounts =
    validIncludedItems.length !== includedItems.length;
  const manualRsdTotalCents = manualRsdInput.trim()
    ? parseAmountInput(manualRsdInput)
    : null;
  // A null currency is "not chosen yet", not an exotic one, so the manual
  // RSD-equivalent branch stays closed until the human picks a code.
  const usesManualRsdEquivalent = needsManualRsdEquivalent(receiptCurrency);
  const hasInvalidManualRsdTotal =
    usesManualRsdEquivalent &&
    manualRsdInput.trim() !== '' &&
    (manualRsdTotalCents === null || manualRsdTotalCents <= 0);
  // What the model could not read and the human has not filled in yet.
  const draftBlockers = receiptDraftBlockers({
    occurredOn,
    currency: receiptCurrency,
    totalCents: receiptTotalCents,
  });
  const needsDate = draftBlockers.includes('date');
  const needsCurrency = draftBlockers.includes('currency');
  const needsTotal = draftBlockers.includes('total');
  const totalWasUnread = !isEditMode && draft?.totalCents === null;

  if (loading) {
    return <LoadingScreen />;
  }

  const reviewAvailable = isEditMode ? editDraft !== null : draft !== null;
  if (!reviewAvailable) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>
          {errorMessage ||
            (isEditMode
              ? t('review.purchaseNotFound')
              : t('review.receiptNotFound'))}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(app)')}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>{t('review.goHome')}</Text>
        </Pressable>
      </View>
    );
  }

  const receiptPaymentType =
    editDraft?.paymentType ?? draft?.paymentType ?? null;
  const receiptMerchantLabel =
    editDraft?.merchantLabel ??
    draft?.merchantLabel ??
    draft?.merchantName ??
    '';
  const selectedMerchantName =
    merchantMode === 'existing'
      ? merchants.find((merchant) => merchant.id === merchantId)?.name ??
        merchantName
      : merchantName;
  const showMerchantLabel =
    receiptMerchantLabel.trim() !== '' &&
    receiptMerchantLabel.trim() !== selectedMerchantName.trim();

  const totalsMismatch = reviewTotalsMismatch(
    includedTotal,
    receiptTotalCents,
  );

  const applyCategoryToAll = (categoryId: string) => {
    setBulkCategoryId(categoryId);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        categoryEdited: true,
        categoryId,
      })),
    );
  };

  const updateItemCategory = (index: number, categoryId: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, categoryEdited: true, categoryId }
          : item,
      ),
    );
  };

  const updateItemDescription = (index: number, description: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, description, descriptionEdited: true }
          : item,
      ),
    );
  };

  const updateItemAmount = (index: number, amountInput: string) => {
    const amountCents = parseReviewAmountInput(amountInput);
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, amountCents, amountInput }
          : item,
      ),
    );
  };

  const toggleItem = (index: number) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              included: !item.included,
              inclusionEdited: true,
            }
          : item,
      ),
    );
  };

  const changeReceiptCurrency = (currency: string) => {
    setReceiptCurrency(currency);
    if (isCurrency(currency)) {
      setManualRsdInput('');
    }
  };

  const changeReceiptTotal = (value: string) => {
    setReceiptTotalInput(value);
    setConfirmedReceiptTotalCents(null);
    setTotalInputEdited(true);
  };

  const confirmReceiptTotal = () => {
    if (receiptTotalInputCents === null) {
      return;
    }
    setConfirmedReceiptTotalCents(receiptTotalInputCents);
    setErrorMessage('');
  };

  // Validates the current form and resolves the merchant to save with, or null
  // (having set an error message). Used by every save path so validation and the
  // duplicate-check input stay in sync with what would actually be written.
  const collectSaveInput = (
    allowEmptyEdit: boolean,
  ): {
    merchant: FiscalReceiptMerchantInput | null;
    currency: string;
    totalCents: number;
  } | null => {
    setErrorMessage('');
    if (!includedItems.length && !allowEmptyEdit) {
      setErrorMessage(t('review.keepOneItem'));
      return null;
    }
    if (hasInvalidIncludedAmounts) {
      setErrorMessage(t('review.fixIncludedAmounts'));
      return null;
    }
    if (hasInvalidManualRsdTotal) {
      setErrorMessage(t('review.validTotalOrEmpty'));
      return null;
    }
    if (!parseLocalISO(occurredOn)) {
      setErrorMessage(t('review.validDate'));
      return null;
    }
    if (!receiptCurrency) {
      setErrorMessage(t('review.currencyMissing'));
      return null;
    }
    if (receiptTotalCents === null) {
      setErrorMessage(t('review.totalMissing'));
      return null;
    }

    let merchant: FiscalReceiptMerchantInput | null = null;
    if (merchantMode === 'existing' && merchantId) {
      merchant = { existingId: merchantId };
    }
    if (merchantMode === 'new' && merchantName.trim()) {
      merchant = { name: merchantName };
    }
    if (!merchant && includedItems.length > 0) {
      setErrorMessage(
        merchantMode === 'existing'
          ? t('review.pickExistingPlace')
          : t('review.enterNewPlaceName'),
      );
      return null;
    }

    return { merchant, currency: receiptCurrency, totalCents: receiptTotalCents };
  };

  // The database write — the non-cancellable phase. `writeInFlightRef` is released
  // only here, so a failed write stays retryable. Completion side-effects (success
  // toast, draft clearing, navigation, error toast) run only while this write's
  // `session` is still current, so a write that outlived its review session never
  // clears a newer draft, navigates a different session or shows account-
  // inappropriate feedback. currency/totalCents are the validated non-null values
  // from collectSaveInput.
  const runWrite = async (
    session: number,
    merchant: FiscalReceiptMerchantInput | null,
    currency: string,
    totalCents: number,
  ) => {
    writeInFlightRef.current = true;
    setSaving(true);
    try {
      let deleted = false;
      if (isEditMode) {
        if (!editReceiptId) {
          throw new Error(t('review.purchaseNotFound'));
        }
        const result = await updateFiscalReceipt(editReceiptId, {
          merchant,
          merchantLabel: receiptMerchantLabel,
          occurredOn,
          currency,
          manualRsdTotalCents,
          expenses: items.map((item) => {
            if (!item.expenseId) {
              throw new Error(t('review.itemNotFound'));
            }
            return {
              id: item.expenseId,
              amountCents: item.amountCents,
              categoryId: item.categoryId,
              description: item.description.trim() || item.rawName,
              rawName: item.rawName,
              included: item.included,
            };
          }),
        });
        deleted = result.deleted;
      } else {
        if (!draft || !merchant) {
          throw new Error(t('review.receiptNotFound'));
        }
        await saveFiscalReceipt({
          // occurredOn comes from the form: for a photo draft the date may have
          // been unreadable and filled in here, and the save path reads it off
          // the receipt.
          receipt: {
            ...draft,
            currency,
            occurredOn,
            totalCents,
          },
          ...(draft.source === 'ocr_photo' ? { rawReceipt: draft } : {}),
          merchant,
          manualRsdTotalCents,
          expenses: validIncludedItems.map((item) => ({
            amountCents: item.amountCents,
            categoryId: item.categoryId,
            description: item.description.trim() || item.rawName,
            rawName: item.rawName,
          })),
        });
      }
      try {
        // Bind rule learning to the account that owned this save. If the account
        // changed while persistence was pending, the writer rejects rather than
        // learning this receipt's selections under the new account — a real
        // ownership guard, not merely hidden UI feedback.
        await learnItemCategoryRules(
          items.map((item) => ({
            rawName: item.rawName,
            displayName: item.description.trim() || item.rawName,
            categoryId: item.included ? item.categoryId : null,
            excluded: !item.included,
          })),
          (rules) => upsertItemCategoryRules(rules, accountId),
        );
      } catch {
        console.error('Unable to learn receipt item categories.');
      }
      // The write succeeded. Only act on the UI while this write still owns the
      // current session; otherwise the user has moved on and these effects would
      // disturb a newer draft/session.
      if (session === sessionRef.current) {
        toast.success(
          t(isEditMode ? 'toast.changesSaved' : 'toast.receiptSaved'),
        );
        if (!isEditMode) {
          clearDraft();
        }
        if (isEditMode) {
          const homeMonth = deleted
            ? editDraft?.occurredOn.slice(0, 7)
            : occurredOn.slice(0, 7);
          router.replace(
            homeMonth ? `/(app)?month=${homeMonth}` : '/(app)',
          );
        } else {
          router.replace('/(app)');
        }
      }
    } catch (error: unknown) {
      console.error('Unable to save receipt review:', error);
      if (session === sessionRef.current) {
        toast.error(
          error instanceof RateUnavailableError
            ? t('editor.ratesLoadFailed')
            : error instanceof Error && error.message
              ? error.message
              : isEditMode
                ? t('review.saveChangesFailed')
                : t('review.saveReceiptFailed'),
        );
      }
    } finally {
      // A started mutation cannot be unwound; always release the write guard so a
      // failed write stays retryable. No competing write can exist (the guard
      // blocked one), so clearing saving here is safe.
      writeInFlightRef.current = false;
      setSaving(false);
      setConfirmDeleteAll(false);
    }
  };

  // Edit path (and the delete-all confirmation): no duplicate detection, straight
  // to the write under the current session.
  const saveEdit = async (allowEmptyEdit: boolean) => {
    if (!canStartSave()) {
      return;
    }
    const input = collectSaveInput(allowEmptyEdit);
    if (!input) {
      return;
    }
    await runWrite(
      sessionRef.current,
      input.merchant,
      input.currency,
      input.totalCents,
    );
  };

  // Builds the duplicate-check input from the validated values that would be
  // saved — the human-confirmed total, selected currency, form date and merchant
  // — never the outdated OCR draft values.
  const buildDuplicateInput = (): IncomingReceiptForDuplicates => ({
    totalCents: receiptTotalCents,
    currency: receiptCurrency,
    occurredOn,
    occurredAt: draft?.occurredAt ?? null,
    merchantId: merchantMode === 'existing' ? merchantId : null,
    merchantName: selectedMerchantName,
    merchantLabel: receiptMerchantLabel,
    taxId: draft?.taxId ?? null,
  });

  // New-receipt path: validate, check for probable duplicates, then either warn
  // or save. Never mutates before the user's decision.
  const checkDuplicatesThenSave = async () => {
    if (!canStartSave()) {
      return;
    }
    const input = collectSaveInput(false);
    if (!input || !input.merchant) {
      return;
    }
    // Advance the session so this check attempt has a unique authorization
    // identity, distinct from any previous check in this same review session.
    const session = (sessionRef.current += 1);
    checkInFlightRef.current = true;
    approvalRef.current = null;
    setApprovalSession(null);
    setCheckingDuplicates(true);
    setDuplicateCheckFailed(false);
    setErrorMessage('');

    let matches: ReceiptDuplicateCandidate[] = [];
    let failed = false;
    try {
      matches = await findReceiptDuplicates(buildDuplicateInput());
    } catch (error: unknown) {
      console.error('Unable to check for duplicate receipts:', error);
      failed = true;
    }
    // Superseded by invalidation (draft/edit-target/field change or blur) or by a
    // remount (account change): a fresh read of the current session proves it. The
    // check is cancellable, so leave the guard to whoever owns the session now.
    if (session !== sessionRef.current) {
      return;
    }
    checkInFlightRef.current = false;
    setCheckingDuplicates(false);
    if (failed) {
      approvalRef.current = session;
      setApprovalSession(session);
      setDuplicateCheckFailed(true);
      return;
    }
    if (matches.length > 0) {
      approvalRef.current = session;
      setApprovalSession(session);
      setDuplicateMatches(matches);
      return;
    }
    await runWrite(session, input.merchant, input.currency, input.totalCents);
  };

  // "Save anyway" / "Save without checking": authorize the write for exactly the
  // session this button was rendered for, exactly once. A stale or duplicate
  // callback (older session, or after the approval was consumed) is a harmless
  // no-op, and it never touches an active write's guard.
  const saveBypassingDuplicateCheck = async (approvedSession: number | null) => {
    if (!canStartSave()) {
      return;
    }
    if (
      approvedSession === null ||
      approvalRef.current === null ||
      approvalRef.current !== approvedSession
    ) {
      return;
    }
    // Consume the approval once. approvalRef is cleared on any invalidation, so a
    // non-null match here means the session is still current.
    approvalRef.current = null;
    setApprovalSession(null);
    const input = collectSaveInput(false);
    if (!input || !input.merchant) {
      setDuplicateMatches(null);
      setDuplicateCheckFailed(false);
      return;
    }
    setDuplicateMatches(null);
    setDuplicateCheckFailed(false);
    await runWrite(
      sessionRef.current,
      input.merchant,
      input.currency,
      input.totalCents,
    );
  };

  const handleSave = async () => {
    if (isEditMode && includedItems.length === 0) {
      setConfirmDeleteAll(true);
      return;
    }
    if (isEditMode) {
      await saveEdit(false);
      return;
    }
    await checkDuplicatesThenSave();
  };

  // Stronger matches first, then a deterministic id tiebreak, formatted for the
  // warning dialog with the receipt's own currency and local date.
  const duplicateWarningRows: DuplicateWarningRow[] = (duplicateMatches ?? [])
    .slice()
    .sort((left, right) => {
      const rank = (candidate: ReceiptDuplicateCandidate) =>
        candidate.match.confidence === 'strong' ? 0 : 1;
      const byRank = rank(left) - rank(right);
      return byRank !== 0
        ? byRank
        : left.receiptId.localeCompare(right.receiptId);
    })
    .map((candidate) => ({
      receiptId: candidate.receiptId,
      merchant:
        candidate.merchantName ??
        candidate.merchantLabel ??
        t('common.notSet'),
      dateLabel: formatLongDate(candidate.occurredOn, locale),
      amountLabel:
        candidate.totalCents !== null && candidate.currency
          ? `${formatMoney(candidate.totalCents)} ${candidate.currency}`
          : '—',
      sourceLabel:
        candidate.source === 'fiscal_qr'
          ? t('review.duplicate.sourceQr')
          : candidate.source === 'ocr_photo'
            ? t('review.duplicate.sourcePhoto')
            : null,
    }));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          disabled={saving}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>
          {isEditMode ? t('home.editPurchase') : t('review.checkTitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('common.date')}</Text>
            {isEditMode || needsDate ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setDatePickerVisible(true)}
                style={({ pressed }) => [
                  styles.dateSelector,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dateSelectorText}>
                  {occurredOn
                    ? formatLongDate(occurredOn, locale)
                    : t('review.datePick')}
                </Text>
                <Text style={styles.dateSelectorChevron}>›</Text>
              </Pressable>
            ) : (
              <Text style={styles.summaryValue}>{occurredOn}</Text>
            )}
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('review.receiptTotal')}</Text>
            <View style={styles.summaryAmount}>
              {totalWasUnread ? (
                <TextInput
                  accessibilityLabel={t('review.receiptTotal')}
                  editable={!saving}
                  inputMode="decimal"
                  maxLength={20}
                  onChangeText={changeReceiptTotal}
                  placeholder="0,00"
                  placeholderTextColor={colors.field.placeholder}
                  selectTextOnFocus
                  style={[
                    styles.totalInput,
                    receiptTotalInputCents === null &&
                      styles.itemAmountInputInvalid,
                  ]}
                  value={receiptTotalInput}
                />
              ) : (
                <Text style={styles.summaryValue}>
                  {receiptTotalCents === null
                    ? '—'
                    : formatMoney(receiptTotalCents)}
                </Text>
              )}
              <ReceiptCurrencySelector
                disabled={saving}
                onChange={changeReceiptCurrency}
                value={receiptCurrency}
              />
            </View>
          </View>
          {receiptPaymentType ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('review.payment')}</Text>
              <Text style={styles.summaryValue}>
                {receiptPaymentType}
              </Text>
            </View>
          ) : null}
          {needsDate ? (
            <Text accessibilityRole="alert" style={styles.missingFieldText}>
              {t('review.dateMissing')}
            </Text>
          ) : null}
          {needsCurrency ? (
            <Text accessibilityRole="alert" style={styles.missingFieldText}>
              {t('review.currencyMissing')}
            </Text>
          ) : null}
          {needsTotal ? (
            <View style={styles.totalConfirmation}>
              <Text accessibilityRole="alert" style={styles.missingFieldText}>
                {t('review.totalMissing')}
              </Text>
              {!totalInputEdited ? (
                <Text style={styles.helperText}>
                  {t('review.totalPrefillHint')}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={saving || receiptTotalInputCents === null}
                onPress={confirmReceiptTotal}
                style={({ pressed }) => [
                  styles.confirmTotalButton,
                  (pressed || saving || receiptTotalInputCents === null) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.confirmTotalText}>
                  {t('review.confirmTotal')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {!isEditMode && draft?.confidence === 'low' ? (
          <View accessibilityRole="alert" style={styles.warningCard}>
            <Text style={styles.warningText}>{t('review.lowConfidence')}</Text>
          </View>
        ) : null}

        {totalsMismatch ? (
          <View accessibilityRole="alert" style={styles.mismatchCard}>
            <Text style={styles.mismatchText}>
              {t('review.mismatchTitle')} {t('review.mismatchHint')}
            </Text>
          </View>
        ) : null}

        {usesManualRsdEquivalent ? (
          <View style={styles.manualCurrencySection}>
            <View style={styles.manualField}>
              <Text style={styles.label}>{t('review.manualRsdLabel')}</Text>
              <View style={styles.manualInputRow}>
                <TextInput
                  accessibilityLabel={t('review.manualRsdA11y')}
                  editable={!saving}
                  inputMode="decimal"
                  maxLength={20}
                  onChangeText={setManualRsdInput}
                  placeholder="0,00"
                  placeholderTextColor={colors.field.placeholder}
                  style={[
                    styles.manualInput,
                    hasInvalidManualRsdTotal && styles.itemAmountInputInvalid,
                  ]}
                  value={manualRsdInput}
                />
                <Text style={styles.manualCurrency}>RSD</Text>
              </View>
              <Text style={styles.helperText}>
                {t('review.distributeHint')}
              </Text>
              {hasInvalidManualRsdTotal ? (
                <Text accessibilityRole="alert" style={styles.itemValidationText}>
                  {t('review.amountAboveZero')}
                </Text>
              ) : null}
            </View>
            <View accessibilityRole="alert" style={styles.warningCard}>
              <Text style={styles.warningText}>
                {t('review.noConversionHint', { currency: receiptCurrency })}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.place')}</Text>
          {showMerchantLabel ? (
            <Text numberOfLines={2} style={styles.merchantLabel}>
              {t('common.onReceipt', { name: receiptMerchantLabel })}
            </Text>
          ) : null}
          <View style={styles.modeChips}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: merchantMode === 'existing' }}
              onPress={() => setMerchantMode('existing')}
              style={({ pressed }) => [
                styles.modeChip,
                merchantMode === 'existing' && styles.modeChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.modeChipText,
                  merchantMode === 'existing' &&
                    styles.modeChipTextSelected,
                ]}
              >
                {t('review.placeExistingTab')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: merchantMode === 'new' }}
              onPress={() => setMerchantMode('new')}
              style={({ pressed }) => [
                styles.modeChip,
                merchantMode === 'new' && styles.modeChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.modeChipText,
                  merchantMode === 'new' && styles.modeChipTextSelected,
                ]}
              >
                {t('review.placeNewTab')}
              </Text>
            </Pressable>
          </View>

          {merchantMode === 'existing' ? (
            <MerchantPicker
              allowCreate={false}
              merchants={merchants}
              onChange={setMerchantId}
              value={merchantId}
            />
          ) : (
            <View style={styles.newMerchant}>
              <Text style={styles.label}>{t('review.newPlaceNameLabel')}</Text>
              <TextInput
                autoCapitalize="words"
                maxLength={80}
                onChangeText={setMerchantName}
                placeholder={t('review.newPlaceNamePlaceholder')}
                placeholderTextColor={colors.field.placeholder}
                style={styles.input}
                value={merchantName}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('review.itemsCount', {
              included: includedItems.length,
              total: items.length,
            })}
          </Text>
          {categorizing ? (
            <View style={styles.categorizingState}>
              <ActivityIndicator
                color={colors.action.primary.fill}
                size="small"
              />
              <Text style={styles.categorizingText}>
                {t('review.categorizing')}
              </Text>
            </View>
          ) : null}
          <CategoryPicker
            categories={categories}
            label={t('review.categoryForAll')}
            onChange={applyCategoryToAll}
            value={bulkCategoryId}
          />

          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.itemCard,
                !item.included && styles.itemCardExcluded,
              ]}
            >
              <TextInput
                accessibilityLabel={t('review.itemNameA11y', { n: index + 1 })}
                autoCapitalize="sentences"
                editable={!saving}
                maxLength={240}
                multiline={false}
                onChangeText={(description) =>
                  updateItemDescription(index, description)
                }
                placeholder={t('review.itemNamePlaceholder')}
                placeholderTextColor={colors.field.placeholder}
                style={[
                  styles.itemNameInput,
                  !item.included && styles.excludedText,
                ]}
                value={item.description}
              />
              {item.rawName.trim() &&
              item.rawName.trim() !== item.description.trim() ? (
                <Text numberOfLines={2} style={styles.itemRawName}>
                  {t('common.onReceipt', { name: item.rawName })}
                </Text>
              ) : null}
              <View style={styles.itemDetailsRow}>
                <Text style={styles.itemDetails}>
                  {item.quantity !== null && item.unitPriceCents !== null
                    ? `${item.quantity} × ${formatMoney(item.unitPriceCents)} ${receiptCurrency}`
                    : t('review.noQtyOrPrice')}
                  {item.vatLabel
                    ? ` · ${t('review.vat', { label: item.vatLabel })}`
                    : ''}
                </Text>
                <View style={styles.itemAmountColumn}>
                  <View style={styles.itemAmountEditor}>
                    <TextInput
                      accessibilityLabel={t('review.itemAmountA11y', {
                        n: index + 1,
                      })}
                      editable={!saving}
                      inputMode="decimal"
                      maxLength={20}
                      onChangeText={(amountInput) =>
                        updateItemAmount(index, amountInput)
                      }
                      placeholder="0,00"
                      placeholderTextColor={colors.field.placeholder}
                      selectTextOnFocus
                      style={[
                        styles.itemAmountInput,
                        item.amountCents === null &&
                          styles.itemAmountInputInvalid,
                        !item.included && styles.excludedText,
                      ]}
                      value={item.amountInput}
                    />
                    <Text
                      style={[
                        styles.itemCurrency,
                        !item.included && styles.excludedText,
                      ]}
                    >
                      {receiptCurrency}
                    </Text>
                  </View>
                  {item.amountCents === null ? (
                    <Text
                      accessibilityRole="alert"
                      style={styles.itemValidationText}
                    >
                      {t('review.amountAboveZero')}
                    </Text>
                  ) : null}
                </View>
              </View>
              {item.included ? (
                <CategoryPicker
                  categories={categories}
                  onChange={(categoryId) =>
                    updateItemCategory(index, categoryId)
                  }
                  value={item.categoryId}
                />
              ) : null}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !item.included }}
                onPress={() => toggleItem(index)}
                style={({ pressed }) => [
                  styles.excludeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.excludeText}>
                  {item.included
                    ? t('review.excludeItem')
                    : t('review.includeItem')}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.saveSummary}>
          <Text style={styles.saveSummaryLabel}>{t('review.willBeSaved')}</Text>
          <Text style={styles.saveSummaryTotal}>
            {includedTotal === null
              ? `— ${receiptCurrency}`
              : `${formatMoney(includedTotal)} ${receiptCurrency}`}
          </Text>
        </View>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        {duplicateCheckFailed ? (
          <View style={styles.duplicateCheckFailed}>
            <StatusBanner
              action={{
                label: t('review.duplicate.retry'),
                onPress: () => void checkDuplicatesThenSave(),
              }}
              message={t('review.duplicate.checkFailed')}
              tone="warning"
            />
            <Button
              disabled={saving}
              fullWidth
              label={t('review.duplicate.saveWithoutChecking')}
              onPress={() => void saveBypassingDuplicateCheck(approvalSession)}
              size="medium"
              variant="surface"
            />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={
            saving ||
            checkingDuplicates ||
            hasInvalidIncludedAmounts ||
            hasInvalidManualRsdTotal ||
            draftBlockers.length > 0
          }
          onPress={() => void handleSave()}
          testID="save-receipt"
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed ||
              saving ||
              checkingDuplicates ||
              hasInvalidIncludedAmounts ||
              hasInvalidManualRsdTotal ||
              draftBlockers.length > 0) &&
              styles.disabled,
          ]}
        >
          {saving || checkingDuplicates ? (
            <ActivityIndicator color={colors.action.primary.content} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isEditMode ? t('review.saveChanges') : t('review.saveReceipt')}
            </Text>
          )}
        </Pressable>

        {checkingDuplicates ? (
          <Text style={styles.checkingText}>
            {t('review.duplicate.checking')}
          </Text>
        ) : null}
      </ScrollView>

      {/* Also reachable for a photo draft whose date the model could not read:
          the picker opens on the current month until the human picks a day. */}
      <DatePicker
        onChange={setOccurredOn}
        onClose={() => setDatePickerVisible(false)}
        value={occurredOn || todayLocalISO()}
        visible={datePickerVisible}
      />

      <ConfirmDialog
        confirming={saving}
        onCancel={() => {
          if (!saving) {
            setConfirmDeleteAll(false);
          }
        }}
        onConfirm={() => void saveEdit(true)}
        title={t('review.deleteConfirmTitle')}
        visible={isEditMode && confirmDeleteAll}
      />

      <DuplicateWarningDialog
        matches={duplicateWarningRows}
        onBack={() => {
          // Bound to this warning's approval identity: an older Back closure must
          // not dismiss a newer warning. Returning to review drops the approval;
          // the next Save re-checks.
          if (
            saving ||
            approvalSession === null ||
            approvalRef.current !== approvalSession
          ) {
            return;
          }
          approvalRef.current = null;
          setApprovalSession(null);
          setDuplicateMatches(null);
        }}
        onSaveAnyway={() => void saveBypassingDuplicateCheck(approvalSession)}
        saving={saving}
        visible={duplicateMatches !== null && duplicateMatches.length > 0}
      />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  backText: {
    color: c.icon.primary,
    fontSize: theme.fontSizes.title,
  },
  centerState: {
    alignItems: 'center',
    backgroundColor: c.bg.base,
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  categorizingState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  categorizingText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
  },
  checkingText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
    textAlign: 'center',
  },
  confirmTotalButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: c.action.secondary.border,
    borderRadius: theme.radii.button,
    borderWidth: theme.sizes.border,
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.md,
  },
  confirmTotalText: {
    color: c.action.secondary.content,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
  },
  dateSelector: {
    alignItems: 'center',
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.sm,
  },
  dateSelectorChevron: {
    color: c.icon.secondary,
    fontSize: theme.fontSizes.title,
  },
  dateSelectorText: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  duplicateCheckFailed: {
    gap: theme.spacing.sm,
  },
  errorText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
  },
  excludeButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: theme.sizes.iconButton,
  },
  excludeText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  excludedText: {
    color: c.text.disabled,
    textDecorationLine: 'line-through',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: c.border.default,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  helperText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.caption,
  },
  input: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  itemAmountColumn: {
    alignItems: 'flex-end',
    width: '45%',
  },
  itemAmountEditor: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xxs,
    width: '100%',
  },
  itemAmountInput: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.xs,
    textAlign: 'right',
  },
  itemAmountInputInvalid: {
    borderColor: c.field.borderError,
  },
  itemCard: {
    backgroundColor: c.surface.raised,
    borderColor: c.border.subtle,
    borderRadius: theme.radii.card,
    borderWidth: theme.sizes.border,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  itemCardExcluded: {
    backgroundColor: c.surface.raised,
    opacity: theme.opacity.disabled,
  },
  itemCurrency: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  itemDetails: {
    color: c.text.secondary,
    flex: 1,
    fontSize: theme.fontSizes.caption,
  },
  itemDetailsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  itemNameInput: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  itemRawName: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.small,
  },
  itemValidationText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.caption,
    marginTop: theme.spacing.xxs,
    textAlign: 'right',
  },
  missingFieldText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.caption,
  },
  label: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  merchantLabel: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.small,
  },
  manualCurrency: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  manualCurrencySection: {
    gap: theme.spacing.md,
  },
  manualField: {
    gap: theme.spacing.xs,
  },
  manualInput: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  manualInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  mismatchCard: {
    backgroundColor: c.status.error.container,
    borderRadius: theme.radii.card,
    padding: theme.spacing.md,
  },
  mismatchText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.body,
  },
  modeChip: {
    borderColor: c.border.subtle,
    borderRadius: theme.radii.chip,
    borderWidth: theme.sizes.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  modeChipSelected: {
    backgroundColor: c.action.container,
    borderColor: c.icon.action,
  },
  modeChipText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
  },
  modeChipTextSelected: {
    color: c.icon.action,
  },
  modeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  newMerchant: {
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.lg,
    width: '100%',
  },
  primaryButtonText: {
    color: c.action.primary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  saveSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveSummaryLabel: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
  },
  saveSummaryTotal: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  stateTitle: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: c.surface.raised,
    borderColor: c.border.subtle,
    borderRadius: theme.radii.card,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  summaryAmount: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  summaryLabel: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.label,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  summaryValue: {
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
  },
  title: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  totalConfirmation: {
    gap: theme.spacing.xs,
  },
  totalInput: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
    minHeight: theme.sizes.iconButton,
    paddingHorizontal: theme.spacing.sm,
    textAlign: 'right',
    minWidth: theme.sizes.multilineInputHeight,
  },
  warningCard: {
    backgroundColor: c.status.warning.container,
    borderRadius: theme.radii.card,
    padding: theme.spacing.md,
  },
  warningText: {
    color: c.status.warning.content,
    fontSize: theme.fontSizes.body,
  },
});
