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

    if (type === 'daily') {
      return await handleDaily(now, doSend, res);
    } else if (type === 'weekly') {
      return await handleWeekly(now, doSend, res);
    } else {
      return res.status(400).json({ error: '无效的 type' });
    }
  } catch (e) {
    console.error('Summary error:', e);
    return res.status(500).json({ error: e.message });
  }
};

// ─── Daily ───────────────────────────────────────
async function handleDaily(now, doSend, res) {
  const today = dateStr(now);
  let entries = await getEntriesForDate(today);
  const noteEntries = entries.filter(e => e.type === 'note' || e.type === 'link');
  if (!noteEntries.length) return res.status(200).json({ message: '今天还没有记录' });

  const prompt = `以下是我今天的记录，包括想法笔记和保存的链接，请帮我整理成一份有深度的每日总结，分析今天的思考重点、情绪状态、值得深化的想法，语言温柔而有洞察力：\n\n${noteEntries.map(e => {
    if (e.type === 'link') return `[链接] ${e.linkTitle || e.text} ${e.estimatedTime || ''}`;
    return `[${e.time}] ${e.text}`;
  }).join('\n')}`;

  const summaryText = await callClaude(prompt);
  await saveEntry(today, now, summaryText, 'summary_daily');

  if (doSend) {
    await sendEmail(`${today} 每日总结`, buildDailyEmailHtml(today, summaryText)).catch(e => console.error('Email error:', e));
  }

  return res.status(200).json({ success: true, summary: summaryText });
}

// ─── Weekly ──────────────────────────────────────
async function handleWeekly(now, doSend, res) {
  const dates = getLast7Days(now);
  const allEntries = (await Promise.all(dates.map(d => getEntriesForDate(d)))).flat();
  const noteEntries = allEntries.filter(e => e.type === 'note' || e.type === 'link');
  if (!noteEntries.length) return res.status(200).json({ message: '本周还没有记录' });

  // Separate AI-related links
  const aiLinks = allEntries.filter(e => e.type === 'link' && e.isAI);
  const weekNum = getWeekNum(now);

  // 1. Regular weekly summary
  const weeklyPrompt = `以下是我这一周的记录，请帮我整理成一份深度周总结，梳理这周反复出现的主题、重要决定、成长点，语言有洞察力，不需要加具体日期：\n\n${noteEntries.map(e => {
    if (e.type === 'link') return `[链接] ${e.linkTitle || e.text} ${e.keyPoint ? '- ' + e.keyPoint : ''}`;
    return `[想法] ${e.text}`;
  }).join('\n')}`;
  const weeklySummary = await callClaude(weeklyPrompt);

  // 2. AI content digest (if any AI links this week)
  let aiScript = '';
  let aiXHS = '';
  if (aiLinks.length > 0) {
    const aiListText = aiLinks.map((e, i) =>
      `${i + 1}. 《${e.linkTitle || e.text}》${e.estimatedTime ? '（' + e.estimatedTime.replace(/[📖🎬]/g, '').trim() + '）' : ''}${e.keyPoint ? '\n   核心要点：' + e.keyPoint : ''}`
    ).join('\n');

    // Generate voice script
    const scriptPrompt = `以下是我本周收藏的AI相关内容清单，请帮我写一段"本周我学了什么"的口播稿。
要求：
- 1.5-2分钟，适合对着镜头念
- 开头有钩子，结尾有行动引导
- 语气自然口语化，像朋友聊天
- 每个内容只提炼1个最有价值的点
- 不要说具体日期，只说"本周"
- 结尾引导关注/收藏

本周AI内容：
${aiListText}`;
    aiScript = await callClaude(scriptPrompt);

    // Generate XHS graphic text
    const xhsPrompt = `以下是我本周收藏的AI相关内容，请帮我写一篇小红书图文文案。
要求：
- 标题党但不标题党，真实有价值
- 正文分点列出，每点一个emoji开头
- 每个内容提炼1句话核心价值
- 结尾加互动引导语
- 附上5个精准tag
- 整体字数控制在300字以内

本周AI内容：
${aiListText}`;
    aiXHS = await callClaude(xhsPrompt);
  }

  // Save entries
  await saveEntry(dateStr(now), now, weeklySummary, 'summary_weekly');
  if (aiScript) await saveEntry(dateStr(now), now, `【本周学了什么·口播稿】\n\n${aiScript}`, 'summary_ai_script');
  if (aiXHS) await saveEntry(dateStr(now), now, `【本周学了什么·小红书文案】\n\n${aiXHS}`, 'summary_ai_xhs');

  // Send email
  if (doSend) {
    const emailHtml = buildWeeklyEmailHtml(weekNum, weeklySummary, aiLinks, aiScript, aiXHS);
    await sendEmail(`第${weekNum}周总结`, emailHtml).catch(e => console.error('Email error:', e));
  }

  return res.status(200).json({ success: true, summary: weeklySummary, aiScript, aiXHS });
}

