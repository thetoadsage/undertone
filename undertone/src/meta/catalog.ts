import type { Env, MAlbum, MArtist, MGenre, MTrack, Page } from "../types";
import { cached, sleep } from "../util";
import {
  fill,
  get,
  holds,
  list,
  type CatalogDef,
  type CatalogRoute,
  type Definition,
  type Vars,
} from "../engine";
import type { MetadataProvider } from "./provider";

type Shape = Record<string, string | string[]>;

export class Catalog implements MetadataProvider {
  name = "catalog";
  private def: CatalogDef;
  private noImage?: RegExp;
  constructor(
    private definition: Definition,
    private settings: Record<string, string>,
    private stamp: string,
  ) {
    this.def = definition.catalog!;
    try {
      this.noImage = this.def.noImage ? new RegExp(this.def.noImage) : undefined;
    } catch {}
  }

  private val(o: any, shape: Shape, key: string): any {
    const f = shape[key];
    for (const path of Array.isArray(f) ? f : f ? [f] : []) {
      const v = get(o, path);
      if (v != null && v !== "") return v;
    }
    return undefined;
  }
  private str(o: any, shape: Shape, key: string): string | undefined {
    const v = this.val(o, shape, key);
    return v == null ? undefined : String(v);
  }
  private num(o: any, shape: Shape, key: string): number | undefined {
    const v = Number(this.val(o, shape, key));
    return Number.isFinite(v) ? v : undefined;
  }
  private pic(o: any, shape: Shape): string | undefined {
    const f = shape.image;
    for (const path of Array.isArray(f) ? f : f ? [f] : []) {
      const v = get(o, path);
      if (typeof v === "string" && v && !(this.noImage && this.noImage.test(v))) return v;
    }
    return undefined;
  }
  private year(date?: string): number | undefined {
    const y = date ? parseInt(String(date).slice(0, 4), 10) : NaN;
    return Number.isFinite(y) && y > 0 ? y : undefined;
  }

  private artistOf(a: any): MArtist {
    const s = this.def.artist;
    return {
      kind: "artist",
      pid: this.str(a, s, "id") || "",
      name: this.str(a, s, "name") || "",
      image: this.pic(a, s),
      albumCount: this.num(a, s, "albumCount"),
    };
  }
  private albumOf(a: any, fallback?: { id?: string; name?: string }): MAlbum {
    const s = this.def.album,
      date = this.str(a, s, "date");
    const genres = list(this.val(a, s, "genres"))
      .map((g) => ({
        pid: this.str(g, this.def.genre || { id: "id", name: "name" }, "id") || "",
        name: this.str(g, this.def.genre || { id: "id", name: "name" }, "name") || "",
      }))
      .filter((g) => g.name);
    return {
      kind: "album",
      pid: this.str(a, s, "id") || "",
      title: this.str(a, s, "title") || "",
      artistPid: this.str(a, s, "artistId") ?? fallback?.id,
      artistName: this.str(a, s, "artistName") || fallback?.name || "",
      image: this.pic(a, s),
      releaseDate: date,
      year: this.year(date),
      trackCount: this.num(a, s, "trackCount"),
      duration: this.num(a, s, "duration"),
      genres: genres.length ? genres : undefined,
      type: this.str(a, s, "type"),
      upc: this.str(a, s, "upc"),
    };
  }
  private trackOf(t: any, album?: MAlbum): MTrack {
    const s = this.def.track,
      artistId = this.str(t, s, "artistId"),
      artistName = this.str(t, s, "artistName");
    const extra = list(this.val(t, s, "artists"))
      .map((c) => ({
        pid: this.str(c, this.def.artist, "id"),
        name: this.str(c, this.def.artist, "name") || "",
      }))
      .filter((c) => c.name);
    const date = this.str(t, s, "date") || album?.releaseDate;
    return {
      kind: "track",
      pid: this.str(t, s, "id") || "",
      title: this.str(t, s, "title") || "",
      artistPid: artistId,
      artistName: artistName || album?.artistName || "",
      artists: extra.length
        ? extra
        : artistName
          ? [{ pid: artistId, name: artistName }]
          : undefined,
      albumPid: this.str(t, s, "albumId") ?? album?.pid,
      albumTitle: this.str(t, s, "albumTitle") || album?.title,
      albumArtistPid: album?.artistPid ?? artistId,
      albumArtistName: album?.artistName ?? artistName,
      image: this.pic(t, s) || album?.image,
      duration: this.num(t, s, "duration") || 0,
      isrc: this.str(t, s, "isrc"),
      trackNo: this.num(t, s, "trackNo"),
      discNo: this.num(t, s, "discNo"),
      year: this.year(date) ?? album?.year,
      explicit: this.val(t, s, "explicit") === undefined ? undefined : !!this.val(t, s, "explicit"),
    };
  }

