# Undertone

A music server for Jellyfin apps that has nothing inside it.

Undertone looks like a Jellyfin server to any Jellyfin music app, but it holds no music and knows no services.
Everything it does comes from **connections**: small JSON files that describe how to talk to a service. The catalog you
search, where audio comes from, lyrics, listening history and playlist import are all connections.

It is one small Node process with one SQLite file, and ships as a Docker image.

This directory contains the server. The repository also includes [ready-made connection files](../undertone-connections/) and [operator guides](../undertone-docs/).

## Run it

```bash
# From the repository root
docker compose up -d --build
```

Open `http://localhost:8787` and create the first account. It becomes the admin. Set `UNDERTONE_BIND_IP` in the repository root's `.env` to bind Compose to a different host address.

The sibling `undertone-connections` folder is mounted into the container and served at `/connections/`. The Compose file starts the
server with the catalog and the "Available" list from that folder. For a server that starts empty, remove the
`CATALOG` and `CONNECTIONS_INDEX` lines; people can still add connections by link, by file or by pasting.

Without Docker, run `./undertone/start-local.sh` from the repository root with Node.js 22.13 or newer.

## Settings

| Variable | What it does | Default |
|---|---|---|
| `PORT` | Port to listen on | `8787` |
| `DATA_DIR` | Where the database file lives | `/data` in the image, `./data` otherwise |
| `SERVER_NAME` | Name shown to apps and on the setup page | `Undertone` |
| `SIGNUP` | `open` lets anyone create an account from the start | `closed` |
| `CATALOG` | Link to a catalog connection file, used until the admin picks one | none |
| `CONNECTIONS_INDEX` | Link to a list of connections shown under "Available" | none |
| `CONNECTIONS_DIR` | A folder of connection files to serve at `/connections/<file>.json` | `/app/connections` in the image |

Everything the server remembers is in `undertone.db` inside the data volume. Back that file up; bring it along to move
servers. To update from the repository root, run `git pull && docker compose up -d --build`.

Put it behind a reverse proxy for HTTPS. The usual `X-Forwarded-Proto` and `X-Forwarded-Host` headers are honoured.

## Develop

```bash
npm install
npm run typecheck
npm run build
npm run format
```

No runtime dependencies: Node built-ins only.

## Layout

| Path | What it is |
|---|---|
| `src/server.ts` | HTTP server, SQLite storage, static `/connections/` |
| `src/index.ts` | Routing, authentication, CORS |
| `src/engine.ts` | The engine that runs connection files |
| `src/connections.ts` | Each person's connections, and finding a stream for a track |
| `src/match.ts` | Matching file names to tracks |
| `src/meta/` | The catalog, read from a connection |
| `src/jellyfin/` | The Jellyfin API |
| `src/web/` | The setup page and its API |
| `schema.sql` | Database tables |

## Neutrality

The code names no music service. If a service changes or disappears, the fix is a JSON file, not a release. Undertone
only passes requests along: what a connection reaches, and whether you may use it, is between you and that service.

MIT licensed.
