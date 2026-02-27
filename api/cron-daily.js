export default async function handler(req, res) {
  // Vercel cron jobs send a GET request
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const baseUrl = `https://${req.headers.host}`;
    const r = await fetch(`${baseUrl}/api/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'daily', sendEmail: true }),
    });
    const data = await r.json();
    return res.status(200).json({ triggered: 'daily', result: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
