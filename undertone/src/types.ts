export interface Statement {
  bind(...args: unknown[]): Statement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Db {
  prepare(sql: string): Statement;
  batch(stmts: Statement[]): Promise<unknown[]>;
}
export interface Kv {
  get(key: string): Promise<string | null>;
  get<T = unknown>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: {
    prefix?: string;
    cursor?: string;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}
export interface Background {
  waitUntil(p: Promise<unknown>): void;
}

export interface Env {
  DB: Db;
  KV: Kv;
  SERVER_NAME?: string;
  SERVER_ID?: string;
  SIGNUP?: string;
  CATALOG?: string;
  CONNECTIONS_INDEX?: string;
  DEFAULT_STREAM_MODE?: string;
}

export interface UserSettings {
  streamMode?: "redirect" | "proxy";
}

export interface User {
  id: string;
  name: string;
  is_admin: number;
  settings: UserSettings;
  created_at: number;
  last_login: number | null;
}

export interface AuthInfo {
  client?: string;
  device?: string;
  deviceId?: string;
  version?: string;
  token?: string;
}

export interface Ctx {
  env: Env;
  req: Request;
  url: URL;
  exec: Background;
  params: Record<string, string>;
  q: Map<string, string>;
  auth: AuthInfo;
  user?: User;
  token?: string;
  serverId: string;
  body?: any;
}

export interface MArtist {
  kind: "artist";
  pid: string;
  name: string;
  image?: string;
  albumCount?: number;
}

export interface MAlbum {
  kind: "album";
  pid: string;
  title: string;
  artistPid?: string;
  artistName: string;
  image?: string;
  year?: number;
  releaseDate?: string;
  trackCount?: number;
  duration?: number;
  genres?: { pid: string; name: string }[];
  type?: string;
  upc?: string;
}

export interface MTrack {
  kind: "track";
  pid: string;
  title: string;
  artistPid?: string;
  artistName: string;
  artists?: { pid?: string; name: string }[];
  albumPid?: string;
  albumTitle?: string;
  albumArtistPid?: string;
  albumArtistName?: string;
  image?: string;
  duration: number;
  isrc?: string;
  trackNo?: number;
  discNo?: number;
  year?: number;
  explicit?: boolean;
}

export interface MGenre {
  kind: "genre";
  pid: string;
  name: string;
  image?: string;
}

export type MItem = MArtist | MAlbum | MTrack | MGenre;

export interface Page<T> {
  items: T[];
  total: number;
}
