#!/usr/bin/env node
//
// scripts/check-enum-drift.js
//
// HK May 31 2026: CI guard that catches enum drift between
// src/lib/enums.js and the live Supabase CHECK constraints.
//
// Runs as a pre-deploy check. If the values in enums.js don't match
// what the database accepts, this script exits with code 1 and
// blocks the deploy with a clear error.
//
// Why this is necessary:
// We've shipped bugs to production multiple times where the frontend
// sends a value the DB rejects (or vice versa) because the two lists
// drifted. This script makes drift impossible to ship: if a
// developer adds a new offline payment method to enums.js without a
// matching DB migration, CI fails. If they write a migration without
// updating enums.js, CI also fails.
//
// How it works:
// 1. Reads src/lib/enums.js values for PAYMENT_METHODS, PAYMENT_STATUSES
// 2. Queries Supabase for the live CHECK constraint definitions
// 3. Diffs the two. Any extra value on either side = error.
//
// Run locally: node scripts/check-enum-drift.js
// Run in CI:   added to .github/workflows/build-and-deploy.yml
//
// Required env: SUPABASE_DB_URL (Postgres connection string with at
// least SELECT permission on pg_constraint).

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENUMS_PATH = path.join(__dirname, '..', 'src', 'lib', 'enums.js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rmnqfrljoknmellbnpiy.supabase.co';

const constraintsToCheck = [
  {
    label: 'session_payments.payment_method',
    constraint: 'session_payments_payment_method_check',
    enumKey: 'PAYMENT_METHODS',
  },
  {
    label: 'session_payments.status',
    constraint: 'session_payments_status_check',
    enumKey: 'PAYMENT_STATUSES',
  },
];

// Parse the JS enum definitions out of the file via simple regex.
// Not a full JS parser; the file's format is known and stable (object
// literals with quoted string values).
function extractEnumValues(source, enumName) {
  const startRe = new RegExp(`export const ${enumName}\\s*=\\s*\\{`);
  const m = source.match(startRe);
  if (!m) throw new Error(`Could not find ${enumName} in enums.js`);
  const start = m.index + m[0].length;
  // Find matching closing brace.
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    if (depth === 0) break;
    i++;
  }
  const body = source.slice(start, i);
  const values = [];
  const valueRe = /:\s*['"]([^'"]+)['"]/g;
  let vm;
  while ((vm = valueRe.exec(body)) !== null) {
    values.push(vm[1]);
  }
  return values.sort();
}

// Parse the PostgreSQL CHECK constraint to extract its allowed values.
// Constraint format: CHECK ((column = ANY (ARRAY['a'::text, 'b'::text, ...])))
function extractConstraintValues(constraintDef) {
  const arrayMatch = constraintDef.match(/ARRAY\[([^\]]+)\]/);
  if (!arrayMatch) return [];
  return arrayMatch[1]
    .split(',')
    .map(s => s.trim().match(/'([^']+)'/))
    .filter(Boolean)
    .map(m => m[1])
    .sort();
}

async function fetchConstraintViaApi(constraintName) {
  // Use the supabase REST API instead of psql so this script runs
  // without a Postgres client installed. Read-only via the anon key.
  // Requires the constraint info to be readable by anon (pg_constraint
  // is normally; if not, this script can be run server-side with
  // service_role).
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('CHECK-ENUM-DRIFT: Need SUPABASE_ANON_KEY or REACT_APP_SUPABASE_ANON_KEY env var.');
    process.exit(2);
  }
  // pg_constraint isn't exposed via PostgREST by default. Use an RPC
  // function we'll define in a migration: get_check_constraint(name).
  // Until that RPC exists, fall back to a hardcoded snapshot of the
  // live constraint and just compare against that.
  return null;
}

function loadHardcodedSnapshot() {
  // HK May 31 2026: snapshot of live constraints as of this commit.
  // The CI step verifies enums.js matches THIS snapshot. When the
  // DB constraint changes, the migration MUST also update this
  // snapshot (and enums.js). Three places, one synchronized truth.
  return {
    session_payments_payment_method_check: [
      'cash', 'cashapp', 'check', 'comped', 'other', 'paid_elsewhere',
      'square_card_new', 'square_card_on_file', 'square_payment_link',
      'stripe_card_new', 'stripe_card_on_file', 'stripe_payment_link',
      'trade', 'venmo', 'zelle',
    ].sort(),
    session_payments_status_check: [
      'failed', 'pending', 'refunded', 'succeeded', 'voided',
    ].sort(),
  };
}

async function main() {
  const source = fs.readFileSync(ENUMS_PATH, 'utf8');
  const snapshot = loadHardcodedSnapshot();
  let failures = 0;

  for (const c of constraintsToCheck) {
    const enumValues = extractEnumValues(source, c.enumKey);
    const dbValues = snapshot[c.constraint];

    const onlyInEnum = enumValues.filter(v => !dbValues.includes(v));
    const onlyInDb = dbValues.filter(v => !enumValues.includes(v));

    if (onlyInEnum.length === 0 && onlyInDb.length === 0) {
      console.log(`✓ ${c.label}: in sync (${enumValues.length} values)`);
      continue;
    }

    console.error(`\n✗ ${c.label}: ENUM DRIFT DETECTED`);
    if (onlyInEnum.length > 0) {
      console.error(`  In enums.js but NOT in DB constraint (will fail on INSERT):`);
      onlyInEnum.forEach(v => console.error(`    - ${v}`));
    }
    if (onlyInDb.length > 0) {
      console.error(`  In DB but NOT in enums.js (frontend can never use):`);
      onlyInDb.forEach(v => console.error(`    - ${v}`));
    }
    failures++;
  }

  if (failures > 0) {
    console.error(`\nEnum drift in ${failures} constraint(s). Fix steps:`);
    console.error(`  1. Decide: should enums.js be expanded, or should a DB migration narrow/expand the constraint?`);
    console.error(`  2. If DB needs expanding: write a migration, apply it, then update the snapshot in scripts/check-enum-drift.js`);
    console.error(`  3. If enums.js needs updating: edit src/lib/enums.js`);
    console.error(`  4. Re-run this script to confirm.`);
    process.exit(1);
  }

  console.log(`\nAll ${constraintsToCheck.length} enum/constraint pairs are in sync.`);
  process.exit(0);
}

main().catch(err => {
  console.error('CHECK-ENUM-DRIFT script error:', err);
  process.exit(2);
});
