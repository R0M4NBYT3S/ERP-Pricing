// chaseCoverMatrix.js
// Straight price tables for Chase Covers by tier.
// No multipliers at runtime. Dimensions generated only for gating.

function generateDimensions(startSkirt, endSkirt, baseLength, baseWidth, skirtStep = 0.25, sizeStep = 0.5) {
  const dimensions = [];
  const steps = Math.round((endSkirt - startSkirt) / skirtStep);
  for (let i = 0; i <= steps; i++) {
    const skirt = parseFloat((startSkirt + i * skirtStep).toFixed(2));
    const reduction = i * sizeStep;
    dimensions.push({
      skirt,
      maxLength: parseFloat((baseLength - reduction).toFixed(2)),
      maxWidth: parseFloat((baseWidth - reduction).toFixed(2)),
    });
  }
  return dimensions;
}

const sizeConfigs = {
  small:        { baseLength: 58,  baseWidth: 46 },
  medium:       { baseLength: 118, baseWidth: 46 },
  large_no_seam:{ baseLength: 118, baseWidth: 58 },
  large_seam:   { baseLength: 118, baseWidth: 68 },
  extra_large:  { baseLength: 118, baseWidth: 92 },
};

// ===== ELITE PRICING (as provided) =====
const ELITE = {
  black_galvanized: { small: 156.91, medium: 195.41, large_no_seam: 235.51, large_seam: 275.62, extra_large: 355.83 },
  kynar:            { small: 184.29, medium: 250.19,                                  large_seam: 357.78, extra_large: 465.38 },
  ss26mil:          { small: 287.74, medium: 372.79,                                  large_seam: 487.38, extra_large: 720.11 },
  ss24mil:          { small: 313.31, medium: 423.94, large_no_seam: 521.95, large_seam: 623.18,  extra_large: 822.41 },
  ss24pol:          { small: 320.88, medium: 439.06, large_no_seam: 695.14, large_seam: 645.86,  extra_large: 852.66 },
  copmill26:        { small: 430.95, medium: 664.71,                                  large_seam: 704.29, extra_large: 1223.45 },
  copssmill24:      { small: 456.52, medium: 675.61, large_no_seam: 955.79, large_seam: 1057.01, extra_large: 1325.75 },
};

// ===== VALUE =====
const VALUE = {
  black_galvanized: { small: 195.21, medium: 243.11, large_no_seam: 293.00, large_seam: 342.90, extra_large: 442.68 },
  kynar:            { small: 229.28, medium: 311.26,                                  large_seam: 445.12, extra_large: 578.97 },
  ss26mil:          { small: 357.97, medium: 463.78,                                  large_seam: 606.34, extra_large: 895.89 },
  ss24mil:          { small: 389.79, medium: 527.42, large_no_seam: 649.36, large_seam: 775.29,  extra_large: 1023.16 },
  ss24pol:          { small: 399.20, medium: 546.24, large_no_seam: 864.82, large_seam: 803.52,  extra_large: 1060.80 },
  copmill26:        { small: 536.14, medium: 826.96,                                  large_seam: 876.21, extra_large: 1522.09 },
  copssmill24:      { small: 567.96, medium: 840.52, large_no_seam: 1189.10, large_seam: 1315.03, extra_large: 1649.37 },
};

// ===== GOLD =====
const GOLD = {
  black_galvanized: { small: 175.69, medium: 218.80, large_no_seam: 263.70, large_seam: 308.61, extra_large: 398.41 },
  kynar:            { small: 206.35, medium: 280.13,                                  large_seam: 400.60, extra_large: 521.08 },
  ss26mil:          { small: 322.18, medium: 417.41,                                  large_seam: 545.71, extra_large: 806.30 },
  ss24mil:          { small: 350.81, medium: 474.68, large_no_seam: 584.42, large_seam: 697.76,  extra_large: 920.85 },
  ss24pol:          { small: 359.28, medium: 491.61, large_no_seam: 778.34, large_seam: 723.17,  extra_large: 954.72 },
  copmill26:        { small: 482.53, medium: 744.26,                                  large_seam: 788.59, extra_large: 1369.88 },
  copssmill24:      { small: 511.16, medium: 756.47, large_no_seam: 1070.19, large_seam: 1183.53, extra_large: 1484.43 },
};

