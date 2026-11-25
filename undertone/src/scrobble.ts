import type { Env, MTrack, User } from "./types";
import { listConnections } from "./connections";
import { isDefinition, reportPlay } from "./engine";

async function tell(
  env: Env,
  user: User,
  kind: "nowPlaying" | "played",
  t: MTrack,
  startedAt?: number,
) {
  const connections = (await listConnections(env, user.id, true)).filter(
    (a) => isDefinition(a.manifest) && a.manifest.track?.[kind],
  );
  const res = await Promise.all(
    connections.map((a) => reportPlay(env, a.manifest, a.settings, a.id, kind, t, startedAt)),
  );
  for (const r of res) if (r) console.log("history connection failed:", r);
}
export const nowPlaying = (env: Env, user: User, t: MTrack) => tell(env, user, "nowPlaying", t);
export const scrobble = (env: Env, user: User, t: MTrack, startedAt: number) =>
  tell(env, user, "played", t, startedAt);

export function shouldScrobble(t: MTrack, playedSec: number) {
  if (t.duration && t.duration < 30) return false;
  return playedSec >= Math.min(240, (t.duration || 240) / 2);
}
