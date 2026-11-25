import type { Env } from "./types";
import { digestHex } from "./util";

export const KIND = { artist: 1, album: 2, track: 3, playlist: 4, view: 5, genre: 6 } as const;
export type KindName = keyof typeof KIND;
const KIND_BY_NUM: Record<number, KindName> = Object.fromEntries(
  Object.entries(KIND).map(([k, v]) => [v, k as KindName]),
);

export const PROVIDERS: Record<string, string> = { catalog: "01" };
const PROVIDER_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(PROVIDERS).map(([k, v]) => [v, k]),
);

export const VIEW_MUSIC = "05000000000000000000000000000001";
export const VIEW_PLAYLISTS = "05000000000000000000000000000002";

export function cleanId(id: string | undefined | null): string {
  return (id || "").replace(/-/g, "").toLowerCase();
}

export function encodeId(kind: KindName, provider: string, pid: string): string {
  const k = KIND[kind].toString(16).padStart(2, "0");
  const p = PROVIDERS[provider];
  if (p && /^\d{1,30}$/.test(pid)) {
    const hex = BigInt(pid).toString(16);
    if (hex.length <= 28) return k + p + hex.padStart(28, "0");
  }
  throw new Error("non-numeric id requires mapId()");
}

export async function mapId(
  env: Env,
  kind: KindName,
  provider: string,
  pid: string,
): Promise<string> {
  try {
    return encodeId(kind, provider, pid);
  } catch {
    const hash = (await digestHex("SHA-1", `${kind}:${provider}:${pid}`)).slice(0, 28);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO idmap (hash, kind, provider, pid) VALUES (?, ?, ?, ?)",
    )
      .bind(hash, KIND[kind], provider, pid)
      .run();
    return KIND[kind].toString(16).padStart(2, "0") + "ff" + hash;
  }
}

export interface DecodedId {
  kind: KindName;
  provider: string;
  pid: string;
  raw: string;
}

export async function decodeId(env: Env, rawId: string): Promise<DecodedId | null> {
  const id = cleanId(rawId);
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const kind = KIND_BY_NUM[parseInt(id.slice(0, 2), 16)];
  if (!kind) return null;
  const pcode = id.slice(2, 4);
  const payload = id.slice(4);
  if (kind === "playlist" || kind === "view") return { kind, provider: "local", pid: id, raw: id };
  if (pcode === "ff") {
    const row = await env.DB.prepare("SELECT provider, pid FROM idmap WHERE hash = ?")
      .bind(payload)
      .first<{ provider: string; pid: string }>();
    return row ? { kind, provider: row.provider, pid: row.pid, raw: id } : null;
  }
  const provider = PROVIDER_BY_CODE[pcode];
  if (!provider) return null;
  return { kind, provider, pid: BigInt("0x" + payload).toString(10), raw: id };
}

export function idOf(
  kind: KindName,
  provider: string,
  pid: string | undefined,
): string | undefined {
  if (!pid) return undefined;
  try {
    return encodeId(kind, provider, pid);
  } catch {
    return undefined;
  }
}

export function newPlaylistId(): string {
  const a = new Uint8Array(14);
  crypto.getRandomValues(a);
  return "0400" + [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
