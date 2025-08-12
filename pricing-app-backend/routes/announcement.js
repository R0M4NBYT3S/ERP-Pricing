// routes/announcements.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const FILE = path.join(__dirname, "..", "config", "announcements.json");
function readAll() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } }
function writeAll(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

// list
router.get("/", (req, res) => { res.json(readAll()); });

// create
router.post("/", (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: "text required" });
  const all = readAll();
  const ann = { id: Date.now(), text: String(text).trim() };
  all.push(ann);
  writeAll(all);
  res.json({ success: true, announcement: ann });
});

// delete
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const all = readAll();
  const next = all.filter(a => a.id !== id);
  writeAll(next);
  res.json({ success: true });
});

module.exports = router;
