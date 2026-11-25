export const AUDIO_EXT = ["flac", "mp3", "m4a", "ogg", "opus", "wav", "aac", "aiff", "wv", "ape"];
const LOSSLESS = new Set(["flac", "wav", "aiff", "wv", "ape"]);
export type Quality = "lossless" | "any" | "small";

export interface Cand {
  id: string;
  title: string;
  artist: string;
  album: string;
  ext: string;
  size: number;
  container: string;
  owned: boolean;
  alts?: { title: string; artist: string }[];
  ctx?: string;
}

export const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...headers },
  });
}
export function notice(
  status: number,
  title: string,
  message: string,
  extra: Record<string, string> = {},
  id = "connection",
) {
  return json(
    {
      notice: {
        id,
        level: status >= 500 && status !== 503 ? "error" : "info",
        title,
        message: message.slice(0, 120),
      },
    },
    status,
    extra,
  );
}
export async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const TAG_WORDS = [
  "feat",
  "ft\\.",
  "featuring",
  "with ",
  "w\\/",
  "from ",
  "prod\\.",
  "prod by",
  "remaster",
  "version",
  "\\bedit\\b",
  "explicit",
  "\\bclean\\b",
  "bonus",
  "official",
  "\\baudio\\b",
  "\\bvideo\\b",
  "lyric",
  "visuali[sz]er",
  "original mix",
  "deluxe",
  "\\bhq\\b",
  "\\bhd\\b",
  "\\b4k\\b",
  "kbps",
  "\\bmono\\b",
  "\\bstereo\\b",
];
const BRACKET_TAG = new RegExp(
  `[\\(\\[][^\\)\\]]*(?:${TAG_WORDS.join("|")})[^\\)\\]]*[\\)\\]]`,
  "gi",
);

