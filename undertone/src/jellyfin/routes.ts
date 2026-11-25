import {
  createUser,
  HttpError,
  issueToken,
  requireUser,
  revokeToken,
  setPassword,
  userCount,
  verifyLogin,
} from "../auth";
import { peekResolved, resolveStream } from "../connections";
import { cleanId, decodeId, idOf, VIEW_MUSIC, VIEW_PLAYLISTS } from "../ids";
import {
  addToPlaylist,
  createPlaylist,
  getItem,
  getPlaylist,
  getTrack,
  listPlaylists,
  markPlayed,
  moveInPlaylist,
  playlistEntries,
  removeFromPlaylist,
  savedItems,
  setFavorite,
  userStates,
} from "../library";
import { getLyrics } from "../lyrics";
import { currentCatalog, provider } from "../meta/provider";
import { Router } from "../router";
import { nowPlaying, scrobble, shouldScrobble } from "../scrobble";
import type { Ctx, MAlbum, MArtist, MItem, MTrack, Page, User } from "../types";
import { empty, err, json, splitList, TICKS, toInt } from "../util";
import {
  albumDto,
  artistDto,
  dtoFor,
  genreDto,
  mediaSource,
  playlistDto,
  queryResult,
  trackDto,
  viewDtos,
  type UserState,
} from "./dto";

export const VERSION = "10.10.7";
const P = "catalog";

function qp(c: Ctx, k: string) {
  return c.q.get(k.toLowerCase());
}
function types(c: Ctx): Set<string> {
  return new Set(splitList(qp(c, "IncludeItemTypes")).map((s) => s.toLowerCase()));
}
function paging(c: Ctx, defLimit = 100) {
  const start = Math.max(0, toInt(qp(c, "StartIndex"), 0));
  const limit = Math.min(Math.max(1, toInt(qp(c, "Limit"), defLimit)), 500);
  return { start, limit };
}
function wantsFavorites(c: Ctx) {
  return (
    qp(c, "IsFavorite") === "true" ||
    splitList(qp(c, "Filters")).some((f) => f.toLowerCase() === "isfavorite")
  );
}
function wantsPlayed(c: Ctx) {
  return (
    qp(c, "IsPlayed") === "true" ||
    splitList(qp(c, "Filters")).some((f) => f.toLowerCase() === "isplayed")
  );
}

function mid(item: MItem): string {
  return idOf(item.kind === "track" ? "track" : item.kind, P, item.pid)!;
}

async function dtos(c: Ctx, items: MItem[], states?: Map<string, UserState>) {
  const u = requireUser(c);
  const st = states || (await userStates(c.env, u.id, items.map(mid)));
  return items.map((it) => dtoFor(c, it, st.get(mid(it))));
}

const SORTERS: Record<string, (a: any, b: any) => number> = {
  sortname: (a, b) => (a.SortName || a.Name || "").localeCompare(b.SortName || b.Name || ""),
  name: (a, b) => (a.Name || "").localeCompare(b.Name || ""),
  album: (a, b) => (a.Album || "").localeCompare(b.Album || ""),
  albumartist: (a, b) => (a.AlbumArtist || "").localeCompare(b.AlbumArtist || ""),
  artist: (a, b) => (a.Artists?.[0] || "").localeCompare(b.Artists?.[0] || ""),
  datecreated: (a, b) => (a.DateCreated || "").localeCompare(b.DateCreated || ""),
  dateplayed: (a, b) =>
    (a.UserData?.LastPlayedDate || "").localeCompare(b.UserData?.LastPlayedDate || ""),
  playcount: (a, b) => (a.UserData?.PlayCount || 0) - (b.UserData?.PlayCount || 0),
  productionyear: (a, b) => (a.ProductionYear || 0) - (b.ProductionYear || 0),
  premieredate: (a, b) => (a.PremiereDate || "").localeCompare(b.PremiereDate || ""),
  runtime: (a, b) => (a.RunTimeTicks || 0) - (b.RunTimeTicks || 0),
  indexnumber: (a, b) => (a.IndexNumber || 0) - (b.IndexNumber || 0),
  parentindexnumber: (a, b) => (a.ParentIndexNumber || 0) - (b.ParentIndexNumber || 0),
};

function sortDtos(c: Ctx, list: any[], fallback?: string) {
  const keys = splitList(qp(c, "SortBy") || fallback || "").map((s) => s.toLowerCase());
  if (!keys.length) return list;
  if (keys.includes("random")) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  const orders = splitList(qp(c, "SortOrder")).map((s) => s.toLowerCase());
  return list.sort((a, b) => {
    for (let i = 0; i < keys.length; i++) {
      const f = SORTERS[keys[i]];
      if (!f) continue;
      const r = f(a, b) * ((orders[i] || orders[0]) === "descending" ? -1 : 1);
      if (r) return r;
    }
    return 0;
  });
}

function pageLocal(c: Ctx, list: any[], fallbackSort?: string) {
  const { start, limit } = paging(c, 1000);
  const sorted = sortDtos(c, list, fallbackSort);
  return json(queryResult(sorted.slice(start, start + limit), sorted.length, start));
}

async function pageProvider<T extends MItem>(
  c: Ctx,
  fn: (limit: number, offset: number) => Promise<Page<T>>,
) {
  const { start, limit } = paging(c, 50);
  const page = await fn(Math.min(limit, 100), start);
  return json(queryResult(await dtos(c, page.items), page.total, start));
}

async function playlistItemsDtos(c: Ctx, playlistId: string) {
  const u = requireUser(c);
  const entries = await playlistEntries(c.env, playlistId);
  const st = await userStates(
    c.env,
    u.id,
    entries.map((e) => e.itemId),
  );
  return entries.map((e) => trackDto(c, e.track, st.get(e.itemId), { PlaylistItemId: e.entryId }));
}

