import type { Env, MAlbum, MArtist, MGenre, MTrack, Page } from "../types";
import { isDefinition, rawUrl, validateDefinition, type Definition } from "../engine";
import { digestHex, fetchJson } from "../util";
import { Catalog } from "./catalog";

export interface MetadataProvider {
  name: string;
  searchArtists(q: string, limit: number, offset: number): Promise<Page<MArtist>>;
  searchAlbums(q: string, limit: number, offset: number): Promise<Page<MAlbum>>;
  searchTracks(q: string, limit: number, offset: number): Promise<Page<MTrack>>;
  findTracks(title: string, artist: string, limit: number): Promise<MTrack[]>;
  artist(pid: string): Promise<MArtist | null>;
  artistAlbums(pid: string, limit: number, offset: number): Promise<Page<MAlbum>>;
  artistTopTracks(pid: string, limit: number): Promise<MTrack[]>;
  similarArtists(pid: string, limit: number): Promise<MArtist[]>;
  artistRadio(pid: string, limit: number): Promise<MTrack[]>;
  album(pid: string): Promise<{ album: MAlbum; tracks: MTrack[] } | null>;
  track(pid: string): Promise<MTrack | null>;
  chartAlbums(genre: string | undefined, limit: number, offset: number): Promise<Page<MAlbum>>;
  chartArtists(genre: string | undefined, limit: number, offset: number): Promise<Page<MArtist>>;
  chartTracks(genre: string | undefined, limit: number, offset: number): Promise<Page<MTrack>>;
  newReleases(limit: number): Promise<MAlbum[]>;
  genres(): Promise<MGenre[]>;
  findArtistByName(name: string): Promise<MArtist | null>;
}

export interface CatalogChoice {
  url: string;
  manifest: Definition;
  settings: Record<string, string>;
  at: number;
}
const KEY = "cfg:catalog";

export async function readCatalog(source: {
  url?: string;
  json?: unknown;
}): Promise<{ url: string; manifest: Definition }> {
  let doc: any = source.json,
    url = "file:";
  if (!doc) {
    url = rawUrl(String(source.url || ""));
    if (!/^https?:\/\//i.test(url)) throw new Error("Give the link to a catalog connection file.");
    const { status, data } = await fetchJson(url, {}, 10000);
    if (status !== 200) throw new Error(`could not read that link (HTTP ${status})`);
    doc = data;
  }
  if (!isDefinition(doc)) throw new Error("That is not a connection file.");
  const manifest = validateDefinition(doc);
  if (!manifest.catalog)
    throw new Error(`${manifest.name} is not a catalog: it has no "catalog" block.`);
  return { url: url === "file:" ? `file:${manifest.id}` : url, manifest };
}
export async function setCatalog(
  env: Env,
  source: { url?: string; json?: unknown },
  settings: Record<string, string> = {},
): Promise<CatalogChoice> {
  const { url, manifest } = await readCatalog(source);
  const choice: CatalogChoice = { url, manifest, settings, at: Date.now() };
  await env.KV.put(KEY, JSON.stringify(choice));
  live = undefined;
  return choice;
}
export async function clearCatalog(env: Env) {
  await env.KV.delete(KEY);
  live = undefined;
}

let live: { at: number; choice: CatalogChoice | null; impl: MetadataProvider | null } | undefined;
export async function currentCatalog(env: Env): Promise<CatalogChoice | null> {
  if (live && Date.now() - live.at < 30_000) return live.choice;
  let choice = await env.KV.get<CatalogChoice>(KEY, "json");
  if (!choice && env.CATALOG)
    choice = await setCatalog(env, { url: env.CATALOG }).catch((e) => {
      console.log("CATALOG could not be read:", (e as Error).message);
      return null;
    });
  const stamp = choice ? (await digestHex("SHA-256", choice.url + choice.at)).slice(0, 12) : "";
  live = {
    at: Date.now(),
    choice,
    impl: choice ? new Catalog(choice.manifest, choice.settings || {}, stamp) : null,
  };
  return choice;
}

const EMPTY: Record<string, unknown> = {
  artist: null,
  album: null,
  track: null,
  findArtistByName: null,
};
export function provider(env: Env): MetadataProvider {
  return new Proxy({ name: "catalog" } as MetadataProvider, {
    get(target, prop: string) {
      if (prop === "name") return target.name;
      return async (...args: unknown[]) => {
        await currentCatalog(env);
        const impl = live?.impl as any;
        if (impl) return impl[prop](...args);
        if (prop in EMPTY) return null;
        return /^(search|chart)/.test(prop) || prop === "artistAlbums"
          ? { items: [], total: 0 }
          : [];
      };
    },
  });
}