// ─── Helpers ─────────────────────────────────────
async function getEntriesForDate(date) {
  try {
    const raw = await kv.lrange(`entries:${date}`, 0, -1);
    return (raw || []).map(r => typeof r === 'string' ? JSON.parse(r) : r);
  } catch { return []; }
}

async function saveEntry(date, now, text, type) {
  const entry = {
    id: Date.now(),
    date,
    time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    text,
    type,
  };
  await kv.lpush(`entries:${date}`, JSON.stringify(entry));
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

async function callClaude(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
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
  if (!r.ok) throw new Error(`Claude error: ${await r.text()}`);
  const data = await r.json();
  return data.content[0].text;
}

async function sendEmail(subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: process.env.EMAIL_TO,
      subject: `【思绪日记】${subject}`,
      html,
    }),
  });
  if (!r.ok) throw new Error(`Resend error: ${await r.text()}`);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildDailyEmailHtml(date, summary) {
  return `<div style="font-family:'PingFang SC',sans-serif;max-width:640px;margin:0 auto;padding:40px 28px;background:#f2eeea;border-radius:16px;color:#4a433d">
    <div style="color:#8fa3a0;font-size:13px;margin-bottom:6px">思绪 · 语音日记</div>
    <h2 style="font-weight:400;font-size:20px;margin:0 0 24px">${date} 每日总结</h2>
    <div style="background:#e8e2dc;border-radius:12px;padding:24px;line-height:2;white-space:pre-wrap;border-left:3px solid #8fa3a0;font-size:15px">${esc(summary)}</div>
    <p style="color:#8c8078;font-size:12px;margin-top:20px;text-align:right">由思绪日记自动生成</p>
  </div>`;
}

function buildWeeklyEmailHtml(weekNum, summary, aiLinks, aiScript, aiXHS) {
  const aiSection = aiLinks.length > 0 ? `
    <div style="margin-top:28px">
      <h3 style="font-weight:400;font-size:17px;color:#4a433d;margin-bottom:16px">🤖 本周 AI 内容（${aiLinks.length}篇）</h3>
      <div style="background:#ede8e3;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        ${aiLinks.map(e => `<div style="padding:8px 0;border-bottom:1px solid #d8d0c8;font-size:14px">
          <div style="font-weight:500;color:#4a433d">📎 ${esc(e.linkTitle || e.text)}</div>
          ${e.estimatedTime ? `<div style="color:#8c8078;font-size:12px;margin-top:3px">${esc(e.estimatedTime)}</div>` : ''}
          ${e.keyPoint ? `<div style="color:#8fa3a0;font-size:13px;margin-top:4px">💡 ${esc(e.keyPoint)}</div>` : ''}
        </div>`).join('')}
      </div>
      ${aiScript ? `<div style="margin-bottom:20px">
        <div style="font-size:13px;color:#a89bb0;letter-spacing:0.1em;margin-bottom:10px">✦ 口播稿</div>
        <div style="background:#e8e2dc;border-radius:12px;padding:20px 24px;line-height:2;white-space:pre-wrap;border-left:3px solid #a89bb0;font-size:14px">${esc(aiScript)}</div>
      </div>` : ''}
      ${aiXHS ? `<div>
        <div style="font-size:13px;color:#b0a090;letter-spacing:0.1em;margin-bottom:10px">✦ 小红书文案</div>
        <div style="background:#e8e2dc;border-radius:12px;padding:20px 24px;line-height:2;white-space:pre-wrap;border-left:3px solid #b0a090;font-size:14px">${esc(aiXHS)}</div>
      </div>` : ''}
    </div>` : '';

  return `<div style="font-family:'PingFang SC',sans-serif;max-width:640px;margin:0 auto;padding:40px 28px;background:#f2eeea;border-radius:16px;color:#4a433d">
    <div style="color:#8fa3a0;font-size:13px;margin-bottom:6px">思绪 · 语音日记</div>
    <h2 style="font-weight:400;font-size:20px;margin:0 0 24px">第${weekNum}周总结</h2>
    <div style="background:#e8e2dc;border-radius:12px;padding:24px;line-height:2;white-space:pre-wrap;border-left:3px solid #8fa3a0;font-size:15px">${esc(summary)}</div>
    ${aiSection}
    <p style="color:#8c8078;font-size:12px;margin-top:28px;text-align:right">由思绪日记自动生成</p>
  </div>`;
}
