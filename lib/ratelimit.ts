// lib/ratelimit.ts — T-05
// Rate-limiter en memoria por clave (IP | email | wa_id).
// Sin setInterval: limpieza lazy en cada invocación (evita leaks en serverless).

const requests = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  let timestamps = requests.get(key);
  if (!timestamps) {
    timestamps = [];
    requests.set(key, timestamps);
  }

  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= maxRequests) {
    return true;
  }

  timestamps.push(now);
  return false;
}

export function resetKey(key: string): void {
  requests.delete(key);
}