// ===== SILVER =====
const SILVER = {
  black_galvanized: { small: 185.45, medium: 230.96, large_no_seam: 278.35, large_seam: 325.75, extra_large: 420.55 },
  kynar:            { small: 217.82, medium: 295.70,                                  large_seam: 422.86, extra_large: 550.02 },
  ss26mil:          { small: 340.08, medium: 440.60,                                  large_seam: 576.03, extra_large: 851.10 },
  ss24mil:          { small: 370.30, medium: 501.05, large_no_seam: 616.89, large_seam: 736.53,  extra_large: 972.01 },
  ss24pol:          { small: 379.24, medium: 518.93, large_no_seam: 821.58, large_seam: 763.34,  extra_large: 1007.76 },
  copmill26:        { small: 509.33, medium: 785.61,                                  large_seam: 832.40, extra_large: 1445.99 },
  copssmill24:      { small: 539.56, medium: 798.50, large_no_seam: 1129.64, large_seam: 1249.28, extra_large: 1566.90 },
};

// ===== BUILDER =====
const BUILDER = {
  black_galvanized: { small: 208.67, medium: 259.88, large_no_seam: 313.21, large_seam: 366.55, extra_large: 473.21 },
  kynar:            { small: 245.09, medium: 332.72,                                  large_seam: 475.81, extra_large: 618.90 },
  ss26mil:          { small: 382.66, medium: 495.77,                                  large_seam: 648.16, extra_large: 957.68 },
  ss24mil:          { small: 416.67, medium: 563.79, large_no_seam: 694.14, large_seam: 828.76,  extra_large: 1093.73 },
  ss24pol:          { small: 426.73, medium: 583.91, large_no_seam: 924.46, large_seam: 858.93,  extra_large: 1133.96 },
  copmill26:        { small: 573.12, medium: 883.99,                                  large_seam: 936.64, extra_large: 1627.07 },
  copssmill24:      { small: 607.13, medium: 898.49, large_no_seam: 1271.10, large_seam: 1405.72, extra_large: 1763.11 },
};

// ===== HOMEOWNER =====
const HOMEOWNER = {
  black_galvanized: { small: 224.38, medium: 279.44, large_no_seam: 336.78, large_seam: 394.13, extra_large: 508.83 },
  kynar:            { small: 263.54, medium: 357.77,                                  large_seam: 511.63, extra_large: 665.49 },
  ss26mil:          { small: 411.46, medium: 533.09,                                  large_seam: 696.95, extra_large: 1029.76 },
  ss24mil:          { small: 448.04, medium: 606.23, large_no_seam: 746.39, large_seam: 891.14,  extra_large: 1176.05 },
  ss24pol:          { small: 458.85, medium: 627.86, large_no_seam: 994.05, large_seam: 923.58,  extra_large: 1219.31 },
  copmill26:        { small: 616.25, medium: 950.53,                                  large_seam: 1007.14, extra_large: 1749.53 },
  copssmill24:      { small: 652.83, medium: 966.12, large_no_seam: 1366.78, large_seam: 1511.53, extra_large: 1895.82 },
};

// Attach dimensions to each price table
function attachDimensions(priceTable) {
  const out = {};
  for (const [metal, sizes] of Object.entries(priceTable)) {
    out[metal] = {};
    for (const [size, price] of Object.entries(sizes)) {
      const cfg = sizeConfigs[size];
      if (!cfg) continue;
      out[metal][size] = {
        basePrice: price,
        dimensions: generateDimensions(0, 15, cfg.baseLength, cfg.baseWidth),
      };
    }
  }
  return out;
}

const chaseCoverMatrix = {
  elite:     attachDimensions(ELITE),
  value:     attachDimensions(VALUE),
  gold:      attachDimensions(GOLD),
  silver:    attachDimensions(SILVER),
  builder:   attachDimensions(BUILDER),
  homeowner: attachDimensions(HOMEOWNER),
};

module.exports = chaseCoverMatrix;