async function playlistsDtos(c: Ctx) {
  const u = requireUser(c);
  return (await listPlaylists(c.env, u.id)).map((p) => playlistDto(c, p));
}

function userDto(c: Ctx, u: User) {
  return {
    Name: u.name,
    ServerId: c.serverId,
    Id: u.id,
    HasPassword: true,
    HasConfiguredPassword: true,
    HasConfiguredEasyPassword: false,
    EnableAutoLogin: false,
    LastLoginDate: u.last_login ? new Date(u.last_login).toISOString() : undefined,
    LastActivityDate: new Date().toISOString(),
    Configuration: {
      PlayDefaultAudioTrack: true,
      SubtitleLanguagePreference: "",
      DisplayMissingEpisodes: false,
      GroupedFolders: [],
      SubtitleMode: "Default",
      DisplayCollectionsView: false,
      EnableLocalPassword: false,
      OrderedViews: [VIEW_MUSIC, VIEW_PLAYLISTS],
      LatestItemsExcludes: [],
      MyMediaExcludes: [],
      HidePlayedInLatest: false,
      RememberAudioSelections: true,
      RememberSubtitleSelections: true,
      EnableNextEpisodeAutoPlay: true,
    },
    Policy: {
      IsAdministrator: !!u.is_admin,
      IsHidden: false,
      EnableCollectionManagement: true,
      EnableSubtitleManagement: false,
      EnableLyricManagement: false,
      IsDisabled: false,
      BlockedTags: [],
      AllowedTags: [],
      EnableUserPreferenceAccess: true,
      AccessSchedules: [],
      BlockUnratedItems: [],
      EnableRemoteControlOfOtherUsers: false,
      EnableSharedDeviceControl: false,
      EnableRemoteAccess: true,
      EnableLiveTvManagement: false,
      EnableLiveTvAccess: false,
      EnableMediaPlayback: true,
      EnableAudioPlaybackTranscoding: false,
      EnableVideoPlaybackTranscoding: false,
      EnablePlaybackRemuxing: false,
      ForceRemoteSourceTranscoding: false,
      EnableContentDeletion: false,
      EnableContentDeletionFromFolders: [],
      EnableContentDownloading: true,
      EnableSyncTranscoding: false,
      EnableMediaConversion: false,
      EnabledDevices: [],
      EnableAllDevices: true,
      EnabledChannels: [],
      EnableAllChannels: true,
      EnabledFolders: [],
      EnableAllFolders: true,
      InvalidLoginAttemptCount: 0,
      LoginAttemptsBeforeLockout: -1,
      MaxActiveSessions: 0,
      EnablePublicSharing: false,
      BlockedMediaFolders: [],
      BlockedChannels: [],
      RemoteClientBitrateLimit: 0,
      AuthenticationProviderId:
        "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
      PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
      SyncPlayAccess: "None",
    },
  };
}

function publicInfo(c: Ctx) {
  return {
    LocalAddress: c.url.origin,
    ServerName: c.env.SERVER_NAME || "Undertone",
    Version: VERSION,
    ProductName: "Jellyfin Server",
    OperatingSystem: "Linux",
    Id: c.serverId,
    StartupWizardCompleted: true,
  };
}

async function queryItems(c: Ctx): Promise<Response> {
  const u = requireUser(c);
  const env = c.env;
  const p = provider(env);
  const t = types(c);
  const search = qp(c, "SearchTerm")?.trim() || qp(c, "NameStartsWith")?.trim();
  const favOnly = wantsFavorites(c);
  const playedOnly = wantsPlayed(c);

  const ids = splitList(qp(c, "Ids")).map(cleanId);
  if (ids.length) {
    const out: any[] = [];
    const st = await userStates(env, u.id, ids);
    for (const id of ids) {
      if (id.startsWith("04")) {
        const pl = await getPlaylist(env, u.id, id);
        if (pl) out.push(playlistDto(c, { ...pl, count: (await playlistEntries(env, id)).length }));
        continue;
      }
      const it = await getItem(env, id).catch(() => null);
      if (it) out.push(dtoFor(c, it, st.get(id)));
    }
    return json(queryResult(out, out.length, 0));
  }

  const parentId = cleanId(qp(c, "ParentId"));
  if (parentId === VIEW_PLAYLISTS || (!parentId && t.has("playlist") && t.size === 1 && !search)) {
    return pageLocal(c, await playlistsDtos(c), "SortName");
  }
  if (parentId && parentId !== VIEW_MUSIC) {
    const d = await decodeId(env, parentId);
    if (!d) return json(queryResult([], 0, 0));
    if (d.kind === "playlist") {
      const pl = await getPlaylist(env, u.id, parentId);
      if (!pl) throw new HttpError(404, "Playlist not found");
      return pageLocal(c, await playlistItemsDtos(c, parentId));
    }
    if (d.kind === "album") {
      const a = await p.album(d.pid);
      if (!a) return json(queryResult([], 0, 0));
      const list = await dtos(c, a.tracks);
      return pageLocal(c, list, "ParentIndexNumber,IndexNumber");
    }
    if (d.kind === "artist") return artistChildren(c, d.pid, t);
    if (d.kind === "genre") return genreChildren(c, d.pid, t);
    return json(queryResult([], 0, 0));
  }

  const artistIds = [
    ...splitList(qp(c, "AlbumArtistIds")),
    ...splitList(qp(c, "ArtistIds")),
    ...splitList(qp(c, "ContributingArtistIds")),
  ].map(cleanId);
  if (artistIds.length) {
    const d = await decodeId(env, artistIds[0]);
    if (!d || d.kind !== "artist") return json(queryResult([], 0, 0));
    return artistChildren(c, d.pid, t);
  }
  const genreIds = splitList(qp(c, "GenreIds")).map(cleanId);
  if (genreIds.length) {
    const d = await decodeId(env, genreIds[0]);
    if (d?.kind === "genre") return genreChildren(c, d.pid, t);
  }
  const genres = splitList(qp(c, "Genres"));
  if (genres.length) {
    const g = (await p.genres()).find((x) => x.name.toLowerCase() === genres[0].toLowerCase());
    if (g) return genreChildren(c, g.pid, t);
  }

  if (search) return searchItems(c, search, t);

  if (t.has("musicgenre") || t.has("genre"))
    return pageLocal(
      c,
      (await p.genres()).map((g) => genreDto(c, g)),
      "SortName",
    );
  const kind = t.has("audio") ? "track" : t.has("musicartist") ? "artist" : "album";
  const saved = await savedItems<MItem & { kind: any }>(env, u.id, kind, {
    favoritesOnly: favOnly,
    playedOnly,
  });
  if (saved.length || favOnly || playedOnly) {
    const list = saved.map((s) => dtoFor(c, s.item, s.state));
    return pageLocal(c, list, "SortName");
  }
  if (kind === "track") return pageProvider(c, (l, o) => p.chartTracks(undefined, l, o));
  if (kind === "artist") return pageProvider(c, (l, o) => p.chartArtists(undefined, l, o));
  return pageProvider(c, (l, o) => p.chartAlbums(undefined, l, o));
}

