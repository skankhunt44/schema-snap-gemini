import levenshtein from 'fast-levenshtein';

export const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[_\s-]/g, '')
    .replace(/id$/, '')
    .replace(/ids$/, '')
    .trim();

export const nameSimilarity = (a: string, b: string) => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  const dist = levenshtein.get(na, nb);
  const maxLen = Math.max(na.length, nb.length) || 1;
  return 1 - dist / maxLen;
};
