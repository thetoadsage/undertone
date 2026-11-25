import type { Env, MTrack } from "./types";
import { provider } from "./meta/provider";
import {
  AUDIO_EXT,
  bestMatch,
  extOf,
  norm,
  parseFile,
  qualityFrom,
  sim,
  type Cand,
  type Want,
} from "./match";
import { digestHex, sleep } from "./util";

export const FORMAT_VERSION = 1;

export interface Req {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  json?: unknown;
  form?: Record<string, string>;
  timeout?: number;
  extract?: string;
  urlencoded?: Record<string, string>;
  sign?: { into: string; secret: string };
}
export interface Cond {
  path: string;
  equals?: unknown;
  notEquals?: unknown;
  match?: string;
  notMatch?: string;
}
interface FileMap {
  id?: string;
  path: string;
  alt?: string;
  size?: string;
}
interface LibSource {
  kind: string;
  request: Req;
  page?: { size: number; max: number };
  one?: Req;
  items: string;
  optional?: boolean;
  ready?: Cond[];
  id: string;
  name?: string;
  hash?: string;
  files: string;
  file: FileMap;
  link: { request: Req; url: string };
}
interface Finder {
  when?: string;
  request: Req;
  items: string;
  hash: string;
  title?: string;
}
interface CacheCheck {
  request: Req;
  items: string;
  hash: string;
  name?: string;
  files: string;
  file: FileMap;
  max?: number;
}
interface Attach {
  kind: string;
  request: Req;
  id: string;
}
interface TrackSource {
  request: Req;
  items: string;
  id: string;
  title: string;
  artist: string;
  album?: string;
  ext?: string;
  link: { url?: string; request?: Req; path?: string };
}
interface PlaylistReader {
  match: string;
  request: Req;
  name?: string;
  items: string;
  next?: string;
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
  artistFirst?: string;
}
type Field = string | string[];
export interface CatalogRoute {
  request: Req;
  items?: string;
  total?: string;
  hours?: number;
  skip?: Cond[];
  defaults?: Record<string, string>;
}
export interface CatalogDef {
  artist: Record<string, Field>;
  album: Record<string, Field>;
  track: Record<string, Field>;
  genre?: Record<string, Field>;
  noImage?: string;
  imageSize?: { match: string; replace: string; sizes: number[] };
  notFound?: Cond[];
  retry?: Cond[];
  routes: Record<string, CatalogRoute>;
}
export interface LyricsDef {
  request: Req;
  synced?: string;
  plain?: string;
  skip?: Cond[];
  search?: {
    request: Req;
    items: string;
    title: string;
    artist: string;
    duration?: string;
    synced?: string;
    plain?: string;
  };
}
export interface ListedTrack {
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
}
export interface Definition {
  undertone: number;
  id: string;
  name: string;
  version?: string;
  description?: string;
  icon?: string;
  settings?: {
    key: string;
    type?: string;
    label?: string;
    help?: string;
    default?: unknown;
    required?: boolean;
    options?: unknown[];
  }[];
  fail?: Cond[];
  message?: string;
  check?: Req;
  library?: LibSource[];
  find?: Finder[];
  cached?: CacheCheck;
  attach?: Attach;
  track?: { nowPlaying?: Req; played?: Req };
  catalog?: CatalogDef;
  lyrics?: LyricsDef;
  tracks?: TrackSource[];
  session?: { request: Req; path: string; days?: number };
  playlists?: PlaylistReader[];
  uncached?: { unless: string };
  quality?: string;
}

export class ConnectionError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
  }
}

export function isDefinition(m: any): m is Definition {
  return !!m && typeof m === "object" && typeof m.undertone === "number";
}

export function rawUrl(u: string): string {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/.exec(u.trim());
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : u.trim();
}

