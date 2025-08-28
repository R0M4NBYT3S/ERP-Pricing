// config/multi_discrepancies.js
// Exact deltas from your spreadsheet.
// Mapping: Gold -> vg, Silver -> vs, Value -> val
// Apply by recomputing with (baseFactor + deltaFactor).

// --- G90 / Black Galvanized ---
const G90 = {
  flat_top_corbel:                               { vg: -0.0004, vs: 0.0094,  val: 0.0292 },
  flat_top_outside_mount:                        { vg: -0.0004, vs: 0.0044,  val: 0.0192 },
  flat_top_top_mount:                            { vg: -0.0036, vs: 0.0146,  val: 0.0228 },
  hip_and_ridge_corbel:                          { vg: -0.0012, vs: 0.0182,  val: 0.0376 },
  hip_and_ridge_outside_mount:                   { vg: -0.0052, vs: 0.0022,  val: 0.0196 },
  hip_and_ridge_outside_mount_standing_seam:     { vg:  2.1704, vs: 0.0006,  val: 0.0208 },
  hip_and_ridge_top_mount:                       { vg: -0.0068, vs: 0.0098,  val: 0.0264 },
  hip_outside_mount:                             { vg:  0.0000, vs: 0.0200,  val: 0.0400 },
  hip_top_mount:                                 { vg:  0.0040, vs: 0.0110,  val: 0.0280 },
};

// --- Stainless (aliases included below) ---
const STAINLESS = {
  flat_top_corbel:                               { vg: -0.0044, vs: 0.0134,  val: 0.0212 },
  flat_top_outside_mount:                        { vg: -0.0080, vs: 0.0130,  val: 0.0240 },
  flat_top_top_mount:                            { vg: -0.0004, vs: 0.0144,  val: 0.0292 },
  hip_and_ridge_corbel:                          { vg: -0.0028, vs: 0.0208,  val: 0.0444 },
  hip_and_ridge_outside_mount:                   { vg: -0.0032, vs: 0.0152,  val: 0.0236 },
  hip_and_ridge_outside_mount_standing_seam:     { vg: -0.0028, vs: 0.0108,  val: 0.0344 },
  hip_and_ridge_top_mount:                       { vg:  0.0012, vs: 0.0218,  val: 0.0324 },
  hip_outside_mount:                             { vg:  0.0008, vs: 0.0262,  val: 0.0416 },
  hip_top_mount:                                 { vg:  0.0008, vs: 0.0162,  val: 0.0416 },
};

// --- Kynar ---
const KYNAR = {
  flat_top_corbel:                               { vg:  0.0060, vs: 0.0140,  val: 0.0320 },
  flat_top_outside_mount:                        { vg:  0.0048, vs: 0.0122,  val: 0.0196 },
  flat_top_top_mount:                            { vg: -0.0036, vs: 0.0096,  val: 0.0128 },
  hip_and_ridge_corbel:                          { vg: -0.0116, vs: 0.0126,  val: 0.0268 },
  hip_and_ridge_outside_mount:                   { vg: -0.0060, vs: 0.0060,  val: 0.0180 },
  hip_and_ridge_outside_mount_standing_seam:     { vg: -0.0052, vs: 0.0072,  val: 0.0296 },
  hip_and_ridge_top_mount:                       { vg: -0.0016, vs: 0.0026,  val: 0.0168 },
  hip_outside_mount:                             { vg: -0.0032, vs: 0.0152,  val: 0.0236 },
  hip_top_mount:                                 { vg: -0.0004, vs: 0.0144,  val: 0.0292 },
};

module.exports = {
  enabled: true,
  data: {
    g90: G90,
    black_galvanized: G90,           // alias
    kynar: KYNAR,
    'stainless steel': STAINLESS,
    ss24pol: STAINLESS,
    ss24mil: STAINLESS,
    ss26mil: STAINLESS,
    stainless: STAINLESS,
  },
};
