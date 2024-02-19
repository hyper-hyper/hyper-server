#!/usr/bin/env node
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { program } from "commander";
import * as pkg from "../package.json";

// if(existsSync(join(process.cwd(), "./hyper.config.js"))) {
//   console.log("Found hyper.config.js");
//   const config = await import(join(process.cwd(), "./hyper.config.js"));
// }

program
  .version(pkg.version)
  .option("--hot", "Enable hot-reloading.", false)
  .option("-h, --hostname <hostname>", "Server's hostname. When `0.0.0.0` serve both localhost and to local network.", process.env.HOSTNAME || "localhost")
  .option("-p, --port <port>", "Port to listen to. Needs sudo to assign ports below 3000.", process.env.PORT || 3000)
  .option("-r, --root <root>", "Document root folder to serve.", process.env.ROOT || process.cwd())
  //.argument("<root>", "Folder to serve. Defaults to current working directory.", process.cwd())
  .parse(process.argv);

const opts = program.opts();
// const args = program.args();

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
    console.log(`FSWatcher: '${eventType}' on '${filePath}'`);
    server.publish(HOT_CMD, `File '${filePath}' fired '${eventType}' event. You have to reload!`);
  }
);

/** Start Server */
export const server = Bun.serve({
  fetch: async (request, server) => {
    const requestPath = new URL(request.url).pathname;
    console.log(`\n${request.method} ${requestPath}`);
    if(opts.hot && request.url.endsWith(HOT_CMD)) {
      console.log(`Server: Got '${HOT_CMD}' request, trying to upgrade...`);
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
                const socket = new WebSocket("ws://${HOSTNAME}:${PORT}${HOT_CMD}");
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
    return new Response(file, {headers:{"Content-Type": file.type}});
  },
  error: (error) => {
    if("ENOENT" === error.code) {
      return new Response("404 - Not Found", { status: 404 });
    }
    return new Response("500 - Internal Server Error", { status: 500 });
  },
  hostname: HOSTNAME,
  port: PORT,
  websocket: {
    open: (ws) => {
      console.log(`WebSocket: Client connected. Subscribe to '${HOT_CMD}'`);
      ws.subscribe(HOT_CMD);
    },
    message: (ws, message) => {
      console.log(`WebSocket: Client trying to communicate: `, ws, message);
    },
    close: (ws) => {
      console.log(`WebSocket: Client disconnected...`);
      ws.unsubscribe(HOT_CMD);
    }
  }
});

console.log(`Started Web Server at: ${server.protocol}://${server.hostname}:${server.port}\n`);