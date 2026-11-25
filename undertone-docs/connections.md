# Writing connections

A connection is **one JSON file**. It describes how to talk to a service; Undertone runs it. There is no code to host.
Put the file anywhere reachable over https (a GitHub repository is fine), or hand it to people as a file.

Undertone knows nothing about any particular service. Everything service-specific lives in these files.

## The smallest connection

```json
{
  "undertone": 1,
  "id": "my-history",
  "name": "My history",
  "description": "Sends what I play to my own server.",
  "settings": [{ "key": "url", "type": "text", "label": "Address", "required": true }],
  "track": {
    "played": { "method": "POST", "url": "{{&settings.url}}", "json": { "title": "{{track.title}}", "artist": "{{track.artist}}" } }
  }
}
```

`undertone` is the format version (currently `1`). `id` and `name` are required. A file needs at least one of the blocks
below; it may have several.

## Blocks

| Block | Makes the connection… | Used by |
|---|---|---|
| `catalog` | the server's catalog | the admin, once per server |
| `tracks` | an audio source you can ask for a song directly | each person |
| `library` (+ `find`, `cached`, `attach`) | an audio source that lists files you have at a service | each person |
| `lyrics` | a lyrics source | each person |
| `track` | a listening-history target | each person |
| `playlists` | a playlist reader for the Import page | each person |

## The basics

### Settings

What the person fills in. Each value is available as `{{settings.key}}`.

```json
"settings": [
  { "key": "apiKey", "type": "password", "label": "API key", "help": "Where to find it.", "required": true },
  { "key": "quality", "type": "select", "label": "Quality", "default": "lossless",
    "options": [{ "value": "lossless", "label": "Lossless first" }, { "value": "any", "label": "No preference" }] },
  { "key": "search", "type": "toggle", "label": "Search beyond my files", "default": true }
]
```

Types: `text`, `password`, `number`, `toggle`, `select`. A connection with an unfilled `required` setting is skipped
until it is filled in.

### Requests

```json
{ "method": "POST", "url": "https://api.example/x?id={{id}}", "headers": { "authorization": "Bearer {{settings.apiKey}}" },
  "json": { "a": "{{title}}" } }
```

| Field | Meaning |
|---|---|
| `url` | Must be http(s). |
| `method` | Defaults to GET, or POST when there is a body. |
| `headers` | Any headers. |
| `json` | A JSON body. |
| `form` | A multipart form body. |
| `urlencoded` | A classic web-form body. Empty values are left out. |
| `sign` | With `urlencoded`: `{ "into": "api_sig", "secret": "{{settings.secret}}" }` adds an MD5 of every name+value in name order followed by the secret (`format` and `callback` excluded). Several scrobbling services use this. |
| `extract` | For a page that isn't JSON: a pattern whose first group is the JSON to read, such as the contents of a data `<script>` tag. |
| `timeout` | Milliseconds, 25000 at most. |

### Templates

| Form | Result |
|---|---|
| `{{name}}` | The value, URL-encoded inside `url`, as-is elsewhere |
| `{{&name}}` | The value, never encoded (for a whole address held in a setting) |
| `{{hex name}}`, `{{b64 name}}` | The value hex- or base64-encoded |
| `"{{#name}}"` as a whole JSON value | The value as a number |

### Paths

Where a field is in an answer: `data.items`, `artists.0.name`. `""` is the whole answer. A step written
`[field=value]` picks the first list entry whose field has that value: `sections.[kind=tracks].items`.

### Conditions

`{ "path": "…", "equals": … }`, `notEquals`, `match` (pattern) or `notMatch`. Used in lists; all must hold.

### Failures

- `"fail": [conditions]` treats an answer as a failure even when the HTTP status is fine (`{ "success": false }`).
- `"message": "path"` says where a failed answer keeps its explanation, if not in `detail`, `message` or `error`.
- `"check": request` is what "Test" runs to prove the settings work.

### A login that is reused

