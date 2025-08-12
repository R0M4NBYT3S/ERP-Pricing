// utils/requestLogWriter.js
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function todayStamp(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function logPathFor(dateStr) {
  return path.join(LOG_DIR, `requests-${dateStr}.jsonl`);
}

function writeLog(entry) {
  const line = JSON.stringify(entry) + '\n';
  const p = logPathFor(todayStamp());
  fs.appendFile(p, line, (err) => {
    if (err) console.error('❌ Failed to write log:', err);
  });
}

module.exports = { writeLog, logPathFor, LOG_DIR };
