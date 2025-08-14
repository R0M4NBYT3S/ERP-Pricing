// src/components/AnnouncementBar.jsx
import React, { useEffect, useState } from "react";
import { API_BASE } from "../config/api";

export default function AnnouncementBar() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/announcements`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
    } catch {
      setError("Announcements unavailable");
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  if (error || items.length === 0) return null;
  const latest = items[items.length - 1];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-blue-100 border-t border-blue-300 text-blue-900 z-50">
      <div className="max-w-5xl mx-auto px-4 py-2 text-sm text-center">
        <strong>Announcement:</strong> {latest.text}
      </div>
    </div>
  );
}
