module.exports = {
  pricingRules: {
    black_galvanized: {
      allowAll: true,
      sizeCutoffs: {
        small: 60,
        medium: 119,
        large: 179,
        small_tall: 60,
        large_tall: 119
      }
    },
    stainless: {
      allowAll: true,
      sizeCutoffs: {
        small: 60,
        medium: 119,
        large: 179,
        small_tall: 60,
        large_tall: 119
      }
    },
    kynar: {
      allowAll: false,
      sizeCutoffs: {
        small: 60,
        medium: 119,
        large: 179
      },
      restricted: ['small_tall', 'large_tall']
    },
    copper: {
      allowAll: false,
      formula: '(L + W) * 2 + 2',
      rules: [
        { max: 60, size: 'small' },
        { max: 120, size: 'medium' }
      ],
      restricted: ['large', 'small_tall', 'large_tall']
    }
  }
};
