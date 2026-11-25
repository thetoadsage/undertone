# Getting started

## 1. Run it

**With Docker (any VPS or home server)**

```bash
git clone https://github.com/thetoadsage/undertone.git
cd undertone
docker compose up -d --build
```

That builds the image and starts Undertone at `http://localhost:8787`. Set `UNDERTONE_BIND_IP` in the repository root's `.env` to the
server's LAN IPv4 address for access from another machine. Everything it remembers (accounts, libraries, playlists,
settings) is in the `undertone-data` volume. To update, run `git pull && docker compose up -d --build`.

To back up, copy the volume's `undertone.db` file. To move servers, bring that file along.

**Without Docker**

```bash
./undertone/start-local.sh
```

Needs Node.js 22.13 or newer. Data goes to `undertone/data`.

**Settings**

Set them under `environment:` in `compose.yaml`, or as environment variables.

| Setting | What it does | Default |
|---|---|---|
| `PORT` | Port to listen on | `8787` |
| `DATA_DIR` | Where the database file lives | `/data` in the image, `./data` otherwise |
| `SERVER_NAME` | Name shown to apps and on the setup page | `Undertone` |
| `SIGNUP` | `open` lets anyone create an account from the start | `closed` |
| `CATALOG` | Link to a catalog connection file, used until the admin picks one | none |
| `CONNECTIONS_INDEX` | Link to a list of connections shown under "Available" | none |
| `CONNECTIONS_DIR` | A folder of connection files to serve at `/connections/<file>.json` | `/app/connections` in the image |

The Compose file mounts `undertone-connections` into the container and points `CATALOG` and `CONNECTIONS_INDEX` at
it. Remove those two lines and the server starts empty: no catalog, no list. People can still paste links or upload
files.

**Putting it on the internet**

Run it behind a reverse proxy that adds HTTPS (Caddy, Traefik, nginx). Undertone reads the usual `X-Forwarded-Proto`
and `X-Forwarded-Host` headers, so the address it shows on the Apps page is the public one. A Caddyfile is two lines:

```
music.example.com {
  reverse_proxy localhost:8787
}
```

## 2. Create the first account

Open the server's address. The first account created becomes the admin.

After that, the admin decides who can join, on the **People** page:

- "Let anyone create an account" on: the sign-in page offers "Create an account".
- Off: only the admin adds people.

## 3. Choose a catalog (admin, once)

On **People → Catalog**, pick one from the list or paste the link to a catalog connection file. The catalog is what
you search and browse. There is one per server because everyone's library and playlists are built on its item ids;
changing it later makes existing libraries stop opening.

## 4. Add your connections

On **Connections**, add what you use. Three ways:

- paste the link to a connection file (a GitHub link works),
- choose the file from your computer,
- paste the file's contents.

If a connection needs something from you (an API key, a server address), its settings open straight away. "Save" also
tests it.

Connections are asked **from the top down, one at a time**. The first one that has the song plays it and the rest are
not contacted. Reorder them with the arrows, and switch any of them off without removing it.

"Try a song" at the top of the page looks a song up and tells you which connection would play it, in what format and
how long it took.

## 5. Connect an app

On **Apps** you'll find the server address. In a Jellyfin music app (Finamp, Feishin, Symfonium, Manet and others), add
a server with that address and sign in with your Undertone username and password.

Search for anything. What you play and favorite becomes your library.

## 6. Import playlists

On **Import**, paste either:

- a playlist link, if you have a connection that reads that service, or
- a list of songs copied from anywhere: one `Artist - Title` per line, a CSV export with track and artist columns, or
  the contents of an M3U file.

Each song is matched to the catalog and saved as a normal playlist. With "Get the songs ready to play" on, each one is
also looked up on your audio connections now, so it starts immediately later.

## Good to know

- **Playback delivery** (Account page). "Direct when possible" hands your app the connection's own link. Files that a
  service serves as a plain download are relayed through Undertone either way, because most players refuse those.
- **"Only cached"**. An audio connection can offer this setting. On, nothing is ever fetched on your behalf: a song
  either is available at the service right now or it isn't. Off, the service may be asked to fetch it for next time.
- **Secrets** you enter (API keys, passwords) are stored in the server's database so the connection can use them. Use
  keys you can revoke.
