import { idOf, VIEW_MUSIC, VIEW_PLAYLISTS } from "../ids";
import type { Ctx, MAlbum, MArtist, MGenre, MItem, MTrack } from "../types";
import { shortTag, TICKS } from "../util";

export interface UserState {
  isFavorite: boolean;
  playCount: number;
  lastPlayed?: number;
  createdAt?: number;
}

const P = "catalog";

function userData(id: string, s?: UserState) {
  return {
    PlaybackPositionTicks: 0,
    PlayCount: s?.playCount || 0,
    IsFavorite: !!s?.isFavorite,
    Played: (s?.playCount || 0) > 0,
    LastPlayedDate: s?.lastPlayed ? new Date(s.lastPlayed).toISOString() : undefined,
    Key: id,
    ItemId: id,
  };
}

function sortName(s: string) {
  return s.replace(/^(the|a|an)\s+/i, "").toLowerCase();
}

export function artistDto(c: Ctx, a: MArtist, s?: UserState) {
  const id = idOf("artist", P, a.pid)!;
  const tag = a.image ? shortTag(a.image) : undefined;
  return {
    Name: a.name,
    ServerId: c.serverId,
    Id: id,
    SortName: sortName(a.name),
    Type: "MusicArtist",
    IsFolder: true,
    ChildCount: a.albumCount,
    AlbumCount: a.albumCount,
    ImageTags: tag ? { Primary: tag } : {},
    BackdropImageTags: tag ? [tag] : [],
    ImageBlurHashes: {},
    LocationType: "FileSystem",
    MediaType: "Unknown",
    DateCreated: new Date(s?.createdAt || Date.UTC(2020, 0, 1)).toISOString(),
    UserData: userData(id, s),
    ProviderIds: { Catalog: a.pid },
  };
}

export function albumDto(c: Ctx, a: MAlbum, s?: UserState) {
  const id = idOf("album", P, a.pid)!;
  const artistId = idOf("artist", P, a.artistPid);
  const tag = a.image ? shortTag(a.image) : undefined;
  const artists = a.artistName ? [{ Name: a.artistName, Id: artistId }] : [];
  return {
    Name: a.title,
    ServerId: c.serverId,
    Id: id,
    SortName: sortName(a.title),
    Type: "MusicAlbum",
    IsFolder: true,
    ParentId: VIEW_MUSIC,
    ChildCount: a.trackCount,
    SongCount: a.trackCount,
    RunTimeTicks: a.duration ? a.duration * TICKS : undefined,
    ProductionYear: a.year,
    PremiereDate: a.releaseDate ? new Date(a.releaseDate + "T00:00:00Z").toISOString() : undefined,
    AlbumArtist: a.artistName,
    AlbumArtists: artists,
    Artists: a.artistName ? [a.artistName] : [],
    ArtistItems: artists,
    Genres: a.genres?.map((g) => g.name) || [],
    GenreItems: a.genres?.map((g) => ({ Name: g.name, Id: idOf("genre", P, g.pid) })) || [],
    ImageTags: tag ? { Primary: tag } : {},
    BackdropImageTags: [],
    ImageBlurHashes: {},
    LocationType: "FileSystem",
    MediaType: "Unknown",
    DateCreated: new Date(
      s?.createdAt || (a.releaseDate ? Date.parse(a.releaseDate) : Date.UTC(2020, 0, 1)),
    ).toISOString(),
    UserData: userData(id, s),
    ProviderIds: { Catalog: a.pid, ...(a.upc ? { UPC: a.upc } : {}) },
    Tags: a.type ? [a.type] : [],
  };
}

export function trackDto(c: Ctx, t: MTrack, s?: UserState, extra: Record<string, unknown> = {}) {
  const id = idOf("track", P, t.pid)!;
  const albumId = idOf("album", P, t.albumPid);
  const tag = t.image ? shortTag(t.image) : undefined;
  const artistItems = (
    t.artists?.length ? t.artists : [{ pid: t.artistPid, name: t.artistName }]
  ).map((a) => ({
    Name: a.name,
    Id: idOf("artist", P, a.pid),
  }));
  const albumArtistName = t.albumArtistName || t.artistName;
  const albumArtistId = idOf("artist", P, t.albumArtistPid || t.artistPid);
  const container = (extra.Container as string) || "flac";
  return {
    Name: t.title,
    ServerId: c.serverId,
    Id: id,
    SortName: sortName(t.title),
    Type: "Audio",
    MediaType: "Audio",
    IsFolder: false,
    ParentId: albumId,
    RunTimeTicks: t.duration * TICKS,
    ProductionYear: t.year,
    IndexNumber: t.trackNo,
    ParentIndexNumber: t.discNo,
    Album: t.albumTitle,
    AlbumId: albumId,
    AlbumPrimaryImageTag: tag,
    AlbumArtist: albumArtistName,
    AlbumArtists: albumArtistName ? [{ Name: albumArtistName, Id: albumArtistId }] : [],
    Artists: artistItems.map((a) => a.Name),
    ArtistItems: artistItems,
    ImageTags: tag ? { Primary: tag } : {},
    BackdropImageTags: [],
    ImageBlurHashes: {},
    HasLyrics: true,
    LocationType: "FileSystem",
    Container: container,
    CanDownload: true,
    DateCreated: new Date(s?.createdAt || Date.UTC(2020, 0, 1)).toISOString(),
    UserData: userData(id, s),
    ProviderIds: { Catalog: t.pid, ...(t.isrc ? { ISRC: t.isrc } : {}) },
    MediaSources: [mediaSource(id, t, container)],
    MediaStreams: [audioStream(container)],
    ...extra,
  };
}

