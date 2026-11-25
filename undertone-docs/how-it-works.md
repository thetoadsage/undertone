# How it works

Undertone is a translator. On one side it speaks the Jellyfin API, so music apps treat it as a server. On the other
side it runs connection files, which tell it how to talk to services. In between it does two jobs of its own: it keeps
each person's library, and it decides which file at a service is the song that was asked for.

```
 Jellyfin app  ──►  Undertone  ──►  catalog connection      (what exists)
                        │      ──►  audio connections        (where it can be heard)
                        │      ──►  lyrics / history / import connections
                        └── its own database: accounts, favorites, plays, playlists
```

## When you search

The app's search goes to the server's catalog connection. The answers are turned into Jellyfin items. Item ids are made
from the catalog's own ids, which is why a server has exactly one catalog. Catalog answers are cached, so repeated
browsing costs nothing.

## When you press play

1. The app asks for the audio of a track id.
2. Undertone looks the track up in the catalog: title, artist, album.
3. It goes through your audio connections **in your order, one at a time**. For each one:
   - a connection with a `tracks` block is asked directly for the song (one request);
   - a connection with a `library` block has its file list read (and remembered for a few minutes) and searched;
   - if the song isn't there and the connection has `find` + `cached`, releases are looked up, and only those the
     service can serve right now are considered; the chosen one is attached to your account with `attach`.
4. The first connection that produces a link wins. The others are not contacted.
5. The link is remembered until it expires, so the next play is immediate.

If no connection has the song, the app gets "not found" quickly. Nothing waits and nothing is downloaded, unless a
connection offers an "only cached" setting and you turned it off.

## Matching a file to a song

Services list files, not songs: `Artist - Album (2001) [FLAC]/01 - Song.flac`, `Song - Artist [uploader].flac`,
`08-artist-song_name.flac`. Undertone reads each name in every plausible way and scores the readings against the
track it wants.

- The title has to match, and the artist has to appear somewhere: in the file name, its folder or the release name.
- Credits and tags that don't change the recording are ignored: "feat. X", "(Remastered 2011)", "(Official Video)".
- Words that do change the recording are decisive: a file marked live, remix, acoustic, instrumental, karaoke or demo
  is only chosen when that is what was asked for.
- Your own files with no artist anywhere (a soundtrack folder, say) are accepted on an exact title.
- A compilation is accepted only when the catalog lists the track on that compilation.

This logic lives in `src/match.ts` of the server.

## Delivery

By default the app is redirected to the connection's link and fetches the audio itself. Some services serve files as
generic downloads; players refuse those, so Undertone notices and relays them with the right type instead.

## Lyrics, history, import

- **Lyrics**: your connections with a `lyrics` block are asked in order; the first with words for the track answers.
- **History**: when a song starts, and when it has been played for half its length or four minutes, every connection
  of yours with a `track` block is told.
- **Import**: a pasted link is handed to your connections with a `playlists` block; the first whose pattern fits reads
  it. Pasted text needs no connection.

## Staying light

The server is deliberately frugal with outside requests, so it is polite to the services it talks to and quick on a
small machine:

- connections are asked one after another and the search stops at the first hit;
- file lists and catalog answers are remembered for a while;
- playlist import is driven by the page, one song per request, so a long playlist never becomes one enormous request.

## What it stores

One SQLite file (`undertone.db` in the data folder) holds everything: accounts with hashed passwords, sign-ins,
each person's connections and their settings, favorites, play counts, playlists, and short-lived things such as
resolved links and found lyrics. Catalog answers are kept in memory only.

## What the server never does

- It never joins a torrent swarm or downloads anything itself. It only makes HTTPS requests that a connection file
  describes, and passes on links.
- It enables nothing by itself. `CATALOG` and `CONNECTIONS_INDEX` exist so whoever runs it can point to files of
  their choosing.
