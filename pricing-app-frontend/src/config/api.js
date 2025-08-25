// src/config/api.js
const env = import.meta?.env || {};
const fromEnv = (env.VITE_API_BASE ?? env.VITE_API_URL ?? '').trim();

// Fallback: same host as the frontend, port 3001 (works on LAN)
const FALLBACK =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001';

// Use env if it's a full URL, else fallback; normalize trailing slashes and /api
const raw = fromEnv && /^https?:\/\//i.test(fromEnv) ? fromEnv : FALLBACK;
const ORIGIN = raw.replace(/\/+$/, '').replace(/\/api$/,'');

export const API_BASE = ORIGIN;            // e.g. http://192.168.0.74:3001
export const API_ROOT = `${ORIGIN}/api`;   // e.g. http://192.168.0.74:3001/api
export const ADMIN_ROOT = `${API_ROOT}/admin`;
export const TIERS_ENDPOINT = `${ADMIN_ROOT}/tiers`;

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http')
    ? path
    : `${path.startsWith('/api') ? API_BASE : API_ROOT}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} → ${text || url}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
