// routes/cutsheet.js
const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');

/** ---------- helpers: rounding & fractions to 1/16" ---------- **/
function roundToSixteenth(inches) {
  const n = Math.round(inches * 16);
  return n / 16;
}
function toMixedFraction(inches) {
  // Handles negatives, integers, and 1/16 steps
  const sign = inches < 0 ? -1 : 1;
  const abs = Math.abs(inches);
  const whole = Math.floor(abs);
  const frac = Math.round((abs - whole) * 16); // 0..16
  if (frac === 0) return `${sign < 0 ? '-' : ''}${whole}"`;
  if (frac === 16) return `${sign < 0 ? '-' : ''}${whole + 1}"`;
  // Reduce fraction
  const g = gcd(frac, 16);
  return `${sign < 0 ? '-' : ''}${whole ? whole + ' ' : ''}${frac / g}/${16 / g}"`;
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/** ---------- product-specific rule hook (start simple) ---------- **/
function computeCutList(product, input) {
  // input fields assumed: L, W, S, overhang, metalKey, pitch, etc.
  // Return a normalized object: panels, notes, metadata for template.
  // This is a stub for Chase Cover; we can add other products next.

  if (product === 'chase_cover') {
    const { L, W, S, overhang = 1.0, metalKey = 'kynar' } = input;

    // Example rules (adjust to your real ones):
    // Lid size = (L + 2*overhang) x (W + 2*overhang)
    // Skirt height = S
    // Hem allowance 0.5" each side (example), bend radii ignored here.
    const lidL = roundToSixteenth(L + 2 * overhang);
    const lidW = roundToSixteenth(W + 2 * overhang);

    const hemAllowance = 0.5; // per edge
    const flatL = roundToSixteenth(lidL + 2 * hemAllowance);
    const flatW = roundToSixteenth(lidW + 2 * hemAllowance);

    const panels = [
      {
        name: 'Lid (flat before hems)',
        qty: 1,
        dims: `${toMixedFraction(flatL)} x ${toMixedFraction(flatW)}`
      },
      {
        name: 'Skirt (perimeter)',
        qty: 1,
        dims: `Perimeter cut for skirt height ${toMixedFraction(S)}`
      }
    ];

    const notes = [
      `Metal: ${metalKey.toUpperCase()}`,
      `Overhang: ${toMixedFraction(overhang)}`,
      `All dimensions rounded to nearest 1/16".`,
    ];

    return {
      productLabel: 'Chase Cover',
      panels,
      summary: {
        L: toMixedFraction(L),
        W: toMixedFraction(W),
        S: toMixedFraction(S),
        overhang: toMixedFraction(overhang),
      },
      notes
    };
  }

  // Placeholder for future products (shroud, cricket, etc.)
  throw new Error(`Unknown product '${product}'`);
}

/** ---------- HTML template (keep it inline for now) ---------- **/
function renderHTML({ company, order, cut }) {
  const css = `
    <style>
      @page { size: Letter; margin: 24mm; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }
      h1 { font-size: 20px; margin: 0 0 8px; }
      h2 { font-size: 16px; margin: 16px 0 8px; }
      .header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ddd; padding-bottom:8px; margin-bottom:12px; }
      .meta { font-size: 12px; }
      table { width:100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border:1px solid #ccc; padding:6px; text-align:left; font-size: 12px; }
      .notes { margin-top: 12px; }
      .badge { display:inline-block; padding:2px 6px; border:1px solid #888; border-radius:4px; font-size: 11px; }
    </style>
  `;
  const panelsRows = cut.panels.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.qty}</td>
      <td>${p.dims}</td>
    </tr>
  `).join('');

  const notesList = cut.notes.map(n => `<li>${n}</li>`).join('');

  return `
    <html>
    <head><meta charset="utf-8">${css}</head>
    <body>
      <div class="header">
        <div>
          <h1>${company?.name || 'CCS Elite Fab'} — Cut Sheet</h1>
          <div class="meta">
            <div>Product: <span class="badge">${cut.productLabel}</span></div>
            <div>Job #: ${order?.jobNumber || '-'}</div>
            <div>Customer: ${order?.customer || '-'}</div>
            <div>Date: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>
        ${company?.logoUrl ? `<img src="${company.logoUrl}" alt="logo" style="max-height:60px">` : ''}
      </div>

      <h2>Summary</h2>
      <table>
        <tr><th>Length</th><td>${cut.summary.L}</td></tr>
        <tr><th>Width</th><td>${cut.summary.W}</td></tr>
        <tr><th>Skirt</th><td>${cut.summary.S}</td></tr>
        <tr><th>Overhang</th><td>${cut.summary.overhang}</td></tr>
      </table>

      <h2>Panels</h2>
      <table>
        <thead><tr><th>Name</th><th>Qty</th><th>Dimensions</th></tr></thead>
        <tbody>${panelsRows}</tbody>
      </table>

      <div class="notes">
        <h2>Notes</h2>
        <ul>${notesList}</ul>
      </div>
    </body>
    </html>
  `;
}

/** ---------- route: POST /api/cutsheet/:product → PDF ---------- **/
router.post('/cutsheet/:product', async (req, res) => {
  try {
    const product = req.params.product; // e.g., 'chase_cover'
    const { order = {}, input = {}, company = {} } = req.body;

    const cut = computeCutList(product, input);
    const html = renderHTML({ company, order, cut });

    const browser = await puppeteer.launch({
      // Consider { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' } if corp policy blocks Chromium
      headless: 'new',
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${product}-cutsheet.pdf"`);
    return res.send(pdf);
  } catch (err) {
    console.error('cutsheet_error', err);
    return res.status(400).json({ error: 'Failed to generate cut sheet', details: err.message });
  }
});

module.exports = router;