async function artistChildren(c: Ctx, pid: string, t: Set<string>) {
  const p = provider(c.env);
  if (t.has("audio") && !t.has("musicalbum")) {
    const tracks = await p.artistTopTracks(pid, 50);
    return pageLocal(c, await dtos(c, tracks));
  }
  const { start, limit } = paging(c, 100);
  const page = await p.artistAlbums(pid, 300, 0);
  const list = sortDtos(c, await dtos(c, page.items), "PremiereDate");
  if (!qp(c, "SortBy")) list.reverse();
  return json(queryResult(list.slice(start, start + limit), list.length, start));
}

async function genreChildren(c: Ctx, gid: string, t: Set<string>) {
  const p = provider(c.env);
  if (t.has("audio")) return pageProvider(c, (l, o) => p.chartTracks(gid, l, o));
  if (t.has("musicartist")) return pageProvider(c, (l, o) => p.chartArtists(gid, l, o));
  return pageProvider(c, (l, o) => p.chartAlbums(gid, l, o));
}

async function searchItems(c: Ctx, q: string, t: Set<string>) {
  const p = provider(c.env);
  const { start, limit } = paging(c, 30);
  const want = t.size ? t : new Set(["musicartist", "musicalbum", "audio"]);
  const per = Math.min(limit, 50);
  const jobs: Promise<Page<MItem>>[] = [];
  if (want.has("musicartist")) jobs.push(p.searchArtists(q, per, start));
  if (want.has("musicalbum")) jobs.push(p.searchAlbums(q, per, start));
  if (want.has("audio")) jobs.push(p.searchTracks(q, per, start));
  const pages = await Promise.all(jobs);
  const items = pages.flatMap((pg) => pg.items);
  const total = pages.reduce((n, pg) => n + pg.total, 0);
  let list = await dtos(c, items);
  if (want.has("playlist")) {
    const pls = (await playlistsDtos(c)).filter((x) =>
      x.Name.toLowerCase().includes(q.toLowerCase()),
    );
    list = [...pls, ...list];
  }
  return json(queryResult(list, Math.max(total, list.length), start));
}

async function artistsQuery(c: Ctx) {
  const u = requireUser(c);
  const p = provider(c.env);
  const search = qp(c, "SearchTerm")?.trim() || qp(c, "NameStartsWith")?.trim();
  if (search) return pageProvider(c, (l, o) => p.searchArtists(search, l, o));
  const genreIds = splitList(qp(c, "GenreIds")).map(cleanId);
  if (genreIds.length) {
    const d = await decodeId(c.env, genreIds[0]);
    if (d?.kind === "genre") return pageProvider(c, (l, o) => p.chartArtists(d.pid, l, o));
  }
  const favOnly = wantsFavorites(c);
  const saved = await savedItems<MArtist>(c.env, u.id, "artist", { favoritesOnly: favOnly });
  if (saved.length || favOnly)
    return pageLocal(
      c,
      saved.map((s) => artistDto(c, s.item, s.state)),
      "SortName",
    );
  return pageProvider(c, (l, o) => p.chartArtists(undefined, l, o));
}

async function itemById(c: Ctx, rawId: string) {
  const u = requireUser(c);
  const id = cleanId(rawId);
  if (id === VIEW_MUSIC || id === VIEW_PLAYLISTS) return json(viewDtos(c).find((v) => v.Id === id));
  if (id.startsWith("04")) {
    const pl = await getPlaylist(c.env, u.id, id);
    if (!pl) throw new HttpError(404, "Not found");
    const entries = await playlistEntries(c.env, id);
    return json(
      playlistDto(c, {
        ...pl,
        count: entries.length,
        image: entries[0]?.track.image,
        duration: entries.reduce((n, e) => n + (e.track.duration || 0), 0),
      }),
    );
  }
  const it = await getItem(c.env, id);
  if (!it) throw new HttpError(404, "Item not found");
  const st = (await userStates(c.env, u.id, [id])).get(id);
  if (it.kind === "track") {
    const r = await peekResolved(c.env, u.id, id);
    return json(trackDto(c, it, st, r?.container ? { Container: r.container } : {}));
  }
  return json(dtoFor(c, it, st));
}

async function imageUrlFor(c: Ctx, rawId: string): Promise<string | undefined> {
  const id = cleanId(rawId);
  if (id.startsWith("04")) {
    const e = await c.env.DB.prepare(
      "SELECT snapshot FROM playlist_items WHERE playlist_id = ? ORDER BY position LIMIT 1",
    )
      .bind(id)
      .first<{ snapshot: string }>();
    return e ? JSON.parse(e.snapshot).image : undefined;
  }
  const it = await getItem(c.env, id).catch(() => null);
  return (it as any)?.image;
}

