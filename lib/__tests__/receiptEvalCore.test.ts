import { describe, expect, it } from '@jest/globals';

// scripts/ is plain CommonJS and excluded from the TS program, so the harness
// core is required and typed with a local interface. All data here is
// synthetic: invented goods and amounts, never a real receipt.

type EvalItem = { name: string; lineTotalCents: number };

type ModelAnswer = {
  items: EvalItem[];
  totalCents: number | null;
  occurredOn: string | null;
  confidence: 'high' | 'medium' | 'low';
  totalsMismatch?: boolean;
};

type PairInput = {
  id?: string;
  truthItems: EvalItem[];
  truthTotalCents: number;
  truthDateISO: string | null;
  model: ModelAnswer;
};

type PairMetrics = {
  id: string | null;
  truthCount: number;
  modelCount: number;
  matchedExact: number;
  matchedWrongTotal: number;
  missed: number;
  phantom: number;
  totalRead: boolean;
  reconciled: boolean;
  dateCorrect: boolean;
  confidence: string;
  flagged: boolean;
  hasError: boolean;
  silentError: boolean;
};

type CalibrationBucket = {
  pairs: number;
  withError: number;
  silentErrors: number;
  errorRate: number;
  silentErrorRate: number;
};

type RunAggregates = {
  pairs: number;
  truthItems: number;
  modelItems: number;
  matchedExact: number;
  matchedWrongTotal: number;
  missed: number;
  phantom: number;
  phantomRate: number;
  itemRecall: number;
  lineTotalExactness: number;
  totalReadRate: number;
  reconciliationRate: number;
  dateAccuracy: number;
  silentErrorRate: number;
  calibration: Record<string, CalibrationBucket>;
  warnings: string[];
};

type ReceiptEvalCore = {
  belgradeDate: (timestamp: string | null) => string | null;
  evaluatePair: (input: PairInput) => PairMetrics;
  aggregate: (pairs: PairMetrics[]) => RunAggregates;
};

const core = require('../../scripts/receiptEvalCore.js') as ReceiptEvalCore;

const TRUTH_ITEMS: EvalItem[] = [
  { name: 'Виджет малый', lineTotalCents: 12000 },
  { name: 'Гаджет большой', lineTotalCents: 38000 },
];
const TRUTH_TOTAL = 50000;
const TRUTH_DATE = '2026-03-04';

function pair(model: Partial<ModelAnswer>, id = 'pair-1'): PairMetrics {
  return core.evaluatePair({
    id,
    truthItems: TRUTH_ITEMS,
    truthTotalCents: TRUTH_TOTAL,
    truthDateISO: TRUTH_DATE,
    model: {
      items: TRUTH_ITEMS,
      totalCents: TRUTH_TOTAL,
      occurredOn: TRUTH_DATE,
      confidence: 'high',
      ...model,
    },
  });
}

