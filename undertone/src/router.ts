import type { Ctx } from "./types";

export type Handler = (c: Ctx) => Promise<Response> | Response;
interface Route {
  method: string;
  parts: string[];
  handler: Handler;
  auth: boolean;
}

export class Router {
  routes: Route[] = [];
  add(method: string | string[], pattern: string, handler: Handler, auth = true) {
    for (const m of Array.isArray(method) ? method : [method]) {
      this.routes.push({
        method: m.toUpperCase(),
        parts: split(pattern).map((p) => (p.startsWith(":") || p === "*" ? p : p.toLowerCase())),
        handler,
        auth,
      });
    }
  }
  get(p: string, h: Handler, auth = true) {
    this.add("GET", p, h, auth);
  }
  post(p: string, h: Handler, auth = true) {
    this.add("POST", p, h, auth);
  }
  del(p: string, h: Handler, auth = true) {
    this.add("DELETE", p, h, auth);
  }

  match(method: string, path: string): { route: Route; params: Record<string, string> } | null {
    const segs = split(path);
    const lower = segs.map((s) => s.toLowerCase());
    const m = method === "HEAD" ? "GET" : method;
    for (const r of this.routes) {
      if (r.method !== m) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < r.parts.length; i++) {
        const p = r.parts[i];
        if (p === "*") {
          params["*"] = segs.slice(i).join("/");
          i = r.parts.length;
          break;
        }
        if (i >= segs.length) {
          ok = false;
          break;
        }
        if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(segs[i]);
        else if (p !== lower[i]) {
          ok = false;
          break;
        }
      }
      if (ok && (r.parts.includes("*") || r.parts.length === segs.length))
        return { route: r, params };
    }
    return null;
  }
}

function split(p: string) {
  return p.split("/").filter(Boolean);
}