async function imageRedirect(c: Ctx, url: string | undefined) {
  if (!url) return err(404, "No image");
  const w = toInt(qp(c, "maxWidth") || qp(c, "fillWidth") || qp(c, "width"), 0);
  let target = url;
  const sizing = w > 0 ? (await currentCatalog(c.env))?.manifest.catalog?.imageSize : undefined;
  if (sizing?.sizes?.length) {
    try {
      const re = new RegExp(sizing.match);
      if (re.test(url)) {
        const size =
          [...sizing.sizes].sort((a, b) => a - b).find((x) => x >= w) ?? Math.max(...sizing.sizes);
        target = url.replace(re, sizing.replace.replaceAll("{{size}}", String(size)));
      }
    } catch {}
  }
  return new Response(null, {
    status: 302,
    headers: { location: target, "cache-control": "public, max-age=604800" },
  });
}

async function streamHandler(c: Ctx) {
  const u = requireUser(c);
  const id = cleanId(c.params.id);
  const t = await getTrack(c.env, id);
  if (!t) throw new HttpError(404, "Track not found");
  if (!t.isrc) {
    const full = await provider(c.env).track(t.pid);
    if (full) Object.assign(t, full);
  }
  let r = await resolveStream(c.env, u, id, t);
  if (!r)
    console.log(
      `no stream: ${t.artistName} - ${t.title} [${t.albumTitle || ""}] isrc=${t.isrc || "?"}`,
    );
  if (!r) return err(404, "Nothing you have connected has this track.");
  const mode =
    u.settings.streamMode || (c.env.DEFAULT_STREAM_MODE === "proxy" ? "proxy" : "redirect");
  const direct = mode === "redirect" && r.playable !== false;
  console.log(
    `stream: ${t.artistName} - ${t.title} → ${direct ? "redirect" : "proxy"}`,
    `(${r.container || "?"}, ${r.connectionName})`,
    `range=${c.req.headers.get("range") || "-"}`,
    `ua=${(c.req.headers.get("user-agent") || "").slice(0, 60)}`,
  );
  if (direct)
    return new Response(null, {
      status: 302,
      headers: { location: r.url, "cache-control": "no-store" },
    });

  const range = c.req.headers.get("range");
  const doFetch = (url: string) =>
    fetch(url, {
      method: c.req.method === "HEAD" ? "HEAD" : "GET",
      headers: range ? { range } : {},
    });
  let upstream = await doFetch(r.url);
  if ([401, 403, 404, 410].includes(upstream.status)) {
    r = await resolveStream(c.env, u, id, t, { fresh: true });
    if (!r) return err(404, "Stream expired and could not be re-resolved");
    upstream = await doFetch(r.url);
  }
  const h = new Headers();
  for (const k of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const v = upstream.headers.get(k);
    if (v) h.set(k, v);
  }
  if (!h.get("content-type") || h.get("content-type") === "application/octet-stream")
    h.set("content-type", mimeFor(r.container));
  h.set("accept-ranges", "bytes");
  return new Response(c.req.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: h,
  });
}

function mimeFor(container?: string) {
  switch (container) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
    case "aac":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "opus":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "webm":
      return "audio/webm";
    default:
      return "audio/flac";
  }
}

async function playbackInfo(c: Ctx) {
  const u = requireUser(c);
  const id = cleanId(c.params.id);
  const t = await getTrack(c.env, id);
  if (!t) throw new HttpError(404, "Not found");
  if (!t.isrc) {
    const full = await provider(c.env).track(t.pid);
    if (full) Object.assign(t, full);
  }
  const r = await resolveStream(c.env, u, id, t);
  const playSessionId = crypto.randomUUID().replace(/-/g, "");
  if (!r)
    return json({
      MediaSources: [],
      PlaySessionId: playSessionId,
      ErrorCode: "NoCompatibleStream",
    });
  const ms: any = mediaSource(id, t, r.container || "flac");
  ms.Path = `/Audio/${id}/stream.${r.container || "flac"}`;
  ms.DirectStreamUrl = `/Audio/${id}/stream.${r.container || "flac"}?static=true&api_key=${c.token}`;
  return json({ MediaSources: [ms], PlaySessionId: playSessionId });
}

interface NowPlayingState {
  itemId: string;
  startedAt: number;
  positionSec: number;
  scrobbled?: boolean;
}

async function finishPlay(c: Ctx, u: User, np: NowPlayingState, positionSec?: number) {
  if (np.scrobbled) return;
  const t = await getTrack(c.env, np.itemId);
  if (!t) return;
  const played =
    Math.max(positionSec ?? 0, np.positionSec, 0) ||
    Math.min((Date.now() - np.startedAt) / 1000, t.duration || 0);
  if (shouldScrobble(t, played)) {
    np.scrobbled = true;
    await markPlayed(c.env, u.id, np.itemId, t);
    await scrobble(c.env, u, t, np.startedAt);
  }
}

async function sessionEvent(c: Ctx, kind: "start" | "progress" | "stop") {
  const u = requireUser(c);
  const b = c.body || {};
  const itemId = cleanId(b.ItemId || c.params.id || qp(c, "ItemId"));
  const pos = Number(b.PositionTicks ?? qp(c, "PositionTicks") ?? 0) / TICKS;
  if (!itemId || !itemId.startsWith("03")) return empty();
  const key = `np:${u.id}:${c.auth.deviceId || "default"}`;
  const prev = await c.env.KV.get<NowPlayingState>(key, "json");
  const work = async () => {
    if (kind === "start") {
      if (prev && prev.itemId !== itemId) await finishPlay(c, u, prev);
      const st: NowPlayingState = { itemId, startedAt: Date.now(), positionSec: 0 };
      await c.env.KV.put(key, JSON.stringify(st), { expirationTtl: 6 * 3600 });
      const t = await getTrack(c.env, itemId);
      if (t) await nowPlaying(c.env, u, t);
    } else if (kind === "progress") {
      if (!prev || prev.itemId !== itemId) {
        const st: NowPlayingState = {
          itemId,
          startedAt: Date.now() - pos * 1000,
          positionSec: pos,
        };
        if (prev) await finishPlay(c, u, prev);
        await c.env.KV.put(key, JSON.stringify(st), { expirationTtl: 6 * 3600 });
      } else {
        prev.positionSec = Math.max(prev.positionSec, pos);
        await c.env.KV.put(key, JSON.stringify(prev), { expirationTtl: 6 * 3600 });
      }
    } else {
      const st =
        prev && prev.itemId === itemId
          ? prev
          : { itemId, startedAt: Date.now() - pos * 1000, positionSec: pos };
      await finishPlay(c, u, st, pos);
      await c.env.KV.delete(key);
    }
  };
  c.exec.waitUntil(work().catch((e) => console.log("session event error", e)));
  return empty();
}

