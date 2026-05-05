// src/lib/intakeSchema.js
//
// The single source of truth for what fields appear on the client
// intake form. Therapists can customize this per-practice via the
// IntakeEditor page; the production intake renderer reads from a
// therapist's custom schema if one exists, otherwise falls back to
// DEFAULT_SCHEMA below.
//
// FIELD TYPES (V1):
//   chips     — single-select pill picker (Pressure, Music, etc.)
//   chips_multi — multi-select pill picker (focus zones, etc.)
//   text      — short free-text input
//   textarea  — multi-line free-text input
//   checkbox  — yes/no boolean
//   checklist — multi-select checklist (medical conditions)
//   header    — visual section divider, no input
//
// All fields share: { id, type, label, hidden, required, kind, options? }
// where kind is "default" (one of our built-in fields, can be hidden +
// edited but not deleted) or "custom" (added by the therapist, can be
// fully removed).
//
// The default schema is intentionally close to what Demo.jsx renders
// today so therapists who don't customize anything get the same flow
// they get now.

export const SCHEMA_VERSION = 1;

// Twelve common contraindications a massage therapist needs to know
// about. Default-on when medical_checklist_enabled is true.
export const DEFAULT_MEDICAL_CONDITIONS = [
  { v: 'high_bp',         label: 'High blood pressure' },
  { v: 'blood_clots',     label: 'Blood clots / DVT history' },
  { v: 'recent_surgery',  label: 'Recent surgery (last 6 months)' },
  { v: 'diabetes',        label: 'Diabetes' },
  { v: 'heart',           label: 'Heart condition' },
  { v: 'cancer',          label: 'Cancer / chemotherapy' },
  { v: 'pregnancy',       label: 'Currently pregnant' },
  { v: 'osteoporosis',    label: 'Osteoporosis' },
  { v: 'skin',            label: 'Skin condition / open wounds' },
  { v: 'recent_injury',   label: 'Recent injury (sprain, fracture)' },
  { v: 'blood_thinners',  label: 'Currently on blood thinners' },
  { v: 'allergies',       label: 'Severe allergies' },
];

// Default intake schema — what every therapist starts with. Each field
// id is stable so we can match answers across schema versions.
export const DEFAULT_SCHEMA = {
  version: SCHEMA_VERSION,
  medical_checklist_enabled: true,
  hipaa_mode: false,
  // Per-condition customization. NULL/missing = use DEFAULT_MEDICAL_CONDITIONS.
  // When therapist edits any condition, the full list is persisted.
  // Each condition: { v, label, hidden, kind: 'default'|'custom' }
  medical_conditions: null,
  fields: [
    {
      id: 'pressure',
      type: 'chips',
      label: 'Pressure preference',
      help: 'How firm do you like the pressure?',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'light',  label: 'Light' },
        { v: 'medium', label: 'Medium' },
        { v: 'firm',   label: 'Firm' },
        { v: 'deep',   label: 'Deep tissue' },
      ],
    },
    {
      id: 'goal',
      type: 'chips',
      label: 'Session goal',
      help: 'What are you hoping for today?',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'relax',    label: 'Relax' },
        { v: 'pain',     label: 'Pain Relief' },
        { v: 'athletic', label: 'Athletic Recovery' },
        { v: 'stress',   label: 'Stress Relief' },
        { v: 'rehab',    label: 'Injury Rehab' },
      ],
    },
    {
      id: 'table_temp',
      type: 'chips',
      label: 'Table temperature',
      help: 'How warm would you like the table?',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'cool',    label: 'Cool' },
        { v: 'neutral', label: 'Neutral' },
        { v: 'warm',    label: 'Warm' },
        { v: 'hot',     label: 'Hot' },
      ],
    },
    {
      id: 'room_temp',
      type: 'chips',
      label: 'Room temperature',
      help: 'How would you like the room?',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'cool',    label: 'Cool' },
        { v: 'neutral', label: 'Neutral' },
        { v: 'warm',    label: 'Warm' },
      ],
    },
    {
      id: 'music',
      type: 'chips',
      label: 'Music',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'silence', label: 'Silence' },
        { v: 'soft',    label: 'Soft Music' },
        { v: 'nature',  label: 'Nature Sounds' },
        { v: 'upbeat',  label: 'Upbeat' },
      ],
    },
    {
      id: 'lighting',
      type: 'chips',
      label: 'Lighting',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'dark',   label: 'Very Dim' },
        { v: 'dim',    label: 'Soft' },
        { v: 'normal', label: 'Normal' },
      ],
    },
    {
      id: 'conversation',
      type: 'chips',
      label: 'Level of conversation',
      help: 'Quiet table or happy to chat?',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'quiet', label: 'Quiet Please' },
        { v: 'open',  label: 'Happy to Chat' },
      ],
    },
    {
      id: 'draping',
      type: 'chips',
      label: 'Draping',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'standard', label: 'Standard' },
        { v: 'extra',    label: 'Extra Coverage' },
      ],
    },
    {
      id: 'oils',
      type: 'chips',
      label: 'Oils & fragrance',
      kind: 'default', hidden: false, required: false,
      options: [
        { v: 'none',    label: 'No Issues' },
        { v: 'noscent', label: 'Fragrance-Free' },
        { v: 'allergy', label: 'Has Allergy' },
      ],
    },
    {
      id: 'medical_notes',
      type: 'textarea',
      label: 'Medical notes or injury history',
      help: 'Anything we should know about?',
      placeholder: 'Recent injuries, conditions, medications...',
      kind: 'default', hidden: false, required: false,
    },
  ],
};

