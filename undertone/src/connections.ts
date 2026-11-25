import type { Env, MTrack, User } from "./types";
import { fetchJson, normalize, randHex, sleep, tokenSim } from "./util";
import { isDefinition, rawUrl, resolveTrack, testDefinition, validateDefinition } from "./engine";

export interface ConnectionRow {
  id: string;
  user_id: string;
  base_url: string;
  manifest: any;
  settings: Record<string, string>;
  position: number;
  enabled: number;
  fetched_at: number;
}

export interface Resolved {
  url: string;
  container?: string;
  codec?: string;
  expiresAt?: number;
  connectionId: string;
  connectionName: string;
  headers?: Record<string, string>;
  playable?: boolean;
}

export function baseFromManifestUrl(u: string): string {
  const url = new URL(u.trim());
  if (!/^https?:$/.test(url.protocol)) throw new Error("Connection URL must be http(s)");
  url.hash = "";
  let p = url.pathname.replace(/\/+$/, "");
  p = p.replace(/\/manifest\.json$/i, "");
  url.pathname = p || "/";
  return url.toString().replace(/\/$/, "").replace(/\/\?/, "?");
}

function withParams(
  base: string,
  path: string,
  params: Record<string, string | undefined>,
  settings: Record<string, string>,
) {
  const u = new URL(base);
  const [p, qs] = path.split("?");
  u.pathname = u.pathname.replace(/\/$/, "") + p;
  if (qs) new URLSearchParams(qs).forEach((v, k) => u.searchParams.set(k, v));
  for (const [k, v] of Object.entries(settings || {}))
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}