```json
"session": { "request": { "method": "POST", "url": "https://api.example/login", "urlencoded": { "user": "{{settings.user}}" } },
             "path": "session.key", "days": 30 }
```

The value at `path` is fetched once, remembered for `days`, and available as `{{session}}`. If a later request is
rejected, Undertone logs in again once and retries.

## Audio: `tracks`

For a service you can ask for a song, such as your own music server.

```json
"tracks": [{
  "request": { "url": "{{&settings.server}}/search?q={{title}}" },
  "items": "results", "id": "id", "title": "title", "artist": "artist", "album": "album", "ext": "format",
  "link": { "url": "{{&settings.server}}/stream/{{id}}" }
}]
```

Available in the request: `{{query}}` ("artist title"), `{{title}}`, `{{artist}}`, `{{album}}`. Undertone picks the row
that is the right recording. `link` is a template using `{{id}}`, or `{ "request": …, "path": "…" }` when the link has
to be asked for.

## Audio: `library`, `find`, `cached`, `attach`

For a service that holds files in your account.

```json
"library": [{
  "kind": "downloads",
  "request": { "url": "https://api.example/list?limit={{limit}}&offset={{offset}}" },
  "page": { "size": 1000, "max": 5 },
  "one": { "url": "https://api.example/list?id={{id}}" },
  "items": "data",
  "ready": [{ "path": "done", "equals": true }],
  "id": "id", "name": "name", "hash": "hash", "files": "files",
  "file": { "id": "id", "path": "name", "alt": "short_name", "size": "size" },
  "link": { "request": { "url": "https://api.example/link?id={{id}}&file={{fileId}}" }, "url": "data" }
}]
```

Each item is a container (a download, a folder) with files. Undertone reads the file names and finds the song among
them; you don't describe that.

Optional, for services that can serve known releases instantly:

```json
"find":   [{ "when": "search", "request": { "url": "https://index.example/?q={{query}}" }, "items": "hits", "hash": "hash", "title": "title" }],
"cached": { "request": { "url": "https://api.example/cached?hash={{&hashes}}" }, "items": "data", "hash": "hash",
            "name": "name", "files": "files", "file": { "path": "name" }, "max": 40 },
"attach": { "kind": "downloads", "request": { "method": "POST", "url": "https://api.example/add", "form": { "hash": "{{hash}}" } }, "id": "data.id" },
"uncached": { "unless": "cachedOnly" }
```

- `find` returns release identifiers for a query. `when` names a toggle setting that switches it off.
- `cached` says which of them the service can serve right now, with their file lists. Anything not in its answer is
  never attached.
- `attach` puts a chosen one in the account; `kind` names the `library` entry it then appears in.
- `uncached` is the only thing that lets a connection ask the service to fetch something that isn't ready. It applies
  when the named setting is **off**. Leave the block out and the connection can never cause a download.

## Lyrics: `lyrics`

```json
"lyrics": {
  "request": { "url": "https://lyrics.example/get?title={{title}}&artist={{artist}}&album={{album}}&duration={{duration}}" },
  "synced": "syncedLyrics", "plain": "plainLyrics",
  "skip": [{ "path": "instrumental", "equals": true }],
  "search": { "request": { "url": "https://lyrics.example/search?title={{title}}&artist={{artist}}" },
              "items": "", "title": "trackName", "artist": "artistName", "duration": "duration" }
}
```

`synced` is text with `[mm:ss.xx]` stamps, `plain` is text without. `search` is an optional second try whose best row
is used.

## Listening history: `track`

```json
"track": {
  "nowPlaying": { "method": "POST", "url": "https://history.example/now", "json": { "title": "{{track.title}}" } },
  "played":     { "method": "POST", "url": "https://history.example/played", "json": { "title": "{{track.title}}", "at": "{{#timestamp}}" } }
}
```

Available: `track.title`, `track.artist`, `track.album`, `track.duration` (seconds), `track.durationMs`, `track.isrc`,
`track.trackNo`, and `timestamp` (when the song started, in seconds). Either request may be left out.

