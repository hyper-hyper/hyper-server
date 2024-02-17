import * as Bun from "bun";
import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";

// const { values } = util.parseArgs({
//   args: process.argv.slice(2),
//   options: {
//     hot: { type: "boolean" },
//     publicDir: { type: "string" },
//     hostname: { type: "string" },
//     port: { type: "string", default: process.env.PORT }
//   }
// });

/** Reload command */
export const HOT_CMD = "/hot";

/** Public directory */
export const PUBLIC_DIR = process.env.PUBLIC_DIR ?? path.join(process.cwd(), "src");

/** Server port */
export const PORT = process.env.PORT ?? 8080;

/** Watch files for change */
export const watcher = fs.watch(
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
      if(request.url.endsWith(HOT_CMD)) {
        console.log(`Server: Got '${HOT_CMD}' request, trying to upgrade...`)
        if(!server.upgrade(request)) {
          console.log(`Server: Upgrade failed...`);
          throw new Error("Upgrade Failed");
        }
      }
      const requestPath = new URL(request.url).pathname;
      let filePath = path.join(PUBLIC_DIR, requestPath);
      if(request.url.endsWith("/")) {
        filePath = `${filePath}index.html`;
      }
      console.log(`Resolved request path: ${filePath}`);
      if(fs.existsSync(filePath)) {
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
  hostname: "0.0.0.0",
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

console.log(`Started Web Server at:\n\n${server.protocol}://127.0.0.1:${server.port}\n\n`);