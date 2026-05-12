// src/lib/giftCardThemes.js
//
// Six preset color themes for branded gift cards. Each theme is a
// curated palette that looks professional across all three render
// surfaces: dashboard preview (GiftCertificates.js), printable
// version (GiftCardPrint.js), and the email template inside the
// send-gift-certificate edge function.
//
// Therapists pick by key (stored in therapists.gift_card_theme).
// They cannot pick free-form colors. This is deliberate per HK's
// 70-year-old persona rule: curated > free-form. Eliminates the
// possibility of ugly cards. Adds a recognizable house style across
// the platform.
//
// To add a theme, add a new entry below and add it to ORDERED_KEYS.
// To rename a theme, only change the label; keep the key the same
// since therapist rows reference it.

export const GIFT_CARD_THEMES = {
  rose: {
    label: 'Rose',
    description: 'Warm pink, the original',
    bgGradient: 'linear-gradient(135deg, #FFF1F5 0%, #FFE4E6 40%, #FEF3F2 100%)',
    headerGradient: 'linear-gradient(135deg, #FCE8E0 0%, #F5D5C8 100%)',
    accentSolid: 'linear-gradient(180deg, #E85C79, #D14560)',
    accent: '#E85C79',
    accentDeep: '#D14560',
    eyebrow: '#A87468',
    ink: '#5C2E27',
    inkSoft: '#7A5C53',
    paperBg: '#FCF8EE',
  },
  sage: {
    label: 'Sage',
    description: 'Calm green, signature MyBodyMap',
    bgGradient: 'linear-gradient(135deg, #F0F4EE 0%, #DCE6D8 40%, #EFF3EC 100%)',
    headerGradient: 'linear-gradient(135deg, #E4EBDE 0%, #C7D5C0 100%)',
    accentSolid: 'linear-gradient(180deg, #4A6B54, #2D4A35)',
    accent: '#4A6B54',
    accentDeep: '#2D4A35',
    eyebrow: '#5A7064',
    ink: '#1C2B22',
    inkSoft: '#4A5C50',
    paperBg: '#F9F5EE',
  },
  forest: {
    label: 'Forest',
    description: 'Deep evergreen, grounded',
    bgGradient: 'linear-gradient(135deg, #EAF0EC 0%, #C5D4C8 40%, #ECF0EE 100%)',
    headerGradient: 'linear-gradient(135deg, #BFD2C0 0%, #94B098 100%)',
    accentSolid: 'linear-gradient(180deg, #1F4030, #14281E)',
    accent: '#1F4030',
    accentDeep: '#14281E',
    eyebrow: '#3D5443',
    ink: '#0F1F16',
    inkSoft: '#34453A',
    paperBg: '#F5F2EA',
  },
  ocean: {
    label: 'Ocean',
    description: 'Soft blue, restorative',
    bgGradient: 'linear-gradient(135deg, #EEF4F7 0%, #D2E1EA 40%, #F0F5F8 100%)',
    headerGradient: 'linear-gradient(135deg, #CDDDE7 0%, #97B5C7 100%)',
    accentSolid: 'linear-gradient(180deg, #2D5A78, #1A3E54)',
    accent: '#2D5A78',
    accentDeep: '#1A3E54',
    eyebrow: '#4F6F82',
    ink: '#13293A',
    inkSoft: '#3D5566',
    paperBg: '#F5F7F9',
  },
  lavender: {
    label: 'Lavender',
    description: 'Soft purple, contemplative',
    bgGradient: 'linear-gradient(135deg, #F3EEF6 0%, #DCCFE5 40%, #F5F0F7 100%)',
    headerGradient: 'linear-gradient(135deg, #D9CBE2 0%, #A892BB 100%)',
    accentSolid: 'linear-gradient(180deg, #6A4A7E, #4A2F5A)',
    accent: '#6A4A7E',
    accentDeep: '#4A2F5A',
    eyebrow: '#6E5784',
    ink: '#2D1C3E',
    inkSoft: '#523E63',
    paperBg: '#F8F5F9',
  },
  terracotta: {
    label: 'Terracotta',
    description: 'Earthy warmth, grounding',
    bgGradient: 'linear-gradient(135deg, #FBEFE6 0%, #F0D9C5 40%, #FCF1E8 100%)',
    headerGradient: 'linear-gradient(135deg, #E8C8AC 0%, #C9986F 100%)',
    accentSolid: 'linear-gradient(180deg, #9D5E36, #6D3F1F)',
    accent: '#9D5E36',
    accentDeep: '#6D3F1F',
    eyebrow: '#8E6647',
    ink: '#3E2814',
    inkSoft: '#624230',
    paperBg: '#FAF3EA',
  },
};

// Display order in the settings palette picker
export const ORDERED_THEME_KEYS = ['rose', 'sage', 'forest', 'ocean', 'lavender', 'terracotta'];

// Safe lookup: never returns undefined. Falls back to 'rose'.
export function getTheme(key) {
  return GIFT_CARD_THEMES[key] || GIFT_CARD_THEMES.rose;
}
