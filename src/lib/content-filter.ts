import { supabase } from './supabase';

/**
 * Novori explicit-language filter.
 *
 * Scope: profanity only. This is intentionally NOT a semantic classifier for
 * sexual content, violence, hate speech, or other moderation categories.
 * Those should be handled by separate moderation/reporting systems.
 *
 * The first group catches normal spelling and common inflections. The second
 * group catches common attempts to evade a simple word list with spaces,
 * punctuation, or light leetspeak (for example: f*ck, f u c k, sh1t).
 */

const GAP = `[\\s._*\\-–—~]*`;
const START = `(?:^|[^a-z0-9_])`;
const END = `(?=$|[^a-z0-9_])`;

const S = `[s$5]`;
const I = `[i1!]`;
const O = `[o0]`;
const T = `[t7+]`;
const U = `[u@*]`;

const EXPLICIT_PATTERNS: RegExp[] = [
  // Normal spelling / common inflections.
  /\bf+u+c+k+(?:er|ers|ing|ed|s)?\b/i,
  /\bmotherf+u+c+k+(?:er|ers|ing|ed|s)?\b/i,
  /\bsh+i+t+(?:ty|ting|ted|s)?\b/i,
  /\bb+i+t+c+h+(?:es|y|ing)?\b/i,
  /\basshole(?:s)?\b/i,
  /\bbullsh+i+t+(?:ting|ted|s)?\b/i,
  /\bdumbass(?:es)?\b/i,
  /\bdick(?:s|head|heads)?\b/i,
  /\bcock(?:s)?\b/i,
  /\b(?:pussy|pussies)\b/i,
  /\bcunt(?:s)?\b/i,
  /\bbastard(?:s)?\b/i,
  /\bwhore(?:s)?\b/i,
  /\bslut(?:s|ty)?\b/i,

  // Common obfuscation / censoring.
  new RegExp(
    `${START}f+${GAP}${U}+${GAP}c+${GAP}k+${END}`,
    'i'
  ),
  new RegExp(
    `${START}${S}+${GAP}h+${GAP}${I}+${GAP}${T}+${END}`,
    'i'
  ),
  new RegExp(
    `${START}b+${GAP}${I}+${GAP}${T}+${GAP}c+${GAP}h+${END}`,
    'i'
  ),
  new RegExp(
    `${START}a+${GAP}${S}+${GAP}${S}+${GAP}h+${GAP}${O}+${GAP}l+${GAP}e+${END}`,
    'i'
  ),
  new RegExp(
    `${START}b+${GAP}u+${GAP}l+${GAP}l+${GAP}${S}+${GAP}h+${GAP}${I}+${GAP}${T}+${END}`,
    'i'
  ),
  new RegExp(
    `${START}d+${GAP}u+${GAP}m+${GAP}b+${GAP}a+${GAP}${S}+${GAP}${S}+${END}`,
    'i'
  ),
  new RegExp(
    `${START}d+${GAP}${I}+${GAP}c+${GAP}k+${END}`,
    'i'
  ),
  new RegExp(
    `${START}c+${GAP}${O}+${GAP}c+${GAP}k+${END}`,
    'i'
  ),
  new RegExp(
    `${START}p+${GAP}u+${GAP}${S}+${GAP}${S}+${GAP}y+${END}`,
    'i'
  ),
  new RegExp(
    `${START}c+${GAP}u+${GAP}n+${GAP}${T}+${END}`,
    'i'
  ),
  new RegExp(
    `${START}b+${GAP}a+${GAP}${S}+${GAP}${T}+${GAP}a+${GAP}r+${GAP}d+${END}`,
    'i'
  ),
  new RegExp(
    `${START}w+${GAP}h+${GAP}${O}+${GAP}r+${GAP}e+${END}`,
    'i'
  ),
  new RegExp(
    `${START}${S}+${GAP}l+${GAP}u+${GAP}${T}+${END}`,
    'i'
  ),
];

function normalizeExplicitText(value: string) {
  // NFKD + combining-mark removal lets obvious accented substitutions such as
  // "fück" and "shít" behave like their plain-letter equivalents.
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function containsExplicitLanguage(
  text: string | null | undefined
) {
  const value = text?.trim();

  if (!value) {
    return false;
  }

  const normalized = normalizeExplicitText(value);

  return EXPLICIT_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
}

export type ExplicitContentTargetType =
  | 'post'
  | 'comment';

// "Show once" is remembered for this app session for the specific
// post/comment only. It does not enable explicit language globally.
const revealedExplicitContent =
  new Set<string>();

function explicitContentKey(
  targetType: ExplicitContentTargetType,
  targetId: string
) {
  return `${targetType}:${targetId}`;
}

export function isExplicitContentRevealed(
  targetType: ExplicitContentTargetType,
  targetId: string
) {
  if (!targetId) {
    return false;
  }

  return revealedExplicitContent.has(
    explicitContentKey(
      targetType,
      targetId
    )
  );
}

export function revealExplicitContentOnce(
  targetType: ExplicitContentTargetType,
  targetId: string
) {
  if (!targetId) {
    return;
  }

  revealedExplicitContent.add(
    explicitContentKey(
      targetType,
      targetId
    )
  );
}

export async function getExplicitLanguagePreference() {
  const { data, error } = await supabase.rpc(
    'get_explicit_language_preference'
  );

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function setExplicitLanguagePreference(
  allowExplicitLanguage: boolean
) {
  const { data, error } = await supabase.rpc(
    'set_explicit_language_preference',
    {
      p_allow: allowExplicitLanguage,
    }
  );

  if (error) {
    throw error;
  }

  return Boolean(data);
}
