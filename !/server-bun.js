#!/usr/bin/env node

import { $ } from "bun";
import { existsSync, watch } from "node:fs";
import { join, resolve } from "node:path";
import { program } from "commander";
import * as pkg from "../package.json";

let cfg = {};

/** Check wether server config exists */
if(existsSync(join(process.cwd(), "hyper.config.js"))) {
  console.log("INFO: Found hyper.config.js...");
  cfg = await import(join(process.cwd(), "hyper.config.js"));
}

/** Server CLI */
program.version(pkg.version)
  .option("--hot", "Enable hot-reloading.", false)
  .option("-h, --hostname <hostname>", "Server's hostname. When `0.0.0.0` serve both localhost and to local network.", process.env.HOSTNAME || ("hostname" in cfg && cfg.hostname) || "0.0.0.0")
  .option("-p, --port <port>", "Port to listen to. Needs sudo to assign ports below 3000.", process.env.PORT || ("port" in cfg && cfg.port) || 3000)
  .option("-r, --root <root>", "Document root folder to serve.", process.env.ROOT || ("root" in cfg && cfg.root) || process.cwd())
  .parse(process.argv);

/** Parse CLI argv */
const opts = program.opts();

/** Hot-Reload command */
export const HOT_CMD = "/hot";

/** Hostname */
export const HOSTNAME = opts.hostname;

/** Server port */
export const PORT = opts.port;

/** Public directory to serve */
export const ROOT = opts.root;

/** Watch files for change */
export const watcher = opts.hot && watch(
  ROOT,
  { recursive: true },
  (eventType, filePath) => {
    console.log(`INFO: FSWatcher detected '${eventType}' on '${filePath}'`);
    server.publish(HOT_CMD, `File '${filePath}' fired '${eventType}' event. You must to reload!`);
  }
);

/** Start Server */
export const server = Bun.serve({
  fetch: async (request, server) => {
    const requestPath = new URL(request.url).pathname;
    console.log(`\n${request.method} ${requestPath}`);
    if(opts.hot && request.url.endsWith(HOT_CMD)) {
      console.log(`Server: Got '${HOT_CMD}' request, upgrading...`);
      return server.upgrade(request);
    }
    let filePath = join(ROOT, requestPath);
    if(request.url.endsWith("/")) {
      filePath = `${filePath}index.html`;
    }
    const file = Bun.file(filePath);
    if(opts.hot && file.type.startsWith("text/html")) {
      return new Response(
        new HTMLRewriter().on("head", {
          element(head) {
            head.append(
              `<script>
                const socket = new WebSocket("ws://${"0.0.0.0" === HOSTNAME ? "127.0.0.1" : HOSTNAME}:${PORT}${HOT_CMD}");
                socket.addEventListener("message", event => window.location.reload());
              </script>`,
              { html: true }
            );
          }
        }).transform(await file.text()),
        {
          headers: { "Content-Type": file.type }
        }
      );
    }
    return new Response(file, { headers: { "Content-Type": file.type } });
  },
  error: (error) => {
    if("ENOENT" === error.code) {
      return new Response("404 - Not Found", { status: 404 });
    }
    return new Response("500 - Internal Server Error", { status: 500 });
  },
  hostname: HOSTNAME,
  port: PORT,
  development: process.env.NODE_ENV === "production",
  websocket: {
    open: (ws) => {
      ws.subscribe(HOT_CMD);
      console.log(`INFO: Subscribed WebSocket Client to '${HOT_CMD}'.`);
    },
    message: (ws, message) => {
      console.log(`INFO: Client trying to communicate with me. `, message);
    },
    close: (ws) => {
      ws.unsubscribe(HOT_CMD);
      console.log(`INFO: WebSocket Client disconnected.`);
    }
  }
});

/** Get Local IP Address */
let domain = "";
if("0.0.0.0" === server.hostname) {
  const ip = await $`ipconfig getifaddr en0`.text();
  domain = `${server.protocol}://127.0.0.1:${server.port}/
                         ${server.protocol}://${ip.trim()}:${server.port}/`
}
else {
  domain = `${server.protocol}://${server.hostname}:${server.port}/`;
}

console.log(`
  Started web server at: ${domain}
  Serving document root: ${resolve(process.cwd(), ROOT)}
`);
