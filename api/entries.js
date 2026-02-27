import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { text, type = 'note', date, time } = req.body;
    if (!text) return res.status(400).json({ error: '内容不能为空' });

    const entry = {
      id: Date.now(),
      date: date || getTodayStr(),
      time: time || getTimeStr(),
      text,
      type,
    };

    // Store in a list keyed by date
    await kv.lpush(`entries:${entry.date}`, JSON.stringify(entry));
    await kv.expire(`entries:${entry.date}`, 60 * 60 * 24 * 365); // 1 year

    return res.status(200).json({ success: true, entry });
  }

  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });

    const raw = await kv.lrange(`entries:${date}`, 0, -1);
    const entries = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r)
      .sort((a, b) => b.id - a.id);
    return res.status(200).json({ entries });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getTimeStr() {
  const d = new Date();
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
