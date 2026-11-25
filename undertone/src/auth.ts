import type { AuthInfo, Ctx, Env, User } from "./types";
import { randHex } from "./util";

export function parseAuthHeader(h: string | null): AuthInfo {
  const out: AuthInfo = {};
  if (!h) return out;
  const re = /(\w+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(h))) {
    const k = m[1].toLowerCase();
    const v = decodeURIComponent(m[2]);
    if (k === "client") out.client = v;
    else if (k === "device") out.device = v;
    else if (k === "deviceid") out.deviceId = v;
    else if (k === "version") out.version = v;
    else if (k === "token") out.token = v;
  }
  return out;
}

export function extractAuth(req: Request, q: Map<string, string>): AuthInfo {
  const hdr = req.headers.get("x-emby-authorization") || req.headers.get("authorization");
  const info = parseAuthHeader(hdr && /mediabrowser|emby/i.test(hdr) ? hdr : null);
  info.token ||=
    req.headers.get("x-emby-token") ||
    req.headers.get("x-mediabrowser-token") ||
    q.get("api_key") ||
    q.get("apikey") ||
    q.get("x-emby-token") ||
    undefined;
  if (!info.token && hdr && /^bearer /i.test(hdr)) info.token = hdr.slice(7).trim();
  info.deviceId ||= q.get("deviceid");
  return info;
}

const ITER = 100_000;

export async function hashPassword(
  pw: string,
  saltHex?: string,
): Promise<{ hash: string; salt: string }> {
  const salt = saltHex || randHex(16);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(salt) as BufferSource, iterations: ITER },
    key,
    256,
  );
  return {
    hash: [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join(""),
    salt,
  };
}

function hexToBytes(h: string): Uint8Array {
  const a = new Uint8Array(h.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
  return a;
}

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function rowToUser(r: any): User {
  let settings = {};
  try {
    settings = JSON.parse(r.settings || "{}");
  } catch {}
  return {
    id: r.id,
    name: r.name,
    is_admin: r.is_admin,
    settings,
    created_at: r.created_at,
    last_login: r.last_login,
  };
}

export async function userCount(env: Env): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return r?.n || 0;
}

export async function createUser(
  env: Env,
  name: string,
  pw: string,
  isAdmin: boolean,
): Promise<User> {
  name = name.trim();
  if (!/^[\w.@+\- ]{2,40}$/.test(name))
    throw new Error("Invalid username (2-40 chars: letters, digits, . _ - @ +)");
  if (pw.length < 6) throw new Error("Password must have at least 6 characters");
  const { hash, salt } = await hashPassword(pw);
  const id = randHex(16);
  const now = Date.now();
  const defaultMode = env.DEFAULT_STREAM_MODE === "proxy" ? "proxy" : "redirect";
  await env.DB.prepare(
    "INSERT INTO users (id, name, pw_hash, pw_salt, is_admin, settings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, name, hash, salt, isAdmin ? 1 : 0, JSON.stringify({ streamMode: defaultMode }), now)
    .run();
  return {
    id,
    name,
    is_admin: isAdmin ? 1 : 0,
    settings: { streamMode: defaultMode },
    created_at: now,
    last_login: null,
  };
}

export async function verifyLogin(env: Env, name: string, pw: string): Promise<User | null> {
  const r = await env.DB.prepare("SELECT * FROM users WHERE name = ?")
    .bind(name.trim())
    .first<any>();
  if (!r) {
    await hashPassword(pw);
    return null;
  }
  const { hash } = await hashPassword(pw, r.pw_salt);
  return timingSafeEq(hash, r.pw_hash) ? rowToUser(r) : null;
}

export async function setPassword(env: Env, userId: string, pw: string) {
  if (pw.length < 6) throw new Error("Password must have at least 6 characters");
  const { hash, salt } = await hashPassword(pw);
  await env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?")
    .bind(hash, salt, userId)
    .run();
}

export async function issueToken(env: Env, user: User, a: AuthInfo): Promise<string> {
  const token = randHex(16);
  const now = Date.now();
  if (a.deviceId)
    await env.DB.prepare("DELETE FROM tokens WHERE user_id = ? AND device_id = ?")
      .bind(user.id, a.deviceId)
      .run();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO tokens (token, user_id, device_id, device, client, version, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      token,
      user.id,
      a.deviceId || null,
      a.device || null,
      a.client || null,
      a.version || null,
      now,
      now,
    ),
    env.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(now, user.id),
  ]);
  return token;
}

export async function userFromToken(env: Env, token: string): Promise<User | null> {
  const kvKey = "tok:" + token;
  const hit = await env.KV.get(kvKey, "json");
  if (hit) return hit as User;
  const r = await env.DB.prepare(
    "SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?",
  )
    .bind(token)
    .first<any>();
  if (!r) return null;
  const u = rowToUser(r);
  await env.KV.put(kvKey, JSON.stringify(u), { expirationTtl: 300 });
  return u;
}

export async function invalidateUserCache(env: Env, userId: string) {
  const { results } = await env.DB.prepare("SELECT token FROM tokens WHERE user_id = ?")
    .bind(userId)
    .all<{ token: string }>();
  await Promise.all(results.map((r) => env.KV.delete("tok:" + r.token)));
}

export async function revokeToken(env: Env, token: string) {
  await env.DB.prepare("DELETE FROM tokens WHERE token = ?").bind(token).run();
  await env.KV.delete("tok:" + token);
}

export async function updateSettings(env: Env, user: User, patch: Record<string, unknown>) {
  const next = { ...user.settings, ...patch };
  for (const [k, v] of Object.entries(next))
    if (v === null || (v as unknown) === "") delete (next as any)[k];
  await env.DB.prepare("UPDATE users SET settings = ? WHERE id = ?")
    .bind(JSON.stringify(next), user.id)
    .run();
  await invalidateUserCache(env, user.id);
  user.settings = next;
}

export function serverIdFor(env: Env, url: URL): string {
  if (env.SERVER_ID && /^[0-9a-f]{32}$/.test(env.SERVER_ID)) return env.SERVER_ID;
  let h1 = 0x811c9dc5,
    h2 = 0x01000193,
    h3 = 0x12345678,
    h4 = 0x9abcdef0;
  const s = url.host;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822507);
    h3 = Math.imul(h3 ^ c, 3266489909);
    h4 = Math.imul(h4 ^ c, 668265263);
  }
  return [h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

export function requireUser(c: Ctx): User {
  if (!c.user) throw new HttpError(401, "Unauthorized");
  return c.user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
  }
}