export function validateDefinition(m: any): Definition {
  const bad = (msg: string): never => {
    throw new Error("not a valid JSON connection: " + msg);
  };
  if (!isDefinition(m)) bad('missing "undertone" version');
  if (m.undertone > FORMAT_VERSION)
    bad(`needs a newer Undertone (connection format ${m.undertone})`);
  if (!m.id || !m.name) bad("needs id and name");
  const reqOk = (r: any, where: string) => {
    if (!r || typeof r.url !== "string" || !/^(https?:\/\/|\{\{)/.test(r.url))
      bad(`${where}: request needs an http(s) url`);
  };
  for (const l of m.library || []) {
    if (!l.kind || typeof l.items !== "string" || !l.files || !l.file?.path || !l.id)
      bad("library entry needs kind, items, id, files, file.path");
    reqOk(l.request, "library");
    reqOk(l.link?.request, "library.link");
  }
  for (const f of m.find || []) {
    reqOk(f.request, "find");
    if (!f.hash) bad("find entry needs hash");
  }
  if (m.find?.length && !m.cached)
    bad('"find" needs "cached" (what the service can serve instantly)');
  if (m.cached) {
    reqOk(m.cached.request, "cached");
    if (!m.attach) bad('"cached" needs "attach"');
  }
  if (m.attach) {
    reqOk(m.attach.request, "attach");
    if (!(m.library || []).some((l: LibSource) => l.kind === m.attach.kind))
      bad("attach.kind must name a library entry");
  }
  for (const k of ["nowPlaying", "played"]) if (m.track?.[k]) reqOk(m.track[k], "track." + k);
  for (const pl of m.playlists || []) {
    reqOk(pl.request, "playlists");
    if (!pl.match || typeof pl.items !== "string" || !pl.title || !pl.artist)
      bad("playlists entry needs match, items, title, artist");
    try {
      new RegExp(pl.match);
    } catch {
      bad("playlists.match is not a valid pattern");
    }
  }
  if (m.uncached && (!m.attach || !m.find?.length)) bad('"uncached" needs "find" and "attach"');
  for (const t of m.tracks || []) {
    reqOk(t.request, "tracks");
    if (typeof t.items !== "string" || !t.id || !t.title || !t.artist)
      bad("tracks entry needs items, id, title, artist");
    if (!t.link?.url && !t.link?.request) bad("tracks.link needs a url or a request");
    if (t.link.request) reqOk(t.link.request, "tracks.link");
  }
  if (m.session) {
    reqOk(m.session.request, "session");
    if (!m.session.path) bad("session needs a path");
  }
  if (m.catalog) {
    for (const k of ["artist", "album", "track"])
      if (!m.catalog[k]?.id) bad(`catalog.${k} needs at least an id`);
    for (const k of ["searchTracks", "album", "track"])
      if (!m.catalog.routes?.[k]) bad(`catalog.routes needs "${k}"`);
    for (const [k, r] of Object.entries(m.catalog.routes || {}))
      reqOk((r as CatalogRoute).request, "catalog.routes." + k);
  }
  if (m.lyrics) {
    reqOk(m.lyrics.request, "lyrics");
    if (m.lyrics.search) reqOk(m.lyrics.search.request, "lyrics.search");
  }
  if (
    !(m.library || []).length &&
    !(m.tracks || []).length &&
    !m.track &&
    !(m.playlists || []).length &&
    !m.catalog &&
    !m.lyrics
  )
    bad("needs at least one block: library, tracks, track, playlists, catalog or lyrics");
  return m as Definition;
}

export function missingSettings(r: Definition, settings: Record<string, string>): string[] {
  return (r.settings || [])
    .filter((s) => s.required && !String(settings?.[s.key] ?? "").trim())
    .map((s) => s.label || s.key);
}

export type Vars = Record<string, unknown>;
export const get = (o: any, path: string | undefined): any => {
  if (!path) return o;
  let v = o;
  for (const k of path.split(".")) {
    if (v == null) return undefined;
    const pick = /^\[(\w+)=(.*)\]$/.exec(k);
    v = pick
      ? Array.isArray(v)
        ? v.find((x) => x && String(x[pick[1]]) === pick[2])
        : undefined
      : v[k];
  }
  return v;
};
export const list = (v: any): any[] =>
  Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
export function fill(tpl: string, vars: Vars, encode: boolean): string {
  return tpl.replace(/\{\{(&?)\s*(?:(hex|b64)\s+)?([\w.]+)\s*\}\}/g, (_, raw, fn, name) => {
    const v = get(vars, name);
    let s = v == null ? "" : String(v);
    if (fn) {
      const bytes = new TextEncoder().encode(s);
      s =
        fn === "hex"
          ? [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
          : btoa(String.fromCharCode(...bytes));
      return s;
    }
    return encode && !raw ? encodeURIComponent(s) : s;
  });
}
function fillDeep(v: unknown, vars: Vars): unknown {
  if (typeof v === "string") {
    const num = /^\{\{#\s*([\w.]+)\s*\}\}$/.exec(v);
    return num ? Number(get(vars, num[1])) : fill(v, vars, false);
  }
  if (Array.isArray(v)) return v.map((x) => fillDeep(x, vars));
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillDeep(x, vars)]));
  return v;
}
export function holds(conds: Cond[] | undefined, o: any): boolean {
  for (const c of conds || []) {
    const v = get(o, c.path);
    if ("equals" in c && v !== c.equals) return false;
    if ("notEquals" in c && v === c.notEquals) return false;
    if (c.match && !new RegExp(c.match, "i").test(String(v ?? ""))) return false;
    if (c.notMatch && new RegExp(c.notMatch, "i").test(String(v ?? ""))) return false;
  }
  return true;
}

export class Runner {
  calls = 0;
  private sess: string | undefined;
  constructor(
    public r: Definition,
    public settings: Record<string, string>,
    private env?: Env,
    private key?: string,
  ) {}

  private async session(fresh = false): Promise<string> {
    const def = this.r.session!;
    const kv = this.env && this.key ? `sess:${this.key}` : "";
    if (!fresh && this.sess) return this.sess;
    if (!fresh && kv) {
      const hit = await this.env!.KV.get(kv);
      if (hit) return (this.sess = hit);
    }
    const v = get(await this.send(def.request, {}), def.path);
    if (v == null || v === "")
      throw new ConnectionError(
        401,
        "the service did not start a session; check the details you entered",
      );
    this.sess = String(v);
    if (kv)
      await this.env!.KV.put(kv, this.sess, { expirationTtl: Math.max(1, def.days || 30) * 86400 });
    return this.sess;
  }
  async call(req: Req, extra: Vars = {}): Promise<any> {
    if (!this.r.session || !JSON.stringify(req).includes("session")) return this.send(req, extra);
    try {
      return await this.send(req, { ...extra, session: await this.session() });
    } catch (e) {
      if (!(e instanceof ConnectionError) || e.status !== 401) throw e;
      return this.send(req, { ...extra, session: await this.session(true) });
    }
  }
  private why(data: any): string {
    const pick = [
      this.r.message ? get(data, this.r.message) : undefined,
      data?.detail,
      data?.message,
      data?.error,
    ].find((x) => typeof x === "string" && x.trim());
    return pick ? String(pick) : "";
  }
  async login() {
    if (this.r.session) await this.session(true);
  }
  private async send(req: Req, extra: Vars = {}): Promise<any> {
    const vars = { settings: this.settings, ...extra };
    const url = fill(req.url, vars, true);
    if (!/^https?:\/\//i.test(url))
      throw new ConnectionError(400, "connection request url must be http(s)");
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "Undertone/0.2",
    };
    for (const [k, v] of Object.entries(req.headers || {}))
      headers[k.toLowerCase()] = fill(v, vars, false);
    let body: BodyInit | undefined;
    if (req.json !== undefined) {
      body = JSON.stringify(fillDeep(req.json, vars));
      headers["content-type"] = "application/json";
    } else if (req.form) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(req.form)) fd.set(k, fill(v, vars, false));
      body = fd;
    } else if (req.urlencoded) {
      const p: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.urlencoded)) {
        const x = fill(v, vars, false);
        if (x !== "") p[k] = x;
      }
      if (req.sign)
        p[req.sign.into] = await digestHex(
          "MD5",
          Object.keys(p)
            .filter((k) => k !== "format" && k !== "callback")
            .sort()
            .map((k) => k + p[k])
            .join("") + fill(req.sign.secret, vars, false),
        );
      body = new URLSearchParams(p).toString();
      headers["content-type"] = "application/x-www-form-urlencoded";
    }
    this.calls++;
    const res = await fetch(url, {
      method: req.method || (body ? "POST" : "GET"),
      headers,
      body,
      signal: AbortSignal.timeout(Math.min(req.timeout || 15000, 25000)),
    });
    let data: any = null;
    try {
      if (req.extract) {
        const m = new RegExp(req.extract, "s").exec(await res.text());
        data = m ? JSON.parse(m[1]) : null;
      } else data = await res.json();
    } catch {}
    if (req.extract && res.ok && data == null)
      throw new ConnectionError(502, "the page no longer has the data this connection reads");
    if (res.status === 401 || res.status === 403)
      throw new ConnectionError(401, this.why(data) || "the service rejected the credentials");
    if (res.status === 429)
      throw new ConnectionError(429, "the service is rate limiting, try again in a moment");
    if (!res.ok || (this.r.fail?.length && holds(this.r.fail, data)))
      throw new ConnectionError(
        res.status >= 400 ? res.status : 502,
        (this.why(data) || `HTTP ${res.status}`).slice(0, 200),
      );
    return data;
  }
  async soft<T>(p: Promise<T>, fallback: T): Promise<T> {
    try {
      return await p;
    } catch (e) {
      if (e instanceof ConnectionError && (e.status === 401 || e.status === 429)) throw e;
      return fallback;
    }
  }
}

