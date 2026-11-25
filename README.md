# Undertone

Undertone is a self-hosted music server for Jellyfin music clients. One shared catalog supplies search and browsing, while each user adds their own audio, lyrics, listening history, and playlist connections.

## Run with Docker

```sh
git clone https://github.com/thetoadsage/undertone.git
cd undertone
docker compose up -d --build
```

Open `http://localhost:8787` and create the first account. It becomes the admin. To listen from another machine on a trusted LAN, set `UNDERTONE_BIND_IP` to the server's LAN IPv4 address in the repository root's `.env` before starting Compose.

The included Compose file starts with the Deezer catalog and lists the bundled connection definitions on the Connections page. Add your audio sources there, then sign into Undertone from your Jellyfin music client.

- [Getting started](undertone-docs/getting-started.md)
- [How search and playback work](undertone-docs/how-it-works.md)
- [Server development](undertone/README.md)
- [Available connection definitions](undertone-connections/README.md)

MIT licensed.
