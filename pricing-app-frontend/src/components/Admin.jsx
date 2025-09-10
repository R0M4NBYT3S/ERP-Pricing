/* Full replacement of src/components/admin.jsx
   Adds a new "Chase" tab that edits tiered grid prices and add-on values.
   Existing tabs (Factors, Shrouds, Tiers, Announcements) are untouched.
*/
import React, { useEffect, useMemo, useState } from "react";

// feature flag: flip in Vercel via VITE_ADMIN_ENABLED
const ADMIN_ENABLED = import.meta.env.VITE_ADMIN_ENABLED === 'true';

// ---- API roots ----
const API_ROOT   = `${import.meta.env.VITE_API_BASE}/api`;
const ADMIN_ROOT = `${API_ROOT}/admin`;
const TIERS_ENDPOINT = `${ADMIN_ROOT}/tiers`;

// ---- Shroud shape helpers ----
const META_KEYS = new Set(["alias", "rules", "meta", "__meta"]);
function productRootForMetal(node) {
  if (!node || typeof node !== "object") return {};
  if (node.prices && typeof node.prices === "object") return node.prices;
  if (node.products && typeof node.products === "object") return node.products;
  return node;
}
function sizeRootForProduct(prodNode) {
  if (!prodNode || typeof prodNode !== "object") return {};
  if (prodNode.prices && typeof prodNode.prices === "object") return prodNode.prices;
  if (prodNode.sizes && typeof prodNode.sizes === "object") return prodNode.sizes;
  return prodNode;
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  if (!ct.includes("application/json")) throw new Error(`Expected JSON, got ${ct || "unknown"}`);
  return res.json();
}

// default adjustments
const DEFAULT_ADJUSTMENTS = {
  screen:   { standard: 0, interval: 0, rate: 0 },
  overhang: { standard: 0, interval: 0, rate: 0 },
  inset:    { standard: 0, interval: 0, rate: 0 },
  skirt:    { standard: 0, interval: 0, rate: 0 },
  pitch:    { below: 0, above: 0 },
  corbel:   0.15,
};

