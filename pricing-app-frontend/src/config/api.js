// src/config/api.js
const fromEnv = import.meta?.env?.VITE_API_BASE?.trim();
const FALLBACK = `${window.location.protocol}//${window.location.hostname}:3001`;

const raw = fromEnv && /^https?:\/\//i.test(fromEnv) ? fromEnv : FALLBACK;

// Normalize: remove trailing slashes and a trailing "/api"
const ORIGIN = raw.replace(/\/+$/,'').replace(/\/api$/,'');

export const API_BASE = ORIGIN;            // e.g. http://localhost:3001
export const API_ROOT = `${ORIGIN}/api`;   // e.g. http://localhost:3001/api

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
