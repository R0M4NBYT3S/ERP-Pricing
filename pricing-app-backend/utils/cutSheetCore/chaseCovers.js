// cutsheetRules/chaseCover.js
// Build an "excelish" schema for Chase Covers from raw inputs.

const { fmt16, roundToSixteenth } = require('../format');

function v(n) {
  return fmt16(roundToSixteenth(n));
}

function buildChaseCoverSchema(input) {
  const {
    finishedLength: L,
    finishedWidth: W,
    skirt: S = 0,
    collar: C = 0,
    sheetWidth = 48,
    turnDownAllowance = 10,
    meta = { job: '', customer: '', date: new Date().toLocaleDateString() }
  } = input;

  // --- Calculations ---
  const totalL = (L || 0) + (S * 2) + turnDownAllowance;
  const totalW = (W || 0) + (S * 2) + turnDownAllowance;

  // Collar cuts (basic placeholder rules – adjust as needed)
  const collarCut1 = (W / 2) + C;
  const collarCut2 = 1;

  // Notes
  const notes = totalW > sheetWidth ? 'Rip the big side' : '';

  // --- Left column like your Excel ---
  const left = [
    { label: 'FINISHED LENGTH', value: v(L) },
    { label: 'FINISHED WIDTH',  value: v(W) },
    { label: 'SKIRT',           value: v(S) },
    { label: 'SHEET WIDTH',     value: String(sheetWidth) },
    { label: 'COLLAR',          value: v(C) },
    { note: notes }
  ];

  // --- Chase Cover section (cut dims) ---
  const chaseCover = {
    title: 'CHASE COVER',
    rows: [{ L: v(totalL), W: v(totalW), cnc: '' }]
  };

  // --- Collar section ---
  const collarSection = {
    title: 'COLLAR CUTS',
    header: ['', 'L'],
    rows: [
      { label: 'CUT 1', L: v(collarCut1) },
      { label: 'CUT 2', L: v(collarCut2) }
    ]
  };

  // --- Storm Collar (optional) ---
  const stormCollar = {
    title: 'STORM COLLAR',
    rows: [{ L: '0', W: '0', cnc: '' }]
  };

  return {
    title: 'CHASE COVER',
    meta,
    left,
    sections: [chaseCover, collarSection, stormCollar]
  };
}

module.exports = buildChaseCoverSchema;
