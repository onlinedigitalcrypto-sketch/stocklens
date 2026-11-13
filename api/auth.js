const { who, sig } = require('./_auth');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const u = who(req);
  if (u.err) return res.status(u.err === 'setup' ? 503 : 401).json({ error: u.err });
  if (req.query.action === 'invite') {
    if (u.role !== 'owner') return res.status(403).json({ error: 'Only the owner can create invites.' });
    const n = String(req.query.name || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
    const d = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);
    if (!n) return res.status(400).json({ error: 'Enter a name using letters and numbers.' });
    const e = Math.floor(Date.now() / 1000) + d * 86400;
    return res.status(200).json({ code: n + '.' + e + '.' + sig(n, e), name: n, expires: e });
  }
  res.status(200).json({ ok: true, role: u.role, name: u.name });
};