export default function Admin() {
  if (import.meta.env.VITE_ADMIN_ENABLED !== 'true') {
    return (
      <div className="min-h-screen w-full bg-gray-100 px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold">Admin — Coming Soon</h1>
          <p className="text-gray-600 mt-2">
            This section is temporarily disabled while pricing goes live.
            Set <code>VITE_ADMIN_ENABLED=true</code> in Vercel and redeploy to enable it.
          </p>
          <div className="mt-4">
            <a
              href="/"
              className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm"
            >
              ⬅ Back
            </a>
          </div>
        </div>
      </div>
    );
  }


  const [tab, setTab] = useState("factors");

  // ================= AUTH =================
  const [currentUser, setCurrentUser] = useState(localStorage.getItem("adminUser") || "");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const authHeaders = currentUser ? { "X-Admin-User": currentUser } : {};

  const signIn = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch(`${ADMIN_ROOT}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed");
      const user = data.user || loginUsername;
      setCurrentUser(user);
      localStorage.setItem("adminUser", user);
      setLoginPassword("");
      setLoginUsername("");
    } catch (err) {
      setLoginError(err.message || "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("adminUser");
    setCurrentUser("");
    setLoginUsername("");
    setLoginPassword("");
  };

  // ================= FACTORS =================
  const [factorsRaw, setFactorsRaw] = useState(null);
  const [loadingFactors, setLoadingFactors] = useState(false);
  const [factorsErr, setFactorsErr] = useState("");

  const [fMetal, setFMetal] = useState("");
  const [fProduct, setFProduct] = useState("");
  const [currentFactor, setCurrentFactor] = useState(null);
  const [newFactor, setNewFactor] = useState("");
  const [adj, setAdj] = useState(structuredClone(DEFAULT_ADJUSTMENTS));

  const loadFactors = async () => {
    setLoadingFactors(true); setFactorsErr("");
    try {
      const url = `${ADMIN_ROOT}/factors?t=${Date.now()}`;
      const data = await getJSON(url);
      setFactorsRaw(data || {});
    } catch (e) {
      setFactorsErr(e.message || String(e));
      setFactorsRaw(null);
    } finally {
      setLoadingFactors(false);
    }
  };

  const factors = useMemo(() => {
    const raw = factorsRaw;
    if (!raw || typeof raw !== "object") return {};
    const looksMetal = Object.values(raw).some(
      (v) => v && typeof v === "object" && !("factor" in v || "adjustments" in v)
    );
    if (looksMetal) {
      const out = {};
      for (const [metalKey, prodMap] of Object.entries(raw)) {
        const m = {};
        for (const [prodKey, entry] of Object.entries(prodMap || {})) {
          if (typeof entry === "number") {
            m[prodKey] = { factor: entry, adjustments: {} };
          } else if (entry && typeof entry === "object") {
            const f = typeof entry.factor === "number" ? entry.factor :
                      (Number.isFinite(+entry) ? +entry : null);
            m[prodKey] = { factor: f, adjustments: entry.adjustments || {} };
          } else {
            m[prodKey] = { factor: null, adjustments: {} };
          }
        }
        out[metalKey] = m;
      }
      return out;
    }
    if (Object.values(raw).every(
      (v) => v && typeof v === "object" && ("factor" in v || "adjustments" in v)
    )) {
      return { default: raw };
    }
    if (Object.values(raw).every((v) => typeof v === "number")) {
      const m = {};
      for (const [prodKey, num] of Object.entries(raw)) {
        m[prodKey] = { factor: num, adjustments: {} };
      }
      return { default: m };
    }
    return raw;
  }, [factorsRaw]);

  const metals = useMemo(() => Object.keys(factors || {}), [factors]);
  const products = useMemo(
    () => (fMetal ? Object.keys(factors?.[fMetal] || {}) : []),
    [fMetal, factors]
  );

  useEffect(() => {
    if (fMetal && fProduct) {
      const rawEntry = factors?.[fMetal]?.[fProduct];
      let fac = null;
      let a = {};
      if (typeof rawEntry === "number") {
        fac = rawEntry;
      } else if (rawEntry && typeof rawEntry === "object") {
        fac = rawEntry.factor;
        a = rawEntry.adjustments || {};
      }
      setCurrentFactor(Number.isFinite(fac) ? fac : null);
      setNewFactor(Number.isFinite(fac) ? String(fac) : "");
      const isCorbel = /corbel/i.test(fProduct);
      setAdj({
        screen:   { ...DEFAULT_ADJUSTMENTS.screen,   ...(a.screen   || {}) },
        overhang: { ...DEFAULT_ADJUSTMENTS.overhang, ...(a.overhang || {}) },
        inset:    { ...DEFAULT_ADJUSTMENTS.inset,    ...(a.inset    || {}) },
        skirt:    { ...DEFAULT_ADJUSTMENTS.skirt,    ...(a.skirt    || {}) },
        pitch:    { ...DEFAULT_ADJUSTMENTS.pitch,    ...(a.pitch    || {}) },
        corbel:   Number.isFinite(a.corbel) ? a.corbel : (isCorbel ? DEFAULT_ADJUSTMENTS.corbel : 0),
      });
    } else {
      setCurrentFactor(null);
      setNewFactor("");
      setAdj(structuredClone(DEFAULT_ADJUSTMENTS));
    }
  }, [fMetal, fProduct, factors]);

  const setAdjField = (group, key, val) => setAdj(prev => ({ ...prev, [group]: { ...prev[group], [key]: val } }));
  const setAdjScalar = (key, val) => setAdj(prev => ({ ...prev, [key]: val }));

  const sanitizeAdj = (a) => {
    const num = (v, d = 0) => {
      const n = typeof v === "string" ? parseFloat(v) : Number(v);
      return Number.isFinite(n) ? n : d;
    };
    return {
      screen:   { standard: num(a.screen?.standard),   interval: num(a.screen?.interval),   rate: num(a.screen?.rate) },
      overhang: { standard: num(a.overhang?.standard), interval: num(a.overhang?.interval), rate: num(a.overhang?.rate) },
      inset:    { standard: num(a.inset?.standard),    interval: num(a.inset?.interval),    rate: num(a.inset?.rate) },
      skirt:    { standard: num(a.skirt?.standard),    interval: num(a.skirt?.interval),    rate: num(a.skirt?.rate) },
      pitch:    { below:    num(a.pitch?.below),       above:    num(a.pitch?.above) },
      corbel:   num(a.corbel, 0),
    };
  };

  const updateFactorAndAdjustments = async () => {
    if (!currentUser) return alert("Sign in first.");
    if (!fMetal || !fProduct) return alert("Select metal and product.");

    const value = parseFloat(newFactor);
    if (!Number.isFinite(value)) return alert("Enter a valid factor.");

    const payload = {
      metal: fMetal,
      product: fProduct,
      factor: value,
      value,
      adjustments: sanitizeAdj(adj),
    };

    const res = await fetch(`${ADMIN_ROOT}/factors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
      body: JSON.stringify(payload),
    });

    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);
    if (!res.ok) {
      const msg = typeof body === "string" && body ? body : (body?.message || `HTTP ${res.status}`);
      throw new Error(`Factor update failed: ${msg}`);
    }
    await loadFactors();
  };

  const resetAdjustments = () => setAdj(structuredClone(DEFAULT_ADJUSTMENTS));

  // ================= SHROUDS =================
  const [shroudData, setShroudData] = useState({});
  const [loadingShrouds, setLoadingShrouds] = useState(false);
  const [shroudErr, setShroudErr] = useState("");

  const [metal, setMetal] = useState("");
  const [product, setProduct] = useState("");
  const [size, setSize] = useState("");
  const [currentPrice, setCurrentPrice] = useState(null);
  const [newPrice, setNewPrice] = useState("");

  const loadShrouds = async () => {
    setLoadingShrouds(true); setShroudErr("");
    try { setShroudData((await getJSON(`${ADMIN_ROOT}/shrouds?t=${Date.now()}`)) || {}); }
    catch (e) { setShroudErr(e.message || String(e)); setShroudData({}); }
    finally { setLoadingShrouds(false); }
  };

  useEffect(() => {
    try {
      if (metal && product && size) {
        const pMap = productRootForMetal(shroudData?.[metal]);
        const sMap = sizeRootForProduct(pMap?.[product]);
        let val = sMap?.[size];
        if (val && typeof val === "object" && "price" in val) val = val.price;
        const num = Number(val);
        setCurrentPrice(Number.isFinite(num) ? num : null);
        setNewPrice(Number.isFinite(num) ? String(num) : "");
      } else {
        setCurrentPrice(null);
        setNewPrice("");
      }
    } catch {
      setCurrentPrice(null);
      setNewPrice("");
    }
  }, [metal, product, size, shroudData]);

  const updateShroudPrice = async () => {
    if (!currentUser) return alert("Sign in first.");
    if (!metal || !product || !size || !newPrice) return alert("Select all fields and enter a price.");
    const payload = { metal, product, size, newPrice: parseFloat(newPrice) };
    const res = await fetch(`${ADMIN_ROOT}/shrouds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || "Failed to update price");
    }
    await loadShrouds();
  };

  const metalsS = Object.keys(shroudData || {});
  const productsMap = metal ? productRootForMetal(shroudData[metal]) : {};
  const productsS = metal ? Object.keys(productsMap).filter((k) => !META_KEYS.has(k)) : [];
  const sizesMap = metal && product ? sizeRootForProduct(productsMap[product]) : {};
  const sizesS = Object.keys(sizesMap || {});

  // ================= CHASE (new) =================
  const [chase, setChase] = useState({ prices: {}, addons: { hole: { black_kynar: 25, stainless: 45 }, unsquare: { black_kynar: 60, stainless: 85 } } });
  const [loadingChase, setLoadingChase] = useState(false);
  const [chaseErr, setChaseErr] = useState("");

  const [cTier, setCTier] = useState("");
  const [cMetal, setCMetal] = useState("");
  const [cSize, setCSize] = useState("");
  const [cCurrent, setCCurrent] = useState(null);
  const [cNew, setCNew] = useState("");

  const [addonHBK, setAddonHBK] = useState("25"); // holes black/kynar
  const [addonHSS, setAddonHSS] = useState("45"); // holes stainless
  const [addonUBK, setAddonUBK] = useState("60"); // unsquare black/kynar
  const [addonUSS, setAddonUSS] = useState("85"); // unsquare stainless

  const loadChase = async () => {
    setLoadingChase(true); setChaseErr("");
    try {
      const data = await getJSON(`${ADMIN_ROOT}/chase?t=${Date.now()}`);
      setChase(data || { prices: {}, addons: {} });
      const a = data?.addons || {};
      setAddonHBK(String(a?.hole?.black_kynar ?? 25));
      setAddonHSS(String(a?.hole?.stainless   ?? 45));
      setAddonUBK(String(a?.unsquare?.black_kynar ?? 60));
      setAddonUSS(String(a?.unsquare?.stainless   ?? 85));
    } catch (e) {
      setChaseErr(e.message || String(e));
      setChase({ prices: {}, addons: {} });
    } finally {
      setLoadingChase(false);
    }
  };

  const chaseTiers   = Object.keys(chase.prices || {});
  const chaseMetals  = cTier ? Object.keys(chase.prices[cTier] || {}) : [];
  const chaseSizes   = (cTier && cMetal) ? Object.keys(chase.prices[cTier][cMetal] || {}) : [];

  useEffect(() => {
    if (cTier && cMetal && cSize) {
      const v = Number(chase?.prices?.[cTier]?.[cMetal]?.[cSize]);
      setCCurrent(Number.isFinite(v) ? v : null);
      setCNew(Number.isFinite(v) ? String(v) : "");
    } else {
      setCCurrent(null);
      setCNew("");
    }
  }, [cTier, cMetal, cSize, chase]);

  const updateChasePrice = async () => {
    if (!currentUser) return alert("Sign in first.");
    if (!cTier || !cMetal || !cSize) return alert("Select tier, metal, and size.");
    const price = parseFloat(cNew);
    if (!Number.isFinite(price)) return alert("Enter a valid price.");
    const res = await fetch(`${ADMIN_ROOT}/chase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
      body: JSON.stringify({ tier: cTier, metal: cMetal, size: cSize, price }),
    });
    if (!res.ok) throw new Error(await res.text().catch(()=> "Failed to update chase price"));
    await loadChase();
  };

  const saveChaseAddons = async () => {
    if (!currentUser) return alert("Sign in first.");
    const payload = {
      addons: {
        "hole.black_kynar": parseFloat(addonHBK),
        "hole.stainless":   parseFloat(addonHSS),
        "unsquare.black_kynar": parseFloat(addonUBK),
        "unsquare.stainless":   parseFloat(addonUSS),
      }
    };
    const res = await fetch(`${ADMIN_ROOT}/chase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text().catch(()=> "Failed to update add-ons"));
    await loadChase();
  };

  // ================= ANNOUNCEMENTS =================
  const [anns, setAnns] = useState([]);
  const [annsErr, setAnnsErr] = useState("");
  const [loadingAnns, setLoadingAnns] = useState(false);

  const [newAnn, setNewAnn] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");

  const loadAnns = async () => {
    setLoadingAnns(true); setAnnsErr("");
    try { const data = await getJSON(`${API_ROOT}/announcements`); setAnns(Array.isArray(data) ? data : []); }
    catch (e) { setAnnsErr(e.message || String(e)); setAnns([]); }
    finally { setLoadingAnns(false); }
  };

  const addAnnouncement = async () => {
    const text = newAnn.trim();
    if (!currentUser) return alert("Sign in first.");
    if (!text) return setAddErr("Enter a message first.");
    setAdding(true); setAddErr("");
    try {
      const res = await fetch(`${API_ROOT}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
        body: JSON.stringify({ text }),
      });
      const ct = res.headers.get("content-type") || "";
      const payload = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) throw new Error(typeof payload === "string" ? payload : (payload?.message || "Failed to add"));
      if (payload?.announcement) setAnns((p) => [...p, payload.announcement]); else await loadAnns();
      setNewAnn("");
    } catch (e) { setAddErr(e.message || String(e)); }
    finally { setAdding(false); }
  };

  // ================= TIERS =================
  const [tiers, setTiers] = useState(null);
  const [tiersErr, setTiersErr] = useState("");
  const [loadingTiers, setLoadingTiers] = useState(false);

  const [tierKey, setTierKey] = useState("");
  const [tierCurrent, setTierCurrent] = useState(null);
  const [tierNew, setTierNew] = useState("");

  const loadTiers = async () => {
    setLoadingTiers(true); setTiersErr("");
    try {
      const resp = await getJSON(TIERS_ENDPOINT);
      const data = (resp && typeof resp === 'object' && !Array.isArray(resp) && resp.tiers) ? resp.tiers : resp || {};
      setTiers(data);
    } catch (e) {
      setTiersErr(e.message || String(e));
      setTiers(null);
    } finally {
      setLoadingTiers(false);
    }
  };

  useEffect(() => {
    if (tierKey && tiers && Object.prototype.hasOwnProperty.call(tiers, tierKey)) {
      const v = tiers[tierKey];
      const num = Number(v);
      setTierCurrent(Number.isFinite(num) ? num : null);
      setTierNew(Number.isFinite(num) ? String(num) : "");
    } else {
      setTierCurrent(null);
      setTierNew("");
    }
  }, [tierKey, tiers]);

  const updateTier = async () => {
    if (!currentUser) return alert("Sign in first.");
    if (!tierKey) return alert("Select a tier.");
    const value = parseFloat(tierNew);
    if (!Number.isFinite(value)) return alert("Enter a valid number.");
    const res = await fetch(TIERS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
      body: JSON.stringify({ tier: tierKey, factor: value }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || "Failed to update tier");
    }
    await loadTiers();
  };

  // ================= initial loads per tab =================
  useEffect(() => {
    if (tab === "factors") loadFactors();
    if (tab === "shrouds") loadShrouds();
    if (tab === "chase")   loadChase();
    if (tab === "announcements") loadAnns();
    if (tab === "tiers")   loadTiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const Pretty = ({ value }) => (
    <pre className="text-xs bg-gray-900 text-green-200 p-3 rounded overflow-auto max-h-80">
      {JSON.stringify(value, null, 2)}
    </pre>
  );

  const isCorbelSelected = /corbel/i.test(fProduct);

  return (
    <div className="min-h-screen w-full bg-gray-100 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <a href="/" className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm">⬅ Back</a>
          <h1 className="text-2xl font-bold">Admin</h1>
          <div className="text-sm">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-700">Signed in as <b>{currentUser}</b></span>
                <button onClick={signOut} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded">Sign out</button>
              </div>
            ) : <span className="text-gray-500">Not signed in</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "factors", label: "Factors" },
            { id: "shrouds", label: "Shrouds" },
            { id: "chase",   label: "Chase" },
            { id: "tiers", label: "Tiers" },
            { id: "announcements", label: "Announcements" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded ${tab === t.id ? "bg-blue-600 text-white" : "bg-white border"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ================= Factors Tab ================= */}
        {tab === "factors" && (
          <section className="bg-white rounded-xl shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Multi-Flue Factors</h2>
              <button
                onClick={loadFactors}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loadingFactors}
              >
                {loadingFactors ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {factorsErr && <div className="text-red-600 text-sm">{factorsErr}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="border rounded p-2"
                value={fMetal}
                onChange={(e) => { setFMetal(e.target.value); setFProduct(""); }}
              >
                <option value="">Select Metal</option>
                {metals.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>

              <select
                className="border rounded p-2"
                value={fProduct}
                onChange={(e) => setFProduct(e.target.value)}
                disabled={!fMetal}
              >
                <option value="">{fMetal ? "Select Product" : "Select metal first"}</option>
                {products.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>

              <div className="border rounded p-2 bg-gray-50 flex items-center">
                <div className="text-sm text-gray-600">Current Factor:&nbsp;</div>
                <div className="font-semibold">{currentFactor ?? "—"}</div>
              </div>
            </div>

            <div className="border rounded p-3">
              <label className="block text-sm mb-1">New Factor</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded p-2"
                value={newFactor}
                onChange={(e) => setNewFactor(e.target.value)}
                disabled={!fProduct}
              />
            </div>

            {/* Adjustments grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded p-3">
                <h3 className="font-semibold mb-2">Screen</h3>
                <FieldTriple label="Standard" value={adj.screen.standard} onChange={(v)=>setAdjField('screen','standard',v)} />
                <FieldTriple label="Interval" value={adj.screen.interval} onChange={(v)=>setAdjField('screen','interval',v)} />
                <FieldTriple label="Rate"     value={adj.screen.rate}     onChange={(v)=>setAdjField('screen','rate',v)} />
              </div>

              <div className="border rounded p-3">
                <h3 className="font-semibold mb-2">Overhang</h3>
                <FieldTriple label="Standard" value={adj.overhang.standard} onChange={(v)=>setAdjField('overhang','standard',v)} />
                <FieldTriple label="Interval" value={adj.overhang.interval} onChange={(v)=>setAdjField('overhang','interval',v)} />
                <FieldTriple label="Rate"     value={adj.overhang.rate}     onChange={(v)=>setAdjField('overhang','rate',v)} />
              </div>

              <div className="border rounded p-3">
                <h3 className="font-semibold mb-2">Inset</h3>
                <FieldTriple label="Standard" value={adj.inset.standard} onChange={(v)=>setAdjField('inset','standard',v)} />
                <FieldTriple label="Interval" value={adj.inset.interval} onChange={(v)=>setAdjField('inset','interval',v)} />
                <FieldTriple label="Rate"     value={adj.inset.rate}     onChange={(v)=>setAdjField('inset','rate',v)} />
              </div>

              {!/corbel/i.test(fProduct) && (
                <div className="border rounded p-3">
                  <h3 className="font-semibold mb-2">Skirt</h3>
                  <FieldTriple label="Standard" value={adj.skirt.standard} onChange={(v)=>setAdjField('skirt','standard',v)} />
                  <FieldTriple label="Interval" value={adj.skirt.interval} onChange={(v)=>setAdjField('skirt','interval',v)} />
                  <FieldTriple label="Rate"     value={adj.skirt.rate}     onChange={(v)=>setAdjField('skirt','rate',v)} />
                </div>
              )}

              <div className="border rounded p-3 md:col-span-2">
                <h3 className="font-semibold mb-2">Pitch</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Below" value={adj.pitch.below} onChange={(v)=>setAdjField('pitch','below',v)} />
                  <Field label="Above" value={adj.pitch.above} onChange={(v)=>setAdjField('pitch','above',v)} />
                </div>
              </div>

              {/corbel/i.test(fProduct) && (
                <div className="border rounded p-3 md:col-span-2">
                  <h3 className="font-semibold mb-2">Corbel (&gt; 9) add</h3>
                  <Field
                    label="Add to factor when inset + overhang + skirt &gt; 9"
                    value={adj.corbel}
                    onChange={(v)=>setAdjScalar('corbel', v)}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={resetAdjustments} disabled={!fProduct} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">Reset Adjustments</button>
              <button onClick={updateFactorAndAdjustments} disabled={!fProduct || newFactor === ""} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Save Factor &amp; Adjustments</button>
            </div>
          </section>
        )}

        {/* ================= Shrouds Tab ================= */}
        {tab === "shrouds" && (
          <section className="bg-white rounded-xl shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Shroud Price Editor</h2>
              <button onClick={loadShrouds} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" disabled={loadingShrouds}>
                {loadingShrouds ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {shroudErr && <div className="text-red-600 text-sm">{shroudErr}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select className="border rounded p-2" value={metal} onChange={(e) => { setMetal(e.target.value); setProduct(e.target.value ? "" : ""); setSize(""); }}>
                <option value="">Select Metal</option>
                {Object.keys(shroudData || {}).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>

              <select className="border rounded p-2" value={product} onChange={(e) => { setProduct(e.target.value); setSize(""); }} disabled={!metal}>
                <option value="">{metal ? "Select Product" : "Select metal first"}</option>
                {(metal ? Object.keys(productRootForMetal(shroudData[metal]) || {}).filter((k) => !META_KEYS.has(k)) : []).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>

              <select className="border rounded p-2" value={size} onChange={(e) => setSize(e.target.value)} disabled={!product}>
                <option value="">{product ? "Select Size" : "Select product first"}</option>
                {Object.keys((metal && product) ? sizeRootForProduct(productRootForMetal(shroudData[metal])[product]) || {} : {}).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded p-3 bg-gray-50">
                <div className="text-sm text-gray-600">Current Price</div>
                <div className="text-2xl font-semibold">{currentPrice !== null ? `$${Number(currentPrice).toFixed(2)}` : "—"}</div>
              </div>

              <div className="border rounded p-3">
                <label className="block text-sm mb-1">New Price</label>
                <input type="number" step="0.01" className="w-full border rounded p-2" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} disabled={!size} />
                <button onClick={updateShroudPrice} disabled={!size || !newPrice} className="mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                  Update Price
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================= Chase Tab (new) ================= */}
        {tab === "chase" && (
          <section className="bg-white rounded-xl shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Chase Cover Editor</h2>
              <button onClick={loadChase} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" disabled={loadingChase}>
                {loadingChase ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {chaseErr && <div className="text-red-600 text-sm">{chaseErr}</div>}

            {/* price grid selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select className="border rounded p-2" value={cTier} onChange={(e)=>{ setCTier(e.target.value); setCMetal(""); setCSize(""); }}>
                <option value="">Select Tier</option>
                {chaseTiers.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <select className="border rounded p-2" value={cMetal} onChange={(e)=>{ setCMetal(e.target.value); setCSize(""); }} disabled={!cTier}>
                <option value="">{cTier ? "Select Metal" : "Select tier first"}</option>
                {chaseMetals.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>

              <select className="border rounded p-2" value={cSize} onChange={(e)=>setCSize(e.target.value)} disabled={!cMetal}>
                <option value="">{cMetal ? "Select Size" : "Select metal first"}</option>
                {chaseSizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* current/new price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded p-3 bg-gray-50">
                <div className="text-sm text-gray-600">Current Price</div>
                <div className="text-2xl font-semibold">{cCurrent !== null ? `$${Number(cCurrent).toFixed(2)}` : "—"}</div>
              </div>
              <div className="border rounded p-3">
                <label className="block text-sm mb-1">New Price</label>
                <input type="number" step="0.01" className="w-full border rounded p-2" value={cNew} onChange={(e)=>setCNew(e.target.value)} disabled={!cSize} />
                <button onClick={updateChasePrice} disabled={!cSize || !cNew} className="mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                  Update Price
                </button>
              </div>
            </div>

            {/* add-ons editor */}
            <div className="border rounded p-4">
              <h3 className="font-semibold mb-3">Add-ons</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <h4 className="font-semibold mb-2">Per-Hole Charge</h4>
                  <Field label="Black/Kynar" value={addonHBK} onChange={setAddonHBK} />
                  <Field label="Stainless"   value={addonHSS} onChange={setAddonHSS} />
                </div>
                <div className="border rounded p-3">
                  <h4 className="font-semibold mb-2">Unsquare Surcharge</h4>
                  <Field label="Black/Kynar" value={addonUBK} onChange={setAddonUBK} />
                  <Field label="Stainless"   value={addonUSS} onChange={setAddonUSS} />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={saveChaseAddons} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Save Add-ons</button>
              </div>
            </div>
          </section>
        )}

        {/* ================= Tiers Tab ================= */}
        {tab === "tiers" && (
          <section className="bg-white rounded-xl shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tier Pricing Factors</h2>
              <button onClick={loadTiers} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" disabled={loadingTiers}>
                {loadingTiers ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {tiersErr && <div className="text-red-600 text-sm">{tiersErr}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select className="border rounded p-2" value={tierKey} onChange={(e) => setTierKey(e.target.value)}>
                <option value="">Select Tier</option>
                {tiers && Object.keys(tiers).sort().map((k) => (<option key={k} value={k}>{k}</option>))}
              </select>

              <div className="border rounded p-2 bg-gray-50 flex items-center">
                <div className="text-sm text-gray-600">Current:&nbsp;</div>
                <div className="font-semibold">{tierCurrent ?? "—"}</div>
              </div>

              <div className="border rounded p-2">
                <label className="block text-sm mb-1">New Factor</label>
                <input type="number" step="0.01" className="w-full border rounded p-2" value={tierNew} onChange={(e) => setTierNew(e.target.value)} disabled={!tierKey} />
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={updateTier} disabled={!tierKey || tierNew === ""} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                Save Tier
              </button>
            </div>
          </section>
        )}

        {/* ================= Announcements Tab ================= */}
        {tab === "announcements" && (
          <section className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Announcements</h2>
              <button onClick={loadAnns} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" disabled={loadingAnns}>
                {loadingAnns ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mb-3">
              <textarea rows={3} className="w-full border rounded p-2" placeholder="Type announcement…" value={newAnn} onChange={(e) => setNewAnn(e.target.value)} />
              {addErr && <div className="text-red-600 text-sm mt-1">{addErr}</div>}
              <div className="mt-2 flex justify-end">
                <button onClick={addAnnouncement} disabled={adding} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                  {adding ? "Posting…" : "Post Announcement"}
                </button>
              </div>
            </div>

            {annsErr ? (
              <div className="text-red-600 text-sm">{annsErr}</div>
            ) : anns.length ? (
              <ul className="space-y-2">
                {anns.map((a) => (
                  <li key={a.id ?? a.text} className="bg-gray-50 border rounded p-2">
                    <div className="text-sm">{a.text}</div>
                    {a.createdAt && <div className="text-xs text-gray-500">{a.createdAt}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-600">No announcements.</div>
            )}
          </section>
        )}
      </div>

      {/* ======= Login Modal ======= */}
      {!currentUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <form onSubmit={signIn} className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Admin Sign In</h2>

            <input
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="Username"
              className="w-full p-2 border rounded mb-3"
              autoFocus
            />

            <div className="relative mb-3">
              <input
                type={showPw ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-2 border rounded pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                title={showPw ? "Hide" : "Show"}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>

            {loginError && (
              <div className="text-red-600 text-sm mb-3">{loginError}</div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full ${
                isLoggingIn ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              } text-white p-2 rounded`}
            >
              {isLoggingIn ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---------- tiny input helpers ---------- */
function Field({ label, value, onChange }) {
  // allow empty string while typing; parse when saving
  return (
    <label className="block">
      <span className="block text-sm">{label}</span>
      <input
        type="number"
        step="0.01"
        className="w-full border rounded p-2"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FieldTriple({ label, value, onChange }) {
  return <Field label={label} value={value} onChange={onChange} />;
}
