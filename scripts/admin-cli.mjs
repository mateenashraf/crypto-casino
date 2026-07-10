#!/usr/bin/env node
/**
 * Operator CLI - approve/reject payouts via authenticated admin API.
 * Usage:
 *   NEONDRAW_ADMIN_KEY=secret node scripts/admin-cli.mjs pending
 *   NEONDRAW_ADMIN_KEY=secret node scripts/admin-cli.mjs approve <uuid>
 *   NEONDRAW_ADMIN_KEY=secret node scripts/admin-cli.mjs reject <uuid>
 */
const API = process.env.NEONDRAW_API || 'http://127.0.0.1:5080';
const KEY = process.env.NEONDRAW_ADMIN_KEY;

async function api(path, method = 'GET') {
  if (!KEY) {
    console.error('Set NEONDRAW_ADMIN_KEY');
    process.exit(1);
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'X-Admin-Key': KEY, Accept: 'application/json' },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    console.error(data.title || data.message || res.status);
    process.exit(1);
  }
  return data;
}

const [,, cmd, id] = process.argv;

(async () => {
  switch (cmd) {
    case 'pending': {
      const rows = await api('/api/admin/payouts/pending');
      if (!rows.length) {
        console.log('No pending payouts.');
        return;
      }
      rows.forEach((p) => {
        console.log(`${p.id}  $${p.usdAmount}  ${p.type}  ${p.walletAddress}`);
      });
      break;
    }
    case 'approve':
      if (!id) throw new Error('Usage: approve <uuid>');
      console.log(await api(`/api/admin/payouts/${id}/approve`, 'POST'));
      break;
    case 'reject':
      if (!id) throw new Error('Usage: reject <uuid>');
      console.log(await api(`/api/admin/payouts/${id}/reject`, 'POST'));
      break;
    case 'tick':
      console.log(await api('/api/admin/draws/tick', 'POST'));
      break;
    default:
      console.log('Commands: pending | approve <id> | reject <id> | tick');
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
