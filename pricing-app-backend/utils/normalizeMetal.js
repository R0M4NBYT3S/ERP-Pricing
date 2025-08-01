const metalMap = {
  'ss24pol': 'ss24pol',
  'ss24mil': 'ss24mil',
  'ss26mil': 'ss26mil',
  'stainless': 'ss24pol',
  'black_galvanized': 'black_galvanized',
  'galvanized_black': 'black_galvanized',
  'kynar': 'kynar',
  'copper': 'copper',
  'copssmill24': 'copper',
  'copmill26': 'copper'
};

function normalizeMetalType(metal) {
  if (!metal) return null;
  const key = metal.toLowerCase();
  return metalMap[key] || key;
}

module.exports = { normalizeMetalType };
