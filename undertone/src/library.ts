import { decodeId, idOf, newPlaylistId, KIND } from "./ids";
import { provider } from "./meta/provider";
import type { Env, MAlbum, MArtist, MItem, MTrack } from "./types";
import type { UserState } from "./jellyfin/dto";
import { randHex } from "./util";

const KIND_NUM: Record<string, number> = {
  artist: KIND.artist,
  album: KIND.album,
  track: KIND.track,
};

export async function getItem(env: Env, id: string): Promise<MItem | null> {
  const d = await decodeId(env, id);
  if (!d || d.provider === "local") return null;
  const p = provider(env);
  if (d.kind === "artist") return p.artist(d.pid);
  if (d.kind === "album") return (await p.album(d.pid))?.album || null;
  if (d.kind === "track") return p.track(d.pid);
  if (d.kind === "genre") return (await p.genres()).find((g) => g.pid === d.pid) || null;
  return null;
}

export async function getTrack(env: Env, id: string): Promise<MTrack | null> {
  const it = await getItem(env, id);
  return it && it.kind === "track" ? it : null;
}

export async function userStates(
  env: Env,
  userId: string,
  ids: string[],
): Promise<Map<string, UserState>> {
  const out = new Map<string, UserState>();
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 90) {
    const chunk = uniq.slice(i, i + 90);
    const { results } = await env.DB.prepare(
      `SELECT item_id, is_favorite, play_count, last_played, created_at FROM user_items WHERE user_id = ? AND item_id IN (${chunk.map(() => "?").join(",")})`,
    )
      .bind(userId, ...chunk)
      .all<any>();
    for (const r of results)
      out.set(r.item_id, {
        isFavorite: !!r.is_favorite,
        playCount: r.play_count,
        lastPlayed: r.last_played,
        createdAt: r.created_at,
      });
  }
  return out;
}

async function upsert(
  env: Env,
  userId: string,
  id: string,
  item: MItem,
  patch: { fav?: boolean; played?: boolean },
) {
  const kind = KIND_NUM[item.kind];
  if (!kind) return;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO user_items (user_id, item_id, kind, is_favorite, play_count, last_played, created_at, snapshot)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(user_id, item_id) DO UPDATE SET
       is_favorite = CASE WHEN ?9 IS NULL THEN is_favorite ELSE ?9 END,
       play_count = play_count + ?5,
       last_played = COALESCE(?6, last_played),
       snapshot = ?8`,
  )
    .bind(
      userId,
      id,
      kind,
      patch.fav ? 1 : 0,
      patch.played ? 1 : 0,
      patch.played ? now : null,
      now,
      JSON.stringify(item),
      patch.fav === undefined ? null : patch.fav ? 1 : 0,
    )
    .run();
}

export async function setFavorite(env: Env, userId: string, id: string, fav: boolean) {
  const item = await getItem(env, id);
  if (!item) {
    await env.DB.prepare("UPDATE user_items SET is_favorite = ? WHERE user_id = ? AND item_id = ?")
      .bind(fav ? 1 : 0, userId, id)
      .run();
    return;
  }
  await upsert(env, userId, id, item, { fav });
}

export async function markPlayed(env: Env, userId: string, id: string, t?: MTrack) {
  const item = t || (await getItem(env, id));
  if (!item) return;
  await upsert(env, userId, id, item, { played: true });
  if (item.kind === "track" && item.albumPid) {
    const albumId = idOf("album", "catalog", item.albumPid)!;
    const alb: MAlbum = {
      kind: "album",
      pid: item.albumPid,
      title: item.albumTitle || "",
      artistPid: item.albumArtistPid || item.artistPid,
      artistName: item.albumArtistName || item.artistName,
      image: item.image,
      year: item.year,
    };
    const existing = await env.DB.prepare(
      "SELECT 1 FROM user_items WHERE user_id = ? AND item_id = ?",
    )
      .bind(userId, albumId)
      .first();
    if (!existing) await upsert(env, userId, albumId, alb, {});
    else
      await env.DB.prepare(
        "UPDATE user_items SET last_played = ? WHERE user_id = ? AND item_id = ?",
      )
        .bind(Date.now(), userId, albumId)
        .run();
  }
}

export interface SavedRow<T> {
  item: T;
  state: UserState;
}

export async function savedItems<T extends MItem>(
  env: Env,
  userId: string,
  kind: "artist" | "album" | "track",
  opts: { favoritesOnly?: boolean; playedOnly?: boolean } = {},
): Promise<SavedRow<T>[]> {
  const where = ["user_id = ?", "kind = ?"];
  if (opts.favoritesOnly) where.push("is_favorite = 1");
  if (opts.playedOnly) where.push("play_count > 0");
  const { results } = await env.DB.prepare(
    `SELECT * FROM user_items WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 5000`,
  )
    .bind(userId, KIND_NUM[kind])
    .all<any>();
  const rows: SavedRow<T>[] = results.map((r) => ({
    item: JSON.parse(r.snapshot),
    state: {
      isFavorite: !!r.is_favorite,
      playCount: r.play_count,
      lastPlayed: r.last_played,
      createdAt: r.created_at,
    },
  }));
  if (kind === "artist" && !opts.favoritesOnly && !opts.playedOnly) {
    const albums = await savedItems<MAlbum>(env, userId, "album");
    const seen = new Set(rows.map((r) => (r.item as any).pid));
    for (const a of albums) {
      if (!a.item.artistPid || seen.has(a.item.artistPid)) continue;
      seen.add(a.item.artistPid);
      rows.push({
        item: { kind: "artist", pid: a.item.artistPid, name: a.item.artistName } as any,
        state: { isFavorite: false, playCount: 0, createdAt: a.state.createdAt },
      });
    }
  }
  return rows;
}

export async function listPlaylists(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM playlist_items i WHERE i.playlist_id = p.id) AS count,
            (SELECT snapshot FROM playlist_items i WHERE i.playlist_id = p.id ORDER BY position LIMIT 1) AS first
     FROM playlists p WHERE user_id = ? ORDER BY updated_at DESC`,
  )
    .bind(userId)
    .all<any>();
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    count: r.count,
    image: r.first ? JSON.parse(r.first).image : undefined,
  }));
}

