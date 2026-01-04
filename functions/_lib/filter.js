const BANNED_EXACT = [
  '시발',
  '씨발',
  '병신',
  '개새끼',
  '새끼',
  '좆',
  '지랄',
  '꺼져',
  '섹스',
  '야동',
  '포르노',
  '성인',
  '노출',
  '19금',
  'av',
  '도박',
  '카지노',
  '바카라',
  '토토',
  '베팅',
  '슬롯',
];

const BANNED_COMPACT = [
  'ㅅㅂ',
  'ㅆㅂ',
  'ㅂㅅ',
  'ㅈㄹ',
  'ㅈㄴ',
  'ㅅㅅ',
  '시발',
  '씨발',
  '병신',
  '좆',
  '지랄',
  '섹스',
  '야동',
  '포르노',
  '도박',
  '카지노',
  '바카라',
  '토토',
  '베팅',
  '슬롯',
];

const keepCharsRegex = /[^0-9a-zA-Z\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]+/g;

const normalizeCompact = (text) =>
  text
    .toLowerCase()
    .replace(keepCharsRegex, '')
    .replace(/(.)\1{2,}/g, '$1');

const tokenize = (text) =>
  text
    .toLowerCase()
    .split(keepCharsRegex)
    .map((token) => token.trim())
    .filter(Boolean);

export const containsForbiddenContent = (text) => {
  if (!text) return false;
  const tokens = tokenize(text);
  if (tokens.some((token) => BANNED_EXACT.includes(token))) return true;

  const compact = normalizeCompact(text);
  return BANNED_COMPACT.some((word) => compact.includes(word));
};