interface RCand extends Cand {
  kind?: string;
  cid?: string;
  fid?: string;
  hash?: string;
  path?: string;
}

function filesOf(
  src: { files: string; file: FileMap },
  item: any,
  container: string,
  mk: (f: any, path: string) => Partial<RCand>,
): RCand[] {
  const out: RCand[] = [];
  for (const f of list(get(item, src.files))) {
    const path = String(get(f, src.file.path) || (src.file.alt ? get(f, src.file.alt) : "") || "");
    const ext = extOf(path);
    if (!AUDIO_EXT.includes(ext)) continue;
    out.push({
      id: "",
      ...parseFile(path, container),
      ext,
      size: Number(src.file.size ? get(f, src.file.size) : 0) || 0,
      container,
      owned: false,
      path,
      ...mk(f, path),
    } as RCand);
  }
  return out;
}

async function libItems(run: Runner, src: LibSource, firstPageOnly = false): Promise<any[]> {
  const size = src.page?.size || 0;
  const page = async (offset: number) =>
    list(get(await run.soft(run.call(src.request, { offset, limit: size }), null), src.items));
  const first = await page(0);
  if (!size || first.length < size || firstPageOnly) return first;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, (src.page?.max || 1) - 1) }, (_, i) => page((i + 1) * size)),
  );
  return first.concat(...rest);
}