async function userDataFor(c: Ctx, id: string) {
  const u = requireUser(c);
  const s = (await userStates(c.env, u.id, [id])).get(id);
  return {
    PlaybackPositionTicks: 0,
    PlayCount: s?.playCount || 0,
    IsFavorite: !!s?.isFavorite,
    Played: (s?.playCount || 0) > 0,
    Key: id,
    ItemId: id,
  };
}

async function favorite(c: Ctx, fav: boolean) {
  const u = requireUser(c);
  const id = cleanId(c.params.id);
  await setFavorite(c.env, u.id, id, fav);
  return json(await userDataFor(c, id));
}

async function played(c: Ctx, isPlayed: boolean) {
  const u = requireUser(c);
  const id = cleanId(c.params.id);
  if (isPlayed) await markPlayed(c.env, u.id, id);
  else
    await c.env.DB.prepare("UPDATE user_items SET play_count = 0 WHERE user_id = ? AND item_id = ?")
      .bind(u.id, id)
      .run();
  return json(await userDataFor(c, id));
}

async function instantMix(c: Ctx, rawId: string) {
  const u = requireUser(c);
  const id = cleanId(rawId);
  const p = provider(c.env);
  const limit = toInt(qp(c, "Limit"), 100);
  let tracks: MTrack[] = [];
  if (id.startsWith("04")) {
    tracks = (await playlistEntries(c.env, id)).map((e) => e.track).sort(() => Math.random() - 0.5);
  } else {
    const d = await decodeId(c.env, id);
    if (d?.kind === "artist") tracks = await p.artistRadio(d.pid, limit);
    else if (d?.kind === "genre") tracks = (await p.chartTracks(d.pid, limit, 0)).items;
    else if (d?.kind === "album") {
      const a = await p.album(d.pid);
      tracks = a?.album.artistPid ? await p.artistRadio(a.album.artistPid, limit) : a?.tracks || [];
    } else if (d?.kind === "track") {
      const t = await p.track(d.pid);
      if (t)
        tracks = [
          t,
          ...(t.artistPid
            ? (await p.artistRadio(t.artistPid, limit)).filter((x) => x.pid !== t.pid)
            : []),
        ];
    }
  }
  const st = await userStates(c.env, u.id, tracks.map(mid));
  const list = tracks.slice(0, limit).map((t) => trackDto(c, t, st.get(mid(t))));
  return json(queryResult(list, list.length, 0));
}

async function similar(c: Ctx, rawId: string) {
  const id = cleanId(rawId);
  const p = provider(c.env);
  const d = await decodeId(c.env, id);
  const limit = toInt(qp(c, "Limit"), 12);
  let artistPid: string | undefined;
  if (d?.kind === "artist") artistPid = d.pid;
  else if (d?.kind === "album") artistPid = (await p.album(d.pid))?.album.artistPid;
  else if (d?.kind === "track") artistPid = (await p.track(d.pid))?.artistPid;
  if (!artistPid) return json(queryResult([], 0, 0));
  const artists = await p.similarArtists(artistPid, limit);
  if (d?.kind === "album") {
    const albums: MAlbum[] = [];
    for (const a of artists.slice(0, Math.min(limit, 8))) {
      const pg = await p
        .artistAlbums(a.pid, 1, 0)
        .catch(() => ({ items: [] as MAlbum[], total: 0 }));
      if (pg.items[0]) albums.push(pg.items[0]);
    }
    return json(queryResult(await dtos(c, albums), albums.length, 0));
  }
  return json(queryResult(await dtos(c, artists), artists.length, 0));
}

async function readIds(c: Ctx): Promise<string[]> {
  const fromQ = splitList(qp(c, "Ids"));
  const fromB = Array.isArray(c.body?.Ids)
    ? c.body.Ids
    : typeof c.body?.Ids === "string"
      ? splitList(c.body.Ids)
      : [];
  return [...fromQ, ...fromB].map(cleanId);
}

async function ownPlaylist(c: Ctx) {
  const u = requireUser(c);
  const id = cleanId(c.params.id);
  const pl = await getPlaylist(c.env, u.id, id);
  if (!pl) throw new HttpError(404, "Playlist not found");
  return id;
}

