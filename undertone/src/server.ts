import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { Readable } from "node:stream";
import worker from "./index";
import type { Db, Env, Kv, Statement } from "./types";

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const CONNECTIONS_DIR = process.env.CONNECTIONS_DIR
  ? path.resolve(process.env.CONNECTIONS_DIR)
  : "";
fs.mkdirSync(DATA_DIR, { recursive: true });

const sql = new DatabaseSync(path.join(DATA_DIR, "undertone.db"));
sql.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
sql.exec(fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
sql.exec(
  "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER); CREATE INDEX IF NOT EXISTS kv_expires ON kv(expires);",
);

const clean = (v: unknown) =>
  (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v) as any;
class Stmt implements Statement {
  constructor(
    public text: string,
    public args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new Stmt(this.text, args.map(clean));
  }
  async first<T = any>(): Promise<T | null> {
    return (sql.prepare(this.text).get(...(this.args as any[])) as T) ?? null;
  }
  async all<T = any>(): Promise<{ results: T[] }> {
    return { results: sql.prepare(this.text).all(...(this.args as any[])) as T[] };
  }
  async run() {
    const r = sql.prepare(this.text).run(...(this.args as any[]));
    return { meta: { changes: Number(r.changes) } };
  }
}
const DB: Db = {
  prepare: (text: string) => new Stmt(text),
  async batch(stmts: Statement[]) {
    sql.exec("BEGIN");
    try {
      const out = [];
      for (const s of stmts as Stmt[])
        out.push({
          meta: { changes: Number(sql.prepare(s.text).run(...(s.args as any[])).changes) },
        });
      sql.exec("COMMIT");
      return out;
    } catch (e) {
      sql.exec("ROLLBACK");
      throw e;
    }
  },
};

const now = () => Math.floor(Date.now() / 1000);
const KV: Kv = {
  async get(key: string, type?: string): Promise<any> {
    const row = sql.prepare("SELECT value, expires FROM kv WHERE key = ?").get(key) as
      { value: string; expires: number | null } | undefined;
    if (!row || (row.expires && row.expires <= now())) return null;
    if (type === "json") {
      try {
        return JSON.parse(row.value);
      } catch {
        return null;
      }
    }
    return row.value;
  },
  async put(key: string, value: string, opts?: { expirationTtl?: number }) {
    sql
      .prepare(
        "INSERT INTO kv (key, value, expires) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires = excluded.expires",
      )
      .run(
        key,
        String(value),
        opts?.expirationTtl ? now() + Math.max(1, Math.floor(opts.expirationTtl)) : null,
      );
  },
  async delete(key: string) {
    sql.prepare("DELETE FROM kv WHERE key = ?").run(key);
  },
  async list(opts?: { prefix?: string; cursor?: string }) {
    const rows = sql
      .prepare(
        "SELECT key FROM kv WHERE key >= ? AND key < ? AND (expires IS NULL OR expires > ?) ORDER BY key LIMIT 1000",
      )
      .all(opts?.prefix || "", (opts?.prefix || "") + "￿", now()) as { key: string }[];
    return { keys: rows.map((r) => ({ name: r.key })), list_complete: true, cursor: "" };
  },
};
setInterval(() => {
  try {
    sql.prepare("DELETE FROM kv WHERE expires IS NOT NULL AND expires <= ?").run(now());
  } catch {}
}, 10 * 60_000).unref();

const mem = new Map<string, { until: number; body: string; type: string }>();
(globalThis as any).caches = {
  default: {
    async match(req: Request) {
      const hit = mem.get(req.url);
      if (!hit) return undefined;
      if (hit.until <= Date.now()) {
        mem.delete(req.url);
        return undefined;
      }
      mem.delete(req.url);
      mem.set(req.url, hit);
      return new Response(hit.body, { headers: { "content-type": hit.type } });
    },
    async put(req: Request, res: Response) {
      const age = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1] || 0);
      if (!age) return;
      mem.set(req.url, {
        until: Date.now() + age * 1000,
        body: await res.text(),
        type: res.headers.get("content-type") || "application/json",
      });
      while (mem.size > 4000) mem.delete(mem.keys().next().value as string);
    },
    async delete(req: Request) {
      return mem.delete(req.url);
    },
  },
};

