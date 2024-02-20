# The `@hyper-hyper/hyper-server`

Simple web server to serve static files from ONE assigned root-directory.

## Usage

1. Add it to your project:

    ```sh
    bun add github:hyper-hyper/hyper-server
    ```

2. Run it from CLI:

    ```sh
    hyper-server --hot --hostname localhost --port 8080 --root ./public
    ```

## Options

You can run `hyper-server --help` to see the help wizard.

| Option | Default  | Description
| - | - | -
| `--hot` | `false` | Enable hot-reloading. Injects client-side script automatically.
| `--root`, `-r` | `.` | Document root folder to serve
| `--hostname`, `-h` | `localhost` | Server's hostname. When `0.0.0.0` serve both localhost and to local network.
| `--port`, `-p` | `3000` | Port to listen to. Needs sudo to assign ports below 3000.

## Features/Todo

- [x] Hot-reloading (inject client script)
- [ ] Server configuration file
- [ ] SSL support
- [ ] Service Workers
- [ ] Production mode

## Resources

* `Bun.serve` - <https://bun.sh/docs/api/http>
* `HTMLRewriter` - <https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/>
* `Commander.js` - <https://github.com/tj/commander.js>