export async function loadConnection(url: string): Promise<{ base: string; manifest: any }> {
  const direct = rawUrl(url);
  if (!/^https?:\/\//i.test(direct)) throw new Error("Connection URL must be http(s)");
  if (!/\/manifest\.json(\?|$)/i.test(direct) || /\.json(\?|$)/i.test(direct)) {
    const { status, data } = await fetchJson(direct, {}, 10000).catch(
      () => ({ status: 0, data: null }) as any,
    );
    if (status === 200 && isDefinition(data))
      return { base: direct, manifest: validateDefinition(data) };
  }
  const base = baseFromManifestUrl(url);
  return { base, manifest: await fetchManifest(base) };
}
export async function reloadManifest(a: ConnectionRow): Promise<any> {
  if (a.base_url.startsWith("file:")) return a.manifest;
  if (!isDefinition(a.manifest)) return fetchManifest(a.base_url);
  const { status, data } = await fetchJson(a.base_url, {}, 10000);
  if (status !== 200) throw new Error(`connection fetch failed (HTTP ${status})`);
  return validateDefinition(data);
}

export async function fetchManifest(base: string): Promise<any> {
  const { status, data } = await fetchJson(withParams(base, "/manifest.json", {}, {}), {}, 10000);
  if (status !== 200 || !data || typeof data !== "object")
    throw new Error(`manifest fetch failed (HTTP ${status})`);
  if (!data.id || !data.name || !Array.isArray(data.resources))
    throw new Error("not an connection manifest (needs id, name, resources)");
  if (!data.resources.includes("stream")) throw new Error("connection has no stream resource");
  return data;
}

function rowFrom(r: any): ConnectionRow {
  return { ...r, manifest: JSON.parse(r.manifest), settings: JSON.parse(r.settings || "{}") };
}

export async function listConnections(
  env: Env,
  userId: string,
  onlyEnabled = false,
): Promise<ConnectionRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM connections WHERE user_id = ? ${onlyEnabled ? "AND enabled = 1" : ""} ORDER BY position, fetched_at`,
  )
    .bind(userId)
    .all();
  return results.map(rowFrom);
}

export async function addConnectionFile(
  env: Env,
  user: User,
  doc: unknown,
  settings: Record<string, string> = {},
): Promise<ConnectionRow> {
  if (!isDefinition(doc))
    throw new Error('That is not a connection file (it needs an "undertone" version).');
  const manifest = validateDefinition(doc);
  return addConnection(env, user, "", settings, {
    base: `file:${String(manifest.id).slice(0, 80)}`,
    manifest,
  });
}

export async function addConnection(
  env: Env,
  user: User,
  manifestUrl: string,
  settings: Record<string, string> = {},
  given?: { base: string; manifest: any },
): Promise<ConnectionRow> {
  const { base, manifest } = given || (await loadConnection(manifestUrl));
  const existing = await env.DB.prepare(
    "SELECT id FROM connections WHERE user_id = ? AND base_url = ?",
  )
    .bind(user.id, base)
    .first<{ id: string }>();
  const defaults: Record<string, string> = {};
  for (const s of manifest.settings || [])
    if (s?.key && s.default !== undefined) defaults[s.key] = String(s.default);
  const merged = { ...defaults, ...settings };
  const now = Date.now();
  if (existing) {
    await env.DB.prepare(
      "UPDATE connections SET manifest = ?, settings = ?, fetched_at = ? WHERE id = ?",
    )
      .bind(JSON.stringify(manifest), JSON.stringify(merged), now, existing.id)
      .run();
    return (await getConnection(env, user.id, existing.id))!;
  }
  const pos = await env.DB.prepare(
    "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM connections WHERE user_id = ?",
  )
    .bind(user.id)
    .first<{ p: number }>();
  const id = randHex(8);
  await env.DB.prepare(
    "INSERT INTO connections (id, user_id, base_url, manifest, settings, position, enabled, fetched_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
  )
    .bind(id, user.id, base, JSON.stringify(manifest), JSON.stringify(merged), pos?.p || 0, now)
    .run();
  return (await getConnection(env, user.id, id))!;
}

export async function getConnection(
  env: Env,
  userId: string,
  id: string,
): Promise<ConnectionRow | null> {
  const r = await env.DB.prepare("SELECT * FROM connections WHERE user_id = ? AND id = ?")
    .bind(userId, id)
    .first();
  return r ? rowFrom(r) : null;
}

export async function importPack(
  env: Env,
  user: User,
  packUrlOrJson: string | any,
): Promise<{ added: string[]; failed: { url: string; error: string }[] }> {
  let doc = packUrlOrJson;
  if (typeof packUrlOrJson === "string") {
    const { status, data } = await fetchJson(packUrlOrJson);
    if (status !== 200) throw new Error(`pack fetch failed (HTTP ${status})`);
    doc = data;
  }
  const list: any[] = Array.isArray(doc)
    ? doc
    : Array.isArray(doc?.connections)
      ? doc.connections
      : [];
  if (!list.length) throw new Error("pack contains no connections");
  const added: string[] = [];
  const failed: { url: string; error: string }[] = [];
  for (const entry of list.slice(0, 50)) {
    const url =
      typeof entry === "string" ? entry : entry?.url || entry?.manifest || entry?.transportUrl;
    if (!url) continue;
    try {
      const a = await addConnection(
        env,
        user,
        url,
        typeof entry === "object" ? entry.settings || {} : {},
      );
      added.push(a.manifest.name);
    } catch (e: any) {
      failed.push({ url, error: e.message });
    }
  }
  return { added, failed };
}

interface Candidate {
  id: string;
  streamURL?: string;
  score: number;
}

function scoreTrack(t: MTrack, x: any): number {
  if (!x || !x.id) return 0;
  if (t.isrc && x.isrc && String(x.isrc).toUpperCase() === t.isrc.toUpperCase()) return 1.5;
  const title = tokenSim(t.title, String(x.title || ""));
  const xa = String(x.artist || x.artists || "");
  const artistNames = (t.artists?.map((a) => a.name) || [t.artistName]).join(" ");
  let artist = Math.max(tokenSim(t.artistName, xa), tokenSim(artistNames, xa));
  if (!artist && normalize(xa).includes(normalize(t.artistName))) artist = 0.8;
  let dur = 0.5;
  const xd = Number(x.duration);
  if (t.duration && xd) {
    const d = Math.abs(t.duration - (xd > 10000 ? xd / 1000 : xd));
    dur = d <= 3 ? 1 : d <= 8 ? 0.7 : d <= 20 ? 0.3 : 0;
  }
  let s = 0.5 * title + 0.3 * artist + 0.2 * dur;
  const nt = normalize(String(x.title || "")),
    ot = normalize(t.title);
  for (const w of [
    "remix",
    "live",
    "acoustic",
    "instrumental",
    "karaoke",
    "sped up",
    "slowed",
    "cover",
  ]) {
    if (nt.includes(w) !== ot.includes(w)) s -= 0.25;
  }
  return s;
}

async function connectionGet(
  a: ConnectionRow,
  path: string,
  params: Record<string, string | undefined> = {},
) {
  return fetchJson(withParams(a.base_url, path, params, a.settings), {}, 25000);
}

async function findCandidate(a: ConnectionRow, t: MTrack): Promise<Candidate | null> {
  const res: string[] = a.manifest.resources || [];
  if (res.includes("isrc") && t.isrc) {
    const { status, data } = await connectionGet(a, "/resolve-isrc", { isrc: t.isrc }).catch(
      () => ({ status: 0, data: null }) as any,
    );
    const id = status === 200 ? (data?.trackId ?? data?.id) : null;
    if (id) return { id: String(id), score: 1.5 };
  }
  if (res.includes("resolve")) {
    const { status, data } = await connectionGet(a, "/resolve", {
      isrc: t.isrc,
      title: t.title,
      artist: t.artistName,
      album: t.albumTitle,
      duration: t.duration ? String(t.duration) : undefined,
    }).catch(() => ({ status: 0, data: null }) as any);
    const item = status === 200 ? data?.item : null;
    if (item?.id) return { id: String(item.id), streamURL: item.streamURL, score: 1.4 };
  }
  if (res.includes("search")) {
    const q = `${t.artistName} ${t.title}`.replace(/\s*\((feat|ft)[^)]*\)/i, "");
    const { status, data } = await connectionGet(a, "/search", { q }).catch(
      () => ({ status: 0, data: null }) as any,
    );
    if (status !== 200 || !data) return null;
    const tracks: any[] = Array.isArray(data.tracks) ? data.tracks : [];
    let best: Candidate | null = null;
    for (const x of tracks.slice(0, 25)) {
      const s = scoreTrack(t, x);
      if (!best || s > best.score) best = { id: String(x.id), streamURL: x.streamURL, score: s };
    }
    if (best && best.score >= 0.72) return best;
  }
  return null;
}

async function getStream(
  a: ConnectionRow,
  cand: Candidate,
  deadline: number,
): Promise<Resolved | null> {
  if (cand.streamURL && /^https?:/.test(cand.streamURL)) {
    return { url: cand.streamURL, connectionId: a.id, connectionName: a.manifest.name };
  }
  for (;;) {
    const { status, data, headers } = await connectionGet(
      a,
      `/stream/${encodeURIComponent(cand.id)}`,
    );
    if (status === 200 && data?.url) {
      let exp: number | undefined;
      if (data.expiresAt)
        exp =
          typeof data.expiresAt === "number"
            ? data.expiresAt < 1e12
              ? data.expiresAt * 1000
              : data.expiresAt
            : Date.parse(data.expiresAt);
      return {
        url: data.url,
        container: (data.container || data.format || "").toString().toLowerCase() || undefined,
        codec: data.codec,
        expiresAt: exp,
        connectionId: a.id,
        connectionName: a.manifest.name,
      };
    }
    if (status === 503 || status === 202) {
      const ra = parseInt(headers.get("retry-after") || "3", 10);
      const wait = Math.min(Math.max(Number.isFinite(ra) ? ra : 3, 1), 6) * 1000;
      if (Date.now() + wait > deadline) return null;
      await sleep(wait);
      continue;
    }
    return null;
  }
}

function containerFromUrl(u: string): string | undefined {
  const m = /\.(flac|mp3|m4a|mp4|aac|ogg|opus|wav|alac|webm)(?:$|[?#])/i.exec(u);
  return m ? m[1].toLowerCase() : undefined;
}

export function normContainer(c?: string): string {
  const v = (c || "").toLowerCase();
  if (["flac", "mp3", "m4a", "ogg", "opus", "wav", "webm", "aac"].includes(v)) return v;
  if (v.includes("flac") || v.includes("lossless") || v.includes("hires") || v.includes("hi_res"))
    return "flac";
  if (v.includes("mp4") || v.includes("aac") || v.includes("alac")) return "m4a";
  if (v.includes("mp3")) return "mp3";
  return "flac";
}

export async function resolveStream(
  env: Env,
  user: User,
  trackId: string,
  t: MTrack,
  opts: { fresh?: boolean } = {},
): Promise<Resolved | null> {
  const key = `res:${user.id}:${trackId}`;
  if (!opts.fresh) {
    const hit = await env.KV.get<Resolved>(key, "json");
    if (
      hit &&
      hit.playable !== undefined &&
      (!hit.expiresAt || hit.expiresAt - Date.now() > 60_000)
    )
      return hit;
  }
  const connections = await listConnections(env, user.id, true);
  const deadline = Date.now() + 45_000;
  for (const a of connections) {
    try {
      let r: Resolved | null = null;
      if (isDefinition(a.manifest)) {
        const got = await resolveTrack(env, a.manifest, a.settings, a.id, t, deadline);
        if (got) r = { ...got, connectionId: a.id, connectionName: a.manifest.name };
      } else {
        const cand = await findCandidate(a, t);
        if (cand) r = await getStream(a, cand, deadline);
      }
      if (!r) continue;
      r.container = normContainer(r.container || containerFromUrl(r.url));
      r.playable = await looksPlayable(r.url);
      const ttl = r.expiresAt
        ? Math.max(60, Math.floor((r.expiresAt - Date.now()) / 1000) - 60)
        : 3 * 3600;
      await env.KV.put(key, JSON.stringify(r), {
        expirationTtl: Math.max(60, Math.min(ttl, 86400)),
      });
      return r;
    } catch (e) {
      console.log(`connection ${a.manifest?.name} failed:`, (e as Error).message);
    }
  }
  return null;
}

async function looksPlayable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return true;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const attach = /attachment/i.test(res.headers.get("content-disposition") || "");
    return /^(audio|video)\//.test(ct) && !attach;
  } catch {
    return true;
  }
}

export async function peekResolved(
  env: Env,
  userId: string,
  trackId: string,
): Promise<Resolved | null> {
  return env.KV.get<Resolved>(`res:${userId}:${trackId}`, "json");
}

export async function testConnection(
  env: Env,
  a: ConnectionRow,
  q = "Daft Punk Get Lucky",
): Promise<{ ok: boolean; message: string }> {
  if (isDefinition(a.manifest)) return testDefinition(env, a.manifest, a.settings, a.id);
  try {
    const { status, data } = await connectionGet(a, "/search", { q });
    if (status === 401 || status === 403)
      return {
        ok: false,
        message: `HTTP ${status}: connection refuses non-Eclipse clients or needs a token in its URL`,
      };
    if (status !== 200) return { ok: false, message: `search returned HTTP ${status}` };
    const n = Array.isArray(data?.tracks) ? data.tracks.length : 0;
    return {
      ok: Array.isArray(data?.tracks),
      message: n
        ? `search OK (${n} tracks)`
        : Array.isArray(data?.tracks)
          ? `connection reachable (no tracks for "${q}")`
          : "search returned no track list",
    };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}