function audioStream(container: string) {
  const codec =
    container === "m4a" || container === "mp4" ? "aac" : container === "ogg" ? "vorbis" : container;
  return {
    Type: "Audio",
    Codec: codec,
    Index: 0,
    IsDefault: true,
    IsExternal: false,
    Language: null,
    ChannelLayout: "stereo",
    Channels: 2,
  };
}

export function mediaSource(id: string, t: MTrack, container: string) {
  return {
    Protocol: "Http",
    Id: id,
    Path: `/Audio/${id}/stream.${container}`,
    Type: "Default",
    Container: container,
    Name: t.title,
    IsRemote: true,
    RunTimeTicks: t.duration * TICKS,
    SupportsTranscoding: false,
    SupportsDirectStream: true,
    SupportsDirectPlay: true,
    IsInfiniteStream: false,
    RequiresOpening: false,
    RequiresClosing: false,
    RequiresLooping: false,
    SupportsProbing: false,
    MediaStreams: [audioStream(container)],
    MediaAttachments: [],
    Formats: [],
    RequiredHttpHeaders: {},
    DefaultAudioStreamIndex: 0,
  };
}

export function genreDto(c: Ctx, g: MGenre) {
  const id = idOf("genre", P, g.pid)!;
  const tag = g.image ? shortTag(g.image) : undefined;
  return {
    Name: g.name,
    ServerId: c.serverId,
    Id: id,
    Type: "MusicGenre",
    IsFolder: true,
    ImageTags: tag ? { Primary: tag } : {},
    BackdropImageTags: [],
    UserData: userData(id),
  };
}

export function playlistDto(
  c: Ctx,
  p: {
    id: string;
    name: string;
    created_at: number;
    count: number;
    image?: string;
    duration?: number;
  },
) {
  const tag = p.image ? shortTag(p.image) : undefined;
  return {
    Name: p.name,
    ServerId: c.serverId,
    Id: p.id,
    SortName: p.name.toLowerCase(),
    Type: "Playlist",
    MediaType: "Audio",
    IsFolder: true,
    ParentId: VIEW_PLAYLISTS,
    ChildCount: p.count,
    RunTimeTicks: p.duration ? p.duration * TICKS : undefined,
    CanDelete: true,
    ImageTags: tag ? { Primary: tag } : {},
    BackdropImageTags: [],
    ImageBlurHashes: {},
    LocationType: "FileSystem",
    DateCreated: new Date(p.created_at).toISOString(),
    UserData: userData(p.id),
  };
}

export function viewDtos(c: Ctx) {
  const base = {
    ServerId: c.serverId,
    IsFolder: true,
    Type: "CollectionFolder",
    ImageTags: {},
    BackdropImageTags: [],
    LocationType: "FileSystem",
    DateCreated: "2020-01-01T00:00:00.000Z",
  };
  return [
    {
      ...base,
      Name: "Music",
      Id: VIEW_MUSIC,
      CollectionType: "music",
      SortName: "music",
      UserData: userData(VIEW_MUSIC),
    },
    {
      ...base,
      Name: "Playlists",
      Id: VIEW_PLAYLISTS,
      CollectionType: "playlists",
      SortName: "playlists",
      UserData: userData(VIEW_PLAYLISTS),
    },
  ];
}

export function dtoFor(c: Ctx, item: MItem, s?: UserState) {
  switch (item.kind) {
    case "artist":
      return artistDto(c, item, s);
    case "album":
      return albumDto(c, item, s);
    case "track":
      return trackDto(c, item, s);
    case "genre":
      return genreDto(c, item);
  }
}

export function queryResult(items: unknown[], total: number, start: number) {
  return { Items: items, TotalRecordCount: total, StartIndex: start };
}
