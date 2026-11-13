// Vercel serverless function. Modes:
//   /api/stock?symbol=TCS.NS            full data (2y prices, fundamentals, profile, news)
//   /api/stock?symbol=TCS.NS&quote=1    fast live quote
//   /api/stock?q=tata                   company search (all listed companies)
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; StockLens/2.0)' };
const r2 = x => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);
const raw = o => (o && typeof o.raw === 'number' ? o.raw : null);
const pct = x => (x == null ? null : x * 100);
const dec = t => t.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

async function yget(path, h) {
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch('https://' + host + '.finance.yahoo.com' + path, { headers: h || UA, signal: AbortSignal.timeout(8000) });
      if (r.ok) return await r.json();
    } catch (e) { /* try next host */ }
  }
  return null;
}

async function fundamentals(s, out) {
  try {
    const a = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual', signal: AbortSignal.timeout(6000) });
    const ck = (a.headers.getSetCookie ? a.headers.getSetCookie() : [a.headers.get('set-cookie') || '']).map(x => x.split(';')[0]).join('; ');
    const h = { ...UA, Cookie: ck };
    const crumb = await (await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: h, signal: AbortSignal.timeout(6000) })).text();
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(s)}?modules=financialData,summaryDetail,assetProfile&crumb=${encodeURIComponent(crumb)}`;
    const m = (await (await fetch(url, { headers: h, signal: AbortSignal.timeout(8000) })).json()).quoteSummary.result[0];
    const fd = m.financialData || {}, sd = m.summaryDetail || {}, ap = m.assetProfile || {};
    const de = raw(fd.debtToEquity);
    const f = { pe: raw(sd.trailingPE) ?? raw(sd.forwardPE), roe: pct(raw(fd.returnOnEquity)), de: de == null ? null : de / 100,
      rg: pct(raw(fd.revenueGrowth)), pg: pct(raw(fd.earningsGrowth)), pm: pct(raw(fd.profitMargins)) };
    Object.keys(f).forEach(k => { if (f[k] == null || !isFinite(f[k])) delete f[k]; else f[k] = r2(f[k]); });
    out.fund = f;
    out.profile = { website: ap.website || null, sector: ap.sector || null, industry: ap.industry || null };
  } catch (e) { /* optional */ }
}

async function news(out) {
  try {
    const q = encodeURIComponent(out.name.replace(/\b(Limited|Ltd\.?|Inc\.?|Corporation|Corp\.?)\b/gi, '').trim() + ' share');
    const xml = await (await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`, { headers: UA, signal: AbortSignal.timeout(6000) })).text();
    out.news = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)].slice(0, 12).map(m => dec(m[1]));
  } catch (e) { /* optional */ }
}

module.exports = async (req, res) => {
  const { symbol, q, quote } = req.query;
  if (q !== undefined) {
    const t = String(q).trim().slice(0, 40);
    res.setHeader('Cache-Control', 's-maxage=3600');
    if (t.length < 2) return res.status(200).json({ results: [] });
    const j = await yget('/v1/finance/search?q=' + encodeURIComponent(t) + '&quotesCount=10&newsCount=0&listsCount=0');
    const results = ((j && j.quotes) || []).filter(x => x.symbol && ['EQUITY', 'ETF'].includes(x.quoteType))
      .map(x => ({ s: x.symbol, n: x.longname || x.shortname || x.symbol, e: x.exchDisp || x.exchange || '' }));
    return res.status(200).json({ results });
  }
  const s = String(symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.\-^=&]{1,20}$/.test(s)) return res.status(400).json({ error: 'Invalid symbol.' });
  try {
    if (quote) {
      res.setHeader('Cache-Control', 'no-store');
      const j = await yget('/v8/finance/chart/' + encodeURIComponent(s) + '?range=1d&interval=1m');
      const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
      if (!m || m.regularMarketPrice == null) return res.status(404).json({ error: 'No live quote.' });
      const pv = m.chartPreviousClose ?? m.previousClose ?? m.regularMarketPrice;
      return res.status(200).json({ price: r2(m.regularMarketPrice), prev: r2(pv), time: m.regularMarketTime, high: r2(m.regularMarketDayHigh),
        low: r2(m.regularMarketDayLow), w52h: r2(m.fiftyTwoWeekHigh), w52l: r2(m.fiftyTwoWeekLow), currency: m.currency });
    }
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    const j = await yget('/v8/finance/chart/' + encodeURIComponent(s) + '?range=2y&interval=1d');
    const c = j && j.chart && j.chart.result && j.chart.result[0];
    if (!c || !c.timestamp) return res.status(404).json({ error: 'No data for this symbol. Use the search suggestions (NSE ends in .NS, BSE in .BO), or try again in a minute.' });
    const q0 = c.indicators.quote[0], rows = [];
    c.timestamp.forEach((t, i) => {
      if (q0.close[i] == null) return;
      rows.push({ d: new Date(t * 1000).toISOString().slice(0, 10), o: r2(q0.open[i] ?? q0.close[i]), h: r2(q0.high[i] ?? q0.close[i]), l: r2(q0.low[i] ?? q0.close[i]), c: r2(q0.close[i]), v: q0.volume[i] || 0 });
    });
    const out = { symbol: s, name: c.meta.longName || c.meta.shortName || s, currency: c.meta.currency, exchange: c.meta.fullExchangeName || c.meta.exchangeName || '', rows, fund: {}, profile: {}, news: [] };
    await Promise.all([fundamentals(s, out), news(out)]);
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: 'Could not fetch data right now. Please try again in a minute.' });
  }
};
