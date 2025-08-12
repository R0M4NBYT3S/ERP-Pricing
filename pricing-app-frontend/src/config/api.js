// src/config/api.js
export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "/api";

export const ADMIN_BASE = `${API_BASE}/admin`;

// Admin UI should post here to match routes/admin.js mounting
export const ANNOUNCE_BASE = `${ADMIN_BASE}/announcements`;
