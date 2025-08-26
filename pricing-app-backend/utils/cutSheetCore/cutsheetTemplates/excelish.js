// cutsheetTemplates/excelish.js
// Generic “Excel-look” renderer that accepts a schema and outputs HTML.

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/**
 * data schema:
 * {
 *   title: "HHT DYNASTY",
 *   linkText: "RETURN TO INDEX", linkHref:"#",
 *   meta: { job, customer, date },
 *   left: [
 *     { label:"LENGTH", value:"53 5/8" },
 *     { label:"WIDTH", value:"35 1/4" },
 *     { label:"HEIGHT", value:"17" },
 *     { note:"HHT DYNASTY HEIGHT IS 17\"" }, // optional full-width note row
 *     { label:"SKIRT", value:"5 1/2" },
 *     ...
 *   ],
 *   sections: [
 *     {
 *       title:"CHASE COVER",
 *       rows:[ { L:"66 5/8", W:"48 1/4", cnc:"CNC" } ] // single row
 *     },
 *     {
 *       title:"SHROUD",
 *       header: ["", "QTY", "L", "x", "W", "CNC"],
 *       rows: [
 *         { label:"LONG PANEL:", qty:"2", L:"56", W:"19 3/4", cnc:"CNC" },
 *         { label:"SHORT PANEL:", qty:"2", L:"36 1/4", W:"19 3/4", cnc:"CNC" },
 *         { label:"LEGS:", qty:"4", L:"15 1/2", W:"6" },
 *         { label:"BRACE:", qty:"1", L:"26 1/2", W:"11", cnc:"CNC" }
 *       ]
 *     },
 *     // Optional sections for RIBS and/or LAMONS BANDS:
 *     {
 *       title:"RIBS",
 *       header:["", "QTY", "L", "x", "W", "CNC"],
 *       rows:[ { label:"RIB:", qty:"4", L:"20", W:"1", cnc:"CNC" } ]
 *     },
 *     {
 *       title:"LAMONS BANDS",
 *       header:["", "QTY", "L", "x", "W", "CNC"],
 *       rows:[ { label:"BAND:", qty:"2", L:"48", W:"1 1/2", cnc:"CNC" } ]
 *     }
 *   ]
 * }
 */
module.exports = function renderExcelish(data) {
  const d = {
    title: 'CUT SHEET',
    linkText: 'RETURN TO INDEX',
    linkHref: '#',
    meta: { date: new Date().toLocaleDateString() },
    left: [],
    sections: [],
    ...data
  };

  const leftRows = d.left.map(item => {
    if (item.note) {
      return `<tr><th colspan="2" style="font-style:italic;color:#4b5563;background:#eef2ff;text-align:center;">${esc(item.note)}</th></tr>`;
    }
    return `<tr><th>${esc(item.label || '')}</th><td class="val">${esc(item.value || '')}</td></tr>`;
  }).join('');

  const sectionBlocks = d.sections.map(sec => {
    if (sec.title.toUpperCase() === 'CHASE COVER') {
      // Compact single-row layout like screenshot
      const r = sec.rows?.[0] || {};
      return `
        <h3>${esc(sec.title)}:</h3>
        <table>
          <tr>
            <td class="dim">${esc(r.L || '')}</td>
            <td class="x">x</td>
            <td class="dim">${esc(r.W || '')}</td>
            <td class="cnc">${esc(r.cnc || '')}</td>
          </tr>
        </table>
      `;
    }

    // Generic table for SHROUD / RIBS / LAMONS BANDS
    const head = sec.header?.length
      ? `<thead><tr>${sec.header.map((h,i) => `<th class="${['','qty','dim','x','dim','cnc'][i]||''}">${esc(h)}</th>`).join('')}</tr></thead>`
      : '';
    const body = (sec.rows||[]).map(r => `
      <tr>
        <th>${esc(r.label || '')}</th>
        <td class="qty">${esc(r.qty || '')}</td>
        <td class="dim">${esc(r.L || '')}</td>
        <td class="x">x</td>
        <td class="dim">${esc(r.W || '')}</td>
        <td class="cnc">${esc(r.cnc || '')}</td>
      </tr>
    `).join('');

    return `
      <h3 ${sec.title==='SHROUD' ? 'style="text-align:center;"' : ''}>${esc(sec.title)}</h3>
      <table>${head}<tbody>${body}</tbody></table>
    `;
  }).join('');

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(d.title)} – Cut Sheet</title>
<style>
  @page { size: Letter; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; }
  a { color: #2a6edb; text-decoration: none; }
  .topbar { font-size: 11px; margin-bottom: 6px; }
  .title { text-align:center; font-size: 20px; font-weight: 700; margin: 6px 0 10px; }

  .grid { display: grid; grid-template-columns: 320px 24px 1fr; gap: 0px; }
  .left, .right { border: 1px solid #d0d0d0; padding: 8px; }
  .left table, .right table { width:100%; border-collapse: collapse; }
  .left th, .left td, .right th, .right td { border:1px solid #d0d0d0; padding:6px 8px; font-size: 12px; }
  .left th { width: 55%; text-align:left; background:#f5f7fb; }
  .left td.val { background:#0ea5e9; color:white; font-weight:600; text-align:center; }
  .sectionTitle { text-transform: uppercase; letter-spacing: .5px; font-weight: 700; font-size: 12px; color:#444; }
  .spacer { width:24px; }

  .right h3 { margin: 10px 0 6px; font-size: 12px; color:#444; letter-spacing:.5px; }
  .x { text-align:center; width: 24px; opacity:.8; }

  .qty { width: 40px; text-align:center; }
  .dim { width: 110px; text-align:center; }
  .cnc { width: 60px; color:#c53030; font-weight:700; text-align:center; }

  .meta { margin-top: 10px; font-size: 11px; color:#555; display:flex; gap:16px; }
  .badge { border:1px solid #888; border-radius:4px; padding:1px 6px; font-size: 10px; }
</style>
</head>
<body>

<div class="topbar"><a href="${esc(d.linkHref)}">${esc(d.linkText || 'RETURN TO INDEX')}</a></div>
<div class="title">${esc(d.title)}</div>

<div class="grid">
  <div class="left">
    <table>${leftRows}</table>
  </div>
  <div class="spacer"></div>
  <div class="right">
    ${sectionBlocks}
    <div class="meta">
      ${d.meta?.job ? `<div><span class="badge">Job</span> ${esc(d.meta.job)}</div>` : ''}
      ${d.meta?.customer ? `<div><span class="badge">Customer</span> ${esc(d.meta.customer)}</div>` : ''}
      <div><span class="badge">Date</span> ${esc(d.meta?.date || '')}</div>
    </div>
  </div>
</div>

</body>
</html>
`;
}
