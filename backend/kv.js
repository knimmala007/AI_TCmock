// A minimal Redis-style key-value interface with two implementations: memory (tests and local
// development) and Upstash over its REST API (hosted). Both take commands as arrays, so the code
// above them is identical in either place. Upstash is called with fetch, so no dependency is added.
//   exec(['GET', key])  /  pipeline([['RPUSH', key, v], ['EXPIRE', key, 60]])

const normIndex = (i, len) => Math.max(0, i < 0 ? len + i : i);

export function memoryKv({ now = () => Date.now() } = {}) {
  const data = new Map();
  const expires = new Map();
  const live = key => {
    const t = expires.get(key);
    if (t !== undefined && t <= now()) { data.delete(key); expires.delete(key); }
    return data.has(key);
  };
  function run([cmd, key, ...args]) {
    switch (String(cmd).toUpperCase()) {
      case 'GET': return live(key) ? data.get(key) : null;
      case 'SET': data.set(key, String(args[0])); expires.delete(key); return 'OK';
      case 'DEL': { const had = live(key); data.delete(key); expires.delete(key); return had ? 1 : 0; }
      case 'RPUSH': {
        const list = live(key) ? data.get(key) : [];
        list.push(...args.map(String));
        data.set(key, list);
        return list.length;
      }
      case 'LRANGE': {
        if (!live(key)) return [];
        const list = data.get(key);
        return list.slice(normIndex(Number(args[0]), list.length), normIndex(Number(args[1]), list.length) + 1);
      }
      case 'LTRIM': {
        if (!live(key)) return 'OK';
        const list = data.get(key);
        data.set(key, list.slice(normIndex(Number(args[0]), list.length), normIndex(Number(args[1]), list.length) + 1));
        return 'OK';
      }
      case 'INCR': {
        const n = (live(key) ? Number(data.get(key)) : 0) + 1;
        data.set(key, String(n));
        return n;
      }
      case 'SADD': {
        const set = live(key) ? data.get(key) : new Set();
        const before = set.size;
        args.forEach(a => set.add(String(a)));
        data.set(key, set);
        return set.size - before;
      }
      case 'SMEMBERS': return live(key) ? [...data.get(key)] : [];
      case 'SISMEMBER': return live(key) && data.get(key).has(String(args[0])) ? 1 : 0;
      case 'EXPIRE':
        if (!live(key)) return 0;
        expires.set(key, now() + Number(args[0]) * 1000);
        return 1;
      default: throw new Error(`unsupported command: ${cmd}`);
    }
  }
  return {
    async exec(command) { return run(command); },
    async pipeline(commands) { return commands.map(run); },
  };
}

export function upstashKv({ url, token, fetch = globalThis.fetch }) {
  if (!url) throw new Error('Upstash url is required');
  if (!token) throw new Error('Upstash token is required');
  const base = url.replace(/\/+$/, '');

  async function post(endpoint, body) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return json;
  }
  const unwrap = r => {
    if (r && r.error) throw new Error(`Upstash error: ${r.error}`); // never include the token
    return r.result;
  };
  return {
    async exec(command) { return unwrap(await post(base, command)); },
    async pipeline(commands) {
      const rs = await post(`${base}/pipeline`, commands);
      if (!Array.isArray(rs)) throw new Error(`Upstash error: ${(rs && rs.error) || 'bad pipeline response'}`);
      return rs.map(unwrap);
    },
  };
}
