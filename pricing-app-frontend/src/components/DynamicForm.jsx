import React, { useState, useMemo, useEffect } from 'react';
import { productConfig, productAliases } from '../config/productConfig';

// 🔧 Use env var if provided, else the current host (works on LAN, localhost, prod), fallback to old IP
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  `${window.location.protocol}//${window.location.hostname}:3001` ||
  'http://192.168.0.73:3001';

function DynamicForm() {
  const [tier, setTier] = useState('');
  const [product, setProduct] = useState('');
  const [metalType, setMetalType] = useState('');
  const [price, setPrice] = useState(null);
  const [formData, setFormData] = useState({ holes: 0, unsquare: false });

  // 🔹 Live Announcement
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let es;
    try {
      es = new EventSource(`${API_BASE}/api/announcements/live`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setAnnouncement(data?.text || '');
        } catch {}
      };
      es.onerror = () => {
        try { es.close(); } catch {}
      };
    } catch {}
    return () => { try { es && es.close(); } catch {} };
  }, []);

  const tierOptions = [
    { label: 'Select Customer/Tier', value: '' },
    { label: 'Advanced', value: 'advanced_vg' },
    { label: "Alan's Home Services", value: 'alans_home_services_val' },
    { label: "All Out Chimney", value: 'all_out_chimney_val' },
    { label: "Atriad", value: 'atriad_val' },
    { label: "Biltmore Hearth & Home", value: 'biltmore_val' },
    { label: "Blossman", value: 'blossman_val' },
    { label: "Blue Sky", value: 'blue_sky_val' },
    { label: "Buck Stove Pool & Spa", value: 'buck_stove_val' },
    { label: "Carolina Elite", value: 'carolina_elite_val' },
    { label: "Carolina Hearth & Patio", value: 'carolina_hearth_val' },
    { label: "Cashiers", value: 'cashiers_val' },
    { label: "Certified Chimney Care, LLC", value: 'certified_chimney_val' },
    { label: "Chim Cheree", value: 'chim_cheree_val' },
    { label: "Chimspector", value: 'chimspector_val' },
    { label: "Chimney Solutions", value: 'chimney_solutions_val' },
    { label: "Clean Sweep - Art", value: 'clean_sweep_val' },
    { label: "Emberstone", value: 'emberstone_vs' },
    { label: "Environmental", value: 'environmental_val' },
    { label: "Fire Protection Specialist", value: 'fire_protection_val' },
    { label: "First Choice", value: 'first_choice_val' },
    { label: "First Due", value: 'first_due_val' },
    { label: "Flamepro", value: 'flamepro_val' },
    { label: "Foothills Fireplace & Stove", value: 'foothills_val' },
    { label: "Future Energy", value: 'future_energy_val' },
    { label: "Good Chimney", value: 'good_chimney_val' },
    { label: "Kickin Ash", value: 'kickin_ash_val' },
    { label: "LKN", value: 'lkn_val' },
    { label: "Seneca Sweeps", value: 'seneca_val' },
    { label: "Smokerise", value: 'smokerise_val' },
    { label: "Stateline Groundworks", value: 'stateline_val' },
    { label: "Tim's Gas Depot", value: 'tims_val' },
    { label: "Top Cat", value: 'top_cat_val' },
    { label: "Top Hat - Greenville", value: 'top_hat_greenville_val' },
    { label: "Top Hat - Wes", value: 'top_hat_wes_val' },
    { label: "Top Hat - Sumter", value: 'top_hat_sumter_val' },
    { label: 'WNC', value: 'wnc_vs' },
    { label: '--------------', value: 'divider' },
    { label: 'Elite', value: 'elite' },
    { label: 'Value Gold', value: 'vg' },
    { label: 'Value Silver', value: 'vs' },
    { label: 'Value', value: 'val' },
    { label: 'Builder', value: 'bul' },
    { label: 'Homeowner', value: 'ho' },
  ];

  const metalOptions = [
    { label: 'Select Metal Type', value: '', backendValue: '' },
    { label: 'Black Galvanized', value: 'black_galvanized', backendValue: 'black_galvanized' },
    { label: 'G90 Galvanized', value: 'g90', backendValue: 'g90' },
    { label: 'Kynar', value: 'kynar', backendValue: 'kynar' },
    { label: 'Stainless Steel Polished', value: 'ss24pol', backendValue: 'ss24pol' },
    { label: 'Stainless Steel Mil', value: 'ss24mil', backendValue: 'ss24mil' },
    { label: 'Copper', value: 'copper', backendValue: 'copper' },
  ];

  const multiFlueProducts = ['ftomt', 'hipcor', 'hrtomt', 'hromt', 'htsmt', 'homt', 'hromss'];

  const filteredMetalOptions = useMemo(() => {
    if (!product) return metalOptions;

    const productRestrictions = {
      chase_cover: ['ss24pol', 'ss24mil', 'black_galvanized', 'kynar', 'copper'],
      multi: ['ss24pol', 'g90', 'kynar'],
      shroud: ['ss24pol', 'black_galvanized', 'kynar'],
    };

    const normalized = product.toLowerCase();
    const allowed = normalized.includes('chase')
      ? productRestrictions.chase_cover
      : multiFlueProducts.includes(product)
      ? productRestrictions.multi
      : productRestrictions.shroud;

    return metalOptions.filter(opt => !opt.value || allowed.includes(opt.value));
  }, [product]);

  const handleChange = (field, value) => {
    const numericFields = ['length', 'width', 'skirt', 'holes'];
    const parsedValue = numericFields.includes(field) ? (value === '' ? 0 : parseFloat(value) || 0) : value;
    setFormData(prev => ({ ...prev, [field]: parsedValue }));
  };

  const mapTierToBackend = (t) => {
    if (!t || t === 'divider') return '';
    const lc = t.toLowerCase();
    const known = new Set(['elite', 'vg', 'vs', 'val', 'bul', 'ho']);
    if (known.has(lc)) return lc;
    const parts = lc.split('_');
    const suffix = parts[parts.length - 1];
    return known.has(suffix) ? suffix : 'elite';
  };

  const calculatePrice = async () => {
    if (!tier || tier === 'divider') return alert('Please select a valid tier');
    if (!product) return alert('Please select a product');

    const productDef = productConfig.products[product] || { fields: [] };
    const metalEntry = metalOptions.find(opt => opt.value === metalType);
    const metalTypeBackend = metalEntry?.backendValue || '';

    const backendProduct = productAliases[product] || product;

    const payload = {
      tier: mapTierToBackend(tier),
      product: backendProduct,
      metal: metalTypeBackend,
      metalType,
      holes: parseFloat(formData.holes ?? 0),
      unsquare: !!formData.unsquare,
    };

    productDef.fields.forEach(field => {
      const raw = formData[field];
      const num = parseFloat(raw);
      payload[field] = Number.isFinite(num) ? num : raw;
    });

    // 🔍 Debug so you can see exactly what’s being sent and where
    console.log('[CALC] POST', `${API_BASE}/api/calculate`, payload);

    try {
      const response = await fetch(`${API_BASE}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[CALC] Response status:', response.status);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn('[CALC] Non-OK response:', data);
        setPrice(null);
        return;
      }

      const finalPrice = data.finalPrice || data.final_price || data.price;
      setPrice(typeof finalPrice === 'number' ? finalPrice : null);
    } catch (err) {
      console.error('🚨 Fetch failed:', err);
      setPrice(null);
    }
  };

  const generateCutSheet = async () => {
    const orderData = {
      product,
      metalType,
      length: formData.length,
      width: formData.width,
      skirt: formData.skirt,
      holes: formData.holes ?? 0,
      unsquare: !!formData.unsquare,
      final_price: price,
    };

    try {
      const res = await fetch(`${API_BASE}/api/cut-sheets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();
      if (data.success) {
        const link = document.createElement('a');
        link.href = `${API_BASE}/api/cut-sheets/download/${data.file}`;
        link.download = data.file;
        link.click();
      } else {
        alert('Failed to generate cut sheet');
      }
    } catch (err) {
      console.error('🚨 Cut sheet generation failed:', err);
    }
  };

  const getFieldMeta = (fieldName) => {
    return productConfig.baseFields.find(f => f.name === fieldName) || { name: fieldName, type: 'text' };
  };

  return (
    <div className="relative min-h-screen bg-gray-100 flex items-center justify-center px-4 py-12">
      {announcement && (
        <div className="fixed bottom-0 left-0 w-full bg-blue-200 text-blue-900 font-bold text-center py-2 z-50 shadow-md">
          {announcement}
        </div>
      )}

      <a
        href="/admin"
        className="fixed top-4 right-4 px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm shadow-md z-50"
      >
        Admin
      </a>

      <img
        src="/watermark.png"
        alt="Company Logo"
        className="absolute top-1/2 left-1/2 w-[900px] opacity-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
      />

      <div className="relative z-10 w-full max-w-md bg-white/0 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/10">
        <h1 className="text-4xl text-blue-600 text-center font-bold">CCS Elite Pricing</h1>

        <div className="h-4" />

        <select
          value={tier}
          onChange={(e) => setTier(e.target.value === 'divider' ? '' : e.target.value)}
          className="w-full p-2 border rounded"
        >
          {tierOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <div className="h-4" />

        <select
          value={product}
          onChange={(e) => {
            setProduct(e.target.value);
            setFormData({ holes: 0, unsquare: false });
          }}
          className="w-full p-2 border rounded"
        >
          <option value="">Select Product</option>
          {Object.entries(productConfig.products)
            .filter(([key]) => {
              const lowerKey = key.toLowerCase();
              const corbelAlwaysShowKeys = ['flat_top_corbel', 'hip_corbel', 'hip_and_ridge_corbel'];
              const shroudKeys = [
                'dynasty', 'majesty', 'monaco', 'royale', 'durham',
                'monarch', 'regal', 'princess', 'prince', 'temptress',
                'imperial', 'centurion', 'mountaineer',
              ];

              const isShroud = shroudKeys.some(name => lowerKey.includes(name));
              const isCorbel = lowerKey.includes('corbel');

              if (corbelAlwaysShowKeys.some(name => lowerKey.includes(name))) return true;
              if (isShroud && isCorbel) return false;
              return true;
            })
            .map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
        </select>

        <div className="h-4" />

        <select
          value={metalType}
          onChange={(e) => setMetalType(e.target.value)}
          className="w-full p-2 border rounded"
        >
          {filteredMetalOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <div className="h-4" />

        {(productConfig.products[product]?.fields || [])
          .filter((field) => field && !['holes', 'holecount'].includes(field.toLowerCase()))
          .map((field) => {
            const { type, required } = getFieldMeta(field);
            const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const stepAttr =
              field.toLowerCase() === 'skirt' ? 0.25 :
              ['length', 'width'].includes(field.toLowerCase()) ? 0.5 :
              undefined;

            return (
              <div key={field} className="w-full mb-4 flex justify-center">
                <input
                  type={type === 'number' ? 'number' : type}
                  step={stepAttr}
                  required={required}
                  placeholder={label}
                  value={formData[field] || ''}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="w-2/3 p-2 border rounded text-center"
                />
              </div>
            );
        })}

        {product === 'chase_cover' && (
          <>
            <div className="w-full mb-4 flex flex-col items-center">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Number of Holes (0 = None)"
                value={formData.holes ?? 0}
                onChange={(e) => handleChange('holes', e.target.value)}
                className="w-2/3 p-2 border rounded text-center"
              />
            </div>

            <div className="w-full mb-4 flex flex-col items-center">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.unsquare || false}
                  onChange={(e) => handleChange('unsquare', e.target.checked)}
                />
                <span>Unsquare?</span>
              </label>
            </div>
          </>
        )}

        <div className="w-full flex justify-center mt-2 space-x-2">
          <button
            onClick={calculatePrice}
            className="w-1/2 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-center"
          >
            Calculate
          </button>

          <button
            onClick={generateCutSheet}
            className="w-1/2 bg-green-600 text-white p-2 rounded hover:bg-green-700 text-center"
            disabled={price === null}
          >
            Generate Cut Sheet
          </button>
        </div>

        <div className="text-center font-semibold text-lg mt-4">
          Price: ${price !== null ? price.toFixed(2) : '0.00'}
        </div>
      </div>
    </div>
  );
}

export default DynamicForm;
