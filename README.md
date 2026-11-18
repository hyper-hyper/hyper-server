# `@hyper-hyper/hyper-server`

Another static file Node server powered with Bun. It has many features, like HTTPS-support with self-signed SSL certificates and Live-Reload over WebSocket. Run `hyper-server --help` to learn more.

## Install

```sh
bun add github:hyper-hyper/hyper-server
```

2. Run it from CLI:

```sh
hyper-server --watch --host localhost --port 8080 ./public
```

Run `hyper-server --help` for the complete CLI help. Run `hyper-server --version` to print the package version.

## Options

| Option | Alias | Default | Description |
| --- | --- | --- | --- |
| `[...arguments]` |  | `./public` | One or more positional document root directories |
| `--host` | `-H` | `localhost` | Hostname or address to bind |
| `--port` | `-p` | `3000` | HTTP or HTTPS server port |
| `--socket` | `-s` | `3001` | Live-reload WebSocket port |
| `--https` | `-S` | `false` | Serve over HTTPS |
| `--cert` | `-c` | `server.crt` | SSL certificate file |
| `--key` | `-k` | `server.key` | SSL private key file |
| `--watch` | `-w` | `false` | Watch for file changes and enable live reload |
| `--index` | `-i` | `true` | Enable generated directory listings |
| `--help` | `-h` | `false` | Print CLI help and exit |
| `--version` | `-v` | `false` | Print the package version and exit |

Boolean options also accept the `--no-<option>` form, such as `--no-watch` or `--no-index`.

## HTTP behavior

- Serves known file types with their MIME type and falls back to `application/octet-stream`.
- Uses `public, max-age=3600` caching when watch mode is disabled.
- Uses `no-cache` when watch mode is enabled.
- Omits hidden files from directory listings.
- Prevents directory traversal outside each configured root.
- Returns 404, 403 and 500 page when applicable.

## HTTPS

Use `--https` with certificate and private-key paths, like so:

```sh
hyper-server --https --cert ./server.crt --key ./server.key ./public
```

__NOTE__: If any of `--cert` or `--key` files are not provided or missing, the server prints a warning but writes a built-in (hard-coded) self-signed certificate pair in the configured root.

## Live-reload

With `--watch`, the server:
For convinience of web developing, a simple live-reload feature has been implemented where the `hyper-server` does the following:

1. Starts a WebSocket Server on provided `--socket`.
2. If the `--socket` port is not provided or busy, it looks an unused one.
3. Injects a small window-reloading script in every served HTML file.
4. Watches Document Root for any file changes.
5. Broadcasts `reload` to all connected browsers.

The HTTP response cache is disabled while in `--watch` mode. WebSocket reconnects using exponential backoff.

## Features Roadmap

- [x] ~~Hot-reloading (inject client script)~~
- [x] ~~Server configuration file~~
- [x] TypeScript support at runtime
- [ ] ~~JSX support at runtime~~
- [ ] ~~PHP support at runtime~~
- [x] SSL support & self-signed certificates
- [ ] Bonjour Service for broadcasting self-discovery
- [x] Live-Reload for development
- [ ] ~~Run commands on remote~~
- [ ] ~~Event Emitter and Key binding~~
- [x] Directory listings and HTTP error status pages


## Resources

* ~~`Bun.serve`: <https://bun.sh/docs/api/http>~~
* ~~`Deno.serve`: <https://deno.land/std/http/mod.ts>~~
* ~~`getAvailablePort()`: <https://deno.land/std/net/mod.ts>~~
* ~~`HTMLRewriter`: <https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/>~~
* ~~`DOMParser`: <https://github.com/hyper-hyper/hyper-dom/>~~
* ~~`Commander.js`: <https://github.com/tj/commander.js>~~
* ~~`cliffy`: <https://github.com/c4spar/deno-cliffy>~~
* `bonjour-service`: <https://github.com/onlxltd/bonjour-service>


