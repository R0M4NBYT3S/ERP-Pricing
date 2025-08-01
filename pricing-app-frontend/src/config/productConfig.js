// 🔹 Base fields for all products
const baseFields = [
  { name: 'length', type: 'number', required: true },
  { name: 'width', type: 'number', required: true },
  { name: 'skirt', type: 'number' },
  { name: 'holeCount', type: 'number' },
  { name: 'screenHeight', type: 'number' },
  { name: 'lidOverhang', type: 'number' },
  { name: 'pitch', type: 'number' },
  { name: 'inset', type: 'number' },
  { name: 'baseOverhang', type: 'number' },
  { name: 'nailingFlange', type: 'number' }
];

// 🔹 Product list
const products = {
  // --- Chase Cover ---
  chase_cover: {
    label: 'Chase Cover',
    fields: ['length', 'width', 'skirt', 'holeCount']
  },
  chase_corbel: {
    label: 'Corbel Chase Cover',
    fields: ['length', 'width', 'skirt', 'nailingFlange', 'baseOverhang']
  },

  // --- Multi-Flue Products (Flat Top, Hip, Hip & Ridge) ---
  ftomt: {
    label: 'Flat Top Outside Mount',
    fields: ['length', 'width', 'skirt', 'screenHeight', 'inset', 'lidOverhang']
  },
  fttm: {
    label: 'Flat Top, Top Mount',
    fields: ['length', 'width', 'screenHeight', 'lidOverhang']
  },
  ftcor: {
    label: 'Flat Top Corbel',
    fields: ['length', 'width', 'skirt', 'nailingFlange', 'baseOverhang', 'screenHeight', 'inset', 'lidOverhang', 'pitch']
  },
  hrtomt: {
    label: 'Hip & Ridge Top Mount',
    fields: ['length', 'width', 'screenHeight', 'lidOverhang', 'pitch']
  },
  hromt: {
    label: 'Hip & Ridge Outside Mount',
    fields: ['length', 'width', 'skirt', 'screenHeight', 'inset', 'lidOverhang', 'pitch']
  },
  hrcor: {
    label: 'Hip & Ridge Corbel',
    fields: ['length', 'width', 'skirt', 'nailingFlange', 'baseOverhang', 'screenHeight', 'inset', 'lidOverhang', 'pitch']
  },

  htsmt: {
    label: 'Hip Top Mount',
    fields: ['length', 'width', 'screenHeight', 'lidOverhang', 'pitch']
  },
  homt: {
    label: 'Hip Outside Mount',
    fields: ['length', 'width', 'skirt', 'screenHeight', 'lidOverhang', 'pitch']
  },
  hromss: {
    label: 'Hip & Ridge Outside Mount (Standing Seam)',
    fields: ['length', 'width', 'skirt', 'screenHeight', 'lidOverhang', 'pitch']
  },
  hipcor: {
    label: 'Hip Corbel',
    fields: ['length', 'width', 'screenHeight', 'lidOverhang', 'nailingFlange', 'baseOverhang', 'skirt', 'inset', 'pitch']
  },

  // --- Shrouds (generated below) ---
};

// 🔹 Shroud models (standard and corbel variants)
const shrouds = [
  'dynasty', 'majesty', 'monaco', 'royale', 'durham',
  'monarch', 'regal', 'princess', 'prince', 'temptress',
  'imperial', 'centurion', 'mountaineer'
];

// 🔹 Dynamically add standard and corbel variants for shrouds
shrouds.forEach((name) => {
  // Standard shroud (NO holeCount)
  products[name] = {
    label: name.charAt(0).toUpperCase() + name.slice(1),
    fields: ['length', 'width', 'skirt']
  };

  // Corbel shroud (NO holeCount)
  products[`${name}_corbel`] = {
    label: `${name.charAt(0).toUpperCase() + name.slice(1)} Corbel Base`,
    fields: ['length', 'width', 'skirt', 'baseOverhang', 'nailingFlange']
  };
});

// 🔹 Backend aliases for normalization
export const productAliases = {
  ftomt: 'flat_top_outside_mount',
  fttm: 'flat_top_top_mount',
  ftcor: 'flat_top_corbel',
  hrtomt: 'hip_and_ridge_top_mount',
  hromt: 'hip_and_ridge_outside_mount',
  hrcor: 'hip_and_ridge_corbel',
  htsmt: 'hip_top_mount',
  homt: 'hip_outside_mount',
  hromss: 'hip_and_ridge_outside_mount_standing_seam',
  hipcor: 'hip_corbel',
  chase_cover: 'chase_cover',
  chase_corbel: 'chase_cover_corbel'
};

export const productConfig = {
  products,
  baseFields
};
