// Shared access check. Owner code = full access; invite codes (name.expiry.signature) = guest access until they expire.
const crypto = require('crypto');
const secret = () => process.env.ACCESS_SECRET || process.env.OWNER_CODE || '';
const sig = (n, e) => crypto.createHmac('sha256', secret()).update(n + '.' + e).digest('hex').slice(0, 20);
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function who(req) {
  const owner = process.env.OWNER_CODE;
  if (!owner) return { err: 'setup' };
  const c = String((req.headers && req.headers['x-code']) || '').trim();
  if (!c) return { err: 'denied' };
  if (eq(c, owner)) return { role: 'owner', name: 'Owner' };
  const m = c.split('.');
  if (m.length === 3) {
    const [n, e, s] = m, revoked = (process.env.REVOKED || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
    if (Number(e) > Date.now() / 1000 && eq(s, sig(n, e)) && !revoked.includes(n.toLowerCase())) return { role: 'guest', name: n };
  }
  return { err: 'denied' };
}
module.exports = { who, sig };
