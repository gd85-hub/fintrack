'use strict';

/**
 * RQ-1 — receipt-recognition eval harness (read-only).
 *
 * Measures how well the deployed `analyze-receipt-image` function reads a photo
 * of a receipt, scored against the deterministic SUF journal of the SAME receipt
 * scanned by QR. The truth comes only from the database (receipts.raw_json) —
 * there is no manual labelling.
 *
 * PRIVACY: this repository is public. Receipt photos and the report live OUTSIDE
 * the repo, in the folder given by RECEIPT_EVAL_DIR. Never commit a photo, a
 * report, a real amount or a merchant name.
 *
 * Pair folder layout ($RECEIPT_EVAL_DIR):
 *
 *   <receipt_id>/        a QR receipt's id from the receipts table = the truth
 *     1.jpg              photo of the paper receipt
 *     2.jpg              more files = one receipt photographed in parts, in order
 *   eval-report.json     written by `run` (outside the repo!)
 *
 * No truth files: the truth is fetched from the database by the folder name.
 * To make a pair: scan the receipt by QR in the app, photograph the paper, run
 * `list` to see your latest QR receipts, copy the id into a folder name and drop
 * the photos in. That is the whole manual step.
 *
 * Environment (nothing is hardcoded; .env already holds the first two):
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   RECEIPT_EVAL_DIR   absolute path to the pairs folder, outside the repo
 *   EVAL_EMAIL, EVAL_PASSWORD   the account whose receipts are read (verify_jwt
 *                               on the function needs a live JWT)
 *
 * Usage:
 *   node --env-file=.env scripts/receipt-eval.js list
 *   node --env-file=.env scripts/receipt-eval.js run
 *
 * `run` makes one paid vision call per pair and prints the count at the end.
 * The harness is strictly read-only: it never writes to the database.
 */

const fs = require('node:fs');
const path = require('node:path');

const core = require('./receiptEvalCore.js');

const REQUIRED_ENV = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'RECEIPT_EVAL_DIR',
  'EVAL_EMAIL',
  'EVAL_PASSWORD',
];

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const MAX_IMAGES_PER_PAIR = 5; // analyze-receipt-image rejects more
const ANALYZE_TIMEOUT_MS = 60000;
const REPORT_FILE = 'eval-report.json';

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function readEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    fail(
      `missing environment variable(s): ${missing.join(', ')}\n` +
        'Run it as: node --env-file=.env scripts/receipt-eval.js list|run\n' +
        'RECEIPT_EVAL_DIR, EVAL_EMAIL and EVAL_PASSWORD are not in .env by ' +
        'default — export them or add them to your local .env (never commit).',
    );
  }
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL.replace(/\/+$/, ''),
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    dir: process.env.RECEIPT_EVAL_DIR,
    email: process.env.EVAL_EMAIL,
    password: process.env.EVAL_PASSWORD,
  };
}

async function signIn(env) {
  const response = await fetch(
    `${env.url}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: env.anonKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: env.email, password: env.password }),
    },
  );
  if (!response.ok) {
    fail(
      `sign-in failed (HTTP ${response.status}). Check EVAL_EMAIL / EVAL_PASSWORD.`,
    );
  }
  const payload = await response.json();
  if (!payload || typeof payload.access_token !== 'string') {
    fail('sign-in returned no access token.');
  }
  return payload.access_token;
}

async function restGet(env, jwt, pathAndQuery) {
  const response = await fetch(`${env.url}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: env.anonKey,
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!response.ok) {
    throw new Error(`REST ${pathAndQuery} failed: HTTP ${response.status}`);
  }
  return response.json();
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '-';
}

async function commandList(env) {
  const jwt = await signIn(env);
  const receipts = await restGet(
    env,
    jwt,
    'receipts?source=eq.fiscal_qr&select=id,occurred_at,total,merchant_label' +
      '&order=created_at.desc&limit=20',
  );

  if (!Array.isArray(receipts) || receipts.length === 0) {
    console.log('No QR receipts found for this account.');
    return;
  }

  console.log('Latest QR receipts (copy an id into a folder name):\n');
  console.log(
    ['id', 'date', 'total', 'place'].map((head) => head.toUpperCase()).join('  '),
  );
  for (const receipt of receipts) {
    const date = core.belgradeDate(receipt.occurred_at) ?? '-';
    console.log(
      [
        receipt.id,
        date,
        formatMoney(receipt.total).padStart(10),
        receipt.merchant_label ?? '-',
      ].join('  '),
    );
  }
  console.log(`\n${receipts.length} receipt(s). Pairs folder: ${env.dir}`);
}

function listPairFolders(dir) {
  if (!fs.existsSync(dir)) {
    fail(`RECEIPT_EVAL_DIR does not exist: ${dir}`);
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function readPairImages(dir, folder) {
  const folderPath = path.join(dir, folder);
  const files = fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => entry.name)
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );

  const used = files.slice(0, MAX_IMAGES_PER_PAIR);
  const images = used.map((name) =>
    fs.readFileSync(path.join(folderPath, name)).toString('base64'),
  );
  return { images, used, skippedFiles: files.length - used.length };
}

async function loadTruth(env, jwt, receiptId) {
  const rows = await restGet(
    env,
    jwt,
    `receipts?id=eq.${encodeURIComponent(receiptId)}` +
      '&select=id,raw_json,total,occurred_at',
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, reason: 'receipt not found for this account' };
  }
  const row = rows[0];
  const rawJson = row.raw_json;
  const items =
    rawJson && Array.isArray(rawJson.items) ? rawJson.items : [];
  if (items.length === 0) {
    return { ok: false, reason: 'receipt has no journal items in raw_json' };
  }
  const totalFromRaw = Number(rawJson.totalCents);
  const truthTotalCents = Number.isFinite(totalFromRaw)
    ? totalFromRaw
    : Math.round(Number(row.total) * 100);
  return {
    ok: true,
    truthItems: items,
    truthTotalCents,
    truthDateISO:
      core.belgradeDate(row.occurred_at) ??
      (typeof rawJson.occurredOn === 'string' ? rawJson.occurredOn : null),
  };
}

