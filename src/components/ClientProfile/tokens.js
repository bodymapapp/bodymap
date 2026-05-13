// src/components/ClientProfile/tokens.js
//
// Single source of truth for the colors, type, and spacing tokens
// used across the redesigned therapist client view. Pulled out so
// the section components (Header, StatusStrip, PatternsCard,
// PreferencesCard, MedicalCard, Timeline) can share without
// duplicating constants. Matches the rest of the app's palette
// (forest/sage/cream/gold) so the new page feels native, not bolted on.

export const C = {
  // Backgrounds
  cream: '#F9F5EE',
  paper: '#FFFFFF',
  paperRaised: '#FAF7EE',
  lineFaint: '#E8E0D0',
  lineSoft: '#EFE7D2',

  // Text
  forest: '#1C2B22',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  muted: '#8A9C90',

  // Brand
  sage: '#4A6B54',
  sageBright: '#6B9E80',
  sageBg: '#F0F7F2',

  // Accents
  gold: '#92660E',
  goldBright: '#C9A84C',
  goldBg: '#FAF3DC',
  goldBorder: '#E5D085',
  goldGradient: 'linear-gradient(135deg, #FAF3DC 0%, #F5E9C3 100%)',

  // Status
  rose: '#C2526E',
  roseBg: '#FCE5E0',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  red: '#DC2626',
  redBg: '#FEE2E2',
  green: '#16A34A',
  greenBg: '#F0FDF4',
};

export const F = {
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

// Spacing scale: keep components rhythmic. All multiples of 4.
export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

// Format helpers — used in multiple sections so factored here.
export function formatShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMonthYear(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatCurrency(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '$0';
  if (n >= 10000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function initials(name) {
  if (!name) return '·';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// Hash a name into a stable warm color from a fixed palette.
// Same algo as ClientList so a client's avatar color is consistent
// between the list view and the profile view.
const AVATAR_COLORS = ['#8B5E3C', '#A0826D', '#946B49', '#7A5C3E', '#9B7B5A', '#85684A'];
export function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
