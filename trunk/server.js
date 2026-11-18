#!/usr/bin/env bun

import { $ } from "bun";
import os from "os";
import { existsSync, watch } from "node:fs";
import { join, resolve } from "node:path";
// import { program } from "commander";
import * as pkg from "./package.json";

/**
 * Get Public IP address using api.ipify.org
 */
const getPublicIP = async () => await fetch("https://api.ipify.org")
  .then(response => response.text())
  .then(ip => ip.trim());

/**
 * Get local IP address from device's Network Interfaces
 * @returns {String}
 */
const getLocalIP = () => {
  const list = os.networkInterfaces();
  for(const name in list) {
    const device = list[name];
    for(const info of device) {
      if(info.family === "IPv4" && !info.internal) {
        return info.address;
      }
    }
  }
  return false;
};

/**
 * Get all available ports on the system within the provided range
 *
 * This approach do not uses the classic loop-and-test-and-try-and-catch, but working with the
 * List of processes using IPv4 or IPv6 addresses, where it finds out what ports are busy within
 * the queried range and returns the filtered array of ports that are not found in the list, assumed
 * not busy.

 * @param {Number} from
 * @param {Number} to
 * @param {Number} limit
 * @returns {Number}
 */
export const getAvailablePorts = async (from = 3000, to = 9000, limit = 1, random = false) => {
  return await $`comm -23 <(seq ${from} ${to} | sort) <(netstat -an -f inet -p tcp | awk '{print $4}' | cut -d':' -f2 | sort -R) ${random && '| sort -R'} | head -n "${limit}"`;
};
// comm -23 <(seq 3000 9000 | sort) <(netstat -an -f inet -p tcp | awk '{print $4}' | cut -d':' -f2 | sort -u) | sort -R | head -n "10"


/**
 * Get random available port within the range

 * @param {Number} from
 * @param {Number} to
 * @returns {Number}
 */
export const getAvailablePort = async (from = 3000, to = 9000) => getAvailablePorts(from, to, 1);

let cfg = {};

/** Check wether server config exists */
if(existsSync(join(process.cwd(), "hyper.config.js"))) {
  console.log("INFO: Found hyper.config.js...");
  cfg = await import(join(process.cwd(), "hyper.config.js"));
}

/** Query the Public IP */
export const PUBLIC_IP = await getPublicIP();

/** Find out Local IP */
export const LOCAL_IP = getLocalIP();

/** Server port */
export const PORT = getAvailablePort(7000, 7010);

/** Public directory to serve */
export const DOCUMENT_ROOT = resolve(process.cwd(), "./public/wp-content/themes/esafe-neue"); //opts.root;

/** Hot-Reload command */
export const HOT_CMD = "/hot";

/** Hostname */
export const HOSTNAME = "0.0.0.0";

/** Start Server */
export const server = Bun.serve({
  /** Handle incomming request */
  fetch: async (request, server) => {
    const requestPath = new URL(request.url).pathname;
    console.log(`${request.method} ${requestPath}`);

    // It's a WSS client, upgrade
    if(request.url.endsWith(HOT_CMD)) {
      console.log(`SERVER: Got '${HOT_CMD}' request, upgrading...`);
      return server.upgrade(request);
    }

    // Serve static assets
    let filePath = join(ROOT, requestPath);
    if(request.url.endsWith("/")) {
      filePath = `${filePath}index.html`;
    }

    // Inject WSS hot-reload script if it is html/text
    const file = Bun.file(filePath);
    if(file.type.startsWith("text/html")) {
      return new Response(
        new HTMLRewriter().on("head", {
          element(head) {
            head.append(
              `<script>
                const socket = new WebSocket("ws://${"0.0.0.0" === HOSTNAME ? LOCAL_IP : HOSTNAME}:${PORT}${HOT_CMD}");
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
  /** 404 - Resource Not Found */
  error: (error) => {
    if("ENOENT" === error.code) {
      return new Response("404 - Not Found", { status: 404 });
    }
    return new Response("500 - Internal Server Error", { status: 500 });
  },

  hostname: HOSTNAME,
  port: PORT,
  development: process.env.NODE_ENV !== "production",

  /** Web Socket Server */
  websocket: {
    open: (ws) => {
      ws.subscribe(HOT_CMD);
      console.log(`WEBSOCKET: A new Client subscribed to '${HOT_CMD}'...`);
    },
    message: (ws, message) => {
      console.log(`WEBSOCKET: Client trying to communicate with me...`, message);
    },
    close: (ws) => {
      ws.unsubscribe(HOT_CMD);
      console.log(`WEBSOCKET: Client disconnected.`);
    }
  }
});

/** Watch files in ROOT for changes and notifye subscribed clients */
export const watcher = watch(
  DOCUMENT_ROOT,
  { recursive: true },
  (eventType, filePath) => {
    console.log(`INFO: FSWatcher detected '${eventType}' on '${filePath}'`);
    server.publish(HOT_CMD, `File '${filePath}' fired '${eventType}' event. You must to reload!`);
  }
);

console.log(`WEBSERVER: Started up!`);
console.log(`   Serving DOCUMENT_ROOT: ${DOCUMENT_ROOT}`);
console.log(`   ${server.protovol}://localhost:${server.port}`);
console.log(`   ${server.protocol}://127.0.0.1:${server.port}`);
console.log(`   ${server.protocol}://${LOCAL_IP}:${server.port}`);
console.log(`   ${server.protocol}://${PUBLIC_IP}:${server.port}`);

