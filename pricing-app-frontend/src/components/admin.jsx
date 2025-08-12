import React, { useEffect, useState } from "react";
import { ADMIN_BASE, ANNOUNCE_BASE } from "../config/api";

function Admin() {
  const [tab, setTab] = useState("multi");

  // ---------- Auth ----------
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("adminUser") || ""
  );
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const signIn = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch(`${ADMIN_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed");
      const user = data.user || loginUsername;
      setCurrentUser(user);
      localStorage.setItem("adminUser", user);
      setLoginPassword("");
    } catch (err) {
      setLoginError(
        err.message.includes("Failed to fetch")
          ? "Unable to reach server"
          : err.message
      );
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

  // ---------- Multi-Flue ----------
  const defaultAdjustments = {
    screen: { standard: 0, interval: 0, rate: 0 },
    overhang: { standard: 0, interval: 0, rate: 0 },
    inset: { standard: 0, interval: 0, rate: 0 },
    skirt: { standard: 0, interval: 0, rate: 0 },
    pitch: { below: 0, above: 0 },
  };

  const [multiFactors, setMultiFactors] = useState({});
  const [multiMetal, setMultiMetal] = useState("");
  const [multiProduct, setMultiProduct] = useState("");
  const [factorVal, setFactorVal] = useState("");
  const [adjustments, setAdjustments] = useState(defaultAdjustments);

  // ---------- Shrouds ----------
  const [shroudData, setShroudData] = useState({});
  const [selectedMetal, setSelectedMetal] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [currentPrice, setCurrentPrice] = useState(null);
  const [newPrice, setNewPrice] = useState("");

  // ---------- Announcements ----------
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");

  // ---------- Load data when tab changes & user is signed in ----------
  useEffect(() => {
    if (!currentUser) return;

    if (tab === "multi") {
      fetch(`${ADMIN_BASE}/factors`)
        .then((r) => r.json())
        .then((data) => setMultiFactors(data || {}))
        .catch(() => setMultiFactors({}));
    } else if (tab === "shrouds") {
      fetch(`${ADMIN_BASE}/shrouds`)
        .then((r) => r.json())
        .then((data) => setShroudData(data || {}))
        .catch(() => setShroudData({}));
    } else if (tab === "announce") {
      fetch(`${ANNOUNCE_BASE}`)
        .then((r) => r.json())
        .then((data) => setAnnouncements(Array.isArray(data) ? data : []))
        .catch(() => setAnnouncements([]));
    }
  }, [tab, currentUser]);

  // ---------- Multi: sync selection -> inputs ----------
  useEffect(() => {
    if (multiMetal && multiProduct) {
      const entry = multiFactors[multiMetal]?.[multiProduct];
      if (entry) {
        setFactorVal(entry.factor ?? "");
        const clonedAdj = JSON.parse(
          JSON.stringify(entry.adjustments || defaultAdjustments)
        );
        setAdjustments(clonedAdj);
      } else {
        setFactorVal("");
        setAdjustments(JSON.parse(JSON.stringify(defaultAdjustments)));
      }
    } else {
      setFactorVal("");
      setAdjustments(JSON.parse(JSON.stringify(defaultAdjustments)));
    }
  }, [multiMetal, multiProduct, multiFactors]);

  // ---------- Shroud derived lists ----------
  const metals = Object.keys(shroudData || {});
  const productsForMetal = selectedMetal
    ? Object.keys(shroudData[selectedMetal] || {})
    : [];
  const sizesForProduct =
    selectedMetal && selectedProduct
      ? Object.keys(shroudData[selectedMetal]?.[selectedProduct] || {})
      : [];

  // Shroud: show current price & seed new price
  useEffect(() => {
    if (selectedMetal && selectedProduct && selectedSize) {
      const price =
        shroudData[selectedMetal]?.[selectedProduct]?.[selectedSize];
      setCurrentPrice(price ?? null);
      setNewPrice(price ?? "");
    }
  }, [selectedMetal, selectedProduct, selectedSize, shroudData]);

  // ---------- Actions ----------
  const handleShroudUpdate = async () => {
    if (!selectedMetal || !selectedProduct || !selectedSize || !newPrice) {
      alert("Please select all fields and enter a price.");
      return;
    }
    try {
      const res = await fetch(`${ADMIN_BASE}/shrouds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-User": currentUser, // audit header
        },
        body: JSON.stringify({
          metal: selectedMetal,
          product: selectedProduct,
          size: selectedSize,
          newPrice: parseFloat(newPrice),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || "Failed to update price.");
      }
      alert("Price updated!");
      const updated = await fetch(`${ADMIN_BASE}/shrouds`).then((r) => r.json());
      setShroudData(updated);
    } catch (err) {
      console.error("Error updating shroud price:", err);
      alert(err.message || "Error updating price.");
    }
  };

  const handleMultiUpdate = async () => {
    if (!multiMetal || !multiProduct) {
      alert("Please select metal and product.");
      return;
    }
    try {
      const res = await fetch(`${ADMIN_BASE}/factors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-User": currentUser, // audit header
        },
        body: JSON.stringify({
          metal: multiMetal,
          product: multiProduct,
          factor: parseFloat(factorVal),
          adjustments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!(data.success || res.ok)) throw new Error("Failed to update factor.");
      alert("Factor updated!");
      const updated = await fetch(`${ADMIN_BASE}/factors`).then((r) => r.json());
      setMultiFactors(updated);
    } catch (err) {
      console.error("Error updating factor:", err);
      alert(err.message || "Error updating factor.");
    }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.trim()) return;
    try {
      const res = await fetch(`${ANNOUNCE_BASE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-User": currentUser, // audit header
        },
        body: JSON.stringify({ text: newAnnouncement }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error("Failed to add announcement");
      const added = data.announcement;
      setAnnouncements((prev) => [...prev, added]);
      setNewAnnouncement("");
    } catch (err) {
      console.error("Error adding announcement:", err);
      alert(err.message || "Error adding announcement.");
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      const res = await fetch(`${ANNOUNCE_BASE}/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-User": currentUser }, // audit header
      });
      if (!res.ok) throw new Error("Failed to delete announcement");
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Error deleting announcement:", err);
      alert(err.message || "Error deleting announcement.");
    }
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen w-full bg-gray-100 flex flex-col items-center p-6 relative">
      <a
        href="/"
        className="mb-4 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm shadow-md"
      >
        ⬅ Back to Main
      </a>

      <div className="absolute top-6 right-6 text-sm">
        {currentUser ? (
          <div className="flex items-center space-x-2">
            <span className="text-gray-700">
              Signed in as <b>{currentUser}</b>
            </span>
            <button
              onClick={signOut}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>

      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${
            tab === "multi" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setTab("multi")}
        >
          Multi-Flue Factors
        </button>
        <button
          className={`px-4 py-2 rounded ${
            tab === "shrouds" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setTab("shrouds")}
        >
          Shroud Pricing
        </button>
        <button
          className={`px-4 py-2 rounded ${
            tab === "chase" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setTab("chase")}
        >
          Chase Covers
        </button>
        <button
          className={`px-4 py-2 rounded ${
            tab === "announce" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setTab("announce")}
        >
          Announcements
        </button>
      </div>

      {/* Multi-Flue Tab */}
      {tab === "multi" && (
        <div className="w-full max-w-xl bg-white shadow rounded p-6">
          <h2 className="text-xl font-semibold mb-4">Multi-Flue Factor Editor</h2>

          <label className="block mb-2">Metal Type</label>
          <select
            value={multiMetal}
            onChange={(e) => {
              setMultiMetal(e.target.value);
              setMultiProduct("");
            }}
            className="w-full p-2 border rounded mb-4"
          >
            <option value="">Select Metal</option>
            {Object.keys(multiFactors || {}).map((metal) => (
              <option key={metal} value={metal}>
                {metal}
              </option>
            ))}
          </select>

          <label className="block mb-2">Product</label>
          <select
            value={multiProduct}
            onChange={(e) => setMultiProduct(e.target.value)}
            className="w-full p-2 border rounded mb-4"
            disabled={!multiMetal}
          >
            <option value="">Select Product</option>
            {multiMetal &&
              Object.keys(multiFactors[multiMetal] || {}).map((prod) => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
          </select>

          {multiMetal && multiProduct && (
            <>
              <label className="block mb-2">Factor</label>
              <input
                type="number"
                step="0.01"
                value={factorVal}
                onChange={(e) => setFactorVal(e.target.value)}
                className="w-full p-2 border rounded mb-4"
              />

              <h3 className="text-lg font-semibold mb-2">Adjustments</h3>

              {/* Screen */}
              <div className="mb-4">
                <p className="font-semibold mb-2">Screen</p>
                <label className="block text-sm mb-1">Standard</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.screen.standard}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      screen: {
                        ...prev.screen,
                        standard: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Interval</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.screen.interval}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      screen: {
                        ...prev.screen,
                        interval: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.screen.rate}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      screen: {
                        ...prev.screen,
                        rate: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded"
                />
              </div>

              {/* Overhang */}
              <div className="mb-4">
                <p className="font-semibold mb-2">Overhang</p>
                <label className="block text-sm mb-1">Standard</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.overhang.standard}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      overhang: {
                        ...prev.overhang,
                        standard: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Interval</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.overhang.interval}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      overhang: {
                        ...prev.overhang,
                        interval: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.overhang.rate}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      overhang: {
                        ...prev.overhang,
                        rate: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded"
                />
              </div>

              {/* Inset */}
              <div className="mb-4">
                <p className="font-semibold mb-2">Inset</p>
                <label className="block text-sm mb-1">Standard</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.inset.standard}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      inset: {
                        ...prev.inset,
                        standard: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Interval</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.inset.interval}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      inset: {
                        ...prev.inset,
                        interval: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.inset.rate}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      inset: {
                        ...prev.inset,
                        rate: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded"
                />
              </div>

              {/* Skirt */}
              <div className="mb-4">
                <p className="font-semibold mb-2">Skirt</p>
                <label className="block text-sm mb-1">Standard</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.skirt.standard}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      skirt: {
                        ...prev.skirt,
                        standard: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Interval</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.skirt.interval}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      skirt: {
                        ...prev.skirt,
                        interval: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.skirt.rate}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      skirt: {
                        ...prev.skirt,
                        rate: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded"
                />
              </div>

              {/* Pitch */}
              <div className="mb-4">
                <p className="font-semibold mb-2">Pitch</p>
                <label className="block text-sm mb-1">Below</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.pitch.below}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      pitch: {
                        ...prev.pitch,
                        below: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded mb-2"
                />
                <label className="block text-sm mb-1">Above</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustments.pitch.above}
                  onChange={(e) =>
                    setAdjustments((prev) => ({
                      ...prev,
                      pitch: {
                        ...prev.pitch,
                        above: parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="w-full p-2 border rounded"
                />
              </div>

              <button
                onClick={handleMultiUpdate}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                Update Factor
              </button>
            </>
          )}
        </div>
      )}

      {/* Shroud Tab */}
      {tab === "shrouds" && (
        <div className="w-full max-w-xl bg-white shadow rounded p-6">
          <h2 className="text-xl font-semibold mb-4">Shroud Price Editor</h2>

          <label className="block mb-2">Metal Type</label>
          <select
            value={selectedMetal}
            onChange={(e) => {
              setSelectedMetal(e.target.value);
              setSelectedProduct("");
              setSelectedSize("");
            }}
            className="w-full p-2 border rounded mb-4"
          >
            <option value="">Select Metal</option>
            {metals.map((metal) => (
              <option key={metal} value={metal}>
                {metal}
              </option>
            ))}
          </select>

          <label className="block mb-2">Product</label>
          <select
            value={selectedProduct}
            onChange={(e) => {
              setSelectedProduct(e.target.value);
              setSelectedSize("");
            }}
            className="w-full p-2 border rounded mb-4"
            disabled={!selectedMetal}
          >
            <option value="">Select Product</option>
            {productsForMetal.map((prod) => (
              <option key={prod} value={prod}>
                {prod}
              </option>
            ))}
          </select>

          <label className="block mb-2">Size</label>
          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            className="w-full p-2 border rounded mb-4"
            disabled={!selectedProduct}
          >
            <option value="">Select Size</option>
            {sizesForProduct.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          {selectedSize && (
            <div className="mb-4">
              <p className="mb-2">
                Current Price:{" "}
                <span className="font-bold">
                  {currentPrice !== null ? `$${currentPrice}` : "N/A"}
                </span>
              </p>
              <input
                type="number"
                step="0.01"
                placeholder="Enter New Price"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
          )}

          <button
            onClick={handleShroudUpdate}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            Update Price
          </button>
        </div>
      )}

      {/* Chase placeholder */}
      {tab === "chase" && (
        <div className="w-full max-w-xl bg-white shadow rounded p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Chase Cover Editor</h2>
          <p>Coming soon...</p>
        </div>
      )}

      {/* Announcements */}
      {tab === "announce" && (
        <div className="w-full max-w-xl bg-white shadow rounded p-6">
          <h2 className="text-xl font-semibold mb-4">Manage Announcements</h2>
          <ul className="mb-4">
            {announcements.length === 0 && (
              <li className="text-gray-500">No announcements found.</li>
            )}
            {announcements.map((ann) => (
              <li
                key={ann.id}
                className="flex justify-between items-center bg-gray-100 p-2 rounded mb-2"
              >
                <span>{ann.text}</span>
                <button
                  onClick={() => handleDeleteAnnouncement(ann.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <label className="block mb-2">New Announcement</label>
          <textarea
            value={newAnnouncement}
            onChange={(e) => setNewAnnouncement(e.target.value)}
            className="w-full p-2 border rounded mb-4"
            rows={3}
            placeholder="Enter announcement message"
          />
          <button
            onClick={handleAddAnnouncement}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            Add Announcement
          </button>
        </div>
      )}

      {/* ---------- Login Modal ---------- */}
      {!currentUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <form
            onSubmit={signIn}
            className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md"
          >
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

export default Admin;
