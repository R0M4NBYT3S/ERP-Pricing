// cutsheetCore/format.js
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

function roundToSixteenth(inches) {
  const n = Math.round(Number(inches) * 16);
  return n / 16;
}

function toMixedFraction(inches) {
  const x = Number(inches);
  if (!Number.isFinite(x)) return String(inches);
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const whole = Math.floor(abs);
  const frac16 = Math.round((abs - whole) * 16);
  if (frac16 === 0) return `${sign < 0 ? '-' : ''}${whole}"`;
  if (frac16 === 16) return `${sign < 0 ? '-' : ''}${whole + 1}"`;
  const g = gcd(frac16, 16);
  const num = frac16 / g, den = 16 / g;
  const prefix = sign < 0 ? '-' : '';
  return `${prefix}${whole ? whole + ' ' : ''}${num}/${den}"`;
}

/** Convert decimal inches to nearest 1/16" display string */
function fmt16(inches) {
  return toMixedFraction(roundToSixteenth(inches));
}

module.exports = { gcd, roundToSixteenth, toMixedFraction, fmt16 };