export function jellyfinRouter(): Router {
  const r = new Router();

  r.get("/System/Info/Public", (c) => json(publicInfo(c)), false);
  r.get("/System/Info", (c) =>
    json({
      ...publicInfo(c),
      OperatingSystemDisplayName: "Linux",
      HasPendingRestart: false,
      IsShuttingDown: false,
      SupportsLibraryMonitor: false,
      WebSocketPortNumber: 443,
      CompletedInstallations: [],
      CanSelfRestart: false,
      CanLaunchWebBrowser: false,
      HasUpdateAvailable: false,
      TranscodingTempPath: "",
      CachePath: "",
      LogPath: "",
      InternalMetadataPath: "",
      ProgramDataPath: "",
      ItemsByNamePath: "",
      CastReceiverApplications: [],
    }),
  );
  r.add(
    ["GET", "POST"],
    "/System/Ping",
    () => new Response("Jellyfin Server", { headers: { "content-type": "text/plain" } }),
    false,
  );
  r.get("/System/Endpoint", () => json({ IsLocal: false, IsInNetwork: false }));
  r.get("/System/Configuration", () =>
    json({
      EnableFolderView: false,
      EnableGroupingIntoCollections: false,
      DisplaySpecialsWithinSeasons: false,
      UICulture: "en-US",
      ServerName: "Undertone",
    }),
  );
  r.get(
    "/Branding/Configuration",
    () => json({ LoginDisclaimer: "", CustomCss: "", SplashscreenEnabled: false }),
    false,
  );
  r.get(
    "/Branding/Css",
    () => new Response("", { headers: { "content-type": "text/css" } }),
    false,
  );
  r.get(
    "/Branding/Css.css",
    () => new Response("", { headers: { "content-type": "text/css" } }),
    false,
  );
  r.get("/QuickConnect/Enabled", () => json(false), false);
  r.get("/Users/Public", () => json([]), false);
  r.get("/Plugins", () => json([]));
  r.get("/web/ConfigurationPages", () => json([]));
  r.get("/Localization/Cultures", () =>
    json([
      {
        Name: "English",
        DisplayName: "English",
        TwoLetterISOLanguageName: "en",
        ThreeLetterISOLanguageName: "eng",
        ThreeLetterISOLanguageNames: ["eng"],
      },
    ]),
  );
  r.get("/Localization/Countries", () => json([]));
  r.get("/Localization/ParentalRatings", () => json([]));
  r.get("/Localization/Options", () => json([{ Name: "English", Value: "en-US" }]));
  r.get("/Sessions", () => json([]));
  r.post("/Sessions/Capabilities", () => empty());
  r.post("/Sessions/Capabilities/Full", () => empty());
  r.get("/DisplayPreferences/:id", (c) =>
    json({
      Id: c.params.id,
      SortBy: "SortName",
      RememberIndexing: false,
      PrimaryImageHeight: 250,
      PrimaryImageWidth: 250,
      CustomPrefs: {},
      ScrollDirection: "Horizontal",
      ShowBackdrop: true,
      RememberSorting: false,
      SortOrder: "Ascending",
      ShowSidebar: false,
      Client: qp(c, "client") || "emby",
    }),
  );
  r.post("/DisplayPreferences/:id", () => empty());

  r.post(
    "/Users/AuthenticateByName",
    async (c) => {
      const b = c.body || {};
      const name = b.Username || b.username || qp(c, "username");
      const pw = b.Pw ?? b.pw ?? b.Password ?? b.password ?? qp(c, "pw") ?? "";
      if (!name) return err(400, "Username required");
      let user = await verifyLogin(c.env, name, pw);
      if (!user && (await userCount(c.env)) === 0) {
        user = await createUser(c.env, name, pw, true);
      }
      if (!user) return err(401, "Invalid username or password");
      const token = await issueToken(c.env, user, c.auth);
      return json({
        User: userDto(c, user),
        SessionInfo: {
          Id: token,
          UserId: user.id,
          UserName: user.name,
          Client: c.auth.client,
          DeviceId: c.auth.deviceId,
          DeviceName: c.auth.device,
          ApplicationVersion: c.auth.version,
          IsActive: true,
          SupportsMediaControl: false,
          SupportsRemoteControl: false,
          PlayableMediaTypes: ["Audio"],
          SupportedCommands: [],
          ServerId: c.serverId,
          LastActivityDate: new Date().toISOString(),
        },
        AccessToken: token,
        ServerId: c.serverId,
      });
    },
    false,
  );
  r.post("/Sessions/Logout", async (c) => {
    if (c.token) await revokeToken(c.env, c.token);
    return empty();
  });
  r.get("/Users/Me", (c) => json(userDto(c, requireUser(c))));
  r.get("/Users", (c) => json([userDto(c, requireUser(c))]));
  r.get("/Users/:uid", (c) => json(userDto(c, requireUser(c))));
  r.post("/Users/:uid/Password", async (c) => {
    const u = requireUser(c);
    const b = c.body || {};
    if (!(await verifyLogin(c.env, u.name, b.CurrentPw ?? b.CurrentPassword ?? "")))
      return err(403, "Wrong password");
    await setPassword(c.env, u.id, b.NewPw ?? "");
    return empty();
  });
  r.post("/Users/Password", async (c) => {
    const u = requireUser(c);
    const b = c.body || {};
    if (!(await verifyLogin(c.env, u.name, b.CurrentPw ?? ""))) return err(403, "Wrong password");
    await setPassword(c.env, u.id, b.NewPw ?? "");
    return empty();
  });

  const views = (c: Ctx) => json(queryResult(viewDtos(c), 2, 0));
  r.get("/Users/:uid/Views", views);
  r.get("/UserViews", views);
  r.get("/Library/MediaFolders", views);
  r.get("/Library/VirtualFolders", () => json([]));
  r.get("/Users/:uid/GroupingOptions", () => json([]));
  r.get("/UserViews/GroupingOptions", () => json([]));
  const root = (c: Ctx) =>
    json({
      Name: "Root",
      ServerId: c.serverId,
      Id: "00000000000000000000000000000000",
      Type: "UserRootFolder",
      IsFolder: true,
      ImageTags: {},
      ChildCount: 2,
    });
  r.get("/Users/:uid/Items/Root", root);
  r.get("/Items/Root", root);

  r.get("/Users/:uid/Items", queryItems);
  r.get("/Items", queryItems);
  r.get("/Artists", artistsQuery);
  r.get("/Artists/AlbumArtists", artistsQuery);
  r.get("/Artists/InstantMix", (c) => instantMix(c, qp(c, "id") || ""));
  r.get("/Artists/:name", async (c) => {
    const a = await provider(c.env).findArtistByName(c.params.name);
    if (!a) throw new HttpError(404, "Not found");
    return json(
      artistDto(c, a, (await userStates(c.env, requireUser(c).id, [mid(a)])).get(mid(a))),
    );
  });
  r.get(
    "/Artists/:name/Images/:type",
    async (c) => imageRedirect(c, (await provider(c.env).findArtistByName(c.params.name))?.image),
    false,
  );
  r.get(
    "/Artists/:name/Images/:type/:idx",
    async (c) => imageRedirect(c, (await provider(c.env).findArtistByName(c.params.name))?.image),
    false,
  );
  const genresList = async (c: Ctx) =>
    pageLocal(
      c,
      (await provider(c.env).genres()).map((g) => genreDto(c, g)),
      "SortName",
    );
  r.get("/Genres", genresList);
  r.get("/MusicGenres", genresList);
  r.get("/MusicGenres/InstantMix", (c) => instantMix(c, qp(c, "id") || ""));
  const genreByName = async (c: Ctx) => {
    const g = (await provider(c.env).genres()).find(
      (x) => x.name.toLowerCase() === c.params.name.toLowerCase(),
    );
    if (!g) throw new HttpError(404, "Not found");
    return json(genreDto(c, g));
  };
  r.get("/Genres/:name", genreByName);
  r.get("/MusicGenres/:name", genreByName);
  r.get("/Items/Filters", () => json({ Genres: [], Tags: [], OfficialRatings: [], Years: [] }));
  r.get("/Items/Filters2", async (c) =>
    json({
      Genres: (await provider(c.env).genres()).map((g) => ({
        Name: g.name,
        Id: idOf("genre", P, g.pid),
      })),
      Tags: [],
    }),
  );
  const latest = async (c: Ctx) => {
    const p = provider(c.env);
    const limit = toInt(qp(c, "Limit"), 20);
    const t = types(c);
    if (t.has("audio") && !t.has("musicalbum")) {
      const tr = (await p.chartTracks(undefined, limit, 0)).items;
      return json(await dtos(c, tr));
    }
    const albums = await p.newReleases(limit).catch(() => [] as MAlbum[]);
    return json(
      await dtos(c, albums.length ? albums : (await p.chartAlbums(undefined, limit, 0)).items),
    );
  };
  r.get("/Users/:uid/Items/Latest", latest);
  r.get("/Items/Latest", latest);
  const resume = () => json(queryResult([], 0, 0));
  r.get("/Users/:uid/Items/Resume", resume);
  r.get("/UserItems/Resume", resume);
  r.get("/Shows/NextUp", resume);
  r.get("/Shows/Upcoming", resume);
  r.get("/Items/Suggestions", async (c) =>
    pageProvider(c, (l, o) => provider(c.env).chartTracks(undefined, l, o)),
  );
  r.get("/Search/Hints", async (c) => {
    const q = qp(c, "SearchTerm") || "";
    const res = await searchItems(c, q, types(c));
    const data: any = await res.json();
    const hints = data.Items.map((i: any) => ({
      ItemId: i.Id,
      Id: i.Id,
      Name: i.Name,
      MatchedTerm: q,
      Type: i.Type,
      MediaType: i.MediaType,
      IsFolder: i.IsFolder,
      RunTimeTicks: i.RunTimeTicks,
      PrimaryImageTag: i.ImageTags?.Primary,
      ThumbImageTag: undefined,
      Album: i.Album,
      AlbumId: i.AlbumId,
      AlbumArtist: i.AlbumArtist,
      Artists: i.Artists || [],
      ProductionYear: i.ProductionYear,
    }));
    return json({ SearchHints: hints, TotalRecordCount: hints.length });
  });

  r.get("/Users/:uid/Items/:id", (c) => itemById(c, c.params.id));
  r.get("/Items/:id", (c) => itemById(c, c.params.id));
  r.get("/Items/:id/Ancestors", (c) => json([viewDtos(c)[0]]));
  r.get("/Items/:id/Similar", (c) => similar(c, c.params.id));
  r.get("/Artists/:id/Similar", (c) => similar(c, c.params.id));
  r.get("/Albums/:id/Similar", (c) => similar(c, c.params.id));
  r.get("/Items/:id/InstantMix", (c) => instantMix(c, c.params.id));
  r.get("/Albums/:id/InstantMix", (c) => instantMix(c, c.params.id));
  r.get("/Songs/:id/InstantMix", (c) => instantMix(c, c.params.id));
  r.get("/Playlists/:id/InstantMix", (c) => instantMix(c, c.params.id));
  r.get("/Items/:id/ThemeMedia", () =>
    json({
      ThemeVideosResult: queryResult([], 0, 0),
      ThemeSongsResult: queryResult([], 0, 0),
      SoundtrackSongsResult: queryResult([], 0, 0),
    }),
  );
  r.get("/Items/:id/ThemeSongs", () => json(queryResult([], 0, 0)));
  r.get("/Users/:uid/Items/:id/LocalTrailers", () => json([]));
  r.get("/Users/:uid/Items/:id/SpecialFeatures", () => json([]));
  r.get("/Items/:id/CriticReviews", () => json(queryResult([], 0, 0)));
  r.get("/Items/:id/ExternalIdInfos", () => json([]));

  r.get(
    "/Items/:id/Images/:type",
    async (c) => imageRedirect(c, await imageUrlFor(c, c.params.id)),
    false,
  );
  r.get(
    "/Items/:id/Images/:type/:idx",
    async (c) => imageRedirect(c, await imageUrlFor(c, c.params.id)),
    false,
  );
  r.get("/Items/:id/Images", async (c) => {
    const u = await imageUrlFor(c, c.params.id);
    return json(
      u ? [{ ImageType: "Primary", ImageIndex: 0, ImageTag: "x", Width: 1000, Height: 1000 }] : [],
    );
  });

  const lyrics = async (c: Ctx) => {
    const u = requireUser(c);
    const t = await getTrack(c.env, cleanId(c.params.id));
    if (!t) throw new HttpError(404, "Not found");
    const l = await getLyrics(c.env, u, t);
    return l ? json(l) : err(404, "No lyrics");
  };
  r.get("/Audio/:id/Lyrics", lyrics);
  r.get("/Users/:uid/Items/:id/Lyrics", lyrics);

  r.add(["GET", "POST"], "/Items/:id/PlaybackInfo", playbackInfo);
  for (const path of [
    "/Audio/:id/universal",
    "/Audio/:id/stream",
    "/Items/:id/Download",
    "/Items/:id/File",
    "/Audio/:id/:file",
  ]) {
    r.get(path, streamHandler);
  }

  r.post("/Sessions/Playing", (c) => sessionEvent(c, "start"));
  r.post("/Sessions/Playing/Progress", (c) => sessionEvent(c, "progress"));
  r.post("/Sessions/Playing/Stopped", (c) => sessionEvent(c, "stop"));
  r.post("/Sessions/Playing/Ping", () => empty());
  r.post("/Users/:uid/PlayingItems/:id", (c) => sessionEvent(c, "start"));
  r.post("/Users/:uid/PlayingItems/:id/Progress", (c) => sessionEvent(c, "progress"));
  r.del("/Users/:uid/PlayingItems/:id", (c) => sessionEvent(c, "stop"));
  r.post("/PlayingItems/:id", (c) => sessionEvent(c, "start"));
  r.post("/PlayingItems/:id/Progress", (c) => sessionEvent(c, "progress"));
  r.del("/PlayingItems/:id", (c) => sessionEvent(c, "stop"));

  r.post("/Users/:uid/FavoriteItems/:id", (c) => favorite(c, true));
  r.del("/Users/:uid/FavoriteItems/:id", (c) => favorite(c, false));
  r.post("/UserFavoriteItems/:id", (c) => favorite(c, true));
  r.del("/UserFavoriteItems/:id", (c) => favorite(c, false));
  r.post("/Users/:uid/PlayedItems/:id", (c) => played(c, true));
  r.del("/Users/:uid/PlayedItems/:id", (c) => played(c, false));
  r.post("/UserPlayedItems/:id", (c) => played(c, true));
  r.del("/UserPlayedItems/:id", (c) => played(c, false));
  r.get("/UserItems/:id/UserData", async (c) => json(await userDataFor(c, cleanId(c.params.id))));
  r.get("/Users/:uid/Items/:id/UserData", async (c) =>
    json(await userDataFor(c, cleanId(c.params.id))),
  );
  const postUserData = async (c: Ctx) => {
    const id = cleanId(c.params.id);
    if (typeof c.body?.IsFavorite === "boolean")
      await setFavorite(c.env, requireUser(c).id, id, c.body.IsFavorite);
    return json(await userDataFor(c, id));
  };
  r.post("/UserItems/:id/UserData", postUserData);
  r.post("/Users/:uid/Items/:id/UserData", postUserData);
  r.add(["POST", "DELETE"], "/Users/:uid/Items/:id/Rating", async (c) =>
    json(await userDataFor(c, cleanId(c.params.id))),
  );

  r.post("/Playlists", async (c) => {
    const u = requireUser(c);
    const name = c.body?.Name || qp(c, "Name") || "Playlist";
    const id = await createPlaylist(c.env, u.id, name, await readIds(c));
    return json({ Id: id });
  });
  r.get("/Playlists/:id", async (c) => {
    const id = await ownPlaylist(c);
    const entries = await playlistEntries(c.env, id);
    return json({ OpenAccess: false, Shares: [], ItemIds: entries.map((e) => e.itemId) });
  });
  r.post("/Playlists/:id", async (c) => {
    const id = await ownPlaylist(c);
    if (c.body?.Name)
      await c.env.DB.prepare("UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?")
        .bind(c.body.Name, Date.now(), id)
        .run();
    if (Array.isArray(c.body?.Ids)) {
      await c.env.DB.prepare("DELETE FROM playlist_items WHERE playlist_id = ?").bind(id).run();
      await addToPlaylist(c.env, id, c.body.Ids.map(cleanId));
    }
    return empty();
  });
  r.get("/Playlists/:id/Users", () => json([]));
  r.get("/Playlists/:id/Items", async (c) =>
    pageLocal(c, await playlistItemsDtos(c, await ownPlaylist(c))),
  );
  r.post("/Playlists/:id/Items", async (c) => {
    await addToPlaylist(c.env, await ownPlaylist(c), await readIds(c));
    return empty();
  });
  r.del("/Playlists/:id/Items", async (c) => {
    const id = await ownPlaylist(c);
    await removeFromPlaylist(c.env, id, splitList(qp(c, "EntryIds")));
    return empty();
  });
  r.post("/Playlists/:id/Items/:entry/Move/:idx", async (c) => {
    await moveInPlaylist(c.env, await ownPlaylist(c), c.params.entry, toInt(c.params.idx, 0));
    return empty();
  });
  r.del("/Items/:id", async (c) => {
    const u = requireUser(c);
    const id = cleanId(c.params.id);
    if (!id.startsWith("04")) return err(403, "Only playlists can be deleted");
    await c.env.DB.prepare("DELETE FROM playlists WHERE id = ? AND user_id = ?")
      .bind(id, u.id)
      .run();
    await c.env.DB.prepare("DELETE FROM playlist_items WHERE playlist_id = ?").bind(id).run();
    return empty();
  });
  r.post("/Items/:id", async (c) => {
    const u = requireUser(c);
    const id = cleanId(c.params.id);
    if (id.startsWith("04") && c.body?.Name)
      await c.env.DB.prepare("UPDATE playlists SET name = ? WHERE id = ? AND user_id = ?")
        .bind(c.body.Name, id, u.id)
        .run();
    return empty();
  });

  return r;
}
