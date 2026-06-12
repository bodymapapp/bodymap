// Single source of truth for client-detail field labels and which fields
// show in the compact session-cockpit view. Principle 37: one definition
// so the profile client card and the schedule cannot drift on labels.
//
// The full editable client card (AboutCard) renders the whole set. The
// session details cockpit renders only CLIENT_COCKPIT_FIELDS, read-only,
// so it stays light and keeps its own scroll. Both pull labels from here,
// so renaming a field in one place changes it everywhere.

export const CLIENT_FIELDS = {
  name:              { label: 'Name' },
  email:             { label: 'Email' },
  phone:             { label: 'Phone' },
  alt_phone:         { label: 'Other phone' },
  birthday:          { label: 'Birthday' },
  gender:            { label: 'Gender' },
  referral_source:   { label: 'Found you via' },
  customer_since:    { label: 'Client since' },
  address:           { label: 'Address' },
  country:           { label: 'Country' },
  allergies:         { label: 'Allergies' },
  health_conditions: { label: 'Health conditions' },
  medications:       { label: 'Medications' },
  areas_to_avoid:    { label: 'Areas to avoid' },
  emergency_contact: { label: 'Emergency contact' },
  notes:             { label: 'Notes' },
};

// Compact at-a-glance set for the session details cockpit. Order matters.
// Deliberately the contact and identity fields only; address, health, and
// notes live on the full client card, reached via "View profile".
export const CLIENT_COCKPIT_FIELDS = [
  'email',
  'phone',
  'alt_phone',
  'birthday',
  'gender',
  'referral_source',
  'customer_since',
];