  private route(name: string): CatalogRoute | undefined {
    return this.def.routes[name];
  }
  private async ask(name: string, vars: Vars, hours: number): Promise<any> {
    const r = this.route(name);
    if (!r) return null;
    const v: Vars = { settings: this.settings, ...vars };
    for (const [k, d] of Object.entries(r.defaults || {}))
      if (v[k] == null || v[k] === "") v[k] = d;
    const url = fill(r.request.url, v, true);
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "Undertone/0.2",
    };
    for (const [k, x] of Object.entries(r.request.headers || {}))
      headers[k.toLowerCase()] = fill(x, v, false);
    return cached(`cat:${this.stamp}:${url}`, Math.round((r.hours ?? hours) * 3600), async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(url, {
          method: r.request.method || "GET",
          headers,
          signal: AbortSignal.timeout(Math.min(r.request.timeout || 10000, 20000)),
        });
        let data: any = null;
        try {
          data = await res.json();
        } catch {}
        if (this.def.retry?.length && holds(this.def.retry, data) && attempt < 2) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        if (res.status >= 500 && attempt < 2) {
          await sleep(500);
          continue;
        }
        if (res.status === 404 || (this.def.notFound?.length && holds(this.def.notFound, data)))
          return { __none: true };
        if (!res.ok) throw new Error(`catalog answered HTTP ${res.status}`);
        return data;
      }
      throw new Error("catalog unavailable");
    }).then((d: any) => (d && d.__none ? null : d));
  }
  private rows(name: string, data: any): any[] {
    const r = this.route(name);
    return data && r
      ? list(get(data, r.items ?? "")).filter((x) => !(r.skip?.length && holds(r.skip, x)))
      : [];
  }
  private page<T>(name: string, data: any, map: (x: any) => T): Page<T> {
    const items = this.rows(name, data).map(map);
    const total = Number(get(data, this.route(name)?.total));
    return {
      items,
      total: Number.isFinite(total) && this.route(name)?.total ? total : items.length,
    };
  }

  async searchArtists(q: string, limit: number, offset: number) {
    return this.page(
      "searchArtists",
      await this.ask("searchArtists", { query: q, limit, offset }, 0.5),
      (a) => this.artistOf(a),
    );
  }
  async searchAlbums(q: string, limit: number, offset: number) {
    return this.page(
      "searchAlbums",
      await this.ask("searchAlbums", { query: q, limit, offset }, 0.5),
      (a) => this.albumOf(a),
    );
  }
  async searchTracks(q: string, limit: number, offset: number) {
    return this.page(
      "searchTracks",
      await this.ask("searchTracks", { query: q, limit, offset }, 0.5),
      (t) => this.trackOf(t),
    );
  }
  async findTracks(title: string, artist: string, limit: number): Promise<MTrack[]> {
    if (this.route("findTrack")) {
      const exact = this.rows(
        "findTrack",
        await this.ask("findTrack", { title, artist, limit, offset: 0 }, 0.5),
      ).map((t) => this.trackOf(t));
      if (exact.length) return exact;
    }
    return (await this.searchTracks(`${artist} ${title}`.trim(), limit, 0)).items;
  }
  async artist(pid: string) {
    const d = await this.ask("artist", { id: pid }, 24);
    return d ? this.artistOf(d) : null;
  }
  async findArtistByName(name: string) {
    const r = await this.searchArtists(name, 5, 0);
    return r.items.find((a) => a.name.toLowerCase() === name.toLowerCase()) || r.items[0] || null;
  }
  async artistAlbums(pid: string, limit: number, offset: number) {
    const artist = await this.artist(pid);
    return this.page(
      "artistAlbums",
      await this.ask("artistAlbums", { id: pid, limit, offset }, 6),
      (a) => this.albumOf(a, artist ? { id: artist.pid, name: artist.name } : undefined),
    );
  }
  async artistTopTracks(pid: string, limit: number) {
    return this.rows(
      "artistTopTracks",
      await this.ask("artistTopTracks", { id: pid, limit, offset: 0 }, 6),
    ).map((t) => this.trackOf(t));
  }
  async similarArtists(pid: string, limit: number) {
    return this.rows(
      "similarArtists",
      await this.ask("similarArtists", { id: pid, limit, offset: 0 }, 24),
    ).map((a) => this.artistOf(a));
  }
  async artistRadio(pid: string, limit: number) {
    return this.rows(
      "artistRadio",
      await this.ask("artistRadio", { id: pid, limit, offset: 0 }, 1),
    ).map((t) => this.trackOf(t));
  }
  async album(pid: string) {
    const d = await this.ask("album", { id: pid }, 24);
    if (!d) return null;
    const album = this.albumOf(d);
    const tr = this.route("albumTracks")
      ? await this.ask("albumTracks", { id: pid, limit: 500, offset: 0 }, 24)
      : null;
    const raw = tr ? this.rows("albumTracks", tr) : this.rows("album", d);
    const tracks = raw.map((t, i) => {
      const m = this.trackOf(t, album);
      m.albumPid ??= album.pid;
      m.albumTitle ??= album.title;
      m.image ??= album.image;
      m.trackNo ??= i + 1;
      m.discNo ??= 1;
      return m;
    });
    album.trackCount = tracks.length || album.trackCount;
    return { album, tracks };
  }
  async track(pid: string) {
    const d = await this.ask("track", { id: pid }, 24);
    if (!d) return null;
    const t = this.trackOf(d);
    if (t.albumPid) {
      const a = await this.ask("album", { id: t.albumPid }, 24).catch(() => null);
      if (a) {
        const al = this.albumOf(a);
        if (al.artistName) {
          t.albumArtistPid = al.artistPid;
          t.albumArtistName = al.artistName;
        }
      }
    }
    return t;
  }
  async chartAlbums(genre: string | undefined, limit: number, offset: number) {
    return this.page(
      "chartAlbums",
      await this.ask("chartAlbums", { genre: genre || "", limit, offset }, 6),
      (a) => this.albumOf(a),
    );
  }
  async chartArtists(genre: string | undefined, limit: number, offset: number) {
    return this.page(
      "chartArtists",
      await this.ask("chartArtists", { genre: genre || "", limit, offset }, 6),
      (a) => this.artistOf(a),
    );
  }
  async chartTracks(genre: string | undefined, limit: number, offset: number) {
    return this.page(
      "chartTracks",
      await this.ask("chartTracks", { genre: genre || "", limit, offset }, 6),
      (t) => this.trackOf(t),
    );
  }
  async newReleases(limit: number) {
    return this.rows("newReleases", await this.ask("newReleases", { limit, offset: 0 }, 6)).map(
      (a) => this.albumOf(a),
    );
  }
  async genres(): Promise<MGenre[]> {
    const s = this.def.genre || { id: "id", name: "name" };
    return this.rows("genres", await this.ask("genres", {}, 168))
      .map((g) => ({
        kind: "genre" as const,
        pid: this.str(g, s, "id") || "",
        name: this.str(g, s, "name") || "",
        image: this.pic(g, s),
      }))
      .filter((g) => g.pid && g.name);
  }
}
