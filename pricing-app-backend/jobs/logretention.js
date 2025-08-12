// jobs/logRetention.js
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { LOG_DIR } = require('../utils/requestLogWriter');

function startLogRetentionJob() {
  const days = parseInt(process.env.LOG_RETENTION_DAYS || '60', 10);
  const msPerDay = 24 * 60 * 60 * 1000;

  // Run daily at 03:15 America/New_York
  cron.schedule('15 3 * * *', () => {
    try {
      if (!fs.existsSync(LOG_DIR)) return;
      const now = Date.now();
      const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('requests-') && f.endsWith('.jsonl'));

      let removed = 0;
      for (const f of files) {
        const dateStr = f.slice('requests-'.length, 'requests-'.length + 10); // YYYY-MM-DD
        const dt = new Date(`${dateStr}T00:00:00Z`).getTime();
        if (!Number.isFinite(dt)) continue;
        if (now - dt > days * msPerDay) {
          try {
            fs.unlinkSync(path.join(LOG_DIR, f));
            removed++;
          } catch (e) {
            console.warn('⚠️  Failed to remove old log:', f, e.message);
          }
        }
      }
      if (removed) console.log(`🧹 Log retention: removed ${removed} old log file(s).`);
    } catch (err) {
      console.error('❌ Log retention job error:', err);
    }
  }, { timezone: 'America/New_York' });
}

module.exports = startLogRetentionJob;