const env: Env = {
  DB,
  KV,
  SERVER_NAME: process.env.SERVER_NAME || "Undertone",
  SERVER_ID: process.env.SERVER_ID,
  SIGNUP: process.env.SIGNUP || "closed",
  CATALOG: process.env.CATALOG,
  CONNECTIONS_INDEX: process.env.CONNECTIONS_INDEX,
  DEFAULT_STREAM_MODE: process.env.DEFAULT_STREAM_MODE || "redirect",
};
const exec = {
  waitUntil(p: Promise<unknown>) {
    Promise.resolve(p).catch((e) => console.log("background task failed", e));
  },
  passThroughOnException() {},
};

function publicUrl(req: http.IncomingMessage): string {
  const h = req.headers;
  const proto =
    String(h["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim() || "http";
  const host =
    String(h["x-forwarded-host"] || "")
      .split(",")[0]
      .trim() ||
    h.host ||
    `localhost:${PORT}`;
  return `${proto}://${host}${req.url || "/"}`;
}

const server = http.createServer(async (req, res) => {
  try {
    const file = CONNECTIONS_DIR
      ? /^\/connections\/([\w.-]+\.json)(?:\?.*)?$/.exec(req.url || "")
      : null;
    if (file) {
      const p = path.join(CONNECTIONS_DIR, file[1]);
      if (!p.startsWith(CONNECTIONS_DIR + path.sep) || !fs.existsSync(p)) {
        res.writeHead(404).end();
        return;
      }
      res
        .writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "cache-control": "no-cache",
        })
        .end(fs.readFileSync(p));
      return;
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const request = new Request(publicUrl(req), {
      method: req.method,
      headers,
      body: hasBody ? (Readable.toWeb(req) as any) : undefined,
      signal: abort.signal,
      ...(hasBody ? { duplex: "half" } : {}),
    } as RequestInit);
    const out = await worker.fetch(request, env, exec as any);
    const h: Record<string, string | string[]> = {};
    out.headers.forEach((v, k) => {
      if (k !== "set-cookie") h[k] = v;
    });
    res.writeHead(out.status, h);
    if (!out.body || req.method === "HEAD") {
      res.end();
      return;
    }
    Readable.fromWeb(out.body as any)
      .on("error", () => res.destroy())
      .pipe(res);
  } catch (e) {
    console.log("request failed", req.method, req.url, e);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal error");
  }
});

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (!key || !/^\/(?:(?:jellyfin|emby|mediabrowser)\/)?socket(?:\?|$)/i.test(req.url || "")) {
    socket.destroy();
    return;
  }
  const accept = createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  const send = (text: string) => {
    const b = Buffer.from(text);
    if (b.length < 126) socket.write(Buffer.concat([Buffer.from([0x81, b.length]), b]));
  };
  send(JSON.stringify({ MessageType: "ForceKeepAlive", Data: 60 }));
  socket.on("data", (d: Buffer) => {
    const op = d[0] & 0x0f;
    if (op === 0x8) {
      socket.end();
      return;
    }
    if (op === 0x9) {
      socket.write(Buffer.from([0x8a, 0]));
      return;
    }
    if (op === 0x1) send(JSON.stringify({ MessageType: "KeepAlive" }));
  });
  socket.on("error", () => {});
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`${env.SERVER_NAME} is listening on port ${PORT}. Data: ${DATA_DIR}`);
  if (!env.CATALOG) console.log("No CATALOG set: the admin chooses one on the People page.");
});
for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    server.close();
    try {
      sql.close();
    } catch {}
    process.exit(0);
  });
