import type { Env, MTrack, User } from "./types";
import { listConnections } from "./connections";
import { isDefinition, fetchLyrics } from "./engine";
import { TICKS } from "./util";

export async function getLyrics(env: Env, user: User, t: MTrack): Promise<any | null> {
  const sources = (await listConnections(env, user.id, true)).filter(
    (a) => isDefinition(a.manifest) && a.manifest.lyrics,
  );
  if (!sources.length) return null;
  const key = `lyr:${sources.map((a) => a.id).join(".")}:${t.isrc || t.pid}`;
  const hit = await env.KV.get(key, "json");
  if (hit) return (hit as any).none ? null : hit;
  for (const a of sources) {
    const got = await fetchLyrics(env, a.manifest, a.settings, a.id, t).catch((e) => {
      console.log("lyrics connection failed:", a.manifest.name, (e as Error).message);
      return undefined;
    });
    if (got === undefined) return null;
    if (got) {
      const dto = toLyricDto(t, got.synced, got.plain);
      await env.KV.put(key, JSON.stringify(dto), { expirationTtl: 86400 * 30 });
      return dto;
    }
  }
  await env.KV.put(key, JSON.stringify({ none: true }), { expirationTtl: 86400 * 3 });
  return null;
}

export function toLyricDto(t: MTrack, synced?: string, plain?: string) {
  const meta = {
    Artist: t.artistName,
    Album: t.albumTitle,
    Title: t.title,
    Length: t.duration * TICKS,
    IsSynced: !!synced,
  };
  if (synced) {
    const lines: { Text: string; Start: number }[] = [];
    for (const raw of synced.split(/\r?\n/)) {
      const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      if (!stamps.length) continue;
      const text = raw.replace(/\[[^\]]*\]/g, "").trim();
      for (const m of stamps) {
        const frac = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) / 1000 : 0;
        lines.push({
          Text: text,
          Start: Math.round((parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac) * TICKS),
        });
      }
    }
    lines.sort((a, b) => a.Start - b.Start);
    return { Metadata: meta, Lyrics: lines };
  }
  return { Metadata: meta, Lyrics: (plain || "").split(/\r?\n/).map((l) => ({ Text: l })) };
}
