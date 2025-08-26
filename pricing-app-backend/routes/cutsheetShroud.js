// routes/cutsheetShroud.js
console.info('[cutsheet] router loaded');


const express = require('express');
const puppeteer = require('puppeteer');
const renderExcelish = require('../utils/cutSheetCore/cutsheetTemplates/excelish');
const buildDynastySchema = require('../utils/cutSheetCore/cutSheetRules/dynasty');

const router = express.Router();

/**
 * POST /api/cutsheet/shroud
 * Body: { schema: <see excelish.js>, // OR
 *         productKey: "dynasty" | "majesty" | ... ,
 *         input: { ...numbers... } }
 *
 * For now we accept `schema` directly (preformatted strings).
 * Next pass: map (productKey,input) => schema via rules.
 */

router.get('/cutsheet/ping', (req, res) => res.json({ ok: true, where: 'cutsheet router' }));

router.post('/cutsheet/shroud', async (req, res) => {
  try {
    const { schema } = req.body;
    if (!schema) return res.status(400).json({ error: 'Missing schema' });

    const html = renderExcelish(schema);

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="CutSheet.pdf"');
    res.send(pdf);
  } catch (e) {
    console.error('cutsheet_shroud_error', e);
    res.status(400).json({ error: 'failed to render shroud cut sheet', details: e.message });
  }
});

module.exports = router;
