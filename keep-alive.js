const SERVER_URL = process.env.SERVER_URL || "https://orbit-server-ymao.onrender.com";
const PING_INTERVAL_MS = 5 * 60 * 1000;

async function ping() {
  const start = Date.now();
  try {
    const res = await fetch(`${SERVER_URL}/health`);
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] Keep-alive OK — ${res.status} (${ms}ms)`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Keep-alive FAILED — ${err}`);
  }
}

console.log(`OrBit server keep-alive started — pinging ${SERVER_URL}/health every 5 minutes`);
ping();
setInterval(ping, PING_INTERVAL_MS);