async function analyzeImages(env, jwt, images, categories, merchantTypes) {
  const response = await fetch(
    `${env.url}/functions/v1/analyze-receipt-image`,
    {
      method: 'POST',
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ images, categories, merchantTypes }),
      signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`analyze-receipt-image: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || payload.ok !== true) {
    const reason =
      payload && typeof payload.error === 'string' ? payload.error : 'unknown';
    throw new Error(`analyze-receipt-image returned not-ok: ${reason}`);
  }
  return payload;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function printSummary(report) {
  const run = report.aggregates;
  console.log('\n--- run summary ---');
  console.log(`pairs evaluated:      ${run.pairs}`);
  console.log(`silent-error rate:    ${percent(run.silentErrorRate)}  <- metric #1`);
  console.log(`phantom rate:         ${percent(run.phantomRate)}`);
  console.log(`item recall:          ${percent(run.itemRecall)}`);
  console.log(`line-total exactness: ${percent(run.lineTotalExactness)}`);
  console.log(`total-read rate:      ${percent(run.totalReadRate)}`);
  console.log(`reconciliation rate:  ${percent(run.reconciliationRate)}`);
  console.log(`date accuracy:        ${percent(run.dateAccuracy)}`);

  const levels = Object.keys(run.calibration);
  if (levels.length > 0) {
    console.log('\ncalibration by confidence:');
    for (const level of levels) {
      const bucket = run.calibration[level];
      console.log(
        `  ${level.padEnd(8)} pairs ${String(bucket.pairs).padStart(3)}  ` +
          `with error ${percent(bucket.errorRate)}  silent ${percent(bucket.silentErrorRate)}`,
      );
    }
  }
  for (const warning of run.warnings) {
    console.log(`warning: ${warning}`);
  }
  if (report.skipped.length > 0) {
    console.log(`\nskipped (${report.skipped.length}):`);
    for (const entry of report.skipped) {
      console.log(`  ${entry.id}: ${entry.reason}`);
    }
  }
  if (report.failed.length > 0) {
    console.log(`\nfailed (${report.failed.length}):`);
    for (const entry of report.failed) {
      console.log(`  ${entry.id}: ${entry.reason}`);
    }
  }
  console.log(`\nvision calls made: ${report.visionCalls}`);
}

async function commandRun(env) {
  const jwt = await signIn(env);
  const [categories, merchantTypes] = await Promise.all([
    restGet(env, jwt, 'categories?select=id,name'),
    restGet(env, jwt, 'merchant_types?select=slug,name'),
  ]);
  if (!Array.isArray(categories) || categories.length === 0) {
    fail('no categories returned — analyze-receipt-image needs them.');
  }
  if (!Array.isArray(merchantTypes) || merchantTypes.length === 0) {
    fail('no merchant types returned — analyze-receipt-image needs them.');
  }

  const folders = listPairFolders(env.dir);
  if (folders.length === 0) {
    console.log(`No pair folders in ${env.dir}. Add <receipt_id>/1.jpg first.`);
  }

  const pairs = [];
  const skipped = [];
  const failed = [];
  let visionCalls = 0;

  for (const folder of folders) {
    const { images, used, skippedFiles } = readPairImages(env.dir, folder);
    if (images.length === 0) {
      skipped.push({ id: folder, reason: 'no jpg/png photos in the folder' });
      continue;
    }

    let truth;
    try {
      truth = await loadTruth(env, jwt, folder);
    } catch (error) {
      failed.push({ id: folder, reason: `truth lookup: ${error.message}` });
      continue;
    }
    if (!truth.ok) {
      skipped.push({ id: folder, reason: truth.reason });
      continue;
    }

    console.log(
      `analyzing ${folder} (${used.length} photo(s)${
        skippedFiles > 0 ? `, ${skippedFiles} beyond the 5-photo limit ignored` : ''
      })...`,
    );
    let model;
    try {
      model = await analyzeImages(env, jwt, images, categories, merchantTypes);
      visionCalls += 1;
    } catch (error) {
      visionCalls += 1; // the call was attempted and may well be billed
      failed.push({ id: folder, reason: error.message });
      continue;
    }

    pairs.push(
      core.evaluatePair({
        id: folder,
        truthItems: truth.truthItems,
        truthTotalCents: truth.truthTotalCents,
        truthDateISO: truth.truthDateISO,
        model,
      }),
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pairs,
    aggregates: core.aggregate(pairs),
    skipped,
    failed,
    visionCalls,
  };

  const reportPath = path.join(env.dir, REPORT_FILE);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  printSummary(report);
  console.log(`report written: ${reportPath}`);
}

async function main() {
  const command = process.argv[2];
  if (command !== 'list' && command !== 'run') {
    fail(
      'usage: node --env-file=.env scripts/receipt-eval.js list|run\n' +
        '  list  show your latest QR receipts (ids for pair folders)\n' +
        '  run   analyze every pair folder and write eval-report.json',
    );
  }
  const env = readEnv();
  if (command === 'list') {
    await commandList(env);
    return;
  }
  await commandRun(env);
}

main().catch((error) => {
  fail(error && error.message ? error.message : String(error));
});
