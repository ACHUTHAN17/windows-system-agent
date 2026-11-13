// Lightweight, offline script recognition for training provenance and UI
// routing. It labels scripts; it does not pretend to be universal language
// understanding or translate user content.
const SCRIPTS = [
  [/\p{Script=Tamil}/u, { code: 'ta', name: 'Tamil' }],
  [/\p{Script=Devanagari}/u, { code: 'hi', name: 'Devanagari / Hindi-family' }],
  [/\p{Script=Arabic}/u, { code: 'ar', name: 'Arabic-script' }],
  [/\p{Script=Han}/u, { code: 'zh', name: 'Han-script / Chinese-family' }],
  [/\p{Script=Hiragana}|\p{Script=Katakana}/u, { code: 'ja', name: 'Japanese' }],
  [/\p{Script=Cyrillic}/u, { code: 'ru', name: 'Cyrillic-script' }],
  [/\p{Script=Hangul}/u, { code: 'ko', name: 'Korean' }],
];

export function languageProfile(value) {
  const text = String(value || '');
  for (const [pattern, profile] of SCRIPTS) if (pattern.test(text)) return profile;
  if (/\p{Script=Latin}/u.test(text)) return { code: 'latin', name: 'Latin-script / language undetermined' };
  return { code: 'und', name: 'Undetermined script' };
}
