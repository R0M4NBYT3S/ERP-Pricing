import React, { useState, useMemo, useEffect } from 'react';
import { productConfig, productAliases } from '../config/productConfig';

// 🔧 API base: env or current host → normalize (remove trailing slashes and a trailing "/api")
const RAW_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  `${window.location.protocol}//${window.location.hostname}:3001` ||
  'http://192.168.0.73:3001';
const API_BASE = String(RAW_BASE).replace(/\/+$/, '').replace(/\/api$/, '');

// ----- Fraction helpers (support up to 1/16") -----
const FRACTION_FIELDS = new Set(['length', 'width', 'skirt', 'length2', 'width2']); // includes unsquare pair

function parseToSixteenth(val) {
  if (val == null) return NaN;
  if (typeof val === 'number') return Math.round(val * 16) / 16;
  const s = String(val).trim();
  if (s === '') return NaN;

  // decimals
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    return Math.round(num * 16) / 16;
  }

  // "X Y/Z" or "X-Y/Z" or "Y/Z"
  const m = s.match(/^\s*(-?\d+)?\s*(?:[- ]\s*)?(?:(\d+)\s*\/\s*(\d+))\s*$/);
  if (m) {
    const whole = m[1] ? parseInt(m[1], 10) : 0;
    const num = parseInt(m[2], 10);
    const den = parseInt(m[3], 10);
    if (!den || Number.isNaN(num)) return NaN;
    const sign = whole < 0 ? -1 : 1;
    const absWhole = Math.abs(whole);
    const v = sign * (absWhole + num / den);
    return Math.round(v * 16) / 16;
  }

  return NaN;
}

const roundToQuarter = (x) => Math.round(x * 4) / 4;