interface LibCache {
  at: number;
  cands: RCand[];
}
const libKey = (cacheKey: string) => new Request(`https://cache.undertone/library/${cacheKey}`);
function libOf(src: LibSource, items: any[]): RCand[] {
  const out: RCand[] = [];
  for (const it of items) {
    if (!holds(src.ready, it)) continue;
    const name = String(get(it, src.name || "name") || "");
    out.push(
      ...filesOf(src, it, name, (f) => ({
        owned: true,
        kind: src.kind,
        cid: String(get(it, src.id)),
        fid: String(get(f, src.file.id || "id")),
      })),
    );
  }
  return out;
}
async function saveLib(cacheKey: string, lib: LibCache) {
  await ((globalThis as any).caches?.default as Cache | undefined)?.put(
    libKey(cacheKey),
    new Response(JSON.stringify(lib), { headers: { "cache-control": "max-age=900" } }),
  );
}
async function libraryCands(run: Runner, cacheKey: string): Promise<LibCache> {
  const hit = await ((globalThis as any).caches?.default as Cache | undefined)?.match(
    libKey(cacheKey),
  );
  if (hit) return hit.json();
  const lists = await Promise.all(
    (run.r.library || []).map(async (src) => libOf(src, await libItems(run, src))),
  );
  const lib = { at: Date.now(), cands: lists.flat() };
  await saveLib(cacheKey, lib);
  return lib;
}
async function topUpLibrary(run: Runner, cacheKey: string, lib: LibCache): Promise<RCand[]> {
  const known = new Set(lib.cands.map((c) => `${c.kind}:${c.cid}`));
  const fresh = (
    await Promise.all(
      (run.r.library || []).map(async (src) => libOf(src, await libItems(run, src, true))),
    )
  )
    .flat()
    .filter((c) => !known.has(`${c.kind}:${c.cid}`));
  lib.at = Date.now();
  lib.cands = fresh.concat(lib.cands);
  await saveLib(cacheKey, lib);
  return fresh;
}
async function dropLibraryCache(cacheKey: string) {
  await (globalThis as any).caches?.default?.delete(libKey(cacheKey));
}

