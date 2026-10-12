// Sends a "Send request" Lead to Reddit's Conversions API, so it counts even when an ad blocker stops the pixel.
// The page fires the pixel Lead with the same conversionId, and Reddit counts the pair once.
// REDDIT_CAPI_TOKEN is the Conversions API access token, kept in the Vercel project's environment variables.
import { createHash } from 'node:crypto';

const PIXEL_ID = 'a2_ju59k2m3wj03';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const token = process.env.REDDIT_CAPI_TOKEN;
  if (!token) return res.status(503).json({ ok: false, error: 'not configured' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const conversionId = String(body.conversionId || '').slice(0, 100);
  if (!conversionId) return res.status(400).json({ ok: false });

  const user = {
    ip_address: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined,
    user_agent: req.headers['user-agent'] || undefined,
    uuid: body.uuid ? String(body.uuid).slice(0, 100) : undefined,
  };
  const email = String(body.email || '').trim().toLowerCase();
  if (email) user.email = createHash('sha256').update(email).digest('hex');

  const event = {
    event_at: Date.now(),
    action_source: 'WEBSITE',
    type: { tracking_type: 'LEAD' },
    metadata: { conversion_id: conversionId },
    user,
  };
  if (body.clickId) event.click_id = String(body.clickId).slice(0, 200);

  const r = await fetch(`https://ads-api.reddit.com/api/v3/pixels/${PIXEL_ID}/conversion_events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { events: [event] } }),
  });
  const text = await r.text();
  if (!r.ok) console.error('Reddit CAPI', r.status, text);
  res.status(r.ok ? 200 : 502).json({ ok: r.ok });
}
