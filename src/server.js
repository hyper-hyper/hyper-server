#!/usr/bin/env node
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { program } from "commander";
import * as pkg from "../package.json";

program
  .version(pkg.version)
  .option("--hot", "Wether to watch for changes in the served folder.", false)
  .option("-h, --hostname <hostname>", "Server's hostname. When '0.0.0.0' serve both localhost and to local network.", "localhost")
  .option("-p, --port <port>", "The port to listen to. Needs sudo to assign ports below 3000.", 8080)
  .option("-d, --dir <dir>", "The folder to serve.", ".")
  // .argument("<dir>", "Folder to serve. Defaults to current folder.", ".")
  .parse(process.argv);

const opts = program.opts();
// const args = program.args();

if(existsSync("./hyper.config.js")) {
  console.log("Found hyper.config.js");
  const config = import("./hyper.config.js");
}

/** Public directory to serve */
const PUBLIC_DIR = join(process.cwd(), opts.dir || "dir" in config && config.dir || process.env.PUBLIC_DIR || ".");

/** Hostname */
const HOSTNAME = opts.hostname || process.env.HOSTNAME || "localhost";

/** Server port */
const PORT = opts.port || process.env.PORT || 8080;

/** Hot-Reload command */
const HOT_CMD = "/hot";

/** Watch files for change */
const watcher = opts.hot && watch(
  PUBLIC_DIR,
  { recursive: true },
  (eventType, filePath) => {
    console.log(`FSWatcher: '${eventType}' on '${filePath}'`);
    server.publish(HOT_CMD, `File '${filePath}' fired '${eventType}' event. You have to reload!`);
  }
);

/** Serve files */
export const server = Bun.serve({
  fetch: (request, server) => {
    try {
      const requestPath = new URL(request.url).pathname;
      console.log(`${request.method} ${requestPath}`);
      if(request.url.endsWith(HOT_CMD)) {
        console.log(`Server: Got '${HOT_CMD}' request, trying to upgrade...`)
        if(!server.upgrade(request)) {
          console.log(`Server: Upgrade failed...`);
          throw new Error("Upgrade Failed");
        }
      }
      let filePath = join(PUBLIC_DIR, requestPath);
      if(request.url.endsWith("/")) {
        filePath = `${filePath}index.html`;
      }
      if(existsSync(filePath)) {
        const file = Bun.file(filePath);
        return new Response(file, { headers: { "Content-Type": file.type } });
      }
    }
    catch(error) {
      console.log(error);
      if("ENOENT" === error.code) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("Internal Server Error", { status: 500 });
    }
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