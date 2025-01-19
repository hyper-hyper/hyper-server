# The `@hyper-hyper/hyper-server`

Simple web server to serve static files from ONE assigned root-directory.

## Usage

1. Add it to your project:

    ```sh
    bun add github:hyper-hyper/hyper-server
    ```

2. Run it from CLI:

    ```sh
    hyper-server --watch --hostname localhost --port 8080 ./public
    ```

## Options

You can run `hyper-server --help` to see the help wizard.

| Option | Default  | Description
| - | - | -
| ~~`--hot`~~ | ~~`false`~~ | ~~Enable hot-reloading. Injects client-side script automatically.~~
| ~~`-r`, `--root`~~ | ~~`.`~~ | ~~Document root folder to serve~~
| `-w`, `--watch` | `.` | Watches files for changes and pings on the next available port via WebSocket
| `-h`, `--hostname` | `0.0.0.0` | Server's hostname. When `0.0.0.0` serve both localhost and to local network.
| `-p`, `--port` | `3000` | Port to listen to. Needs sudo to assign ports below 3000.

## Features/Todo

- [x] ~~Hot-reloading (inject client script)~~
- [x] ~~Server configuration file~~
- [x] Watch mode (Websockets)
- [x] TypeScript support at runtime
- [ ] JSX support at runtime
- [ ] PHP support at runtime
- [ ] SSL support
- [ ] Self-Discovery with Bonjour
- [ ] ~~Run commands on remote~~
- [ ] ~~Event Emitter and Key binding~~

## Resources

* ~~`Bun.serve`: <https://bun.sh/docs/api/http>~~
* ~~`Deno.serve`: <https://deno.land/std/http/mod.ts>~~
* ~~`getAvailablePort()`: <https://deno.land/std/net/mod.ts>~~
* ~~`HTMLRewriter`: <https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/>~~
* `DOMParser`: <https://github.com/hyper-hyper/hyper-dom/>
* ~~`Commander.js`: <https://github.com/tj/commander.js>~~
* ~~`cliffy`: <https://github.com/c4spar/deno-cliffy>~~
* `bonjour-service`: <https://github.com/onlxltd/bonjour-service>

