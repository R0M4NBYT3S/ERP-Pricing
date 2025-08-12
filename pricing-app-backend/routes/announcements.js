// routes/announcements.js — robust + SSE /live + clear errors
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// TEMP DEBUG - remove once fixed
router.use((req, _res, next) => {
  if (req.method === 'POST' && req.originalUrl.includes('/announcements')) {
    console.log('DEBUG /announcements POST headers:', req.headers);
    console.log('DEBUG /announcements POST raw body:', req.body);
  }
  next();
});


// Store under /config/announcement.json (single source of truth)
const FILE = path.join(__dirname, "..", "config", "announcement.json");

// ---------- file helpers ----------
function readRaw() {
  try {
    const txt = fs.readFileSync(FILE, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}
function writeRaw(v) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(v, null, 2), "utf8");
}

// Normalize:
// - If file is { "message": "..." } -> convert to [{id,text}]
// - If file is [ {id,text}, ... ] -> passthrough
function readList() {
  const raw = readRaw();
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && typeof raw.message === "string") {
    return [{ id: Date.now(), text: raw.message }];
  }
  return [];
}

// ---------- SSE clients ----------
let clients = [];
function broadcastLatest() {
  const list = readList();
  const latest = list[list.length - 1] || null;
  const payload = latest ? { text: latest.text } : { text: "" };
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((res) => {
    try { res.write(msg); } catch {}
  });
}

// ---------- REST ----------
router.get("/", (_req, res) => {
  try {
    return res.json(readList());
  } catch (e) {
    console.error("GET /announcements error:", e);
    return res.status(500).json({ success: false, message: "Read failed" });
  }
});

router.post("/", (req, res) => {
  try {
    // Be ultra-tolerant about how text arrives
    let text =
      (req.body && (req.body.text ?? req.body.message)) ??
      (typeof req.body === "string" ? req.body : "");

    if (text != null) text = String(text).trim();
    if (!text) {
      // Helpful logging for debugging from devtools/Network tab
      console.warn("POST /announcements missing text. Body seen:", req.body);
      return res.status(400).json({ success: false, message: "text required" });
    }

    const list = readList();
    const ann = {
      id: Date.now(),
      text,
      by: req.get("X-Admin-User") || "admin",
      ts: Date.now(),
    };

    list.push(ann);
    writeRaw(list);

    // 201 Created + success flag (your Admin UI checks both)
    return res.status(201).json({ success: true, announcement: ann });
  } catch (e) {
    console.error("POST /announcements error:", e);
    return res.status(500).json({ success: false, message: "Write failed" });
  }
});


router.delete("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "bad id" });
    }
    const list = readList();
    const next = list.filter((a) => Number(a.id) !== id);
    if (next.length === list.length) {
      return res.status(404).json({ success: false, message: "not found" });
    }
    writeRaw(next);
    broadcastLatest();
    return res.json({ success: true });
  } catch (e) {
    console.error("DELETE /announcements/:id error:", e);
    return res.status(500).json({ success: false, message: "Delete failed" });
  }
});

// ---------- SSE (/api/announcements/live) ----------
router.get("/live", (req, res) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // send current immediately
    const list = readList();
    const latest = list[list.length - 1] || null;
    const payload = latest ? { text: latest.text } : { text: "" };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);

    clients.push(res);
    req.on("close", () => {
      clients = clients.filter((c) => c !== res);
      try { res.end(); } catch {}
    });
  } catch (e) {
    console.error("GET /announcements/live error:", e);
    // Can't change headers to JSON here, just end the stream
    try { res.end(); } catch {}
  }
});

module.exports = router;
