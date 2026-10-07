/**
 * Place this file at: __tests__/content-filter.test.ts
 *
 * This keeps tests outside src/app, which is important for Expo Router because
 * files in the app directory are treated as routes.
 */

import { describe, expect, jest, test } from '@jest/globals';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

import { containsExplicitLanguage } from '../src/lib/content-filter';

const explicitCases: Array<[string, string]> = [
  ['basic profanity', 'This book was fucking amazing.'],
  ['uppercase', 'FUCK'],
  ['fucker', 'fucker'],
  ['fucked', 'fucked'],
  ['fuckers', 'fuckers'],
  ['motherfucker', 'motherfucker'],
  ['motherfucking', 'motherfucking'],
  ['shit', 'this is shit'],
  ['shitty', 'shitty ending'],
  ['shitting', 'shitting'],
  ['bitch', 'bitch'],
  ['bitches', 'bitches'],
  ['bitchy', 'bitchy'],
  ['bitching', 'bitching'],
  ['asshole', 'asshole'],
  ['assholes', 'assholes'],
  ['bullshit', 'bullshit'],
  ['bullshitting', 'bullshitting'],
  ['dumbass', 'dumbass'],
  ['dumbasses', 'dumbasses'],
  ['dick', 'dick'],
  ['dicks', 'dicks'],
  ['dickhead', 'dickhead'],
  ['cock', 'cock'],
  ['cocks', 'cocks'],
  ['pussy', 'pussy'],
  ['pussies', 'pussies'],
  ['cunt', 'cunt'],
  ['cunts', 'cunts'],
  ['bastard', 'bastard'],
  ['bastards', 'bastards'],
  ['whore', 'whore'],
  ['whores', 'whores'],
  ['slut', 'slut'],
  ['sluts', 'sluts'],
  ['slutty', 'slutty'],

  // Common evasion / censoring attempts.
  ['spaces between letters', 'f u c k'],
  ['asterisk substitution', 'f*ck'],
  ['at-sign substitution', 'f@ck'],
  ['period separators', 'F.U.C.K.'],
  ['em-dash separators', 'f—u—c—k'],
  ['numeric i substitution', 'sh1t'],
  ['symbol i substitution', 'sh!t'],
  ['spaced shit', 's h i t'],
  ['numeric bitch substitution', 'b1tch'],
  ['numeric t substitution', 'bi7ch'],
  ['period-separated bitch', 'b.i.t.c.h'],
  ['spaced asshole', 'a s s h o l e'],
  ['zero substitution', 'c0ck'],
  ['dollar-sign s substitution', '$ l u t'],
  ['numeric s substitution', '5lut'],
  ['numeric t in cunt', 'cun7'],
  ['numeric s in bastard', 'ba5tard'],
  ['zero in whore', 'wh0re'],
  ['accented vowel', 'fück'],
  ['accented i', 'shít'],
];

const cleanCases: Array<[string, string]> = [
  ['normal review', 'I loved this book'],
  ['ordinary phrase', 'classic literature'],
  ['author surname containing letters', 'Dickens is an author'],
  ['cocktail should not match cock', 'cocktail hour'],
  ['assassin should not match', 'assassin'],
  ['Scunthorpe should not match', 'Scunthorpe'],
  ['passionate should not match', 'passionate readers'],
  ['larger word containing asshole letters', 'classhole'],
  ['larger word after pussies', 'pussiesque'],
  ['pussycat regression test', 'pussycat'],
  ['shiitake regression test', 'shiitake mushrooms'],
  ['near-match slang', 'bitchin soundtrack'],

  // These are outside this filter's scope. They may be handled by separate
  // content/moderation systems, but this profanity matcher should not invent a
  // classification simply because the subject is mature.
  ['sexual-topic word only', 'sex'],
  ['sexual-topic phrase only', 'sexual content'],
  ['implied sexual content', 'They slept together in the hotel room.'],
  ['violent sentence without listed profanity', 'kill them all'],
  ['generic hate phrase without a listed slur', 'hate speech here'],
  ['cockerel should not match cock', 'The rooster is a cockerel.'],
];

describe('containsExplicitLanguage', () => {
  test.each(explicitCases)('%s is flagged', (_label, value) => {
    expect(containsExplicitLanguage(value)).toBe(true);
  });

  test.each(cleanCases)('%s is not flagged', (_label, value) => {
    expect(containsExplicitLanguage(value)).toBe(false);
  });

  test.each([
    ['blank string', ''],
    ['spaces only', '   '],
    ['null', null],
    ['undefined', undefined],
  ])('%s returns false', (_label, value) => {
    expect(
      containsExplicitLanguage(value as string | null | undefined)
    ).toBe(false);
  });
});

/**
 * IMPORTANT PRODUCT NOTE
 * ----------------------
 * This is a lexical profanity filter, not a semantic AI classifier.
 * Ambiguous words can still be flagged in innocent contexts. For example,
 * "Dick" as a person's name or "bastard" in "bastard sword" contains a word
 * that is on the profanity list. That is an expected limitation of a local
 * deterministic word filter and should be evaluated separately if Novori later
 * needs context-aware moderation.
 */
