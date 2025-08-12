// jobs/dailySummary.js
const fs = require('fs');
const cron = require('node-cron');
const { logPathFor } = require('../utils/requestLogWriter');
const { sendEmail } = require('../utils/mailer');

function safeParse(line) {
  try { return JSON.parse(line); } catch { return null; }
}

function loadEntriesFor(dateStr) {
  const p = logPathFor(dateStr);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8');
  return raw.split('\n')
    .filter(Boolean)
    .map(safeParse)
    .filter(Boolean);
}

function summarize(entries) {
  const total = entries.length;
  const byProduct = {};
  const byTier = {};
  const failures = { total: 0, byReason: {}, examples: [] };

  for (const e of entries) {
    const product = e.product || 'n/a';
    const tier = e.tier || 'elite';
    byProduct[product] = (byProduct[product] || 0) + 1;
    byTier[tier] = (byTier[tier] || 0) + 1;

    if (e.failureReason) {
      failures.total += 1;
      failures.byReason[e.failureReason] = (failures.byReason[e.failureReason] || 0) + 1;
      if (failures.examples.length < 10) {
        failures.examples.push({
          ts: e.ts,
          path: e.path,
          tier: e.tier,
          product: e.product,
          metal: e.metal,
          status: e.status,
          reason: e.failureReason
        });
      }
    }
  }

  const sortDesc = obj => Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  return {
    total,
    byProduct: sortDesc(byProduct),
    byTier: sortDesc(byTier),
    failures
  };
}

function formatEmail(dateStr, s) {
  const lines = [];
  lines.push(`Daily Pricing Summary — ${dateStr}`);
  lines.push('--------------------------------------');
  lines.push(`Total requests: ${s.total}`);
  lines.push('');
  lines.push('By product:');
  for (const [k,v] of s.byProduct) lines.push(`  - ${k}: ${v}`);
  lines.push('');
  lines.push('By tier:');
  for (const [k,v] of s.byTier) lines.push(`  - ${k}: ${v}`);
  lines.push('');
  lines.push(`Failures: ${s.failures.total}`);
  for (const [k,v] of Object.entries(s.failures.byReason)) lines.push(`  - ${k}: ${v}`);
  if (s.failures.examples.length) {
    lines.push('');
    lines.push('Sample failures:');
    for (const ex of s.failures.examples) {
      lines.push(`  - [${ex.ts}] ${ex.tier} ${ex.product} ${ex.metal} ${ex.status} ${ex.reason} (${ex.path})`);
    }
  }
  lines.push('');
  lines.push('— Automated report');
  return lines.join('\n');
}

function isoDate(d = new Date()) {
  // Keep UTC to match log filenames (writer uses toISOString().slice(0,10))
  return d.toISOString().slice(0,10);
}

async function sendDailySummary(dateStr = isoDate(new Date())) {
  const entries = loadEntriesFor(dateStr);
  const summary = summarize(entries);
  const subject = `Pricing Summary ${dateStr} — ${summary.total} reqs, ${summary.failures.total} failures`;
  const text = formatEmail(dateStr, summary);
  await sendEmail({ subject, text });
  return { meta: { date: dateStr, total: summary.total, failures: summary.failures.total } };
}

function startDailySummaryJob() {
  // Run every day at 18:00 America/New_York
  cron.schedule('0 18 * * *', async () => {
    try {
      await sendDailySummary(isoDate(new Date()));
      console.log('📧 Daily summary processed.');
    } catch (err) {
      console.error('❌ Daily summary error:', err);
    }
  }, { timezone: 'America/New_York' });
}

module.exports = { startDailySummaryJob, sendDailySummary, loadEntriesFor, summarize };
