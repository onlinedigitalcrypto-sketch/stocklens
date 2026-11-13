// Finds the exact Groww stock page for a symbol, e.g. INFY.NS -> https://groww.in/stocks/infosys-ltd
// Groww has no public "open the order window" link, so the stock page (with its Buy button) is the closest direct target.
const { who } = require('./_auth');
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; StockLens/2.0)', Accept: 'application/json' };
const cache = new Map();

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const u = who(req);
  if (u.err) return res.status(u.err === 'setup' ? 503 : 401).json({ error: u.err });
  const base = String(req.query.symbol || '').trim().toUpperCase().replace(/\.(NS|BO)$/, '');
  if (!/^[A-Z0-9&\-]{1,20}$/.test(base)) return res.status(400).json({ error: 'Invalid symbol.' });
  if (cache.has(base)) return res.status(200).json({ url: cache.get(base) });
  try {
    const r = await fetch('https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=' + encodeURIComponent(base) + '&size=10',
      { headers: UA, signal: AbortSignal.timeout(7000) });
    const j = await r.json();
    const list = (j && (j.content || j.data || j.results)) || [];
    const stocks = list.filter(x => /stock/i.test(String(x.entity_type || x.type || '')) && (x.search_id || (x.company && x.company.search_id)));
    const code = x => String(x.nse_scrip_code || (x.company && x.company.nse_scrip_code) || x.symbol || '').toUpperCase();
    const hit = stocks.find(x => code(x) === base) || stocks[0];
    if (hit) {
      const url = 'https://groww.in/stocks/' + (hit.search_id || hit.company.search_id);
      cache.set(base, url);
      return res.status(200).json({ url });
    }
  } catch (e) { /* fall through */ }
  res.status(200).json({ url: null });
};