function loose(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘`´]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function norm(s: string): string {
  return loose(
    s
      .replace(
        /\s[-–—]\s(?:\d{4}\s)?(?:remaster(?:ed)?|mono|stereo|single version|album version|radio edit|bonus track|original mix)(?:\s\d{4})?(?:\s(?:version|mix|edit))?\s*$/i,
        " ",
      )
      .replace(BRACKET_TAG, " ")
      .replace(/\s(?:feat|ft|featuring)\.?\s.*$/i, " ")
      .replace(/\bpt\b\.?/gi, "part"),
  );
}
export function sim(a: string, b: string): number {
  const na = norm(a),
    nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb || na.replace(/ /g, "") === nb.replace(/ /g, "")) return 1;
  const ta = new Set(na.split(" ")),
    tb = new Set(nb.split(" "));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}
export function contains(hay: string, needle: string) {
  const h = " " + norm(hay) + " ",
    n = norm(needle);
  return !!n && h.includes(" " + n + " ");
}
export function extOf(name: string) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}
export function b64u(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const EXT_RE = /\.(flac|mp3|m4a|ogg|opus|wav|aac|aiff|wv|ape)$/i;
const VARIOUS =
  /^(va|v\.a\.?|various|various artists?|varios artistas|compilation|soundtrack|ost)$/i;

export function parseFile(path: string, containerName: string) {
  const parts = path.split("/").filter(Boolean);
  const file = parts[parts.length - 1] || path;
  let stem = file
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  stem = stem.replace(/^(\s*\[[^\]]*\]\s*)+/, "") || stem;
  stem = stem.replace(/^(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|me|cc|to|ru|co)\s*[-–—]\s*/i, "");
  stem = stem.replace(/(\s*\[[^\]]*\])+\s*$/, "").trim() || stem;

  let title = stem,
    sceneArtist = "",
    numbered = "";
  const scene = /^\d{1,3}-([^-]+)-(.+)$/.exec(stem);
  if (scene && !/\s[-–—]\s/.test(stem)) {
    sceneArtist = scene[1].trim();
    title = scene[2].trim();
  } else {
    const spaced = /^\s*(?:\d{1,2}[-.]\d{1,2}|\d{1,3}|[A-Da-d]\d{1,2})\s*([-–—.)\]]?)\s+(.+)$/.exec(
      stem,
    );
    const tight = /^\d{1,3}\s*[-._)]\s*(?=[^\d\s])(.+)$/.exec(stem);
    if (spaced) {
      title = spaced[2];
      if (!spaced[1]) numbered = stem;
    } else if (tight) title = tight[1];
    title = title.replace(/^\s*[-–—]\s*/, "");
  }

  let folder = parts.length > 1 ? parts[0] : containerName;
  if (/^(cd|disc|disk)\s*\d+$/i.test(folder)) folder = containerName;
  folder = folder.replace(EXT_RE, "");
  const clean = folder
    .replace(/[\[\(\{][^\]\)\}]*[\]\)\}]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let artist = "",
    album = clean;
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(clean);
  if (m) {
    artist = m[1].trim();
    album = m[2].replace(/^\d{4}\s+[-–—]\s+/, "").trim();
  }
  if (VARIOUS.test(artist)) artist = "";

  const alts: { title: string; artist: string }[] = [];
  const full = title;
  const segs = title
    .split(/\s+[-–—]\s+/)
    .map((x) => x.trim())
    .filter((x) => x && !/^\d{1,3}$/.test(x));
  if (segs.length >= 2) {
    const a = segs[0],
      b = segs.slice(1).join(" - "),
      last = segs[segs.length - 1];
    if (!artist || sim(a, artist) > 0.6 || contains(artist, a) || contains(a, artist)) {
      artist ||= a;
      title = b;
      alts.push({ title: full, artist });
    } else alts.push({ title: b, artist: a });
    alts.push({ title: a, artist: b });
    if (segs.length >= 3) alts.push({ title: last, artist: a }, { title: last, artist });
  }
  if (!artist && sceneArtist) artist = sceneArtist;
  if (numbered) alts.push({ title: numbered, artist });
  const near = parts
    .slice(0, -1)
    .filter((x) => !/^(cd|disc|disk)\s*\d+$/i.test(x))
    .pop();
  const ctx = (near || containerName).replace(EXT_RE, "");
  return alts.length ? { title, artist, album, ctx, alts } : { title, artist, album, ctx };
}

export function qualityBonus(c: Cand, s: { quality: Quality }) {
  const lossless = LOSSLESS.has(c.ext);
  if (s.quality === "lossless") return lossless ? 0.06 : 0;
  if (s.quality === "small") return lossless ? 0 : 0.06;
  return 0;
}

const VERSIONS = [
  "live",
  "remix",
  "instrumental",
  "karaoke",
  "acoustic",
  "demo",
  "tribute",
  "taylors version",
  "sped up",
  "slowed",
  "nightcore",
  "acapella",
  "a cappella",
  "8d",
  "cover version",
];
const CUTS = ["extended", "reprise", "stripped", "orchestral"];
const hasWord = (text: string, w: string) => (" " + text + " ").includes(" " + w + " ");

type Wanted = { title: string; artist: string; album?: string; albums?: string[] };
function scoreReading(
  c: Cand,
  title: string,
  artist: string,
  want: Wanted,
  s: { quality: Quality },
): number {
  const t = sim(title, want.title);
  if (t < 0.6) return 0;
  const artistOk =
    !want.artist ||
    sim(artist, want.artist) >= 0.5 ||
    contains(artist, want.artist) ||
    contains(c.container, want.artist) ||
    contains(title, want.artist);
  let penalty = 0;
  const viaAlbum =
    !artistOk &&
    t >= 1 &&
    (want.albums || []).some((a) => contains(c.container, a) || sim(c.album, a) >= 0.6);
  if (viaAlbum) penalty = 0.05;
  else if (!artistOk) {
    if (!c.owned || artist || t < 1) return 0;
    const albumWords = new Set(
      norm(want.album || "")
        .split(" ")
        .filter((w) => w.length > 2),
    );
    const albumHint = norm(`${c.album} ${c.container}`)
      .split(" ")
      .some((w) => albumWords.has(w));
    if (norm(want.title).split(" ").length < 2 && !albumHint) return 0;
    penalty = albumHint ? 0.08 : 0.15;
  }
  let score = 0.7 * t + 0.2 - penalty;
  if (want.album && (sim(c.album, want.album) >= 0.6 || contains(c.container, want.album)))
    score += 0.08;
  const have = loose(`${title} ${c.ctx ?? c.container}`),
    wanted = loose(`${want.title} ${want.album || ""}`);
  for (const w of VERSIONS) {
    const a = hasWord(have, w),
      b = hasWord(wanted, w);
    if (a !== b) return 0;
    if (a && t < 0.8) return 0;
  }
  for (const w of CUTS) if (hasWord(have, w) !== hasWord(wanted, w)) score -= 0.2;
  return score + qualityBonus(c, s) + (c.owned ? 0.03 : 0);
}
export function scoreCand(c: Cand, want: Wanted, s: { quality: Quality }): number {
  let best = scoreReading(c, c.title, c.artist, want, s);
  for (const a of c.alts || [])
    best = Math.max(best, scoreReading(c, a.title, a.artist, want, s) - 0.01);
  return best;
}

export function toTrack(c: Cand) {
  return {
    id: c.id,
    title: c.title,
    artist: c.artist || "Unknown artist",
    album: c.album || undefined,
    format: c.ext,
  };
}

export interface Want {
  title: string;
  artist: string;
  album?: string;
  albums?: string[];
}
export function bestMatch(list: Cand[], want: Want, s: { quality: Quality }): Cand | null {
  let top: Cand | null = null,
    topScore = 0;
  for (const c of list) {
    const sc = scoreCand(c, want, s);
    if (sc > topScore) {
      top = c;
      topScore = sc;
    }
  }
  return topScore >= 0.72 ? top : null;
}
export function matchesQuery(c: Cand, q: string) {
  const words = norm(q).split(" ").filter(Boolean);
  const hay = norm(`${c.artist} ${c.album} ${c.title} ${c.container}`);
  return words.every((w) => hay.includes(w));
}
export function rankForQuery(c: Cand, q: string, s: { quality: Quality }) {
  return (
    sim(`${c.artist} ${c.title}`, q) + sim(c.title, q) + qualityBonus(c, s) + (c.owned ? 0.05 : 0)
  );
}
export function qualityFrom(v: string | null): Quality {
  return v === "any" || v === "small" ? v : "lossless";
}
export const QUALITY_SETTING = {
  key: "quality",
  type: "select",
  label: "Preferred quality",
  default: "lossless",
  options: [
    { value: "lossless", label: "Lossless (FLAC) first" },
    { value: "any", label: "No preference" },
    { value: "small", label: "Smaller files (MP3/AAC) first" },
  ],
};