## Playlist import: `playlists`

```json
"playlists": [{
  "match": "example\\.com/playlist/(\\w+)",
  "request": { "url": "https://api.example/playlists/{{m1}}" },
  "name": "title", "items": "tracks.data", "next": "tracks.next",
  "title": "title", "artist": "artist.name", "album": "album.title", "isrc": "isrc",
  "artistFirst": ","
}]
```

`match` is tested against the pasted link; its groups are `{{m1}}`, `{{m2}}`… `next` is the path to the following
page's address when the service pages. `artistFirst` keeps the first name when the artist field lists several.

## Catalog: `catalog`

One per server. Three shapes say where each field of an artist, album and track is found; routes say where each kind
of question goes.

```json
"catalog": {
  "artist": { "id": "id", "name": "name", "image": ["picture_xl", "picture_big"], "albumCount": "nb_album" },
  "album":  { "id": "id", "title": "title", "artistId": "artist.id", "artistName": "artist.name", "image": "cover",
              "date": "release_date", "trackCount": "nb_tracks", "duration": "duration", "type": "record_type",
              "upc": "upc", "genres": "genres.data" },
  "track":  { "id": "id", "title": "title", "artistId": "artist.id", "artistName": "artist.name", "artists": "contributors",
              "albumId": "album.id", "albumTitle": "album.title", "image": "album.cover", "duration": "duration",
              "isrc": "isrc", "trackNo": "track_position", "discNo": "disk_number", "date": "release_date", "explicit": "explicit" },
  "genre":  { "id": "id", "name": "name", "image": "picture" },
  "noImage": "/placeholder/",
  "imageSize": { "match": "/\\d+x\\d+-", "replace": "/{{size}}x{{size}}-", "sizes": [250, 500, 1000] },
  "notFound": [{ "path": "error.code", "equals": 800 }],
  "retry": [{ "path": "error.code", "equals": 4 }],
  "routes": {
    "searchTracks": { "request": { "url": "https://api.example/search/track?q={{query}}&limit={{limit}}&index={{offset}}" }, "items": "data", "total": "total" },
    "album":  { "request": { "url": "https://api.example/album/{{id}}" }, "items": "tracks.data" },
    "track":  { "request": { "url": "https://api.example/track/{{id}}" } }
  }
}
```

A field may be one path or a list of paths to try in order.

| Route | Asked with | Needed? |
|---|---|---|
| `searchTracks`, `searchAlbums`, `searchArtists` | `query`, `limit`, `offset` | `searchTracks` is required |
| `findTrack` | `title`, `artist`, `limit` | optional, a more exact lookup |
| `track` | `id` | required |
| `album` | `id` (its `items` is the track list) | required |
| `albumTracks` | `id`, `limit` | optional, when the track list is a separate question |
| `artist`, `artistAlbums`, `artistTopTracks`, `similarArtists`, `artistRadio` | `id`, `limit`, `offset` | optional |
| `chartTracks`, `chartAlbums`, `chartArtists` | `genre`, `limit`, `offset` | optional |
| `newReleases` | `limit` | optional |
| `genres` | nothing | optional |

Per route: `items`, `total`, `hours` (how long to remember the answer), `skip` (conditions that drop a row) and
`defaults` (values for `{{genre}}` and the like when none is given). Routes that are left out simply come back empty.

`noImage` matches the service's "no picture" placeholder addresses. `imageSize` lets apps get smaller pictures: `match`
is the part of an image address that carries the size, `replace` what to put there.

## Offering connections to people

Set `CONNECTIONS_INDEX` to the address of a list like this and they appear under "Available":

```json
{ "connections": [ { "file": "my-service.json", "name": "My service", "description": "…", "does": ["audio"] } ] }
```

`file` is relative to the list's own address; `url` may be used instead. `does` is any of `audio`, `lyrics`, `history`,
`playlists`, `catalog`.

## Trust

A connection sends the settings you give it wherever the file says. Read a file before using it, and prefer keys you
can revoke.
