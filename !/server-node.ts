import * as http from "node:http";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

import { DOMParser } from "@hyper-hyper/hyper-parser/deno-dom-wasm";

/** Base Directory to serve */
export const BASE_DIR = "./src";

/** Hostname */
export const HOSTNAME = "localhost";

/** HTTP Server Port */
export const PORT = 8000;

/** Web Socket Server Port */
export const WSS_PORT = 3000;

/** Reload Command */
export const RELOAD_CMD = "/reload";

/** List of supported MIME types */
export const MIME_TYPES = new Map([
  ["html", "text/html"],
  ["css", "text/css"],
  ["js", "text/javascript"],
  ["jsx", "text/javascript"],
  ["ts", "text/javascript"],
  ["tsx", "text/javascript"],
  ["json", "application/json"],
  ["ico", "image/icon"],
]);

/**
 * Get MIME type by path
 * 
 * @param filePath {string}
 * @returns {string}
 */
export const getMimeType = (filePath:string) => {
  const ext = filePath.match(/.*\.(.+)$/)?.[1].toLowerCase();
  return MIME_TYPES.get(ext as string) || "application/octet-stream";
};

/** Create HTTP Server */
export const server = http.createServer((request, response) => {
  let filePath = request.url as string;

  // Upgrade request if Web Socket
  if(request.url?.endsWith(RELOAD_CMD)) {
    response.writeHead(101, "Web Socket Protocol Handshake", {
      Upgrade: "WebSocket",
      Connection: "Upgrade",
    });
    response.end();
    return;
  }

  // Append index.html when request ending with `/`
  if(request.url?.endsWith("/")) {
    filePath += "index.html";
  }

  // Try reading the file
  fs.readFile(path.join(BASE_DIR, filePath), "utf-8", (error, data) => {
    if(error) {
      response.writeHead(404, "Not Found");
      response.end();
      return;
    }

    // Get MIME type
    const mimeType = getMimeType(filePath);

    // Inject live-reload client-side script when requested file is HTML
    if("text/html" === mimeType) {
      const dom = new JSDOM(data);
      const script = dom.window.document.createElement("script");
      script.textContent = `const ws = new WebSocket("ws://${HOSTNAME}:${WSS_PORT}${RELOAD_CMD}"); ws.onmessage = event => window.location.reload();`;
      dom.window.document.body.appendChild(script);
      data = dom.serialize();
    }

    response.writeHead(200, { "Content-Type": mimeType });
    response.end(data);
  });
});

/** Create Web Socket Server */
export const wss = net.createServer((socket) => {
  socket.once("data", () => {
    socket.write(
      "HTTP/1.1 101 Web Socket Protocol Handshake\r\n" +
        "Upgrade: WebSocket\r\n" +
        "Connection: Upgrade\r\n" +
        "\r\n",
    );
    fs.watch(BASE_DIR, { recursive: true }, (event, filename) => {
      console.log(`fs.watch(): Detected ${event} on ${filename}`);
      socket.write(RELOAD_CMD);
    });
  });
});

/** Configure HTTP Server */
server.listen(PORT, HOSTNAME, () => {
  console.log(`Started HTTP Server: http://${HOSTNAME}:${PORT}`);
});

/** Configure Web Socket Server */
wss.listen(WSS_PORT, HOSTNAME, () => {
  console.log(`Started Web Socket Server: ws://${HOSTNAME}:${WSS_PORT}`);
});