function DynamicForm() {
  const [tier, setTier] = useState('');
  const [product, setProduct] = useState('');
  const [metalType, setMetalType] = useState('');
  const [price, setPrice] = useState(null);

  // keep raw strings so users can type fractions
  const [formData, setFormData] = useState({
    holes: '',          // blank -> placeholder shows "Hole Count"
    unsquare: false,
    length: '',
    width: '',
    skirt: '',
    length2: '',        // extra fields shown when unsquare
    width2: '',
    holeSizes: [],      // reference only
  });

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

  // Identify product categories (robust multi-flue detection using backend aliases)
  const lowerProduct = (product || '').toLowerCase();
  const backendKey = (productAliases[product] || product || '').toLowerCase();
  const multiFlueProducts = ['ftomt', 'hipcor', 'hrtomt', 'hromt', 'htsmt', 'homt', 'hromss'];

  const isChase = lowerProduct.includes('chase');
  const isMulti =
    /(flat[_\s-]?top|hip|ridge)/.test(backendKey) ||  // use backendKey here
    multiFlueProducts.includes(backendKey) ||
    multiFlueProducts.includes(lowerProduct);

  // NEW: detect hip / hip-and-ridge for pitch handling
  const isHipProduct = /hip/.test(backendKey);

  const shroudKeys = [
    'dynasty', 'majesty', 'monaco', 'royale', 'durham',
    'monarch', 'regal', 'princess', 'prince', 'temptress',
    'imperial', 'centurion', 'mountaineer', 'emperor'
  ];
  const isShroud = shroudKeys.some(n => lowerProduct.includes(n));

  const showUnsquareLayout = isChase || isMulti || isShroud;

  const filteredMetalOptions = useMemo(() => {
    if (!product) return metalOptions;

    const productRestrictions = {
      chase_cover: ['ss24pol', 'ss24mil', 'black_galvanized', 'kynar', 'copper'],
      multi: ['ss24pol', 'g90', 'kynar'],
      shroud: ['ss24pol', 'black_galvanized', 'kynar'],
    };

    const allowed = isChase
      ? productRestrictions.chase_cover
      : isMulti
      ? productRestrictions.multi
      : productRestrictions.shroud;

    return metalOptions.filter(opt => !opt.value || allowed.includes(opt.value));
  }, [product, isChase, isMulti]);

  const handleChange = (field, value) => {
    const lower = field.toLowerCase();

    if (FRACTION_FIELDS.has(lower)) {
      // keep raw string; parse later
      setFormData(prev => ({ ...prev, [field]: value }));
      return;
    }

    if (lower === 'holes') {
      // Keep the raw typed value so the input can be blank with a placeholder
      const count = Math.max(0, parseInt(value || 0, 10) || 0);
      setFormData(prev => ({
        ...prev,
        holes: value,
        holeSizes: Array.from({ length: count }, (_, i) => prev.holeSizes?.[i] || '')
      }));
      return;
    }

    if (lower === 'unsquare') {
      const on = !!value;
      setFormData(prev => ({
        ...prev,
        unsquare: on,
        ...(on ? {} : { length2: '', width2: '' })
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
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
    if (!metalTypeBackend) return alert('Please select a metal type');

    const backendProduct = productAliases[product] || product;

    // Parse/round fields
    const parsed = {};
    productDef.fields.forEach(field => {
      const lower = field.toLowerCase();
      const raw = formData[field];

      if (FRACTION_FIELDS.has(lower)) {
        let num = parseToSixteenth(raw);
        if (lower === 'skirt' && Number.isFinite(num)) num = roundToQuarter(num); // round skirt to .25
        parsed[field] = num;
      } else {
        const n = Number(raw);
        parsed[field] = Number.isFinite(n) ? n : raw;
      }
    });

    // If unsquare, take the longest L and W for pricing
    let L1 = parseToSixteenth(formData.length);
    let L2 = parseToSixteenth(formData.length2);
    let W1 = parseToSixteenth(formData.width);
    let W2 = parseToSixteenth(formData.width2);

    if (!Number.isFinite(L1)) L1 = 0;
    if (!Number.isFinite(W1)) W1 = 0;
    if (!Number.isFinite(L2)) L2 = 0;
    if (!Number.isFinite(W2)) W2 = 0;

    const effectiveLength = formData.unsquare ? Math.max(L1, L2) : L1;
    const effectiveWidth  = formData.unsquare ? Math.max(W1, W2) : W1;

    const holesCount = Math.max(0, parseInt(formData.holes || 0, 10) || 0);

    // 🔒 Force neutral pitch (12) when NOT hip; otherwise pass user-entered pitch
    if (!isHipProduct) {
      parsed.pitch = 12;
    }

    // build payload
    const payload = {
      tier: mapTierToBackend(tier),
      product: backendProduct,
      metalType: metalTypeBackend,
      metal: metalTypeBackend,
      metalKey: metalTypeBackend,
      holes: holesCount,
      unsquare: !!formData.unsquare,

      // send rounded/skirt-quantized fields (with neutralized pitch if needed)
      ...parsed,

      // overwrite length/width with effective values
      length: effectiveLength,
      width: effectiveWidth,
    };

    const url = `${API_BASE}/api/calculate`;
    console.log('[CALC] →', url, payload);

    try {
      const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();

      console.log('[CALC] ←', res.status, body);

      if (!res.ok) {
        alert(`Calc failed: HTTP ${res.status}\n${typeof body === 'string' ? body : JSON.stringify(body)}`);
        setPrice(null);
        return;
      }

      const finalPrice = (body && (body.finalPrice ?? body.final_price ?? body.price));
      setPrice(typeof finalPrice === 'number' ? finalPrice : null);
    } catch (err) {
      console.error('[CALC] error', err);
      alert(`Calc error: ${String(err)}`);
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
      holes: Math.max(0, parseInt(formData.holes || 0, 10) || 0),
      unsquare: !!formData.unsquare,
      final_price: price,
      // holeSizes intentionally not sent (reference-only for next step)
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

  // fields present for the selected product
  const productFields = (productConfig.products[product]?.fields || []).map(s => s.toLowerCase());
  const hasSkirt = productFields.includes('skirt');

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
            setFormData({
              holes: '',
              unsquare: false,
              length: '',
              width: '',
              skirt: '',
              length2: '',
              width2: '',
              holeSizes: [],
            });
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
              const isShroudHere = shroudKeys.some(name => lowerKey.includes(name));
              const isCorbel = lowerKey.includes('corbel');
              if (corbelAlwaysShowKeys.some(name => lowerKey.includes(name))) return true;
              if (isShroudHere && isCorbel) return false;
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

        {/* ===== CHASE / MULTI / SHROUD share the same unsquare-first layout ===== */}
        {showUnsquareLayout ? (
          <>
            {/* Unsquare first */}
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

            {/* Length (1) and Width (2) */}
            <div className="w-full mb-4 flex justify-center">
              <input
                type="text"
                placeholder="Length (1)"
                value={formData.length}
                onChange={(e) => handleChange('length', e.target.value)}
                className="w-2/3 p-2 border rounded text-center"
              />
            </div>
            <div className="w-full mb-4 flex justify-center">
              <input
                type="text"
                placeholder="Width (2)"
                value={formData.width}
                onChange={(e) => handleChange('width', e.target.value)}
                className="w-2/3 p-2 border rounded text-center"
              />
            </div>

            {/* Length (3) and Width (4) appear when Unsquare is checked */}
            {formData.unsquare && (
              <>
                <div className="w-full mb-4 flex justify-center">
                  <input
                    type="text"
                    placeholder="Length (3)"
                    value={formData.length2}
                    onChange={(e) => handleChange('length2', e.target.value)}
                    className="w-2/3 p-2 border rounded text-center"
                  />
                </div>
                <div className="w-full mb-4 flex justify-center">
                  <input
                    type="text"
                    placeholder="Width (4)"
                    value={formData.width2}
                    onChange={(e) => handleChange('width2', e.target.value)}
                    className="w-2/3 p-2 border rounded text-center"
                  />
                </div>
              </>
            )}

            {/* Skirt next (only if that field exists for this product) */}
            {hasSkirt && (
              <div className="w-full mb-4 flex justify-center">
                <input
                  type="text"
                  placeholder="Skirt"
                  value={formData.skirt}
                  onChange={(e) => handleChange('skirt', e.target.value)}
                  className="w-2/3 p-2 border rounded text-center"
                />
              </div>
            )}

            {/* Hole controls ONLY for Chase Cover */}
            {isChase && (
              <>
                <div className="w-full mb-4 flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Hole Count"
                    value={formData.holes}
                    onChange={(e) => handleChange('holes', e.target.value)}
                    className="w-2/3 p-2 border rounded text-center"
                  />
                </div>

                {Math.max(0, parseInt(formData.holes || 0, 10) || 0) > 0 && (
                  <div className="w-full mb-4 flex flex-col items-center space-y-2">
                    {Array.from({ length: Math.max(0, parseInt(formData.holes || 0, 10) || 0) }, (_, i) => (
                      <input
                        key={i}
                        type="text"
                        placeholder={`Hole ${i + 1} size (ref only)`}
                        value={formData.holeSizes[i] || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormData(prev => {
                            const arr = [...(prev.holeSizes || [])];
                            arr[i] = v;
                            return { ...prev, holeSizes: arr };
                          });
                        }}
                        className="w-2/3 p-2 border rounded text-center"
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Render remaining product fields (excluding ones we already handled).
                Also exclude 'pitch' unless this is a hip product. */}
            {(productConfig.products[product]?.fields || [])
              .filter((f) => {
                const k = f.toLowerCase();
                if (['length','width','skirt','holes','holecount'].includes(k)) return false;
                if (k === 'pitch' && !isHipProduct) return false; // HIDE pitch when not hip
                return true;
              })
              .map((field) => {
                const { type, required } = getFieldMeta(field);
                const lower = field.toLowerCase();
                const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const inputType = FRACTION_FIELDS.has(lower) ? 'text' : (type === 'number' ? 'number' : type);
                return (
                  <div key={field} className="w-full mb-4 flex justify-center">
                    <input
                      type={inputType}
                      inputMode={FRACTION_FIELDS.has(lower) ? 'text' : undefined}
                      placeholder={label}
                      value={formData[field] ?? ''}
                      onChange={(e) => handleChange(field, e.target.value)}
                      className="w-2/3 p-2 border rounded text-center"
                      required={required}
                    />
                  </div>
                );
              })}
          </>
        ) : (
          // ===== OTHER PRODUCTS (not chase/multi/shroud): generic renderer =====
          <>
            {(productConfig.products[product]?.fields || [])
              .filter((field) => {
                const k = field && field.toLowerCase();
                if (!k) return false;
                if (['holes','holecount'].includes(k)) return false;
                if (k === 'pitch' && !isHipProduct) return false; // HIDE pitch when not hip
                return true;
              })
              .map((field) => {
                const { type, required } = getFieldMeta(field);
                const lower = field.toLowerCase();
                const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const inputType = FRACTION_FIELDS.has(lower) ? 'text' : (type === 'number' ? 'number' : type);
                return (
                  <div key={field} className="w-full mb-4 flex justify-center">
                    <input
                      type={inputType}
                      inputMode={FRACTION_FIELDS.has(lower) ? 'text' : undefined}
                      placeholder={label}
                      value={formData[field] ?? ''}
                      onChange={(e) => handleChange(field, e.target.value)}
                      className="w-2/3 p-2 border rounded text-center"
                      required={required}
                    />
                  </div>
                );
              })}
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
