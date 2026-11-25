# Undertone connections

Ready-made connection files for Undertone. A connection is one JSON file that describes how to talk to a service;
the server runs it. See the [connection format reference](../undertone-docs/connections.md).

## Use them

The included Compose file and local launcher use this directory for `/connections/` and list its definitions under "Available". Any single file can also be added
from the Connections page by its link, by uploading it or by pasting its contents.

## What is here

| File | Kind | What it does | How it was checked |
|---|---|---|---|
| `deezer-catalog.json` | Catalog | Search, artists, albums, tracks, charts, artwork from Deezer's public API | Live |
| `torbox.json` | Audio | Files in a TorBox account, and releases already cached on TorBox | Live with a real account |
| `subsonic.json` | Audio | Your own Navidrome / Subsonic-compatible music server | Live, against the public Navidrome demo |
| `lrclib.json` | Lyrics | Synced and plain lyrics from LRCLIB | Live |
| `lastfm.json` | History | Scrobbles to Last.fm, with your own API key | Against a stand-in service only: the signature and session renewal |
| `listenbrainz.json` | History | Sends plays to ListenBrainz | Against a stand-in service only |
| `ntfy.json` | History | Push notification when a song starts | Live |
| `discord.json` | History | Posts what you are listening to in a Discord channel | Not run against Discord |
| `webhook.json` | History | Posts every play as JSON to an address of yours | Live, against an echo service |
| `spotify-playlists.json` | Import | Public Spotify playlists, read from the public embed page | Live |
| `apple-music-playlists.json` | Import | Public Apple Music playlists, read from the playlist's web page | Live |
| `deezer-playlists.json` | Import | Public Deezer playlists | Live |
| `listenbrainz-playlists.json` | Import | Public ListenBrainz playlists | Live |
| `index.json` | | The list a server can show as "Available" | |

"Against a stand-in service only" means the connection has not been run with a real account yet.

The two that read web pages (Spotify, Apple Music) depend on those pages keeping their shape. When one changes, the
connection reports that the page no longer has the data.

## Adding one

Write the file, add a line for it to `index.json`, and say in this table how it was checked.

MIT licensed.