describe('receiptEvalCore.evaluatePair', () => {
  it('scores a perfect pair with full recall and no silent error', () => {
    const metrics = pair({});

    expect(metrics.matchedExact).toBe(2);
    expect(metrics.matchedWrongTotal).toBe(0);
    expect(metrics.missed).toBe(0);
    expect(metrics.phantom).toBe(0);
    expect(metrics.totalRead).toBe(true);
    expect(metrics.reconciled).toBe(true);
    expect(metrics.dateCorrect).toBe(true);
    expect(metrics.hasError).toBe(false);
    expect(metrics.silentError).toBe(false);

    const run = core.aggregate([metrics]);
    expect(run.itemRecall).toBe(1);
    expect(run.phantomRate).toBe(0);
    expect(run.silentErrorRate).toBe(0);
  });

  it('counts an invented item as phantom, silent only when unflagged', () => {
    const invented: EvalItem[] = [
      ...TRUTH_ITEMS,
      { name: 'Фантомный товар', lineTotalCents: 9000 },
    ];

    const confident = pair({ items: invented });
    expect(confident.phantom).toBe(1);
    expect(confident.matchedExact).toBe(2);
    expect(confident.hasError).toBe(true);
    expect(confident.flagged).toBe(false);
    expect(confident.silentError).toBe(true);

    const unsure = pair({ items: invented, confidence: 'low' });
    expect(unsure.phantom).toBe(1);
    expect(unsure.flagged).toBe(true);
    expect(unsure.silentError).toBe(false);
  });

  it('counts a dropped item as missed', () => {
    const metrics = pair({ items: [TRUTH_ITEMS[0]] });

    expect(metrics.missed).toBe(1);
    expect(metrics.matchedExact).toBe(1);
    expect(metrics.phantom).toBe(0);
    expect(metrics.hasError).toBe(true);
  });

  it('counts a found item with a wrong total separately from an exact match', () => {
    const metrics = core.evaluatePair({
      truthItems: [TRUTH_ITEMS[0]],
      truthTotalCents: 12000,
      truthDateISO: TRUTH_DATE,
      model: {
        items: [{ name: 'Виджет малый', lineTotalCents: 12500 }],
        totalCents: 12500,
        occurredOn: TRUTH_DATE,
        confidence: 'high',
      },
    });

    expect(metrics.matchedExact).toBe(0);
    expect(metrics.matchedWrongTotal).toBe(1);
    expect(metrics.missed).toBe(0);
    expect(metrics.phantom).toBe(0);

    const run = core.aggregate([metrics]);
    expect(run.lineTotalExactness).toBeLessThan(1);
    expect(run.itemRecall).toBe(1);
  });

  it('keeps two items at the same price as two exact matches', () => {
    const twoColas: EvalItem[] = [
      { name: 'Кола 0,5', lineTotalCents: 15000 },
      { name: 'Кола 0,5', lineTotalCents: 15000 },
    ];
    const metrics = core.evaluatePair({
      truthItems: twoColas,
      truthTotalCents: 30000,
      truthDateISO: TRUTH_DATE,
      model: {
        items: twoColas,
        totalCents: 30000,
        occurredOn: TRUTH_DATE,
        confidence: 'high',
      },
    });

    expect(metrics.truthCount).toBe(2);
    expect(metrics.matchedExact).toBe(2);
    expect(metrics.missed).toBe(0);
    expect(metrics.phantom).toBe(0);
  });

  it('marks a missing total as unread but still reconciles against the truth total', () => {
    const metrics = pair({ totalCents: null });

    expect(metrics.totalRead).toBe(false);
    // Line items still sum to the QR truth total, so reconciliation holds.
    expect(metrics.reconciled).toBe(true);
  });

  it('compares the date in the tracked zone, not via a UTC shortcut', () => {
    // 22:30 UTC is already the next calendar day in Belgrade.
    const stamp = '2026-07-29T22:30:00Z';
    const truthDate = core.belgradeDate(stamp);

    expect(truthDate).toBe('2026-07-30');
    expect(truthDate).not.toBe(stamp.slice(0, 10));

    const metrics = core.evaluatePair({
      truthItems: TRUTH_ITEMS,
      truthTotalCents: TRUTH_TOTAL,
      truthDateISO: truthDate,
      model: {
        items: TRUTH_ITEMS,
        totalCents: TRUTH_TOTAL,
        occurredOn: '2026-07-30',
        confidence: 'high',
      },
    });
    expect(metrics.dateCorrect).toBe(true);
  });
});

describe('receiptEvalCore.aggregate', () => {
  it('aggregates several pairs and reports calibration per confidence', () => {
    const perfect = pair({}, 'perfect');
    const silent = pair(
      {
        items: [...TRUTH_ITEMS, { name: 'Фантомный товар', lineTotalCents: 9000 }],
      },
      'silent',
    );
    const flagged = pair({ items: [TRUTH_ITEMS[0]], confidence: 'low' }, 'flagged');

    const run = core.aggregate([perfect, silent, flagged]);

    expect(run.pairs).toBe(3);
    expect(run.phantom).toBe(1);
    expect(run.missed).toBe(1);
    expect(run.silentErrorRate).toBeCloseTo(1 / 3, 5);
    expect(run.dateAccuracy).toBe(1);
    expect(run.calibration.high.pairs).toBe(2);
    expect(run.calibration.high.silentErrors).toBe(1);
    expect(run.calibration.low.pairs).toBe(1);
    expect(run.calibration.low.silentErrorRate).toBe(0);
    expect(run.warnings).toHaveLength(0);
  });

  it('survives an empty run with zeros and a warning', () => {
    const run = core.aggregate([]);

    expect(run.pairs).toBe(0);
    expect(run.phantomRate).toBe(0);
    expect(run.itemRecall).toBe(0);
    expect(run.lineTotalExactness).toBe(0);
    expect(run.totalReadRate).toBe(0);
    expect(run.reconciliationRate).toBe(0);
    expect(run.dateAccuracy).toBe(0);
    expect(run.silentErrorRate).toBe(0);
    expect(run.calibration).toEqual({});
    expect(run.warnings.length).toBeGreaterThan(0);
  });
});
