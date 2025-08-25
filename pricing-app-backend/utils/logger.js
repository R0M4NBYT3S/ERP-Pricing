// utils/logger.js
// Minimal, fast, leveled logger with request-scoped children, permanent pretty blocks,
// and machine-readable JSON lines.
//
// Env:
//   LOG_LEVEL=debug|info|warn|error|silent   (default: info)
//   LOG_HTTP=all                             (log all HTTP, else only 4xx/5xx)
//   LOG_EVENTS=multiflue,api_return          (only log these events; empty=all per level)
//   LOG_SAMPLE=0.15                          (sample ratio for debug-only events)
//   LOG_BLOCKS=0                             (disable human block rendering if set to 0)
//   LOG_PRETTY=1                             (optional: colors for one-line pretty mode; JSON unaffected)

const { randomUUID } = require('crypto');

// ── ANSI helpers (for pretty outputs) ───────────────────────────────────────────
const CC = { reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", gray: "\x1b[90m", red: "\x1b[31m", yellow: "\x1b[33m", blue: "\x1b[34m" };
const bold = s => CC.bold + s + CC.reset;
const dim  = s => CC.dim  + s + CC.reset;
const gray = s => CC.gray + s + CC.reset;

const ICON = { info:"ℹ️", warn:"⚠️", error:"🔥", debug:"🔎", http:"🔗", pin:"🧷", section:"🧩" };

// ── config ─────────────────────────────────────────────────────────────────────
const isTrue = v => /^(1|true|yes|on)$/i.test(String(v || ''));
const LEVELS = { debug:10, info:20, warn:30, error:40, silent:99 };
const blocksEnabled = String(process.env.LOG_BLOCKS || '1') !== '0'; // permanent blocks ON by default

function parseLevel(s) {
  return LEVELS[(s || '').toLowerCase()] ?? LEVELS.info;
}

function parseEvents(s) {
  return new Set(String(s || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean));
}

// ── core logger ────────────────────────────────────────────────────────────────
function createLogger(baseCtx = {}) {
  const prettyMode   = isTrue(process.env.LOG_PRETTY);
  const levelThresh  = parseLevel(process.env.LOG_LEVEL);
  const httpModeAll  = String(process.env.LOG_HTTP || '').toLowerCase() === 'all';
  const allowEvents  = parseEvents(process.env.LOG_EVENTS);
  const sampleRatio  = Math.max(0, Math.min(1, Number(process.env.LOG_SAMPLE || 0)));

  function should(level) {
    return LEVELS[level] >= levelThresh && levelThresh !== LEVELS.silent;
  }

  function shouldEvent(evtName, level) {
    if (!should(level)) return false;
    if (allowEvents.size && !allowEvents.has(evtName)) return false;
    if (level === 'debug' && sampleRatio && Math.random() > sampleRatio) return false;
    return true;
  }

function write(level, msg, data, ctx) {
  if (!should(level)) return;

  const record = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...baseCtx,
    ...(ctx || {}),
    ...(data || {})
  };

  if (process.env.LOG_MULTILINE === '1') {
    // force multi-line JSON output
    console.log(JSON.stringify(record, null, 2));
    return;
  }

  if (!prettyMode) {
    // current machine-readable single line
    console.log(JSON.stringify(record));
    return;
  }

    // pretty single-line (optional)
    const tag = level === 'error' ? CC.red + ICON.error + CC.reset
              : level === 'warn'  ? CC.yellow + ICON.warn + CC.reset
              : level === 'debug' ? CC.blue + ICON.debug + CC.reset
              : ICON.info;

    const keys = Object.entries({ ...baseCtx, ...(ctx || {}), ...(data || {}) })
      .filter(([,v]) => v !== undefined)
      .map(([k,v]) => `${gray(k + '=')}${String(v)}`)
      .join('  ');

    console.log(`${tag} ${bold(msg)} ${keys ? '  ' + dim('[' + keys + ']') : ''}`);
  }

  function child(bindings = {}) {
    const merged = { ...baseCtx, ...bindings };
    const c = createLogger(merged);
    c._inherit = true;
    return c;
  }

  // ── permanent human block helpers ────────────────────────────────────────────
  function prettyKV(obj) {
    const entries = Object.entries(obj || {});
    if (!entries.length) return '{}';
    const lines = entries.map(([k,v]) => `"${k}":${typeof v === 'string' ? `"${v}"` : String(v)}`);
    return `{\n  ${lines.join(',\n  ')}\n}`;
  }

  function printBlock(title, sections = []) {
    if (!blocksEnabled) return;
    console.log(CC.gray + '─'.repeat(72) + CC.reset);
    console.log(`${ICON.section} ${bold(title)}`);
    for (const { icon = ICON.pin, label, data } of sections) {
      console.log();
      console.log(`${icon} ${bold(label)}: ${prettyKV(data)}`);
    }
    console.log(CC.gray + '─'.repeat(72) + CC.reset);
  }

  // ── API ─────────────────────────────────────────────────────────────────────
  const api = {
    child,

    debug(msg, data, ctx) { write('debug', msg, data, ctx); },
    info (msg, data, ctx) { write('info',  msg, data, ctx); },
    warn (msg, data, ctx) { write('warn',  msg, data, ctx); },
    error(msg, data, ctx) { write('error', msg, data, ctx); },

    // Structured event helper (JSON always + optional permanent block for api_return)
    event(evtName, data = {}, level = 'info', ctx) {
      if (!shouldEvent(evtName, level)) return;

      // Always emit JSON for machines
      write(level, evtName, data, ctx);

      // Human block for API return
      if (evtName === 'api_return') {
        printBlock('API return', [
          { icon: '⏎', label: 'API return', data }
        ]);
      }
    },

    // Back-compat alias
    json(evtName, data = {}) {
      api.event(evtName, data, 'info');
    },

// Permanent block + JSON snapshot for multiflue (ALWAYS prints the block)
multiflue(payload) {
  const evt = 'multiflue_snapshot';

  // Emit one JSON line for machines at info level (so it survives LOG_LEVEL=info)
  if (shouldEvent(evt, 'info')) {
    write('info', evt, payload);
  }

  // Always print the human block (unless LOG_BLOCKS=0)
  const t  = payload?.tierResolved || {};
  const mf = payload?.multiflue || {};
  const td = payload?.tierData || {};
  const adj = payload?.adjustments || {};
  const ret = payload?.apiReturn || {};

  printBlock(
    `Tier resolved { incoming: '${t.incoming}', tierKey: '${t.tierKey}', tierMul: ${t.tierMul} }`,
    [
      { icon: '☑️', label: 'Multiflue',   data: { metal: mf.metal, product: mf.product } },
      { icon: ICON.pin, label: 'Tier Data', data: {
          base: td.base, tierKey: td.tierKey, tierMul: td.tierMul,
          deltaToTier: td.deltaToTier, tierMulAdj: td.tierMulAdj,
          tieredFactor: td.tieredFactor, final: td.final
        }},
      { icon: ICON.debug, label: 'Adjustments', data: adj },
      { icon: '⏎', label: 'API return', data: ret }
    ]
  );
},

    // Request-scoped HTTP middleware with req.id + req.log
    http() {
      return (req, res, next) => {
        const reqId = String(req.headers['x-request-id'] || randomUUID());
        res.setHeader('X-Request-Id', reqId);
        req.id = reqId;
        req.log = child({ reqId });

        const start = process.hrtime.bigint();
        res.on('finish', () => {
          const durMs = Number(process.hrtime.bigint() - start) / 1e6;
          const httpData = {
            method: req.method,
            path: req.originalUrl || req.url,
            status: res.statusCode,
            duration_ms: +durMs.toFixed(1)
          };
          if (httpModeAll || res.statusCode >= 400) {
            req.log.event('http', httpData, res.statusCode >= 500 ? 'error'
                                 : res.statusCode >= 400 ? 'warn'
                                 : 'info');
          }
        });

        next();
      };
    }
  };

  return api;
}

module.exports = { createLogger };