async function cachedFiles(run: Runner, hashes: string[]): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  const c = run.r.cached;
  if (!c || !hashes.length) return out;
  const data = await run.call(c.request, { hashes: hashes.join(","), hash: hashes[0] });
  for (const x of list(get(data, c.items))) {
    const h = String(get(x, c.hash) || "").toLowerCase();
    if (h) out.set(h, x);
  }
  return out;
}

interface Found {
  cands: RCand[];
  misses: { hash: string; title: string }[];
}
async function foundCands(run: Runner, queries: string[]): Promise<Found> {
  const c = run.r.cached;
  const finders = (run.r.find || []).filter(
    (f) => !f.when || String(run.settings[f.when] ?? "true") !== "false",
  );
  if (!c || !finders.length) return { cands: [], misses: [] };
  const seen = new Map<string, string>();
  const max = c.max || 40;
  outer: for (const q of queries) {
    for (const f of finders) {
      const data = await run.call(f.request, { query: q }).catch(() => null);
      for (const x of list(get(data, f.items))) {
        const h = String(get(x, f.hash) || "").toLowerCase();
        if (/^[0-9a-f]{32,64}$/.test(h) && !seen.has(h))
          seen.set(h, String(f.title ? get(x, f.title) || "" : ""));
        if (seen.size >= max) break outer;
      }
      if (seen.size) break;
    }
    if (seen.size >= 15) break;
  }
  const out: RCand[] = [];
  const have = await cachedFiles(run, [...seen.keys()]);
  for (const [hash, info] of have) {
    const raw = String(c.name ? get(info, c.name) || "" : "");
    const name = (/^[0-9a-f]{32,64}$/i.test(raw) ? "" : raw) || seen.get(hash) || "";
    out.push(...filesOf(c, info, name, () => ({ hash })));
  }
  return {
    cands: out,
    misses: [...seen].filter(([h]) => !have.has(h)).map(([hash, title]) => ({ hash, title })),
  };
}

