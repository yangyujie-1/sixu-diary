const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const url = `${REDIS_URL}/${[command, ...args].map(encodeURIComponent).join('/')}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

const kv = {
  async lpush(key, value) { return redis('lpush', key, value); },
  async lrange(key, start, end) { return redis('lrange', key, start, end); },
  async expire(key, seconds) { return redis('expire', key, seconds); },
};

module.exports = { kv };
