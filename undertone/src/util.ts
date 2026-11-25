import { createHash } from "node:crypto";
export const TICKS = 10_000_000;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function empty(status = 204): Response {
  return new Response(null, { status });
}

export function err(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export function randHex(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function digestHex(algo: string, input: string): Promise<string> {
  return createHash(algo.replace("-", "").toLowerCase()).update(input, "utf8").digest("hex");
}

export function shortTag(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /\s*[\(\[].*?(feat|ft\.|with|remaster|version|edit|mono|stereo|live|deluxe|explicit).*?[\)\]]/g,
      "",
    )
    .replace(/\b(feat|ft)\.?\s.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenSim(a: string, b: string): number {
  const na = normalize(a),
    nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(" ")),
    tb = new Set(nb.split(" "));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function toInt(v: string | undefined | null, def: number): number {
  if (v == null || v === "") return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export function splitList(v: string | undefined | null): string[] {
  if (!v) return [];
  return v
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isoDate(ms: number | undefined | null): string | undefined {
  return ms ? new Date(ms).toISOString() : undefined;
}

export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const req = new Request("https://undertone.cache/" + encodeURIComponent(key));
  if (cache) {
    const hit = await cache.match(req);
    if (hit) return (await hit.json()) as T;
  }
  const val = await fn();
  if (cache && val !== undefined) {
    await cache.put(
      req,
      new Response(JSON.stringify(val), {
        headers: {
          "content-type": "application/json",
          "cache-control": `public, max-age=${ttlSec}`,
        },
      }),
    );
  }
  return val;
}

export async function fetchJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<{ status: number; data: any; headers: Headers }> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": "Undertone/0.1 (+https://github.com/)",
      accept: "application/json",
      ...(init.headers || {}),
    },
  });
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}