export async function getPlaylist(env: Env, userId: string, id: string) {
  const r = await env.DB.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<any>();
  return r || null;
}

export async function playlistEntries(env: Env, playlistId: string) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY position",
  )
    .bind(playlistId)
    .all<any>();
  return results.map((r) => ({
    entryId: r.entry_id,
    itemId: r.item_id,
    track: JSON.parse(r.snapshot) as MTrack,
  }));
}

export async function createPlaylist(env: Env, userId: string, name: string, ids: string[]) {
  const id = newPlaylistId();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO playlists (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, userId, name || "Playlist", now, now)
    .run();
  if (ids.length) await addToPlaylist(env, id, ids);
  return id;
}

export async function addToPlaylist(env: Env, playlistId: string, ids: string[]) {
  const tracks: { id: string; t: MTrack }[] = [];
  const p = provider(env);
  for (const raw of ids) {
    const d = await decodeId(env, raw);
    if (!d) continue;
    if (d.kind === "track") {
      const t = await p.track(d.pid);
      if (t) tracks.push({ id: d.raw, t });
    } else if (d.kind === "album") {
      const a = await p.album(d.pid);
      for (const t of a?.tracks || []) tracks.push({ id: idOf("track", "catalog", t.pid)!, t });
    } else if (d.kind === "artist") {
      for (const t of await p.artistTopTracks(d.pid, 25))
        tracks.push({ id: idOf("track", "catalog", t.pid)!, t });
    }
  }
  const pos = await env.DB.prepare(
    "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM playlist_items WHERE playlist_id = ?",
  )
    .bind(playlistId)
    .first<{ p: number }>();
  let n = pos?.p || 0;
  const stmts = tracks.map(({ id, t }) =>
    env.DB.prepare(
      "INSERT INTO playlist_items (entry_id, playlist_id, item_id, position, snapshot) VALUES (?, ?, ?, ?, ?)",
    ).bind(randHex(16), playlistId, id, n++, JSON.stringify(t)),
  );
  stmts.push(
    env.DB.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").bind(Date.now(), playlistId),
  );
  await env.DB.batch(stmts);
}

export async function removeFromPlaylist(env: Env, playlistId: string, entryIds: string[]) {
  if (!entryIds.length) return;
  await env.DB.prepare(
    `DELETE FROM playlist_items WHERE playlist_id = ? AND entry_id IN (${entryIds.map(() => "?").join(",")})`,
  )
    .bind(playlistId, ...entryIds)
    .run();
  await renumber(env, playlistId);
}

export async function moveInPlaylist(
  env: Env,
  playlistId: string,
  entryId: string,
  newIndex: number,
) {
  const entries = await playlistEntries(env, playlistId);
  const idx = entries.findIndex((e) => e.entryId === entryId);
  if (idx < 0) return;
  const [e] = entries.splice(idx, 1);
  entries.splice(Math.max(0, Math.min(newIndex, entries.length)), 0, e);
  await env.DB.batch(
    entries.map((x, i) =>
      env.DB.prepare("UPDATE playlist_items SET position = ? WHERE entry_id = ?").bind(
        i,
        x.entryId,
      ),
    ),
  );
}

async function renumber(env: Env, playlistId: string) {
  const entries = await playlistEntries(env, playlistId);
  if (entries.length)
    await env.DB.batch(
      entries.map((x, i) =>
        env.DB.prepare("UPDATE playlist_items SET position = ? WHERE entry_id = ?").bind(
          i,
          x.entryId,
        ),
      ),
    );
}

export type { MArtist };
