import {
  createUser,
  HttpError,
  invalidateUserCache,
  issueToken,
  requireUser,
  setPassword,
  updateSettings,
  userCount,
  verifyLogin,
} from "../auth";
import {
  addConnection,
  addConnectionFile,
  getConnection,
  importPack,
  listConnections,
  reloadManifest,
  resolveStream,
  testConnection,
} from "../connections";
import { isDefinition, missingSettings, readPlaylist, type ListedTrack } from "../engine";
import { sim } from "../match";
import { createPlaylist, getTrack } from "../library";

function parseTrackList(text: string): ListedTrack[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const cells = (l: string) => {
    const out: string[] = [];
    let cur = "",
      q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') {
        if (q && l[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if ((ch === "," || ch === ";" || ch === "\t") && !q) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const head = cells(lines[0]).map((h) => h.toLowerCase());
  const ti = head.findIndex((h) => /^(track name|track|title|name|song)$/.test(h)),
    ai = head.findIndex((h) => /^(artist name\(s\)|artist name|artists?|artist\(s\))$/.test(h)),
    bi = head.findIndex((h) => /^(album name|album)$/.test(h)),
    ii = head.findIndex((h) => h === "isrc");
  if (ti >= 0 && ai >= 0)
    return lines
      .slice(1)
      .map(cells)
      .filter((c) => c[ti])
      .map((c) => ({
        title: c[ti],
        artist: (c[ai] || "").split(/[,;]/)[0].trim(),
        album: bi >= 0 ? c[bi] || undefined : undefined,
        isrc: ii >= 0 ? c[ii] || undefined : undefined,
      }));
  if (lines.some((l) => /^#EXTINF:/i.test(l))) {
    return lines
      .filter((l) => /^#EXTINF:/i.test(l))
      .map((l) => l.replace(/^#EXTINF:[^,]*,/i, "").trim())
      .filter(Boolean)
      .map((l) => {
        const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(l);
        return m ? { artist: m[1].trim(), title: m[2].trim() } : { title: l, artist: "" };
      });
  }
  const out: ListedTrack[] = [];
  for (const raw of lines) {
    const l = raw.replace(/^\s*\d{1,3}[.)]\s+/, "");
    const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(l) || /^(.+?)\t+(.+)$/.exec(l);
    if (m) out.push({ artist: m[1].trim(), title: m[2].trim() });
    else {
      const by = /^(.+?)\s+by\s+(.+)$/i.exec(l);
      out.push(by ? { title: by[1].trim(), artist: by[2].trim() } : { title: l, artist: "" });
    }
  }
  return out;
}
import { idOf } from "../ids";
import { clearCatalog, currentCatalog, provider, setCatalog } from "../meta/provider";
import { Router } from "../router";
import type { Ctx, Env, User } from "../types";
import { empty, json, randHex } from "../util";
import { SETUP_HTML } from "./page";
import fontDisplay from "./fonts/display.woff2";
import fontText from "./fonts/text.woff2";

const FONTS: Record<string, Uint8Array> = { "display.woff2": fontDisplay, "text.woff2": fontText };

function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    isAdmin: !!u.is_admin,
    streamMode: u.settings.streamMode || "redirect",
  };
}

function connectionView(a: any) {
  return {
    id: a.id,
    url: isDefinition(a.manifest) ? a.base_url : a.base_url + "/manifest.json",
    kind: String(a.base_url).startsWith("file:")
      ? "file"
      : isDefinition(a.manifest)
        ? "json"
        : "server",
    does: isDefinition(a.manifest)
      ? [
          a.manifest.library?.length || a.manifest.tracks?.length ? "audio" : "",
          a.manifest.find?.length ? "search" : "",
          a.manifest.track ? "history" : "",
          a.manifest.playlists?.length ? "playlists" : "",
          a.manifest.lyrics ? "lyrics" : "",
          a.manifest.catalog ? "catalog" : "",
        ].filter(Boolean)
      : ["audio"],
    missing: isDefinition(a.manifest) ? missingSettings(a.manifest, a.settings) : [],
    name: a.manifest.name,
    version: a.manifest.version,
    icon: a.manifest.icon,
    description: a.manifest.description,
    resources: a.manifest.resources,
    settingsSchema: a.manifest.settings || [],
    settings: a.settings,
    enabled: !!a.enabled,
    position: a.position,
  };
}

async function signupOpen(env: Env): Promise<boolean> {
  const v = await env.KV.get("cfg:signup");
  return v ? v === "open" : env.SIGNUP === "open";
}

function requireAdmin(c: Ctx) {
  const u = requireUser(c);
  if (!u.is_admin) throw new HttpError(403, "Admin only");
  return u;
}

export function webRouter(): Router {
  const r = new Router();
  r.get(
    "/undertone/font/:name",
    async (c) => {
      const f = FONTS[c.params.name];
      return f
        ? new Response(f as unknown as BodyInit, {
            headers: {
              "content-type": "font/woff2",
              "cache-control": "public, max-age=31536000, immutable",
            },
          })
        : new Response(null, { status: 404 });
    },
    false,
  );
  const page = () =>
    new Response(SETUP_HTML, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
    });
  r.get("/", page, false);
  r.get("/setup", page, false);
  r.get("/web", page, false);
  r.get("/web/index.html", page, false);

  r.get(
    "/undertone/api/status",
    async (c) =>
      json({
        serverName: c.env.SERVER_NAME || "Undertone",
        hasUsers: (await userCount(c.env)) > 0,
        signupOpen: await signupOpen(c.env),
        catalog: await currentCatalog(c.env).then((x) =>
          x
            ? { name: x.manifest.name, description: x.manifest.description || "", url: x.url }
            : null,
        ),
        serverUrl: c.url.origin,
      }),
    false,
  );

  r.post(
    "/undertone/api/register",
    async (c) => {
      const { username, password } = c.body || {};
      const first = (await userCount(c.env)) === 0;
      if (!first && !(await signupOpen(c.env)))
        throw new HttpError(403, "Registration is closed. Ask the admin for an account.");
      const u = await createUser(c.env, String(username || ""), String(password || ""), first);
      const token = await issueToken(c.env, u, {
        client: "Undertone Web",
        device: "Browser",
        deviceId: "web-" + randHex(6),
      });
      return json({ token, user: publicUser(u) });
    },
    false,
  );

  r.post(
    "/undertone/api/login",
    async (c) => {
      const { username, password } = c.body || {};
      const u = await verifyLogin(c.env, String(username || ""), String(password || ""));
      if (!u) throw new HttpError(401, "Invalid username or password");
      const token = await issueToken(c.env, u, {
        client: "Undertone Web",
        device: "Browser",
        deviceId: "web-" + randHex(6),
      });
      return json({ token, user: publicUser(u) });
    },
    false,
  );

  r.get("/undertone/api/me", async (c) => {
    const u = requireUser(c);
    return json({
      user: publicUser(u),
      connections: (await listConnections(c.env, u.id)).map(connectionView),
    });
  });

  r.post("/undertone/api/settings", async (c) => {
    const u = requireUser(c);
    const b = c.body || {};
    const patch: Record<string, unknown> = {};
    if (b.streamMode === "redirect" || b.streamMode === "proxy") patch.streamMode = b.streamMode;
    await updateSettings(c.env, u, patch);
    return json({ user: publicUser(u) });
  });

  r.post("/undertone/api/password", async (c) => {
    const u = requireUser(c);
    if (!(await verifyLogin(c.env, u.name, c.body?.current || "")))
      throw new HttpError(403, "Current password is wrong");
    await setPassword(c.env, u.id, c.body?.next || "");
    return empty();
  });

  r.post("/undertone/api/connections", async (c) => {
    const u = requireUser(c);
    const doc = typeof c.body?.json === "string" ? JSON.parse(c.body.json) : c.body?.json;
    const a = doc
      ? await addConnectionFile(c.env, u, doc, c.body?.settings || {})
      : await addConnection(c.env, u, String(c.body?.url || ""), c.body?.settings || {});
    return json(connectionView(a));
  });
  r.post("/undertone/api/connections/import", async (c) => {
    const u = requireUser(c);
    const b = c.body || {};
    let src: any = b.url;
    if (!src && b.json) src = typeof b.json === "string" ? JSON.parse(b.json) : b.json;
    if (!src) throw new HttpError(400, "Provide a pack URL or JSON");
    return json(await importPack(c.env, u, src));
  });
  r.post("/undertone/api/connections/:id", async (c) => {
    const u = requireUser(c);
    const a = await getConnection(c.env, u.id, c.params.id);
    if (!a) throw new HttpError(404, "Connection not found");
    const b = c.body || {};
    if (b.settings && typeof b.settings === "object") {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(b.settings))
        if (v !== null && v !== undefined) clean[k] = String(v);
      await c.env.DB.prepare("UPDATE connections SET settings = ? WHERE id = ?")
        .bind(JSON.stringify(clean), a.id)
        .run();
    }
    if (typeof b.enabled === "boolean")
      await c.env.DB.prepare("UPDATE connections SET enabled = ? WHERE id = ?")
        .bind(b.enabled ? 1 : 0, a.id)
        .run();
    await clearResolveCache(c, u);
    return json(connectionView((await getConnection(c.env, u.id, a.id))!));
  });
  r.post("/undertone/api/connections/:id/move", async (c) => {
    const u = requireUser(c);
    const list = await listConnections(c.env, u.id);
    const i = list.findIndex((a) => a.id === c.params.id);
    const j = i + (c.body?.dir === -1 ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return empty();
    [list[i], list[j]] = [list[j], list[i]];
    await c.env.DB.batch(
      list.map((a, k) =>
        c.env.DB.prepare("UPDATE connections SET position = ? WHERE id = ?").bind(k, a.id),
      ),
    );
    await clearResolveCache(c, u);
    return empty();
  });
  r.post("/undertone/api/connections/:id/refresh", async (c) => {
    const u = requireUser(c);
    const a = await getConnection(c.env, u.id, c.params.id);
    if (!a) throw new HttpError(404, "Connection not found");
    const m = await reloadManifest(a);
    await c.env.DB.prepare("UPDATE connections SET manifest = ?, fetched_at = ? WHERE id = ?")
      .bind(JSON.stringify(m), Date.now(), a.id)
      .run();
    return json(connectionView((await getConnection(c.env, u.id, a.id))!));
  });
  r.post("/undertone/api/connections/:id/test", async (c) => {
    const u = requireUser(c);
    const a = await getConnection(c.env, u.id, c.params.id);
    if (!a) throw new HttpError(404, "Connection not found");
    return json(await testConnection(c.env, a));
  });
  r.del("/undertone/api/connections/:id", async (c) => {
    const u = requireUser(c);
    await c.env.DB.prepare("DELETE FROM connections WHERE id = ? AND user_id = ?")
      .bind(c.params.id, u.id)
      .run();
    await clearResolveCache(c, u);
    return empty();
  });

  r.get("/undertone/api/catalog", async (c) => {
    requireUser(c);
    const index = (c.env.CONNECTIONS_INDEX || "").trim();
    if (!/^https?:\/\//.test(index)) return json({ connections: [] });
    const res = await fetch(index, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    const data: any = res && res.ok ? await res.json().catch(() => null) : null;
    const rows = Array.isArray(data?.connections) ? data.connections : [];
    return json({
      connections: rows
        .filter((x: any) => x && (x.file || x.url) && x.name)
        .slice(0, 200)
        .map((x: any) => ({
          url: new URL(String(x.url || x.file), index).toString(),
          name: String(x.name),
          description: String(x.description || ""),
          does: Array.isArray(x.does) ? x.does.map(String) : [],
        })),
    });
  });

  r.post("/undertone/api/import/read", async (c) => {
    const u = requireUser(c);
    const link = String(c.body?.url || "").trim(),
      text = String(c.body?.text || "");
    if (/^https?:\/\/\S+$/.test(link)) {
      const readers = (await listConnections(c.env, u.id, true)).filter(
        (a) => isDefinition(a.manifest) && a.manifest.playlists?.length,
      );
      for (const a of readers) {
        const got = await readPlaylist(a.manifest, a.settings, link).catch((e) => {
          throw new HttpError(502, `${a.manifest.name}: ${e.message}`);
        });
        if (got && !got.tracks.length)
          throw new HttpError(
            404,
            `${a.manifest.name} found no songs at that link. Is the playlist public?`,
          );
        if (got)
          return json({ name: got.name, tracks: got.tracks.slice(0, 1000), via: a.manifest.name });
      }
      throw new HttpError(
        400,
        readers.length
          ? "None of your connections can read that link. Paste the track list as text instead."
          : "Reading links needs a connection for that service. You can paste the track list as text instead.",
      );
    }
    const tracks = parseTrackList(text || link);
    if (!tracks.length)
      throw new HttpError(
        400,
        "Paste a playlist link, or a list with one “Artist - Title” per line.",
      );
    return json({ name: "", tracks: tracks.slice(0, 1000), via: null });
  });
  r.post("/undertone/api/import/match", async (c) => {
    requireUser(c);
    const w: ListedTrack = {
      title: String(c.body?.title || ""),
      artist: String(c.body?.artist || ""),
      album: c.body?.album ? String(c.body.album) : undefined,
    };
    if (!w.title) return json({ found: false });
    const p = provider(c.env);
    const pick = (items: any[]) => {
      let best: any = null,
        top = 0;
      for (const t of items) {
        const sc =
          sim(t.title, w.title) * 0.6 +
          (w.artist ? sim(t.artistName || "", w.artist) : 0.7) * 0.3 +
          (w.album && t.albumTitle && sim(t.albumTitle, w.album) >= 0.6 ? 0.1 : 0) +
          (String(t.title).toLowerCase() === w.title.toLowerCase() ? 0.05 : 0);
        if (
          sim(t.title, w.title) >= 0.6 &&
          (!w.artist ||
            sim(t.artistName || "", w.artist) >= 0.4 ||
            (t.artistName || "").toLowerCase().includes(w.artist.toLowerCase())) &&
          sc > top
        ) {
          top = sc;
          best = t;
        }
      }
      return best;
    };
    let hit = w.artist ? pick(await p.findTracks(w.title, w.artist, 8).catch(() => [])) : null;
    if (!hit)
      hit = pick(
        (
          await p
            .searchTracks(`${w.artist} ${w.title}`.trim(), 8, 0)
            .catch(() => ({ items: [] }) as any)
        ).items,
      );
    if (!hit) return json({ found: false });
    return json({
      found: true,
      id: idOf("track", "catalog", hit.pid),
      title: hit.title,
      artist: hit.artistName,
      album: hit.albumTitle,
      image: hit.image,
    });
  });
  r.post("/undertone/api/import/warm", async (c) => {
    const u = requireUser(c);
    const id = String(c.body?.id || "");
    const t = await getTrack(c.env, id);
    if (!t) return json({ ready: false });
    if (!t.isrc) {
      const full = await provider(c.env).track(t.pid);
      if (full) Object.assign(t, full);
    }
    const res = await resolveStream(c.env, u, id, t).catch(() => null);
    return json({ ready: !!res, connection: res?.connectionName || null });
  });
  r.post("/undertone/api/import/save", async (c) => {
    const u = requireUser(c);
    const ids = (Array.isArray(c.body?.ids) ? c.body.ids : [])
      .map((x: unknown) => String(x))
      .filter((x: string) => /^[0-9a-f]{32}$/.test(x))
      .slice(0, 1000);
    if (!ids.length) throw new HttpError(400, "Nothing to save");
    const name =
      String(c.body?.name || "")
        .trim()
        .slice(0, 120) || "Imported playlist";
    return json({ id: await createPlaylist(c.env, u.id, name, ids), name, count: ids.length });
  });

  r.get("/undertone/api/try", async (c) => {
    const u = requireUser(c);
    const q = c.q.get("q") || "";
    const p = provider(c.env);
    const hit = (await p.searchTracks(q, 1, 0)).items[0];
    if (!hit) return json({ found: false });
    const full = (await p.track(hit.pid)) || hit;
    const id = idOf("track", "catalog", full.pid)!;
    const started = Date.now();
    const res = await resolveStream(c.env, u, id, full, { fresh: true });
    return json({
      found: true,
      track: {
        title: full.title,
        artist: full.artistName,
        album: full.albumTitle,
        isrc: full.isrc,
        image: full.image,
      },
      resolved: res
        ? {
            connection: res.connectionName,
            container: res.container,
            url: res.url.slice(0, 120) + (res.url.length > 120 ? "…" : ""),
          }
        : null,
      ms: Date.now() - started,
    });
  });

  r.post("/undertone/api/server", async (c) => {
    requireAdmin(c);
    if (typeof c.body?.signupOpen === "boolean")
      await c.env.KV.put("cfg:signup", c.body.signupOpen ? "open" : "closed");
    return json({ signupOpen: await signupOpen(c.env) });
  });
  r.post("/undertone/api/server/catalog", async (c) => {
    requireAdmin(c);
    const b = c.body || {};
    if (b.remove) {
      await clearCatalog(c.env);
      return json({ catalog: null });
    }
    const doc = typeof b.json === "string" ? JSON.parse(b.json) : b.json;
    const ch = await setCatalog(
      c.env,
      doc ? { json: doc } : { url: String(b.url || "") },
      b.settings || {},
    );
    return json({
      catalog: { name: ch.manifest.name, description: ch.manifest.description || "", url: ch.url },
    });
  });
  r.get("/undertone/api/users", async (c) => {
    requireAdmin(c);
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, is_admin, created_at, last_login FROM users ORDER BY created_at",
    ).all();
    return json(results);
  });
  r.post("/undertone/api/users", async (c) => {
    requireAdmin(c);
    const u = await createUser(
      c.env,
      String(c.body?.username || ""),
      String(c.body?.password || ""),
      !!c.body?.admin,
    );
    return json(publicUser(u));
  });
  r.del("/undertone/api/users/:id", async (c) => {
    const me = requireAdmin(c);
    if (c.params.id === me.id) throw new HttpError(400, "You can't delete yourself");
    await invalidateUserCache(c.env, c.params.id);
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM tokens WHERE user_id = ?").bind(c.params.id),
      c.env.DB.prepare("DELETE FROM connections WHERE user_id = ?").bind(c.params.id),
      c.env.DB.prepare("DELETE FROM user_items WHERE user_id = ?").bind(c.params.id),
      c.env.DB.prepare(
        "DELETE FROM playlist_items WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)",
      ).bind(c.params.id),
      c.env.DB.prepare("DELETE FROM playlists WHERE user_id = ?").bind(c.params.id),
      c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(c.params.id),
    ]);
    return empty();
  });

  return r;
}

async function clearResolveCache(c: Ctx, u: User) {
  let cursor: string | undefined;
  do {
    const page = await c.env.KV.list({ prefix: `res:${u.id}:`, cursor });
    await Promise.all(page.keys.map((k) => c.env.KV.delete(k.name)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}