// Get the effective schema for a therapist: their custom one if set,
// otherwise the default. Always returns a valid schema with all
// required fields present (defensive).
export function effectiveSchema(therapist) {
  const custom = therapist?.intake_schema;
  if (!custom || !custom.fields || !Array.isArray(custom.fields)) {
    return DEFAULT_SCHEMA;
  }
  return {
    version: custom.version || SCHEMA_VERSION,
    medical_checklist_enabled: custom.medical_checklist_enabled !== false,
    hipaa_mode: !!custom.hipaa_mode,
    medical_conditions: custom.medical_conditions || null,
    fields: custom.fields,
  };
}

// Get the effective medical conditions list (custom or default).
// Adds kind='default' to default ones for downstream rendering logic.
export function effectiveMedicalConditions(schema) {
  if (schema?.medical_conditions && Array.isArray(schema.medical_conditions)) {
    return schema.medical_conditions;
  }
  return DEFAULT_MEDICAL_CONDITIONS.map((c) => ({ ...c, hidden: false, kind: 'default' }));
}

// Generate a new custom medical condition skeleton.
export function makeCustomCondition() {
  const v = `cust_${Math.random().toString(36).slice(2, 7)}`;
  return { v, label: 'New condition', kind: 'custom', hidden: false };
}

// Generate a new custom field skeleton for the editor. Used when the
// therapist taps "+ Add question".
export function makeCustomField(type = 'chips') {
  const id = `custom_${Math.random().toString(36).slice(2, 9)}`;
  const base = {
    id,
    type,
    label: 'New question',
    kind: 'custom',
    hidden: false,
    required: false,
  };
  if (type === 'chips' || type === 'chips_multi') {
    base.options = [
      { v: 'opt1', label: 'Option 1' },
      { v: 'opt2', label: 'Option 2' },
    ];
  }
  if (type === 'text' || type === 'textarea') {
    base.placeholder = '';
  }
  if (type === 'checklist') {
    base.options = [
      { v: 'a', label: 'Item one' },
      { v: 'b', label: 'Item two' },
    ];
  }
  return base;
}

// Available field types for the "Add question" picker.
export const FIELD_TYPE_CHOICES = [
  { v: 'chips',       label: 'Pick one (chips)',    desc: 'Client picks one option from a row of pills' },
  { v: 'chips_multi', label: 'Pick many (chips)',   desc: 'Client picks multiple options' },
  { v: 'checklist',   label: 'Checklist',           desc: 'Multiple checkboxes — good for medical or yes/no lists' },
  { v: 'text',        label: 'Short text',          desc: 'A single line of free text' },
  { v: 'textarea',    label: 'Long text',           desc: 'Multiple lines of free text' },
  { v: 'checkbox',    label: 'Yes/no checkbox',     desc: 'Single yes/no question' },
  { v: 'header',      label: 'Section header',      desc: 'Visual divider, not a question' },
];
