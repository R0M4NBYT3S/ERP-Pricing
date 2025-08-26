// cutsheetRules/dynasty.js
// Build an "excelish" schema for Dynasty from raw inputs.
// TUNE the CFG values to match your true rules. No code rewrite needed.

const { fmt16, roundToSixteenth } = require('../format');

const CFG = {
  title: 'HHT DYNASTY',
  // CHASE COVER dims: L + add, W + add (sample showed +13 on both)
  chaseCoverAdd: 13, // inches total (both sides combined)
  // SHROUD panels — defaults chosen to match the screenshot example
  long:   { qty: 2, L_from: (L)=>L + 2.375,      W_fixed: 19.75, cnc: true },
  short:  { qty: 2, L_from: (W)=>W + 1.0,        W_fixed: 19.75, cnc: true },
  legs:   { qty: 4, L_fixed: 15.5,               W_fixed: 6.0,    cnc: false },
  brace:  { qty: 1, L_fixed: 26.5,               W_fixed: 11.0,   cnc: true },
};

function v(v) { return fmt16(roundToSixteenth(v)); }

function buildDynastySchema(input) {
  const {
    L, W, H = 17, S, sheetWidth = 60,
    copper = false,
    meta = { job: '', customer: '', date: new Date().toLocaleDateString() },
    notes = `HHT DYNASTY HEIGHT IS ${fmt16(H)}`
  } = input;

  // ---- Left column ----
  const left = [
    { label: 'LENGTH',      value: v(L) },
    { label: 'WIDTH',       value: v(W) },
    { label: 'HEIGHT',      value: Number.isFinite(H) ? String(H) : '' },
    { note:  notes },
    { label: 'SKIRT',       value: v(S) },
    { label: 'SHEET WIDTH', value: String(sheetWidth) },
    { label: 'COLLAR',      value: '0' },
    { label: 'COLLAR',      value: '0' },
    { label: 'COPPER?',     value: copper ? 'TRUE' : 'FALSE' },
    // square feet is optional; compute if L/W given
    ...(Number.isFinite(L) && Number.isFinite(W) ? [{ label: 'SQ FEET', value: ((L*W)/144).toFixed(3) }] : [])
  ];

  // ---- Chase cover ----
  const add = CFG.chaseCoverAdd;
  const chaseCover = {
    title: 'CHASE COVER',
    rows: [{ L: v(L + add), W: v(W + add), cnc: 'CNC' }]
  };

  // ---- Shroud rows (config-driven) ----
  const long = {
    label: 'LONG PANEL:',
    qty: String(CFG.long.qty),
    L: v(CFG.long.L_from(L)),
    W: v(CFG.long.W_fixed),
    cnc: CFG.long.cnc ? 'CNC' : ''
  };
  const short = {
    label: 'SHORT PANEL:',
    qty: String(CFG.short.qty),
    L: v(CFG.short.L_from(W)),
    W: v(CFG.short.W_fixed),
    cnc: CFG.short.cnc ? 'CNC' : ''
  };
  const legs = {
    label: 'LEGS:',
    qty: String(CFG.legs.qty),
    L: v(CFG.legs.L_fixed),
    W: v(CFG.legs.W_fixed),
    cnc: CFG.legs.cnc ? 'CNC' : ''
  };
  const brace = {
    label: 'BRACE:',
    qty: String(CFG.brace.qty),
    L: v(CFG.brace.L_fixed),
    W: v(CFG.brace.W_fixed),
    cnc: CFG.brace.cnc ? 'CNC' : ''
  };

  const shroud = {
    title: 'SHROUD',
    header: ['', 'QTY', 'L', 'x', 'W', 'CNC'],
    rows: [long, short, legs, brace]
  };

  return {
    title: CFG.title,
    meta,
    left,
    sections: [chaseCover, shroud]
  };
}

module.exports = buildDynastySchema;
