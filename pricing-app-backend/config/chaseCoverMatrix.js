// chaseCoverMatrix.js

// Generate dynamic dimensions
function generateDimensions(startSkirt, endSkirt, baseLength, baseWidth, skirtStep = 0.25, sizeStep = 0.5) {
  const dimensions = [];
  const steps = Math.round((endSkirt - startSkirt) / skirtStep);

  for (let i = 0; i <= steps; i++) {
    const skirt = parseFloat((startSkirt + i * skirtStep).toFixed(2));
    const reduction = i * sizeStep;
    dimensions.push({
      skirt,
      maxLength: parseFloat((baseLength - reduction).toFixed(2)),
      maxWidth: parseFloat((baseWidth - reduction).toFixed(2))
    });
  }

  return dimensions;
}

// Base setup for sizes with new starting dimensions
const sizeConfigs = {
  small:        { baseLength: 58, baseWidth: 46 },
  medium:       { baseLength: 118, baseWidth: 46 },
  large_no_seam:{ baseLength: 118, baseWidth: 58 },
  large_seam:   { baseLength: 118, baseWidth: 68 },
  extra_large:  { baseLength: 118, baseWidth: 92 }
};

// Price data by metal
const basePrices = {
  black_galvanized: {
    small: 156.91, medium: 195.41, large_no_seam: 235.51, large_seam: 275.62, extra_large: 355.83
  },
  kynar: {
    small: 184.29, medium: 250.19, large_seam: 357.78, extra_large: 465.38 // ❌ no large_no_seam
  },
  ss26mil: {
    small: 287.74, medium: 372.79, large_seam: 487.38, extra_large: 720.11 // ❌ no large_no_seam
  },
  ss24mil: {
    small: 313.31, medium: 423.94, large_no_seam: 521.95, large_seam: 623.18, extra_large: 822.41
  },
  ss24pol: {
    small: 320.88, medium: 439.06, large_no_seam: 695.14, large_seam: 645.86, extra_large: 852.66
  },
  copmill26: {
    small: 430.95, medium: 664.71, large_seam: 704.29, extra_large: 1223.45 // ❌ no large_no_seam
  },
  copssmill24: {
    small: 456.52, medium: 675.61, large_no_seam: 955.79, large_seam: 1057.01, extra_large: 1325.75
  }
};

// Build matrix dynamically
const chaseCoverMatrix = {};

for (const [metal, prices] of Object.entries(basePrices)) {
  chaseCoverMatrix[metal] = {};

  for (const [size, basePrice] of Object.entries(prices)) {
    const config = sizeConfigs[size];
    if (!config) continue; // Skip sizes that aren't in config (like large_no_seam for kynar/ss26mil)

    chaseCoverMatrix[metal][size] = {
      basePrice,
      dimensions: generateDimensions(0, 15, config.baseLength, config.baseWidth)
    };
  }
}

module.exports = chaseCoverMatrix;
