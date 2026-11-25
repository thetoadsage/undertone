import { extractAuth, HttpError, serverIdFor, userFromToken } from "./auth";
import { jellyfinRouter } from "./jellyfin/routes";
import type { Router } from "./router";
import type { Background, Ctx, Env } from "./types";
import { webRouter } from "./web/api";

const web = webRouter();
const jf = jellyfinRouter();

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
  "access-control-allow-headers": [
    "Authorization",
    "X-Emby-Authorization",
    "X-Emby-Token",
    "X-MediaBrowser-Token",
    "Content-Type",
    "Range",
    "Accept",
    "X-Requested-With",
    "X-Emby-Client",
    "X-Emby-Device-Id",
    "X-Emby-Device-Name",
    "X-Emby-Client-Version",
  ].join(", "),
  "access-control-expose-headers": "Content-Length, Content-Range, Accept-Ranges, Location",
  "access-control-max-age": "86400",
};

function withCors(res: Response): Response {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
}

async function readBody(req: Request): Promise<any> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      return Object.fromEntries(
        [...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
      );
    }
    const text = await req.text();
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

export default {
  async fetch(req: Request, env: Env, exec: Background): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    let path = url.pathname.replace(/\/{2,}/g, "/");
    path = path.replace(/^\/(jellyfin|emby|mediabrowser)(?=\/|$)/i, "") || "/";
    if (path.length > 1) path = path.replace(/\/$/, "");

    const q = new Map<string, string>();
    url.searchParams.forEach((v, k) => q.set(k.toLowerCase(), v));
    const isWeb = path === "/" || /^\/(setup|web|undertone)(\/|$)/i.test(path);
    const routers: Router[] = isWeb ? [web, jf] : [jf, web];

    let match = null;
    for (const r of routers) {
      match = r.match(req.method, path);
      if (match) break;
    }
    if (!match) {
      console.log("unhandled", req.method, path + url.search);
      return withCors(new Response("Not found", { status: 404 }));
    }

    const auth = extractAuth(req, q);
    const c: Ctx = {
      env,
      req,
      url,
      exec,
      params: match.params,
      q,
      auth,
      serverId: serverIdFor(env, url),
    };
    try {
      if (auth.token) {
        const u = await userFromToken(env, auth.token);
        if (u) {
          c.user = u;
          c.token = auth.token;
        }
      }
      if (match.route.auth && !c.user) throw new HttpError(401, "Unauthorized");
      c.body = await readBody(req);
      const res = await match.route.handler(c);
      if (
        req.method === "HEAD" &&
        res.body &&
        !path.toLowerCase().startsWith("/audio") &&
        !/\/(download|file)$/i.test(path)
      ) {
        return withCors(new Response(null, { status: res.status, headers: res.headers }));
      }
      return withCors(res);
    } catch (e: any) {
      const isApi = path.toLowerCase().startsWith("/undertone");
      const status = e instanceof HttpError ? e.status : isApi ? 400 : 500;
      if (status >= 500) console.log("error", req.method, path, e?.stack || e);
      const msg = e?.message || "Internal error";
      return withCors(
        new Response(isApi ? JSON.stringify({ error: msg }) : msg, {
          status,
          headers: { "content-type": isApi ? "application/json" : "text/plain" },
        }),
      );
    }
  },
};
