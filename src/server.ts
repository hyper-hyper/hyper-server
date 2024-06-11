/// <reference types="./deno.d.ts" />
import Deno from "deno";
import { $ } from "bun";
import { getAvailablePort } from "@std/net";
import { colors, tty } from "@cliffy/ansi";
import { Command, ValidationError } from "@cliffy/command";

import * as pkg from "../package.json";

/** Color Messages */
export const fail = colors.bold.red;
export const warn = colors.bold.yellow;
export const info = colors.bold.blue;
export const okay = colors.bold.green;

/** Server CLI */
const { args, options } = await new Command()
  .name("hyper-server")
  .version(pkg.version)
  .description(pkg.description)
  .env("HOSTNAME=<hostname:string>", "Server's hostname. When '0.0.0.0' serve both to localhost and the local network.")
  .env("PORT=<port:number>", "Port to listen to. Requires sudo to assign ports below 3000.")
  .env("PUBLIC_DIR=<dir:string>", "Document root folder to serve.")
  .option("-w, --watch", "Enable watcher for changes in served directories.")
  .option("-h, --hostname <hostname:string>", "Server's hostname. When '0.0.0.0' serve both to localhost and the local network.")
  .option("-p, --port <port:number>", "Port to listen to. Requires sudo to assign ports below 3000.")
  .arguments("<...dirs:string>")
  .error((error, cmd) => {
    if(error instanceof ValidationError) {
      cmd.showHelp();
    }
    console.log(`${fail('[ ERROR ]')} ${error.message}`);
    Deno.exit(error instanceof ValidationError ? error.exitCode : 1);
  })
  .parse(Deno.args);

/** Watch mode */
export const WATCH_MODE = options.watch ?? false;

/** Server Hostname */
export const HOSTNAME = options.hostname;

/** Server Public Port */
export const PORT = getAvailablePort({ preferredPort: options.port });

/** Web Socket Port */
export const SOCKET_PORT = getAvailablePort({ preferredPort: PUBLIC_PORT + 1 });

/** Public Directory Root */
export const PUBLIC_DIR = args;

/** Start Watcher (if enabled) */
export const watcher = options.watch && Deno.watchFs(PUBLIC_DIR, { recursive: true });

export const abort = new AbortController();

/** Start Server */
export const server = Deno.serve({
  hostname: HOSTNAME,
  port: PORT,
  handler: (request: Request, info: Deno.ServeHandlerInfo) => {
    return new Response("OK", { status: 200 });
  },
  onError: (error) => {
    if( "ENOENT" === error.code ) {
      return new Response( "404 - Not Found", { status: 404 } );
    }
    return new Response("ERROR", { status: 500 });
  },
  onListen: (localAddr: Deno.NetAddr) => {
    const { transport, hostname, port } = localAddr;
    console.log(`Listening to: ${transport}://${hostname}:${port}`);
  },
  signal: abort.signal
});
