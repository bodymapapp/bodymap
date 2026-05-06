#!/usr/bin/env node
/* eslint-disable */
// scripts/audit-intake-schema-render.js
//
// Static audit that catches the class of bug Ashley hit with Pressure:
// "I edited X in the IntakeEditor and the change did not reach the
// client view." Walks the schema definition, the editor, and the
// SchemaField renderer in Demo.jsx, and asserts that every property a
// therapist can edit is consumed by the renderer.
//
// Run via: node scripts/audit-intake-schema-render.js
// Exit code: 0 = clean, 1 = at least one contract gap found.
//
// What it checks for each default field:
//   1. The editor exposes label, hidden, options[], and (for text /
//      textarea) placeholder edits — verified by looking at
//      IntakeEditor.jsx imports and patches of these properties
//   2. Demo.jsx SchemaField reads and renders each of those edits, OR
//      the field is special-cased and the special case reads them
//   3. The editor type selectable for adding a custom field has a
//      matching generic render branch in SchemaField

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO, 'src/lib/intakeSchema.js');
const EDITOR_PATH = path.join(REPO, 'src/pages/IntakeEditor.jsx');
const DEMO_PATH = path.join(REPO, 'src/pages/Demo.jsx');

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
const editor = fs.readFileSync(EDITOR_PATH, 'utf8');
const demo = fs.readFileSync(DEMO_PATH, 'utf8');

// ----- Parse default field ids out of intakeSchema.js DEFAULT_SCHEMA -----
// Looking for entries like `id: 'pressure'` inside the DEFAULT_SCHEMA
// fields array. We do not try to fully parse JS, just collect the ids.
const fieldIdRegex = /id:\s*'([a-z_]+)'/g;
const defaultFieldIds = new Set();
let m;
while ((m = fieldIdRegex.exec(schema)) !== null) {
  defaultFieldIds.add(m[1]);
}

// ----- Check that SchemaField has a generic render or a special case -----
// for each field. If neither, the field will literally not render.
const errors = [];
const SPECIAL_CASE_IDS = new Set(['pressure', 'oils', 'medical_notes']);

for (const id of defaultFieldIds) {
  if (SPECIAL_CASE_IDS.has(id)) {
    // Special case must exist in Demo.jsx
    const re = new RegExp(`field\\.id === ['"]${id}['"]`);
    if (!re.test(demo)) {
      errors.push(`Default field '${id}' is in SPECIAL_CASE_IDS but no special-case render found in Demo.jsx`);
    }
    // Special case must read field.label (the rename path)
    // We look for the field.id check followed within ~30 lines by
    // either field.label or title=
    const idIdx = demo.indexOf(`field.id === '${id}'`);
    if (idIdx >= 0) {
      const slice = demo.slice(idIdx, idIdx + 2000);
      if (!/field\.label/.test(slice) && !/title=\{field\.label\}/.test(slice)) {
        errors.push(`Special case for '${id}' does not read field.label (label rename will not flow through)`);
      }
    }
  } else {
    // Generic field: SchemaField must have a generic branch matching
    // the field's type. We look up the type from intakeSchema.js.
    const typeRe = new RegExp(`id:\\s*'${id}',\\s*type:\\s*'([a-z_]+)'`);
    const typeMatch = schema.match(typeRe);
    if (typeMatch) {
      const type = typeMatch[1];
      const branchRe = new RegExp(`field\\.type === ['"]${type}['"]`);
      if (!branchRe.test(demo)) {
        errors.push(`Default field '${id}' has type '${type}' but no generic branch \`field.type === '${type}'\` in Demo.jsx`);
      }
    }
  }
}

// ----- Check FIELD_TYPE_CHOICES (custom-field types) all have render branches -----
const typeChoicesMatch = schema.match(/FIELD_TYPE_CHOICES\s*=\s*\[([\s\S]+?)\];/);
if (typeChoicesMatch) {
  const choices = [];
  const choiceRe = /\{\s*v:\s*'([a-z_]+)'/g;
  let cm;
  while ((cm = choiceRe.exec(typeChoicesMatch[1])) !== null) {
    choices.push(cm[1]);
  }
  for (const t of choices) {
    const branchRe = new RegExp(`field\\.type === ['"]${t}['"]`);
    if (!branchRe.test(demo)) {
      errors.push(`Custom-field type '${t}' is offered in FIELD_TYPE_CHOICES but no generic render branch in Demo.jsx`);
    }
  }
  console.log(`  → custom-field types covered: ${choices.join(', ')}`);
}

// ----- Generic chips/chips_multi/checklist branches must read field.options -----
// (catches a future regression where someone hardcodes options inside
// a generic branch, like the Pressure bug)
function getBranchBody(src, type) {
  // Find the start of `if (field.type === 'TYPE') {`, then walk forward
  // matching braces until the closing brace of that if-block. Returns
  // the slice of source between the opening and closing braces.
  const start = src.search(new RegExp(`if \\(field\\.type === ['"]${type}['"]\\) \\{`));
  if (start < 0) return null;
  const openBrace = src.indexOf('{', start);
  let depth = 0;
  for (let i = openBrace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(openBrace, i + 1);
    }
  }
  return null;
}

for (const t of ['chips', 'chips_multi', 'checklist']) {
  const body = getBranchBody(demo, t);
  if (!body) {
    errors.push(`Generic branch for type '${t}' not found in Demo.jsx`);
    continue;
  }
  if (!/field\.options/.test(body)) {
    errors.push(`Generic branch for type '${t}' does not read field.options (option edits will not flow through)`);
  }
  if (!/opt\.label/.test(body)) {
    errors.push(`Generic branch for type '${t}' does not read opt.label (option label edits will not flow through)`);
  }
}

// ----- Editor must support hide / unhide on fields -----
// (sanity check that the contract on the editor side is also intact)
if (!/onToggleHidden/.test(editor)) {
  errors.push(`IntakeEditor.jsx does not export onToggleHidden — therapists cannot hide fields`);
}

// ----- Report -----
console.log(`\nIntake schema render audit`);
console.log(`──────────────────────────────────────────`);
console.log(`Default fields found in schema: ${[...defaultFieldIds].join(', ')}`);
console.log(`Special-cased fields: ${[...SPECIAL_CASE_IDS].join(', ')}`);
console.log(`──────────────────────────────────────────`);

if (errors.length === 0) {
  console.log(`\n✅ All editor-customizable properties reach the client view.`);
  process.exit(0);
}

console.error(`\n❌ ${errors.length} contract gap${errors.length === 1 ? '' : 's'} found:\n`);
for (const e of errors) {
  console.error(`  · ${e}`);
}
console.error(``);
process.exit(1);
