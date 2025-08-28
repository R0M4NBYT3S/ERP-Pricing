// DynamicForm.jsx
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
} // <-- closes parseToSixteenth properly

// ===== IMAGE HELPERS (top-level) =====
const IMG_ROOT = '/products';
const FALLBACK_IMAGE = `${IMG_ROOT}/placeholder.png`;

function imageCandidatesForProduct(key) {
  if (!key) return [];
  const slug = String(key).trim().toLowerCase();
  return [`${IMG_ROOT}/${slug}.jpg`, `${IMG_ROOT}/${slug}.jpeg`, `${IMG_ROOT}/${slug}.png`];
}

const roundToQuarter = (x) => Math.round(x * 4) / 4;

function DynamicForm() {
  const [tier, setTier] = useState('');
  const [product, setProduct] = useState('');
  const [metalType, setMetalType] = useState('');
  const [price, setPrice] = useState(null);

  // NEW: store canonical calc values from backend (no client recompute)
  const [quote, setQuote] = useState(null);

  // keep raw strings so users can type fractions
  const [formData, setFormData] = useState({
    holes: '',
    unsquare: false,
    length: '',
    width: '',
    skirt: '',
    length2: '',
    width2: '',
    holeSizes: [],
    // NEW — shroud addon + hole placement
    addChaseCover: false,
    centerHole: false,
    offsetHole: false,
    offsetMultiHole: false,
    // offsets (single or multi) already supported below via formData.*
  });

  // ---- image candidates (.jpg → .jpeg → .png) ----
  const [imgIdx, setImgIdx] = useState(0);

  const candidates = useMemo(() => {
    const fromAlias = (productAliases[product] || product || '').toLowerCase();
    const fromRaw = (product || '').toLowerCase();
    const uniqSlugs = Array.from(new Set([fromAlias, fromRaw].filter(Boolean)));
    const exts = ['jpg', 'jpeg', 'png', 'JPG', 'JPEG', 'PNG'];
    const out = [];
    for (const slug of uniqSlugs) for (const ext of exts) out.push(`${IMG_ROOT}/${slug}.${ext}`);
    return out;
  }, [product]);

  const imgSrc = candidates[imgIdx] || null;

  useEffect(() => {
    setImgIdx(0); // reset when product changes
  }, [product]);

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
        try {
          es.close();
        } catch {}
      };
    } catch {}
    return () => {
      try {
        es && es.close();
      } catch {}
    };
  }, []);

  const tierOptions = [
    { label: 'Select Customer/Tier', value: '' },
    { label: 'Advanced', value: 'advanced_vg' },
    { label: "Alan's Home Services", value: 'alans_home_services_val' },
    { label: 'All Out Chimney', value: 'all_out_chimney_val' },
    { label: 'Atriad', value: 'atriad_val' },
    { label: 'Biltmore Hearth & Home', value: 'biltmore_val' },
    { label: 'Blossman', value: 'blossman_val' },
    { label: 'Blue Sky', value: 'blue_sky_val' },
    { label: 'Buck Stove Pool & Spa', value: 'buck_stove_val' },
    { label: 'Carolina Elite', value: 'carolina_elite_val' },
    { label: 'Carolina Hearth & Patio', value: 'carolina_hearth_val' },
    { label: 'Cashiers', value: 'cashiers_val' },
    { label: 'Certified Chimney Care, LLC', value: 'certified_chimney_val' },
    { label: 'Chim Cheree', value: 'chim_cheree_val' },
    { label: 'Chimspector', value: 'chimspector_val' },
    { label: 'Chimney Solutions', value: 'chimney_solutions_val' },
    { label: 'Clean Sweep - Art', value: 'clean_sweep_val' },
    { label: 'Emberstone', value: 'emberstone_vs' },
    { label: 'Environmental', value: 'environmental_val' },
    { label: 'Fire Protection Specialist', value: 'fire_protection_val' },
    { label: 'First Choice', value: 'first_choice_val' },
    { label: 'First Due', value: 'first_due_val' },
    { label: 'Flamepro', value: 'flamepro_val' },
    { label: 'Foothills Fireplace & Stove', value: 'foothills_val' },
    { label: 'Future Energy', value: 'future_energy_val' },
    { label: 'Good Chimney', value: 'good_chimney_val' },
    { label: 'Kickin Ash', value: 'kickin_ash_val' },
    { label: 'LKN', value: 'lkn_val' },
    { label: 'Seneca Sweeps', value: 'seneca_val' },
    { label: 'Smokerise', value: 'smokerise_val' },
    { label: 'Stateline Groundworks', value: 'stateline_val' },
    { label: "Tim's Gas Depot", value: 'tims_val' },
    { label: 'Top Cat', value: 'top_cat_val' },
    { label: 'Top Hat - Greenville', value: 'top_hat_greenville_val' },
    { label: 'Top Hat - Wes', value: 'top_hat_wes_val' },
    { label: 'Top Hat - Sumter', value: 'top_hat_sumter_val' },
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
    /(flat[_\s-]?top|hip|ridge)/.test(backendKey) ||
    multiFlueProducts.includes(backendKey) ||
    multiFlueProducts.includes(lowerProduct);

  // NEW: detect hip / hip-and-ridge for pitch handling
  const isHipProduct = /hip/.test(backendKey);

  const shroudKeys = [
    'dynasty',
    'majesty',
    'monaco',
    'royale',
    'durham',
    'monarch',
    'regal',
    'princess',
    'prince',
    'temptress',
    'imperial',
    'centurion',
    'mountaineer',
    'emperor',
  ];
  const isShroud = shroudKeys.some((n) => lowerProduct.includes(n));

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

    return metalOptions.filter((opt) => !opt.value || allowed.includes(opt.value));
  }, [product, isChase, isMulti]);

  const handleChange = (field, value) => {
    const lower = field.toLowerCase();

    if (FRACTION_FIELDS.has(lower)) {
      setFormData((prev) => ({ ...prev, [field]: value }));
      return;
    }

    if (lower === 'holes') {
      const count = Math.max(0, parseInt(value || 0, 10) || 0);
      setFormData((prev) => ({
        ...prev,
        holes: value,
        holeSizes: Array.from({ length: count }, (_, i) => prev.holeSizes?.[i] || ''),
      }));
      return;
    }

    if (lower === 'unsquare') {
      const on = !!value;
      setFormData((prev) => ({
        ...prev,
        unsquare: on,
        ...(on ? {} : { length2: '', width2: '' }),
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
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
    const metalEntry = metalOptions.find((opt) => opt.value === metalType);
    const metalTypeBackend = metalEntry?.backendValue || '';
    if (!metalTypeBackend) return alert('Please select a metal type');

    const backendProduct = productAliases[product] || product;

    // Parse/round fields
    const parsed = {};
    productDef.fields.forEach((field) => {
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
    const effectiveWidth = formData.unsquare ? Math.max(W1, W2) : W1;

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

      // hole placement + offsets (forward to backend if it ever cares for shroud add-on)
      addChaseCover: !!formData.addChaseCover,
      centerHole: !!formData.centerHole,
      offsetHole: !!formData.offsetHole,
      offsetMultiHole: !!formData.offsetMultiHole,
      offsetA: formData.offsetA ?? '',
      offsetB: formData.offsetB ?? '',
      offsetAList: formData.offsetAList ?? [],
      offsetBList: formData.offsetBList ?? [],

      // send rounded/skirt-quantized fields (with neutralized pitch if needed)
      ...parsed,

      // overwrite length/width with effective values
      length: effectiveLength,
      width: effectiveWidth,
    };

    const url = `${API_BASE}/api/calculate`;
    console.log('[CALC] →', url, payload);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();

      console.log('[CALC] ←', res.status, body);

      if (!res.ok) {
        alert(
          `Calc failed: HTTP ${res.status}\n${
            typeof body === 'string' ? body : JSON.stringify(body)
          }`
        );
        setPrice(null);
        setQuote(null);
        return;
      }

      // ✅ Trust backend canonical numbers (no client recompute)
      const n = (v) => {
        const x = Number(v);
        return Number.isFinite(x) ? x : NaN;
      };
      const adjustedFactor = n(body.adjustedFactor ?? body.adjusted_factor);
      const tieredFactor = n(body.tieredFactor ?? body.tiered_factor);
      const perimeter = n(body.perimeter ?? body.perim);
      const finalPrice =
        n(body.totalPrice ?? body.finalPrice ?? body.computedPrice ?? body.price);

      setQuote({
        adjustedFactor,
        tieredFactor,
        perimeter,
        finalPrice,
      });

      setPrice(Number.isFinite(finalPrice) ? finalPrice : null);
    } catch (err) {
      console.error('[CALC] error', err);
      alert(`Calc error: ${String(err)}`);
      setPrice(null);
      setQuote(null);
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
    return productConfig.baseFields.find((f) => f.name === fieldName) || { name: fieldName, type: 'text' };
  };

  // fields present for the selected product
  const productFields = (productConfig.products[product]?.fields || []).map((s) => s.toLowerCase());
  const hasSkirt = productFields.includes('skirt');

  // ====== NEW: derive whether the hole-placement UI is enabled (Chase OR Shroud+AddOn) ======
  const holePlacementEnabled = !!product && (isChase || (isShroud && formData.addChaseCover));

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
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
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
              addChaseCover: false,
              centerHole: false,
              offsetHole: false,
              offsetMultiHole: false,
              offsetA: '',
              offsetB: '',
              offsetAList: [],
              offsetBList: [],
            });
            setQuote(null);
            setPrice(null);
          }}
          className="w-full p-2 border rounded"
        >
          <option value="">Select Product</option>
          {Object.entries(productConfig.products)
            .filter(([key]) => {
              const lowerKey = key.toLowerCase();
              const corbelAlwaysShowKeys = ['flat_top_corbel', 'hip_corbel', 'hip_and_ridge_corbel'];
              const shroudKeysLocal = [
                'dynasty',
                'majesty',
                'monaco',
                'royale',
                'durham',
                'monarch',
                'regal',
                'princess',
                'prince',
                'temptress',
                'imperial',
                'centurion',
                'mountaineer',
              ];
              const isShroudHere = shroudKeysLocal.some((name) => lowerKey.includes(name));
              const isCorbel = lowerKey.includes('corbel');
              if (corbelAlwaysShowKeys.some((name) => lowerKey.includes(name))) return true;
              if (isShroudHere && isCorbel) return false;
              return true;
            })
            .map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
        </select>

        {product && (
          <div className="mt-4 mb-6 border rounded bg-gray-50 p-2">
            <div className="text-xs text-gray-500 mb-2">Preview: {product}</div>
            <div className="w-full max-w-sm aspect-[4/3] overflow-hidden flex items-center justify-center">
              {imgSrc && (
                <img
                  src={imgSrc || FALLBACK_IMAGE}
                  alt={`${backendKey || 'product'} preview`}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    if (imgIdx + 1 < candidates.length) {
                      setImgIdx(imgIdx + 1); // try .jpeg then .png
                    } else if (e.currentTarget.src !== window.location.origin + FALLBACK_IMAGE) {
                      e.currentTarget.src = FALLBACK_IMAGE; // final fallback
                    }
                  }}
                  className="object-contain w-full h-full"
                />
              )}
            </div>
          </div>
        )}

        <div className="h-4" />

        <select
          value={metalType}
          onChange={(e) => setMetalType(e.target.value)}
          className="w-full p-2 border rounded"
        >
          {filteredMetalOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* ── Universal toggles: Unsquare + Powdercoat ───────── */}
        {product && (
          <div className="mt-2 mb-3 flex flex-wrap items-center gap-6">
            {/* Unsquare with tooltip */}
            <div className="relative inline-flex items-center gap-2 text-sm font-normal group">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!formData.unsquare}
                  onChange={(e) => setFormData((f) => ({ ...f, unsquare: e.target.checked }))}
                />
                <span>Unsquare?</span>
              </label>
              <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block">
                <div className="pointer-events-none rounded-lg border bg-white shadow-xl p-2 w-64">
                  <img src="/help/unsquare.png" alt="Unsquare illustration" className="w-full h-auto rounded" />
                  <p className="mt-1 text-xs text-gray-600">Unsquare illustration</p>
                </div>
              </div>
            </div>

            {/* Powdercoat (stainless only) */}
            {['ss24pol', 'ss24mil'].includes(metalType) && (
              <label className="inline-flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  checked={!!formData.powdercoat}
                  onChange={(e) => setFormData((f) => ({ ...f, powdercoat: e.target.checked }))}
                />
                <span>Powdercoat</span>
              </label>
            )}

            {/* NEW: Add Chase Cover (only for shrouds) */}
            {isShroud && (
              <label className="inline-flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  checked={!!formData.addChaseCover}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      addChaseCover: e.target.checked,
                      // reset hole placements when toggling the add-on
                      ...(e.target.checked
                        ? {}
                        : {
                            centerHole: false,
                            offsetHole: false,
                            offsetMultiHole: false,
                            holes: '',
                            holeSizes: [],
                            offsetA: '',
                            offsetB: '',
                            offsetAList: [],
                            offsetBList: [],
                          }),
                    }))
                  }
                />
                <span>Add Chase Cover</span>
              </label>
            )}
          </div>
        )}

        {/* ── Hole placement toggles: Center/Offset/Offset Multi ─────────
            (usable for: Chase product, OR Shroud + Add Chase Cover) */}
        {holePlacementEnabled && (
          <>
            {(() => {
              const setHolePlacement = (key) => {
                setFormData((f) => ({
                  ...f,
                  centerHole: key === 'center',
                  offsetHole: key === 'offset',
                  offsetMultiHole: key === 'multi',
                }));
              };

              const Tooltip = ({ src, alt, children }) => (
                <div className="relative inline-flex items-center gap-2 text-sm font-normal group">
                  {children}
                  <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block">
                    <div className="pointer-events-none rounded-lg border bg-white shadow-xl p-2 w-64">
                      <img src={src} alt={alt} className="w-full h-auto rounded" />
                      <p className="mt-1 text-xs text-gray-600">{alt}</p>
                    </div>
                  </div>
                </div>
              );

              return (
                <div className="mt-2 mb-3 flex flex-wrap items-center gap-6">
                  {/* Center hole (radio-like) + tooltip */}
                  <Tooltip src="/help/center-hole.png" alt="Center hole illustration">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!formData.centerHole}
                        onChange={(e) => setHolePlacement(e.target.checked ? 'center' : null)}
                      />
                      <span>Center hole</span>
                    </label>
                  </Tooltip>

                  {/* Offset hole (radio-like) + tooltip */}
                  <Tooltip src="/help/offset-single-hole.png" alt="Offset (single) hole illustration">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!formData.offsetHole}
                        onChange={(e) => setHolePlacement(e.target.checked ? 'offset' : null)}
                      />
                      <span>Offset hole</span>
                    </label>
                  </Tooltip>

                  {/* Offset multi hole (radio-like) + tooltip */}
                  <Tooltip src="/help/offset-multi-hole.png" alt="Offset multi-hole illustration">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!formData.offsetMultiHole}
                        onChange={(e) => setHolePlacement(e.target.checked ? 'multi' : null)}
                      />
                      <span>Offset multi hole</span>
                    </label>
                  </Tooltip>
                </div>
              );
            })()}
          </>
        )}

        {/* Length (1) and Width (2) — only when a product is selected and it uses base dims */}
        {(() => {
          const fields = productConfig.products[product]?.fields || [];
          const needsBaseDims =
            isChase ||
            fields.some((f) => ['length', 'width'].includes((f || '').toLowerCase()));
          if (!product || !needsBaseDims) return null;

          return (
            <>
              <div className="w-full mb-4 flex justify-center">
                <input
                  type="text"
                  placeholder="Length (1)"
                  value={formData.length ?? ''}
                  onChange={(e) => handleChange('length', e.target.value)}
                  className="w-2/3 p-2 border rounded text-center"
                />
              </div>
              <div className="w-full mb-4 flex justify-center">
                <input
                  type="text"
                  placeholder="Width (2)"
                  value={formData.width ?? ''}
                  onChange={(e) => handleChange('width', e.target.value)}
                  className="w-2/3 p-2 border rounded text-center"
                />
              </div>
            </>
          );
        })()}

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

        {/* Skirt (only if that field exists for this product) */}
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

        {/* Hole controls (SAME UI as Chase) — enabled for Chase OR (Shroud + AddOn) */}
        {holePlacementEnabled && (
          <>
            {(() => {
              const holeCount = Math.max(0, parseInt(formData.holes || 0, 10) || 0);
              const multiMode = !!formData.offsetMultiHole || holeCount > 1;
              const showOffsets = !!formData.offsetHole || multiMode;
              const centerSingle = holeCount === 1 && !formData.offsetHole && !formData.offsetMultiHole;

              return (
                <>
                  {/* Hole count + adaptive A/B offset inputs */}
                  <div className="w-full mb-4 flex flex-col items-center">
                    <div className="w-2/3 flex items-center gap-3">
                      {/* Hole Count — shrinks to 1/4 width when offsets apply */}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Hole Count"
                        value={formData.holes}
                        onChange={(e) => {
                          const count = Math.max(0, parseInt(e.target.value || 0, 10) || 0);
                          setFormData((prev) => {
                            const resize = (arr = [], len) =>
                              Array.from({ length: len }, (_, i) => arr[i] ?? '');
                            return {
                              ...prev,
                              holes: e.target.value,
                              holeSizes: resize(prev.holeSizes, count),
                              offsetAList: resize(prev.offsetAList, count),
                              offsetBList: resize(prev.offsetBList, count),
                            };
                          });
                        }}
                        className={`${showOffsets ? 'w-1/4' : 'w-full'} p-2 border rounded text-center`}
                      />

                      {/* Offsets UI */}
                      {showOffsets && (
                        <>
                          {!multiMode ? (
                            // Single offset: just A and B
                            <div className="flex-1 flex items-center gap-3">
                              <div className="flex items-center gap-2 flex-1">
                                <label className="text-sm shrink-0">A:</label>
                                <input
                                  type="text"
                                  placeholder="A"
                                  value={formData.offsetA ?? ''}
                                  onChange={(e) => setFormData((f) => ({ ...f, offsetA: e.target.value }))}
                                  className="w-full p-2 border rounded text-center"
                                />
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                <label className="text-sm shrink-0">B:</label>
                                <input
                                  type="text"
                                  placeholder="B"
                                  value={formData.offsetB ?? ''}
                                  onChange={(e) => setFormData((f) => ({ ...f, offsetB: e.target.value }))}
                                  className="w-full p-2 border rounded text-center"
                                />
                              </div>
                            </div>
                          ) : (
                            // Multi offset: A1..An, B1..Bn
                            <div className="flex-1">
                              <div className="grid grid-cols-2 gap-2">
                                {Array.from({ length: holeCount }, (_, i) => (
                                  <React.Fragment key={i}>
                                    <div className="flex items-center gap-2">
                                      <label className="text-sm shrink-0">{`A${i + 1}:`}</label>
                                      <input
                                        type="text"
                                        placeholder={`A${i + 1}`}
                                        value={formData.offsetAList?.[i] ?? ''}
                                        onChange={(e) =>
                                          setFormData((prev) => {
                                            const next = [...(prev.offsetAList || [])];
                                            next[i] = e.target.value;
                                            return { ...prev, offsetAList: next };
                                          })
                                        }
                                        className="w-full p-2 border rounded text-center"
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-sm shrink-0">{`B${i + 1}:`}</label>
                                      <input
                                        type="text"
                                        placeholder={`B${i + 1}`}
                                        value={formData.offsetBList?.[i] ?? ''}
                                        onChange={(e) =>
                                          setFormData((prev) => {
                                            const next = [...(prev.offsetBList || [])];
                                            next[i] = e.target.value;
                                            return { ...prev, offsetBList: next };
                                          })
                                        }
                                        className="w-full p-2 border rounded text-center"
                                      />
                                    </div>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Per-hole reference sizes – ONLY for a single, center hole */}
                  {centerSingle && (
                    <div className="w-full mb-4 flex flex-col items-center space-y-2">
                      <input
                        type="text"
                        placeholder="Hole 1 size (ref only)"
                        value={formData.holeSizes?.[0] || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormData((prev) => {
                            const arr = [...(prev.holeSizes || [])];
                            arr[0] = v;
                            return { ...prev, holeSizes: arr };
                          });
                        }}
                        className="w-2/3 p-2 border rounded text-center"
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* Render remaining product fields (excluding ones we already handled).
            Also exclude 'pitch' unless this is a hip product. */}
        {(productConfig.products[product]?.fields || [])
          .filter((field) => {
            const k = field?.toLowerCase?.() || '';
            if (!k) return false;
            if (['length', 'width', 'skirt', 'holes', 'holecount'].includes(k)) return false;
            if (k === 'pitch' && !isHipProduct) return false;
            return true;
          })
          .map((field) => {
            const { type, required } = getFieldMeta(field);
            const lower = field.toLowerCase();
            const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
            const inputType = FRACTION_FIELDS.has(lower) ? 'text' : type === 'number' ? 'number' : type;
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

        {/* Optional debug (display backend canonical values; keep commented to avoid UI churn)
        {quote && (
          <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border">
            {JSON.stringify({
              adjustedFactor_4dp: quote.adjustedFactor,
              tieredFactor_2dp: quote.tieredFactor,
              perimeter: quote.perimeter,
              finalPrice: quote.finalPrice,
            }, null, 2)}
          </pre>
        )} */}
      </div>
    </div>
  );
}

export default DynamicForm;
