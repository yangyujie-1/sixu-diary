const { kv } = require('./_redis');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { type, sendEmail: doSend = true } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type is required' });

  try {
    const now = new Date();
    let entries = [], prompt, subject, entryType;

    if (type === 'daily') {
      const today = dateStr(now);
      entries = await getEntriesForDate(today);
      entries = entries.filter(e => e.type === 'note');
      if (!entries.length) return res.status(200).json({ message: '今天还没有记录' });
      prompt = `以下是我今天的想法记录，请帮我整理成一份有深度的每日总结，分析今天的思考重点、情绪状态、值得深化的想法，语言温柔而有洞察力：\n\n${entries.map(e => `[${e.time}] ${e.text}`).join('\n')}`;
      subject = `${today} 每日想法总结`;
      entryType = 'summary_daily';

    } else if (type === 'weekly') {
      const dates = getLast7Days(now);
      const allEntries = await Promise.all(dates.map(d => getEntriesForDate(d)));
      entries = allEntries.flat().filter(e => e.type === 'note');
      if (!entries.length) return res.status(200).json({ message: '本周还没有记录' });
      prompt = `以下是我这一周的想法记录，请帮我整理成一份深度周总结，梳理这周反复出现的主题、重要决定、成长点和值得关注的思维模式，语言有洞察力：\n\n${entries.map(e => `[${e.date} ${e.time}] ${e.text}`).join('\n')}`;
      subject = `第${getWeekNum(now)}周 每周想法总结`;
      entryType = 'summary_weekly';

    } else {
      return res.status(400).json({ error: '无效的 type' });
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!claudeRes.ok) throw new Error(`Claude error: ${await claudeRes.text()}`);
    const claudeData = await claudeRes.json();
    const summaryText = claudeData.content[0].text;

    const summaryEntry = {
      id: Date.now(),
      date: dateStr(now),
      time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      text: summaryText,
      type: entryType,
    };
    await kv.lpush(`entries:${summaryEntry.date}`, JSON.stringify(summaryEntry));

    if (doSend) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: process.env.EMAIL_TO,
          subject: `【思绪日记】${subject}`,
          html: `<div style="font-family:sans-serif;max-width:620px;margin:0 auto;padding:40px 32px;background:#f2eeea;border-radius:16px;color:#4a433d">
            <h2 style="font-weight:400;color:#8fa3a0">思绪 · 语音日记</h2>
            <h3 style="font-weight:400;margin:16px 0">${subject}</h3>
            <div style="background:#e8e2dc;border-radius:12px;padding:24px;line-height:2;white-space:pre-wrap;border-left:3px solid #8fa3a0">${summaryText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            <p style="color:#8c8078;font-size:12px;margin-top:20px;text-align:right">由思绪日记自动生成</p>
          </div>`,
        }),
      });
      if (!emailRes.ok) console.error('Email error:', await emailRes.text());
    }

    return res.status(200).json({ success: true, summary: summaryText });
  } catch (e) {
    console.error('Summary error:', e);
    return res.status(500).json({ error: e.message });
  }
};

async function getEntriesForDate(date) {
  try {
    const raw = await kv.lrange(`entries:${date}`, 0, -1);
    return (raw || []).map(r => typeof r === 'string' ? JSON.parse(r) : r);
  } catch { return []; }
}

function getLast7Days(now) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - i); return dateStr(d);
  });
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getWeekNum(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}