export async function readPlaylist(
  r: Definition,
  settings: Record<string, string>,
  link: string,
): Promise<{ name: string; tracks: ListedTrack[] } | null> {
  if (missingSettings(r, settings).length) return null;
  for (const pl of r.playlists || []) {
    const m = new RegExp(pl.match, "i").exec(link);
    if (!m) continue;
    const run = new Runner(r, settings),
      vars: Vars = { link };
    m.forEach((g, i) => {
      vars["m" + i] = g || "";
    });
    const tracks: ListedTrack[] = [];
    let name = "",
      data = await run.call(pl.request, vars);
    for (let page = 0; page < 12 && data; page++) {
      if (!name && pl.name) name = String(get(data, pl.name) || "");
      for (const x of list(get(data, pl.items))) {
        const title = String(get(x, pl.title) || "").trim();
        let artist = String(get(x, pl.artist) || "")
          .replace(/\u00a0/g, " ")
          .trim();
        if (pl.artistFirst) artist = artist.split(pl.artistFirst)[0].trim();
        if (title)
          tracks.push({
            title,
            artist,
            album: pl.album ? String(get(x, pl.album) || "") || undefined : undefined,
            isrc: pl.isrc ? String(get(x, pl.isrc) || "") || undefined : undefined,
          });
      }
      const next = pl.next ? get(data, pl.next) : null;
      if (typeof next !== "string" || !/^https?:\/\//.test(next) || tracks.length >= 1000) break;
      data = await run
        .call({ url: "{{&next}}", headers: pl.request.headers }, { ...vars, next })
        .catch(() => null);
    }
    return { name, tracks };
  }
  return null;
}

async function altAlbums(env: Env, want: Want): Promise<string[]> {
  const bare = (x: string) =>
    x
      .replace(/[\(\[][^\)\]]*[\)\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const title = bare(want.title) || want.title;
  const page = await provider(env)
    .findTracks(title, want.artist, 40)
    .catch(() => null);
  const skip = new Set([norm(want.album || ""), norm(want.title), norm(title)]);
  const out: string[] = [];
  for (const t of page || []) {
    if (sim(t.artistName || "", want.artist) < 0.5 || sim(t.title || "", want.title) < 0.9)
      continue;
    const album = bare(t.albumTitle || "");
    const key = norm(album);
    if (!key || skip.has(key) || sim(album, title) >= 0.9) continue;
    skip.add(key);
    out.push(album);
    if (out.length >= 3) break;
  }
  return out;
}

export interface StreamLink {
  url: string;
  container?: string;
  expiresAt?: number;
}

const sessKey = async (connectionId: string, settings: Record<string, string>) =>
  `${connectionId}-${(await digestHex("SHA-256", JSON.stringify(settings))).slice(0, 24)}`;

export async function testDefinition(
  env: Env,
  r: Definition,
  settings: Record<string, string>,
  connectionId: string,
): Promise<{ ok: boolean; message: string }> {
  const miss = missingSettings(r, settings);
  if (miss.length) return { ok: false, message: "fill in: " + miss.join(", ") };
  const run = new Runner(r, settings, env, await sessKey(connectionId, settings));
  try {
    if (r.session) await run.login();
    if (r.check) await run.call(r.check);
    else if (r.library?.[0]) await run.call(r.library[0].request, { offset: 0, limit: 1 });
    return { ok: true, message: "connected" };
  } catch (e: any) {
    return { ok: false, message: e?.message || "request failed" };
  }
}

export async function fetchLyrics(
  env: Env,
  r: Definition,
  settings: Record<string, string>,
  connectionId: string,
  t: MTrack,
): Promise<{ synced?: string; plain?: string } | null> {
  const def = r.lyrics;
  if (!def || missingSettings(r, settings).length) return null;
  const run = new Runner(r, settings, env, await sessKey(connectionId, settings));
  const vars = {
    title: t.title,
    artist: t.artistName,
    album: t.albumTitle || "",
    duration: t.duration ? Math.round(t.duration) : "",
    isrc: t.isrc || "",
  };
  const read = (x: any, synced?: string, plain?: string) => {
    if (!x || (holds(def.skip?.length ? def.skip : undefined, x) && def.skip?.length)) return null;
    const a = synced ? get(x, synced) : undefined,
      b = plain ? get(x, plain) : undefined;
    return (typeof a === "string" && a.trim()) || (typeof b === "string" && b.trim())
      ? {
          synced: typeof a === "string" && a.trim() ? a : undefined,
          plain: typeof b === "string" && b.trim() ? b : undefined,
        }
      : null;
  };
  const exact = read(await run.call(def.request, vars).catch(() => null), def.synced, def.plain);
  if (exact || !def.search) return exact;
  const rows = list(
    get(await run.call(def.search.request, vars).catch(() => null), def.search.items),
  );
  let best: any = null,
    top = 1.2;
  for (const x of rows) {
    const got = read(x, def.search.synced ?? def.synced, def.search.plain ?? def.plain);
    if (!got) continue;
    const d = def.search.duration ? Number(get(x, def.search.duration)) : 0;
    const sc =
      sim(String(get(x, def.search.title) || ""), t.title) +
      sim(String(get(x, def.search.artist) || ""), t.artistName) -
      (t.duration && d ? Math.min(Math.abs(d - t.duration) / 30, 1) : 0) +
      (got.synced ? 0.2 : 0);
    if (sc > top) {
      top = sc;
      best = got;
    }
  }
  return best;
}

export async function reportPlay(
  env: Env,
  r: Definition,
  settings: Record<string, string>,
  connectionId: string,
  kind: "nowPlaying" | "played",
  t: MTrack,
  startedAt?: number,
): Promise<string | null> {
  const req = r.track?.[kind];
  if (!req || missingSettings(r, settings).length) return null;
  const track = {
    title: t.title,
    artist: t.artistName,
    album: t.albumTitle || "",
    duration: t.duration || 0,
    durationMs: (t.duration || 0) * 1000,
    isrc: t.isrc || "",
    trackNo: t.trackNo || "",
  };
  try {
    await new Runner(r, settings, env, await sessKey(connectionId, settings)).call(req, {
      track,
      timestamp: Math.floor((startedAt || Date.now()) / 1000),
    });
    return null;
  } catch (e: any) {
    return `${r.name}: ${e?.message || "failed"}`;
  }
}

export async function resolveTrack(
  env: Env,
  r: Definition,
  settings: Record<string, string>,
  connectionId: string,
  t: MTrack,
  deadline: number,
): Promise<StreamLink | null> {
  if (missingSettings(r, settings).length || !(r.library?.length || r.tracks?.length)) return null;
  const run = new Runner(r, settings, env, await sessKey(connectionId, settings));
  const s = { quality: qualityFrom(settings[r.quality || "quality"] ?? null) };
  const want: Want = { title: t.title, artist: t.artistName, album: t.albumTitle };
  const cacheKey = `${connectionId}-${(await digestHex("SHA-256", JSON.stringify(settings))).slice(0, 24)}`;

  for (const src of r.tracks || []) {
    const data = await run.soft(
      run.call(src.request, {
        query: `${want.artist} ${want.title}`.trim(),
        title: want.title,
        artist: want.artist,
        album: want.album || "",
      }),
      null,
    );
    const rows = list(get(data, src.items));
    const cands: RCand[] = rows
      .map((x) => ({
        id: String(get(x, src.id) ?? ""),
        title: String(get(x, src.title) || ""),
        artist: String(get(x, src.artist) || ""),
        album: String(src.album ? get(x, src.album) || "" : ""),
        ext: String(src.ext ? get(x, src.ext) || "" : "").toLowerCase() || "mp3",
        size: 0,
        container: String(src.album ? get(x, src.album) || "" : ""),
        owned: true,
      }))
      .filter((c) => c.id && c.title);
    const got = bestMatch(cands, want, s);
    if (!got) continue;
    const item = rows.find((x) => String(get(x, src.id)) === got.id);
    let url: unknown;
    if (src.link.url) url = fill(src.link.url, { settings, id: got.id, item }, true);
    else url = get(await run.call(src.link.request!, { id: got.id, item }), src.link.path);
    if (typeof url === "string" && /^https?:/.test(url))
      return { url, container: got.ext, expiresAt: Date.now() + 3600_000 };
  }
  if (!r.library?.length) return null;

  const lib = await libraryCands(run, cacheKey);
  let hit = bestMatch(lib.cands, want, s) as RCand | null;
  if (!hit && Date.now() - lib.at > 60_000)
    hit = bestMatch(await topUpLibrary(run, cacheKey, lib), want, s) as RCand | null;
  if (!hit && run.r.find?.length) {
    const queries = [
      ...new Set(
        [
          want.album ? `${want.artist} ${want.album}` : "",
          `${want.artist} ${want.title}`,
          want.artist,
        ]
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ];
    const first = await foundCands(run, queries);
    hit = bestMatch(first.cands, want, s) as RCand | null;
    if (!hit) {
      const albums = await altAlbums(env, want);
      const q = albums.map((a) => a.replace(/[^\p{L}\p{N}]+/gu, " ").trim()).filter(Boolean);
      if (q.length)
        hit = bestMatch((await foundCands(run, q)).cands, { ...want, albums }, s) as RCand | null;
    }
    const un = run.r.uncached;
    if (
      !hit &&
      un &&
      run.r.attach &&
      String(settings[un.unless] ?? "true") === "false" &&
      first.misses.length
    ) {
      const goal = `${want.artist} ${want.album || want.title}`;
      let best: { hash: string; title: string } | null = null,
        top = 0;
      for (const m of first.misses) {
        const sc = sim(m.title.replace(/[\[\(\{][^\]\)\}]*[\]\)\}]/g, " "), goal);
        if (sc > top && norm(m.title).includes(norm(want.artist))) {
          top = sc;
          best = m;
        }
      }
      const key = best ? `fetch:${connectionId}:${best.hash}` : "";
      if (best && top >= 0.5 && !(await env.KV.get(key))) {
        await env.KV.put(key, "1", { expirationTtl: 86400 });
        await run.call(run.r.attach.request, { hash: best.hash }).catch(() => null);
        await dropLibraryCache(cacheKey);
      }
    }
  }
  if (!hit) return null;

  const link = async (src: LibSource, cid: string, fid: string): Promise<StreamLink> => {
    const url = get(await run.call(src.link.request, { id: cid, fileId: fid }), src.link.url);
    if (typeof url !== "string" || !/^https?:/.test(url))
      throw new ConnectionError(502, "the service returned no link");
    return { url, container: hit!.ext, expiresAt: Date.now() + 3600_000 };
  };
  if (hit.owned) {
    const src = run.r.library!.find((l) => l.kind === hit!.kind);
    return src ? link(src, hit.cid!, hit.fid!) : null;
  }

  const at = run.r.attach!,
    hash = hit.hash!;
  const src = run.r.library!.find((l) => l.kind === at.kind)!;
  if (!(await cachedFiles(run, [hash])).has(hash)) return null;
  const sameHash = (x: any) => String(get(x, src.hash || "hash") || "").toLowerCase() === hash;
  let item = (await libItems(run, src, true)).find(sameHash);
  let cid: string | undefined = item ? String(get(item, src.id)) : undefined;
  if (!item) {
    const made = get(await run.call(at.request, { hash }).catch(() => null), at.id);
    cid = made != null ? String(made) : undefined;
    await dropLibraryCache(cacheKey);
  }
  const fetchItem = async (): Promise<any> => {
    if (cid && src.one) {
      const v = get(await run.soft(run.call(src.one, { id: cid }), null), src.items);
      return Array.isArray(v) ? v[0] : v || undefined;
    }
    return (await libItems(run, src, true)).find(sameHash);
  };
  if (!item) item = await fetchItem();
  while (!item || !holds(src.ready, item) || !list(get(item, src.files)).length) {
    if (Date.now() + 3000 > deadline) return null;
    await sleep(3000);
    item = await fetchItem();
  }
  const base = hit.path!.split("/").pop();
  const files = list(get(item, src.files));
  const pathOf = (f: any) => String(get(f, src.file.path) || "");
  const file =
    files.find((f) => pathOf(f) === hit!.path) ||
    files.find(
      (f) => pathOf(f).split("/").pop() === base || (src.file.alt && get(f, src.file.alt) === base),
    );
  if (!file) return null;
  return link(src, String(get(item, src.id)), String(get(file, src.file.id || "id")));
}
