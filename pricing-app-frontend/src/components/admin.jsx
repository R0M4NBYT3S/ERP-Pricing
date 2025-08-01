import React, { useEffect, useState } from "react";

const API_BASE = "http://192.168.0.73:3001/api/admin";

function Admin() {
  const [tab, setTab] = useState("multi");
  const [multiFactors, setMultiFactors] = useState({});
  const [shroudData, setShroudData] = useState({});
  // 🟦 State for Shroud tab
  const [selectedMetal, setSelectedMetal] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [currentPrice, setCurrentPrice] = useState(null);
  const [newPrice, setNewPrice] = useState("");

  // 🟦 State for Multi-Flue tab
  const [multiMetal, setMultiMetal] = useState("");
  const [multiProduct, setMultiProduct] = useState("");
  const [factorVal, setFactorVal] = useState("");
  // Default adjustments structure
  const defaultAdjustments = {
    screen: { standard: 0, interval: 0, rate: 0 },
    overhang: { standard: 0, interval: 0, rate: 0 },
    inset: { standard: 0, interval: 0, rate: 0 },
    skirt: { standard: 0, interval: 0, rate: 0 },
    pitch: { below: 0, above: 0 },
  };
  const [adjustments, setAdjustments] = useState(defaultAdjustments);

  // 🟧 State for Announcements tab
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");

  // ======== Load Data ========
  useEffect(() => {
    if (tab === "multi") {
      fetch(`${API_BASE}/factors`)
        .then((res) => res.json())
        .then((data) => setMultiFactors(data || {}))
        .catch(() => setMultiFactors({}));
    } else if (tab === "shrouds") {
      fetch(`${API_BASE}/shrouds`)
        .then((res) => res.json())
        .then((data) => {
          console.log("Shroud Data:", data);
          setShroudData(data || {});
        })
        .catch(() => setShroudData({}));
    } else if (tab === "announce") {
      fetch(`${API_BASE}/announcements`)
        .then((res) => res.json())
        .then((data) => setAnnouncements(Array.isArray(data) ? data : []))
        .catch(() => setAnnouncements([]));
    }
  }, [tab]);

  // Update factor and adjustments when selection changes in Multi tab
  useEffect(() => {
    if (multiMetal && multiProduct) {
      const entry = multiFactors[multiMetal]?.[multiProduct];
      if (entry) {
        setFactorVal(entry.factor ?? "");
        // Deep clone adjustments to avoid mutating state directly
        const clonedAdj = JSON.parse(JSON.stringify(entry.adjustments || defaultAdjustments));
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

  // ======== Handle Dropdowns ========
  const metals = Object.keys(shroudData || {});

  const productsForMetal = selectedMetal
    ? Object.keys(shroudData[selectedMetal] || {})
    : [];

  const sizesForProduct =
    selectedMetal && selectedProduct
      ? Object.keys(shroudData[selectedMetal]?.[selectedProduct] || {})
      : [];

  // Update current price when selection changes
  useEffect(() => {
    if (selectedMetal && selectedProduct && selectedSize) {
      const price = shroudData[selectedMetal]?.[selectedProduct]?.[selectedSize];
      setCurrentPrice(price ?? null);
      setNewPrice(price ?? "");
    }
  }, [selectedMetal, selectedProduct, selectedSize, shroudData]);

  // ======== Submit Shroud Price Update ========
  const handleShroudUpdate = async () => {
    if (!selectedMetal || !selectedProduct || !selectedSize || !newPrice) {
      alert("Please select all fields and enter a price.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/shrouds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metal: selectedMetal,
          product: selectedProduct,
          size: selectedSize,
          newPrice: parseFloat(newPrice),
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Price updated!");
        // Refresh shroud data
        const updated = await fetch(`${API_BASE}/shrouds`).then((r) => r.json());
        setShroudData(updated);
      } else {
        alert("Failed to update price.");
      }
    } catch (err) {
      console.error("Error updating shroud price:", err);
      alert("Error updating price.");
    }
  };

// ======== Submit Multi Factor Update ========
const handleMultiUpdate = async () => {
  if (!multiMetal || !multiProduct) {
    alert("Please select metal and product.");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/factors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metal: multiMetal,
        product: multiProduct,
        factor: parseFloat(factorVal),
        adjustments,
      }),
    });
    const data = await res.json();
    if (data.success) {
      alert("Factor updated!");
      const updated = await fetch(`${API_BASE}/factors`).then((r) => r.json());
      setMultiFactors(updated);
    } else {
      alert("Failed to update factor.");
    }
  } catch (err) {
    console.error("Error updating factor:", err);
    alert("Error updating factor.");
  }
};

// ======== Submit Announcement ========
const submitAnnouncement = async () => {
  if (!announcementText.trim()) {
    alert("Please enter a message first.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: announcementText }),
    });

    if (response.ok) {
      const liveRes = await fetch(`${API_BASE}/api/announcements/live`);
      const liveData = await liveRes.json();
      console.log("🔔 Live Announcement Set:", liveData);

      alert("✅ Live announcement updated!");
      setAnnouncementText("");
    } else {
      const data = await response.json();
      alert(`❌ Failed to save: ${data.error || response.statusText}`);
    }
  } catch (err) {
    console.error("🚨 Error saving announcement:", err);
    alert("Error saving announcement. Check console.");
  }
};

// ======== Delete Announcement ========
const handleDeleteAnnouncement = async (id) => {
  if (!window.confirm("Delete this announcement?")) return;
  try {
    const res = await fetch(`${API_BASE}/announcements/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) {
      alert("Announcement deleted!");
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } else {
      alert("Failed to delete announcement.");
    }
  } catch (err) {
    console.error("Error deleting announcement:", err);
    alert("Error deleting announcement.");
  }
};
  return (
    <div className="min-h-screen w-full bg-gray-100 flex flex-col items-center p-6">
      <a
        href="/"
        className="mb-4 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm shadow-md"
      >
        ⬅ Back to Main
      </a>

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

          {/* Metal Dropdown for Multi-Flue */}
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

          {/* Product Dropdown for Multi-Flue */}
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

          {/* Factor and Adjustments Inputs */}
          {multiMetal && multiProduct && (
            <>
              {/* Factor Input */}
              <label className="block mb-2">Factor</label>
              <input
                type="number"
                step="0.01"
                value={factorVal}
                onChange={(e) => setFactorVal(e.target.value)}
                className="w-full p-2 border rounded mb-4"
              />

              {/* Adjustments Inputs */}
              <h3 className="text-lg font-semibold mb-2">Adjustments</h3>
              {/* Screen adjustments */}
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

              {/* Overhang adjustments */}
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

              {/* Inset adjustments */}
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

              {/* Skirt adjustments */}
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

              {/* Pitch adjustments */}
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

          {/* Metal Dropdown */}
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

          {/* Product Dropdown */}
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

          {/* Size Dropdown */}
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

          {/* Current and New Price */}
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

      {tab === "chase" && (
        <div className="w-full max-w-xl bg-white shadow rounded p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Chase Cover Editor</h2>
          <p>Coming soon...</p>
        </div>
      )}

      {/* Announcements Tab */}
      {tab === "announce" && (
        <div className="w-full max-w-xl bg-white shadow rounded p-6">
          <h2 className="text-xl font-semibold mb-4">Manage Announcements</h2>
          {/* List existing announcements */}
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
          {/* Add new announcement */}
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
    </div>
  );
}

export default Admin;
