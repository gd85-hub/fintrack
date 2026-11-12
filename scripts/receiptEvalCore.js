'use strict';

// Pure scoring logic for the receipt-recognition eval harness (RQ-1).
// No I/O, no dependencies, no network: takes a QR receipt's journal truth plus
// one vision-model answer and returns per-pair metrics, then aggregates a run.
// Tested from lib/__tests__/receiptEvalCore.test.ts with synthetic data only.

// A leftover truth item counts as "found with a wrong total" when this share of
// its name tokens is shared with a leftover model item.
const NAME_MATCH_THRESHOLD = 0.5;

function normalizeName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(value) {
  const normalized = normalizeName(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

// Share of common tokens, measured against the longer of the two names.
function tokenOverlap(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

// Calendar date of a timestamp in the tracked zone. Never derive a calendar
// date from toISOString() - it shifts late-evening receipts to another day.
function belgradeDate(timestamp) {
  if (typeof timestamp !== 'string' || !timestamp) {
    return null;
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

function itemCents(item) {
  if (!item || !Number.isFinite(item.lineTotalCents)) {
    return null;
  }
  return item.lineTotalCents;
}

function sumCents(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.reduce((total, item) => {
    const cents = itemCents(item);
    return total + (cents === null ? 0 : cents);
  }, 0);
}

// Two passes: first pair items with equal line totals (greedy in printed order,
// so repeated prices pair first-with-first and never collapse), then pair the
// leftovers by name similarity - those are "found, but the total is wrong".
function matchItems(truthItems, modelItems) {
  const truth = Array.isArray(truthItems) ? truthItems : [];
  const model = Array.isArray(modelItems) ? modelItems : [];
  const truthTaken = new Array(truth.length).fill(false);
  const modelTaken = new Array(model.length).fill(false);
  let matchedExact = 0;
  let matchedWrongTotal = 0;

  for (let t = 0; t < truth.length; t += 1) {
    const cents = itemCents(truth[t]);
    if (cents === null) {
      continue;
    }
    for (let m = 0; m < model.length; m += 1) {
      if (modelTaken[m] || itemCents(model[m]) !== cents) {
        continue;
      }
      truthTaken[t] = true;
      modelTaken[m] = true;
      matchedExact += 1;
      break;
    }
  }

  for (let t = 0; t < truth.length; t += 1) {
    if (truthTaken[t]) {
      continue;
    }
    for (let m = 0; m < model.length; m += 1) {
      if (modelTaken[m]) {
        continue;
      }
      const overlap = tokenOverlap(
        truth[t] ? truth[t].name : '',
        model[m] ? model[m].name : '',
      );
      if (overlap >= NAME_MATCH_THRESHOLD) {
        truthTaken[t] = true;
        modelTaken[m] = true;
        matchedWrongTotal += 1;
        break;
      }
    }
  }

  return {
    truthCount: truth.length,
    modelCount: model.length,
    matchedExact,
    matchedWrongTotal,
    missed: truthTaken.filter((taken) => !taken).length,
    phantom: modelTaken.filter((taken) => !taken).length,
  };
}

function evaluatePair(input) {
  const source = input || {};
  const model = source.model || {};
  const modelItems = Array.isArray(model.items) ? model.items : [];
  const match = matchItems(source.truthItems, modelItems);

  const totalRead = Number.isFinite(model.totalCents);
  const reconciled =
    Number.isFinite(source.truthTotalCents) &&
    sumCents(modelItems) === source.truthTotalCents;
  const dateCorrect =
    typeof source.truthDateISO === 'string' &&
    source.truthDateISO.length > 0 &&
    model.occurredOn === source.truthDateISO;
  const confidence =
    typeof model.confidence === 'string' ? model.confidence : 'unknown';
  // The model warns us when it is unsure: low/medium confidence, or its own
  // totals mismatch. Anything else is a silent error - the dangerous kind.
  const flagged = confidence !== 'high' || model.totalsMismatch === true;
  const hasError =
    match.phantom > 0 ||
    match.missed > 0 ||
    match.matchedWrongTotal > 0 ||
    !reconciled ||
    !dateCorrect;

  return {
    id: typeof source.id === 'string' ? source.id : null,
    truthCount: match.truthCount,
    modelCount: match.modelCount,
    matchedExact: match.matchedExact,
    matchedWrongTotal: match.matchedWrongTotal,
    missed: match.missed,
    phantom: match.phantom,
    totalRead,
    reconciled,
    dateCorrect,
    confidence,
    flagged,
    hasError,
    silentError: hasError && !flagged,
  };
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function aggregate(pairs) {
  const list = Array.isArray(pairs) ? pairs : [];
  const warnings = [];
  if (list.length === 0) {
    warnings.push('no pairs evaluated: nothing to measure');
  }

  const sum = (pick) =>
    list.reduce((total, pair) => total + (Number(pick(pair)) || 0), 0);
  const count = (predicate) => list.filter(predicate).length;

  const truthItems = sum((pair) => pair.truthCount);
  const modelItems = sum((pair) => pair.modelCount);
  const matchedExact = sum((pair) => pair.matchedExact);
  const matchedWrongTotal = sum((pair) => pair.matchedWrongTotal);
  const missed = sum((pair) => pair.missed);
  const phantom = sum((pair) => pair.phantom);

  const calibration = {};
  for (const pair of list) {
    const level = pair && pair.confidence ? pair.confidence : 'unknown';
    if (!calibration[level]) {
      calibration[level] = { pairs: 0, withError: 0, silentErrors: 0 };
    }
    const bucket = calibration[level];
    bucket.pairs += 1;
    if (pair && pair.hasError) {
      bucket.withError += 1;
    }
    if (pair && pair.silentError) {
      bucket.silentErrors += 1;
    }
  }
  for (const level of Object.keys(calibration)) {
    const bucket = calibration[level];
    bucket.errorRate = rate(bucket.withError, bucket.pairs);
    bucket.silentErrorRate = rate(bucket.silentErrors, bucket.pairs);
  }

  return {
    pairs: list.length,
    truthItems,
    modelItems,
    matchedExact,
    matchedWrongTotal,
    missed,
    phantom,
    phantomRate: rate(phantom, modelItems),
    itemRecall: rate(matchedExact + matchedWrongTotal, truthItems),
    lineTotalExactness: rate(matchedExact, matchedExact + matchedWrongTotal),
    totalReadRate: rate(count((pair) => pair.totalRead), list.length),
    reconciliationRate: rate(count((pair) => pair.reconciled), list.length),
    dateAccuracy: rate(count((pair) => pair.dateCorrect), list.length),
    // Metric #1: errors the model did not warn us about.
    silentErrorRate: rate(count((pair) => pair.silentError), list.length),
    calibration,
    warnings,
  };
}

module.exports = {
  NAME_MATCH_THRESHOLD,
  aggregate,
  belgradeDate,
  evaluatePair,
  matchItems,
  normalizeName,
  sumCents,
  tokenOverlap,
};
