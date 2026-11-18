#!/usr/bin/env node

import os from "node:os";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { URL } from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Max event listeners per event */
const MAX_EVENT_LISTENERS = 10;

/** Default configuration */
export const DEFAULTS = {
  host: "0.0.0.0",
  port: 3000,
  socket: 3001,
  https: false,
  cert: "server.crt",
  key: "server.key",
  watch: false,
  root: ["./public"],
  cors: false,
  gzip: false,
  index: true,
};

/** Schema for command-line arguments */
const SCHEMA = {
  _: { description: "Document root directories (multiple paths supported)", default: DEFAULTS.root, type: "array" },
  host: { alias: "H", description: "Hostname to broadcast", default: DEFAULTS.host, type: "string" },
  port: { alias: "p", description: "Port to listen", default: DEFAULTS.port, type: "number" },
  socket: { alias: "s", description: "Web Socket port", default: DEFAULTS.socket, type: "number" },
  https: { alias: "S", description: "Enable HTTPS", default: DEFAULTS.https, type: "boolean" },
  cert: { alias: "c", description: "Path to SSL certificate", default: DEFAULTS.cert, type: "string" },
  key: { alias: "k", description: "Path to SSL private key", default: DEFAULTS.key, type: "string" },
  watch: { alias: "w", description: "Enable Live-Reload", default: DEFAULTS.watch, type: "boolean" },
  cors: { description: "Enable CORS headers", default: DEFAULTS.cors, type: "boolean" },
  gzip: { alias: "g", description: "Enable gzip compression", default: DEFAULTS.gzip, type: "boolean" },
  index: { alias: "i", description: "Enable directory listing", default: DEFAULTS.index, type: "boolean" },
  help: { alias: "h", description: "Print help and exit", default: false, type: "boolean" },
  version: { alias: "v", description: "Print version and exit", default: false, type: "boolean" },
};

/** Allowed MIME types to serve */
export const ALLOWED_MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** Self-signed certificate for SSL */
export const SELF_SIGNED_CERT = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQCKz8+8GGKbPDANBgkqhkiG9w0BAQsFADCBjDELMAkGA1UEBhMC
VVMxCzAJBgNVBAgMAlRYMQ8wDQYDVQQHDAZBdXN0aW4xEDAOBgNVBAoMB05vZGVU
ZXN0MRAwDgYDVQQLDAdOb2RlVGVzdDEUMBIGA1UEAwwLbG9jYWxob3N0MR8wHQYJ
KoZIhvcNAQkBFhB0ZXN0QGV4YW1wbGUuY29tMB4XDTI0MDEwMTAwMDAwMFoXDTI1
MDEwMTAwMDAwMFowgYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJUWDEPMA0GA1UE
BwwGQXVzdGluMRAwDgYDVQQKDAdOb2RlVGVzdDEQMA0GA1UECwwHTm9kZVRlc3Qx
FDASBgNVBAMMC2xvY2FsaG9zdDEfMB0GCSqGSIb3DQEJARYQdGVzdEBleGFtcGxl
LmNvbTCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEAu1SU1LfVLPHCgWsYZv/E
PJVS5sknZY/C9ZSkFLVO1CsuLNXCCCptp6sCUN22aZOCzYk+JdKSYh/9bF6vxaa2
FDjmc1BiiqfDOCuzeZVfIyIeR6tMCoRdZWI1lod7+2MymcY0/CfS+zBASkAdCiey
oySdZNsCd3VNy+aPUfQnn2ECAwEAATANBgkqhkiG9w0BAQsFAAOBgQBuEdFdBfov
nNpuD0PKPB5OIeVea/FfWeKOzPrz3d1eM+Su3/B9Y+mvc929ktZBdL9mdyuIuVe5
Ni9WvXNytT/ZtleoeAPI9M9WOnuFObdm+1fZN3/C9J9j+au7/VNWvHNhepN1tp+C
+zPIdQ==
-----END CERTIFICATE-----`;

/** Self-signed private key for SSL */
export const SELF_SIGNED_KEY = `-----BEGIN PRIVATE KEY-----
MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBALtUlNS31SzxwoFr
GGb/xDyVUubJJ2WPwvWUpBS1TtQrLizVwggqbaerAlDdtmmTgs2JPiXSkmIf/Wxe
r8WmthQ45nNQYoqnwzgrs3mVXyMiHkerTAqEXWViNZaHe/tjMpnGNPwn0vswQEpA
HQonsqMknWTbAnd1TcvmJ1H0J59hAgMBAAECgYAKPz0D5r8F3+xj9J5o2L6U8g1K
J7a9S1N5r8o5g6z7V5L2K9Q8Q8v6z8J9f2z6F3K1P2d8w8v6A3K1P2s7J9Y8e8a8
f8K1P2Q8P6Y8m2B8v7G6S5K3F7J9D2t8q6y8Q8x5a7z8R9P6Z5L3K2B5n8m2q7P8
n2V5k3F7M8t6r9w8Y7k2QQJBAN+g5Q8m7z8F5J1t2y8K6A3j9P5z7m8q4n7P6B2V
K9D8w3r8j9E5G3q8t7F2d8K1Y2c8P6K9B3m7E5S9w8J2J2z8D8kCQQDU8K9B3z8Y
7K3d8v6A3B9P5r8F7m8K1r2z8R9V5k3Y9E5t2Q8K7j9F5B6m8P7A3j9q8v6r9w8z
3K2B5P5a7d8v8AkEAo+P6K9a3G8v5F7P6z8Q8w6J3Y2r8t9E5F8K1r2z8Y8v6A3
j9P5z7m8q4P6K9a3r8t9V5k3B9P6z8q7P6y8K1Y2c8P6K9B3m7E5S9w8J2J2z8D8
kQJAO8K7j9F5B6m8P7A3j9q8v6r9w8z3K2B5P5a7d8v8F5J1t2y8K6A3j9P5z7m8
q4n7P6B2VK9D8w3r8j9E5G3q8t7F2d8K1Y2c8P6K9B3m7E5S9w8J2J2z8D8kCQQC7
VJTUt9Us8cKBaxhm/8Q8lVLmySdlj8L1lKQUtU7UKy4s1cIIKm2nqwJQ3bZpk4LN
iT4l0pJiH/1sXq/FprYUOOZzUGKKp8M4K7N5lV8jIh5Hq0wKhF1lYjWWh3v7YzKZ
-----END PRIVATE KEY-----`;

/** fetch() polyfill for Node.js 14.21.3 */
if ("undefined" === typeof globalThis.fetch) {
  // NOTE: These are simplified and do not fully replicate the browser's Request/Response API.

  class Headers {
    constructor(init = {}) {
      this._headers = new Map();
      if (init instanceof Headers) {
        init._headers.forEach((value, key) => this.set(key, value));
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.append(key, value));
      } else if (typeof init === 'object' && init !== null) {
        for (const key in init) {
          this.append(key, init[key]);
        }
      }
    }

    append(name, value) {
      name = name.toLowerCase();
      const existing = this._headers.get(name);
      if (existing) {
        this._headers.set(name, existing + ', ' + value);
      } else {
        this._headers.set(name, String(value));
      }
    }

    delete(name) {
      this._headers.delete(name.toLowerCase());
    }

    get(name) {
      return this._headers.get(name.toLowerCase()) || null;
    }

    has(name) {
      return this._headers.has(name.toLowerCase());
    }

    set(name, value) {
      this._headers.set(name.toLowerCase(), String(value));
    }

    forEach(callbackFn, thisArg) {
      this._headers.forEach((value, key) => callbackFn.call(thisArg, value, key, this));
    }

    *[Symbol.iterator]() {
      for (const [key, value] of this._headers.entries()) {
        yield [key, value];
      }
    }

    entries() {
      return this._headers.entries();
    }

    keys() {
      return this._headers.keys();
    }

    values() {
      return this._headers.values();
    }

    toJSON() {
      const obj = {};
      this.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
  }

  class Response {
    constructor(body, init = {}) {
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Headers(init.headers);
      this.ok = this.status >= 200 && this.status < 300;
      this.url = init.url || ''; // The final URL after redirects

      // Simplified body handling
      this._bodyText = body;
      this._bodyUsed = false;
    }

    _handleBodyRead() {
      if (this._bodyUsed) {
        return Promise.reject(new TypeError('Body has already been used.'));
      }
      this._bodyUsed = true;
      return Promise.resolve(this._bodyText);
    }

    async json() {
      const text = await this._handleBodyRead()
      try {
        return JSON.parse(text)
      } catch (e) {
        throw new Error(`Failed to parse JSON: ${e.message}`)
      }
    }

    text() {
      return this._handleBodyRead();
    }

    // Add other body methods (formData, blob, arrayBuffer, etc.) as needed
    // but they require more complex polyfills for those types as well.
  }

  // Main fetch() polyfill
  globalThis.fetch = (input, init = {}) => new Promise((resolve, reject) => {
    let url;
    let method = init.method ? init.method.toUpperCase() : 'GET';
    let requestHeaders = new Headers(init.headers);
    let requestBody = null;

    // Handle input as URL string or Request object (simplified)
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) { // Node.js URL object
      url = input.toString();
    } else if (typeof input === "object" && input !== null) { // Assume it's a Request-like object
      url = input.url;
      if (input.method) method = input.method.toUpperCase();
      if (input.headers) requestHeaders = new Headers(input.headers);
      // For simplicity, body is handled from init for now
    } else {
      return reject(new TypeError("Invalid input to fetch."));
    }

    const urlObj = new URL(url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: requestHeaders.toJSON(), // Convert Headers object to plain object
    };

    // Set Content-Length for bodies
    if (init.body !== undefined && init.body !== null) {
      if (typeof init.body === "string") {
        requestBody = init.body;
        if (!requestHeaders.has("content-type")) {
          requestHeaders.set("content-type", "text/plain;charset=UTF-8");
        }
      } else if (typeof init.body === "object" && !Buffer.isBuffer(init.body)) { // Attempt JSON stringify
        try {
          requestBody = JSON.stringify(init.body);
          if (!requestHeaders.has("content-type")) {
            requestHeaders.set("content-type", "application/json;charset=UTF-8");
          }
        } catch {
          return reject(new TypeError("Could not stringify request body to JSON."));
        }
      } else if (Buffer.isBuffer(init.body)) { // Raw buffer
        requestBody = init.body;
        // Content-Type should ideally be set by the user for buffers
      } else {
        return reject(new TypeError("Unsupported body type for fetch polyfill."));
      }
      options.headers["Content-Length"] = Buffer.byteLength(requestBody);
    }

    // Update headers in options after body processing might have added Content-Type
    options.headers = requestHeaders.toJSON();

    const req = protocol.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        const responseHeaders = new Headers(res.headers);
        const responseOptions = {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: responseHeaders,
          url: url, // For simplicity, using the request URL. Real fetch handles redirects.
        };
        resolve(new Response(data, responseOptions));
      });

      response.on("error", (error) => {
        reject(new TypeError(`Response error: ${error.message}`));
      });
    });

    req.on("error", (error) => {
      reject(new TypeError(`Network request failed: ${error.message}`));
    });

    if (requestBody) {
      req.write(requestBody);
    }
    req.end();
  });
}

// Utility functions
export const toBool = [() => true, () => false];

/**
 * Shuffle values in an array using Fisher-Yates algorithm
 * @param {array} array Array of values
 * @returns {array}
 */
export const shuffleValues = (array) => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Create a range of numbers
 * @param {number} from
 * @param {number} to
 * @param {boolean} shuffle
 * @returns {array}
 */
export const createRange = (from, to, shuffle = false) => {
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return shuffle ? shuffleValues(range) : range;
};

export const inferType = (value) => {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "array";
  return "string";
};

export const assignValue = (o, k, v) => {
  if (Array.isArray(o[k])) {
    o[k].push(v);
  } else if (o[k] !== undefined && inferType(o[k]) === inferType(v)) {
    o[k] = v;
  } else if (o[k] !== undefined) {
    o[k] = [o[k], v];
  } else {
    o[k] = v;
  }
};

export const getPkgMeta = () => {
  try {
    const scriptName = path.basename(process.argv[1]) || __dirname;
    let dir = path.dirname(scriptName);
    let pkg = null;

    while (dir !== path.dirname(dir)) {
      const pkgFilePath = path.join(dir, "package.json");
      if (fs.existsSync(pkgFilePath)) {
        try {
          const pkgFileContent = fs.readFileSync(pkgFilePath, "utf8");
          if (!pkgFileContent || 0 === pkgFileContent.trim().length) {
            dir = path.dirname(dir);
            continue;
          }
          
          try { 
            pkg = JSON.parse(pkgFileContent);
          } catch {
            /* Silently fail */
          }
          
          if (!pkg || "object" !== typeof pkg) {
            dir = path.dirname(dir);
            continue;
          }
          return {
            main: pkg.main || scriptName,
            name: pkg.name,
            version: pkg.version,
            description: pkg.description
          };
        }
        catch (error) {
          // Silently fail and return empty object
        }
      }
      dir = path.dirname(dir);
    }
  } catch (error) {
    // Silently fail and return empty object
  }
  return { name: scriptName };
};

/**
 * Print help message
 */
export const printHelp = (schema = SCHEMA) => {
  const scriptName = path.basename(process.argv[1]);
  const meta = getPkgMeta();
  console.log(`🏭 ${meta.name || meta.main || scriptName} ${meta.version || ""}`);
  if (meta.description) console.log(`   ${meta.description}`);
  console.log(`\n  🥸 USAGE\n   ${scriptName} ${schema ? "[options] [--]" : ""} ${schema && "_" in schema ? "[...arguments]" : ""}`);

  if (schema) {
    if ("_" in schema) {
      console.log(
        `\n  🗂️ ARGUMENTS\n   ${schema._.description || ""}${"default" in schema._ ? ` (default: ${Array.isArray(schema._.default) ? `[${schema._.default.join(", ")}]` : schema._.default})` : ""}`,
      )
    }

    console.log("\n  🎛️ OPTIONS");
    for (const key in schema) {
      if (key === "_") continue;

      const { alias, default: defaultValue } = schema[key];
      const flags = [`--${key}`, ...(alias ? [alias].flat().map((a) => `-${a}`) : [])];

      console.log(
        `   ${flags.join(", ")}  ${schema[key].description || ""}${defaultValue !== undefined ? ` (default: ${defaultValue})` : ""}`,
      );
    }
  }
};

export const printError = (message, exit = false) => {
  console.error(`❌ ${message}`);
  if (exit) {
    printHelp();
    process.exit(1);
  }
};

export const printWarning = (message) => {
  console.warn(`⚠️ ${message}`);
};


export const getPublicIP = async () => {
  try {
    const response = await fetch("https://api.ipify.org");
    const ip = await response.text();
    return ip.trim();
  } catch (error) {
    printWarning(`Failed to get public IP address: ${error.message}`);
    return "127.0.0.1";
  }
}

export const getLocalIP = () => {
  const devices = os.networkInterfaces();
  for (const name in devices) {
    for (const device of devices[name]) {
      if (device.family === "IPv4" && !device.internal) {
        return device.address;
      }
    }
  }
  return "127.0.0.1";
};

export const getRandomAvailablePort = async (host = "0.0.0.0") =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

export const isPortAvailable = async (port, host = "0.0.0.0") =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    })
  })

export const getAvailablePorts = async (from = 3000, to = 9000, limit = 1, random = false, host = "0.0.0.0") => {
  const range = createRange(from, to, random);
  const ports = [];

  for (const port of range) {
    if (await isPortAvailable(port, host)) {
      ports.push(port);
      if (ports.length === limit) break;
    }
  }

  return ports;
}

export const getAvailablePort = async (from = 3000, to = 9000, random = false, host = "0.0.0.0") => {
  const [port] = await getAvailablePorts(from, to, 1, random, host);
  return port;
}

export const parseArgs = (argv = process.argv.slice(2), schema = SCHEMA) => {
  const flags = new Map();
  const parsed = {
    _: "_" in schema ? (Array.isArray(schema._.default) ? [...schema._.default] : [schema._.default]) : [],
  };
  if (schema) {
    for (const f in schema) {
      const { alias, default: defaultValue } = schema[f];
      if (alias) {
        const aliases = Array.isArray(alias) ? alias : [alias];
        for (const alias of aliases) {
          flags.set(alias, f);
        }
      }
      if (defaultValue !== undefined) {
        parsed[f] = defaultValue;
      }
    }
  }
  let x = 0
  while (x < argv.length) {
    const arg = argv[x];
    let flag = "_";
    let value = true;
    if (arg === "--help" || arg === "-h") {
      flag = "help";
    }
    else if (arg === "--version" || arg === "-v") {
      flag = "version";
    }
    else if (arg.startsWith("--no-")) {
      const rawKey = arg.slice(5);
      flag = flags.get(rawKey) || rawKey;
      value = false;
    }
    else if (arg.startsWith("--")) {
      const [rawKey, equals] = arg.slice(2).split("=", 2);
      const next = argv[x + 1]
      flag = flags.get(rawKey) || rawKey;
      value = equals !== undefined ? equals : next && !next.startsWith("-") ? (x++, next) : true;
      // assignValue(parsed, flag, value);
    }
    else if (arg.startsWith("-") && arg.length > 1) {
      const chars = arg.slice(1);
      for (let y = 0; y < chars.length; y++) {
        const char = chars[y];
        const next = argv[x + 1];
        const isLast = y === chars.length - 1;
        flag = flags.get(char) || char;
        value = isLast && next && !next.startsWith("-") ? (x++, next) : true;
      }
    }
    else {
      flag = "_";
      value = arg;
    }
    assignValue(parsed, flag, value);
    x++;
  }
  return parsed;
};

const eventManager = new EventEmitter();

export const off = (event, listener) => {
  eventManager.removeListener(event, listener);
}

export const on = (event, listener) => {
  eventManager.on(event, listener);
  return () => off(event, listener);
};

export const once = (event, listener) => {
  eventManager.once(event, listener);
  return () => off(event, listener);
};

export const emit = (event, ...args) => {
  eventManager.emit(event, ...args)
};

/**
 * Base Server class with common functionality
 */
export class Server {
  /**
   * Constructor
   * @param {object} config Configuration object
   */
  constructor(config = {}) {
    this.IS_RUNNING = false;
    this.config = { ...DEFAULTS, ...config };
    this.server = null;
    this.request = null;
    this.response = null;
  }

  /**
   * Start the server - to be implemented by subclasses
   */
  async start() {
    emit("start");
    this.IS_RUNNING = true;
    printWarning("start() method should be implemented by subclass");
    // throw new Error("start() method must be implemented by subclass");
  }

  /**
   * Stop the server - to be implemented by subclasses
   */
  async stop() {
    emit("stop");
    this.IS_RUNNING = false;
    printWarning("stop() method should be implemented by subclass");
  }

  on(event, listener) {
    on(event, listener);
    return this;
  }

  off(event, listener) {
    off(event, listener);
    return this;
  }

  emit(event, ...args) {
    emit(event, ...args);
    return this;
  }

  /**
   * Handle incoming requests - to be implemented by subclasses
   */
  async handle(request, response) {
    printWarning("handle() method should be implemented by subclass");
  }

  respond(body = null, statusCode = 200, headers = {}) {
    printWarning("respond() method should be implemented by subclass");
  }

  /**
   * Send a response with flexible content and headers
   */
  sendResponse(response, statusCode = 200, content = null, contentType = "text/html; charset=utf-8", headers = {}) {
    const defaultHeaders = {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      ...headers,
    }

    if (this.config.cors) {
      defaultHeaders["Access-Control-Allow-Origin"] = "*"
      defaultHeaders["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
      defaultHeaders["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    }

    // If no content provided, generate default HTML response
    if (content === null) {
      const statusText = this.getReason(statusCode)
      content = this.generateDefaultHtmlResponse(statusCode, statusText)
    }

    // Set content length if not already set
    if (!defaultHeaders["Content-Length"]) {
      defaultHeaders["Content-Length"] = Buffer.byteLength(content)
    }

    response.writeHead(statusCode, defaultHeaders)
    response.end(content)
  }

  /**
   * Get HTTP status text for status code
   */
  getReason(statusCode) {
    const statuses = {
      200: "OK",
      201: "Created",
      204: "No Content",
      301: "Moved Permanently",
      302: "Found",
      304: "Not Modified",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      409: "Conflict",
      410: "Gone",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
      501: "Not Implemented",
      502: "Bad Gateway",
      503: "Service Unavailable",
      504: "Gateway Timeout",
    };
    return statuses[statusCode] || "Unknown";
  }

  /**
   * Generate default HTML response for status codes
   */
  generateDefaultHtmlResponse(statusCode, statusText) {
    const isError = statusCode >= 400
    const emoji = isError ? "❌" : "✅"
    const color = isError ? "#e74c3c" : "#27ae60"

    return /*html*/`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${statusCode} ${statusText}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #333;
      }
      .container {
        background: white;
        padding: 3rem;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        text-align: center;
        max-width: 500px;
        width: 90%;
      }
      .status-code {
        font-size: 4rem;
        font-weight: 700;
        color: ${color};
        margin-bottom: 1rem;
      }
      .status-text {
        font-size: 1.5rem;
        color: #666;
        margin-bottom: 2rem;
      }
      .emoji {
        font-size: 3rem;
        margin-bottom: 1rem;
        display: block;
      }
      .back-link {
        color: #667eea;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.3s ease;
      }
      .back-link:hover {
        color: #764ba2;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <span class="emoji">${emoji}</span>
      <h1 class="status-code">${statusCode} </h1>
      <p>${statusText}</p>
      ${isError ? '<a href="/">←- Go back home</a>' : ""}
    </div>
  </body>
</html>`;
  }

  /**
   * Setup HTTPS configuration
   */
  async setupHTTPS() {
    let certPath = path.resolve(this.config.cert)
    let keyPath = path.resolve(this.config.key)

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      printWarning("Certificate or key file not found, using self-signed certificate...")
      certPath = path.join(this.config.root, "server.crt")
      keyPath = path.join(this.config.root, "server.key")

      try {
        fs.writeFileSync(certPath, SELF_SIGNED_CERT)
        fs.writeFileSync(keyPath, SELF_SIGNED_KEY)
      } catch (error) {
        throw new Error(`Failed to create self-signed certificate: ${error.message}`)
      }
    }

    try {
      this.config.tls = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      }
    } catch (error) {
      throw new Error(`Failed to read SSL certificate files: ${error.message}`)
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = () => {
      this.stop()
      process.exit(0)
    }

    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)
  }
}

/**
 * File Watcher class for live-reload functionality
 */
export class Watcher extends Server {
  constructor(config = {}) {
    super(config)
    this.fsWatcher = null
    this.debounceTimeout = null
    this.eventEmitter = new EventEmitter()

    // Set max listeners to prevent memory leak warnings
    this.eventEmitter.setMaxListeners(50)
  }

  async start() {
    if (this.running || !this.config.watch) {
      return Promise.resolve()
    }

    try {
      // Validate root directory
      await fs.promises.access(this.config.root)
      const stats = await fs.promises.stat(this.config.root)
      if (!stats.isDirectory()) {
        throw new Error(`${this.config.root} is not a directory`)
      }

      // Start file system watcher
      this.fsWatcher = fs.watch(this.config.root, { recursive: true }, (eventType, filename) => {
        if (filename && !this.shouldIgnoreFile(filename)) {
          this.handleFileChange(eventType, filename)
        }
      })

      // Handle watcher errors
      this.fsWatcher.on("error", (error) => {
        console.error("📁 File watcher error:", error)
        this.eventEmitter.emit("error", error)
      })

      console.log(`👀 Watching ${path.resolve(this.config.root)} for changes...`)
      this.isRunning = true
      this.eventEmitter.emit("started")

      return Promise.resolve()
    } catch (error) {
      console.error(`Failed to start file watcher: ${error.message}`)
      this.eventEmitter.emit("error", error)
      throw error
    }
  }

  async stop() {
    if (!this.isRunning) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      // Clear any pending debounce timeout
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout)
        this.debounceTimeout = null
      }

      // Close file system watcher
      if (this.fsWatcher) {
        this.fsWatcher.close()
        this.fsWatcher = null
      }

      // Clean up event listeners for garbage collection
      this.eventEmitter.removeAllListeners()

      console.log("✅ File watcher stopped")
      this.isRunning = false
      resolve()
    })
  }

  shouldIgnoreFile(filename) {
    // Ignore hidden files, temp files, and common build artifacts
    const ignoredPatterns = [
      /^\./, // Hidden files
      /~$/, // Temp files
      /\.tmp$/, // Temp files
      /\.log$/, // Log files
      /node_modules/, // Node modules
      /\.git/, // Git files
      /\.DS_Store$/, // macOS files
      /Thumbs\.db$/, // Windows files
      /\.swp$/, // Vim swap files
      /\.swo$/, // Vim swap files
    ]

    return ignoredPatterns.some((pattern) => pattern.test(filename))
  }

  handleFileChange(eventType, filename) {
    // Clear existing timeout to debounce rapid changes
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }

    // Debounce file changes to avoid rapid reloads
    this.debounceTimeout = setTimeout(() => {
      console.log(`📝 File changed: ${filename} [${eventType}]`)

      // Emit file change event with details
      this.eventEmitter.emit("fileChanged", {
        filename,
        eventType,
        timestamp: new Date().toISOString(),
        fullPath: path.join(this.config.root, filename),
      })

      // Emit reload event for backward compatibility
      this.eventEmitter.emit("reload")

      this.debounceTimeout = null
    }, 100)
  }

  // Event listener management
  on(event, listener) {
    this.eventEmitter.on(event, listener)
    return this // For chaining
  }

  off(event, listener) {
    this.eventEmitter.off(event, listener)
    return this // For chaining
  }

  once(event, listener) {
    this.eventEmitter.once(event, listener)
    return this // For chaining
  }

  emit(event, ...args) {
    this.eventEmitter.emit(event, ...args)
    return this // For chaining
  }

  // Get current listener count for monitoring
  getListenerCount(event) {
    return this.eventEmitter.listenerCount(event)
  }

  // Clean up method for garbage collection
  cleanup() {
    this.stop();
    this.eventEmitter.removeAllListeners();
    this.eventEmitter = null;
  }

  getLiveReloadScript() {
    if (!this.config.watch) return "";
    return /*html*/`
<script>
(() => {
  let RECONNECT_ATTEMPS = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const hostname = window.location.hostname;
  const port = ${this.config.socket};
  const connect = () => {
    const socket = new WebSocket(protocol + "://" + hostname + ":" + port);
    socket.onopen = () => {
      console.log("🔌 Connected to Web Socket Server");
    };
    socket.onmessage = (event) => {
      switch (event.data) {
        case "RELOAD":
          console.log("🔄 Reload command received, reloading...");
          window.location.reload();
          break;
        default:
          console.warn("⚠️ Unhandled message:", event);
          break;
      }
    };
    socket.onclose = () => {
      if (RECONNECT_ATTEMPS <= MAX_RECONNECT_ATTEMPTS) {
        RECONNECT_ATTEMPS++;
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, RECONNECT_ATTEMPS), 30000);
        console.log("🔌 Disconnected from Web Socket Server, trying to reconnect in " + delay + "s... (" + RECONNECT_ATTEMPS + "/" + MAX_RECONNECT_ATTEMPTS + ")");
        setTimeout(connect, delay);
      } else {
        console.log("🔌 Disconnected from Web Socket Server");
      }
    };
    socket.onerror = (error) => {
      console.error("🚨 Web Socket Server Error:", error);
      socket.close();
    };
  };
  connect();
})();
</script>
`;
  }
}

/**
 * WebSocket Server Class
 */
export class WebSocketServer extends Server {
  constructor(config = {}) {
    super(config);
    this.sockets = new Set();
  }

  async start() {
    if (this.running) return;

    // Handle port configuration
    if (this.config.socket && !(await isPortAvailable(this.config.socket, this.config.host))) {
      printWarning(`WebSocket port ${this.config.socket} is already in use, looking for available one...`)
      this.config.socket = await getAvailablePort(this.config.socket + 1, 9000, false, this.config.host)
    }
    else if (this.config.socket === 0) {
      this.config.socket = await getRandomAvailablePort(this.config.host)
    }
    else if (!this.config.socket) {
      this.config.socket = await getAvailablePort(3000, 9000, true, this.config.host)
    }

    // Setup HTTPS if needed
    if (this.config.https) {
      await this.setupHTTPS()
    }

    const serverModule = this.config.https ? https : http
    const options = this.config.https ? this.config.tls : {}

    this.server = serverModule.createServer(options)
    this.setupWebSocketHandling()

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.socket, this.config.host, async () => {
        const protocol = this.config.https ? "wss" : "ws"
        const host = this.config.host === "0.0.0.0" ? await getPublicIP() : this.config.host
        console.log(`👂 WebSocket server started on ${protocol}://${host}:${this.config.socket}`)
        this.isRunning = true
        this.eventEmitter.emit("started")
        resolve()
      })

      this.server.on("error", (error) => {
        this.eventEmitter.emit("error", error)
        reject(error)
      })
    })
  }

  async stop() {
    if (!this.isRunning) return

    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.sockets.forEach((socket) => {
        if (!socket.destroyed) {
          socket.end()
        }
      })
      this.sockets.clear()

      // Clean up event listeners
      this.eventEmitter.removeAllListeners()

      if (this.server) {
        this.server.close(() => {
          console.log("✅ WebSocket Server stopped")
          this.isRunning = false
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  // Get connection statistics
  getStats() {
    return {
      activeConnections: this.sockets.size,
      isRunning: this.isRunning,
      port: this.config.socket,
    }
  }

  setupWebSocketHandling() {
    this.server.on("upgrade", (request, socket, head) => {
      const key = request.headers["sec-websocket-key"]
      if (!key) {
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n")
        return
      }

      const acceptKey = this.generateAcceptKey(key)
      const headers = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "\r\n",
      ].join("\r\n")

      socket.write(headers)

      socket.on("close", () => {
        this.sockets.delete(socket)
        this.eventEmitter.emit("connectionClosed", { socketCount: this.sockets.size })
      })

      socket.on("error", (error) => {
        console.error("WebSocket error:", error)
        this.sockets.delete(socket)
        this.eventEmitter.emit("connectionError", error)
      })

      socket.on("data", (buffer) => {
        try {
          this.handleFrame(socket, buffer)
        } catch (error) {
          console.error("Error handling WebSocket frame:", error)
          this.eventEmitter.emit("frameError", error)
        }
      })

      this.sockets.add(socket)
      this.eventEmitter.emit("connectionOpened", { socketCount: this.sockets.size })
    })
  }

  generateAcceptKey(key) {
    const sha1 = crypto.createHash("sha1")
    sha1.update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    return sha1.digest("base64")
  }

  handleFrame(socket, buffer) {
    if (buffer.length < 2) return

    const firstByte = buffer[0]
    const secondByte = buffer[1]

    const opcode = firstByte & 0x0f
    const masked = (secondByte & 0x80) === 0x80
    let payloadLength = secondByte & 0x7f

    let offset = 2

    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(offset)
      offset += 2
    } else if (payloadLength === 127) {
      payloadLength = buffer.readBigUInt64BE(offset)
      offset += 8
    }

    if (masked) {
      const maskKey = buffer.slice(offset, offset + 4)
      offset += 4

      const payload = buffer.slice(offset, offset + Number(payloadLength))
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskKey[i % 4]
      }

      // Handle different opcodes
      if (opcode === 0x8) {
        // Close frame
        socket.end()
      } else if (opcode === 0x9) {
        // Ping frame
        this.sendPong(socket, payload)
      }
    }
  }

  sendPong(socket, payload) {
    const frame = this.createFrame(payload, 0xa) // Pong opcode
    socket.write(frame)
  }

  createFrame(message, opcode = 0x1) {
    const payload = Buffer.isBuffer(message) ? message : Buffer.from(message, "utf8")
    const length = payload.length
    let frame

    if (length < 126) {
      frame = Buffer.allocUnsafe(2 + length)
      frame[0] = 0x80 | opcode // FIN + opcode
      frame[1] = length
      payload.copy(frame, 2)
    } else if (length < 65536) {
      frame = Buffer.allocUnsafe(4 + length)
      frame[0] = 0x80 | opcode // FIN + opcode
      frame[1] = 126
      frame.writeUInt16BE(length, 2)
      payload.copy(frame, 4)
    } else {
      frame = Buffer.allocUnsafe(10 + length)
      frame[0] = 0x80 | opcode // FIN + opcode
      frame[1] = 127
      frame.writeUInt32BE(0, 2)
      frame.writeUInt32BE(length, 6)
      payload.copy(frame, 10)
    }

    return frame
  }

  broadcast(message) {
    const frame = this.createFrame(message)
    let successCount = 0
    let errorCount = 0

    this.sockets.forEach((socket) => {
      if (!socket.destroyed && socket.readyState !== "closed") {
        try {
          socket.write(frame)
          successCount++
        } catch (error) {
          console.error("Error broadcasting to socket:", error)
          this.sockets.delete(socket)
          errorCount++
        }
      } else {
        this.sockets.delete(socket)
        errorCount++
      }
    })

    // Emit broadcast statistics
    this.eventEmitter.emit("broadcast", {
      message,
      successCount,
      errorCount,
      totalSockets: this.sockets.size,
    })
  }

  // ... rest of WebSocketServer methods remain the same ...
}

/**
 * Web Server class that orchestrates HTTP server, WebSocket server, and file watcher
 */
export class WebServer extends Server {
  constructor(config = {}) {
    super(config);
    this.wss = null;
    this.watcher = null;
  }

  async start() {
    super.start();
    try {
      for (const root of this.config.root) {
        await fs.promises.access(root);
        const stats = await fs.promises.stat(root);
        if (!stats.isDirectory()) {
          throw new Error(`${root} is not a directory`);
        }
      }
      if (this.config.port && !(await isPortAvailable(this.config.port, this.config.host))) {
        printWarning(`Port ${this.config.port} is already in use, looking for available one...`);
        this.config.port = await getAvailablePort(this.config.port + 1, 9000, false, this.config.host);
        console.log(`🎉 Found available port: ${this.config.port}`);
      }
      else if (this.config.port === 0) {
        console.log(`🔎 Looking for random available port...`);
        this.config.port = await getRandomAvailablePort(this.config.host);
        console.log(`🎉 Found available port: ${this.config.port}`);
      }
      else if (!this.config.port) {
        console.log(`🔎 Looking for random available port in range from 3000 to 9000 ...`);
        this.config.port = await getAvailablePort(3000, 9000, true, this.config.host);
        console.log(`🎉 Found available port: ${this.config.port}`);
      }
      if (this.config.https) await this.setupHTTPS();
      this.setupGracefulShutdown();
      const serverModule = this.config.https ? "https" : "http";
      const options = this.config.https ? this.config.tls : {};
      this.server = serverModule.createServer(options, (request, response) => {
        if (this.config.cors && "OPTIONS" === request.method) {
          this.respond(null, 200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });
          return;
        }
        this.handle(request, response);
      });
      this.wss = new WebSocketServer(this.config);
      this.wss.start();
      return new Promise((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, async () => {
          const protocol = this.config.https ? "https" : "http";
          const host = "0.0.0.0" === this.config.host ? await getPublicIP() : this.config.host;
          const port = this.server.port;
          console.log(`🚀 Server is running at:\n  ${protocol}://${host}:${port}`);
          console.log(`📁 Serving files from:\n  ${this.config.root.join("\n  ")}`);
          console.log(`   Press CTRL+C to stop...`);
          resolve();
        });
        this.server.on("error", reject);
      });
    }
    catch (error) {
      printError(`Failed to start server: ${error.message}`);
      eventManager.emit("error", error);
      process.exit(1);
    }
  }

  async setup() {
  }

  async stop() {
    if (!this.running) return;
    console.log("\n👋 Shutting down web server...")
    this.cleanup();
    if (this.watcher) await this.watcher.stop();
    if (this.wss) await this.webSocketServer.stop();
    if (this.server)
      await new Promise((resolve) => {
        this.server.close(() => {
          console.log("✅ HTTP Server stopped");
          resolve();
        });
      });
    this.server = this.wss = this.watcher = null;
    eventManager.emit("stop");
    this.running = false;
  }

  // setupEventListeners() {
  //   if (!this.watcher || !this.webSocketServer) return

  //   // Connect watcher events to WebSocket broadcasts
  //   this.watcher.on("reload", () => {
  //     this.webSocketServer.broadcast("reload")
  //   })

  //   this.watcher.on("fileChanged", (changeInfo) => {
  //     this.eventEmitter.emit("fileChanged", changeInfo)
  //     // Could add more sophisticated handling here
  //   })

  //   this.watcher.on("error", (error) => {
  //     this.eventEmitter.emit("watcherError", error)
  //   })

  //   this.webSocketServer.on("connectionOpened", (info) => {
  //     this.eventEmitter.emit("wsConnectionOpened", info)
  //   })

  //   this.webSocketServer.on("connectionClosed", (info) => {
  //     this.eventEmitter.emit("wsConnectionClosed", info)
  //   })

  //   this.webSocketServer.on("broadcast", (info) => {
  //     this.eventEmitter.emit("wsBroadcast", info)
  //   })
  // }

  // cleanupEventListeners() {
  //   if (this.watcher) {
  //     this.watcher.off("reload")
  //     this.watcher.off("fileChanged")
  //     this.watcher.off("error")
  //   }

  //   if (this.webSocketServer) {
  //     this.webSocketServer.off("connectionOpened")
  //     this.webSocketServer.off("connectionClosed")
  //     this.webSocketServer.off("broadcast")
  //   }

  //   this.eventEmitter.removeAllListeners()
  // }

  // Get server statistics
  stats() {
    return {
      running: this.running,
      root: this.config.root.join(","),
      host: this.server.host,
      port: this.server.port,
      socket: this.wss.port,
      watcher: this.watcher,
      wss: this.wss
    };
  }

  // ... rest of WebServer methods remain the same ...

  async startWatcher() {
    this.watcher = new Watcher(this.config, this.webSocketServer)
    await this.watcher.start()
  }

  async handle(request, response) {
    this.request = request;
    this.response = response;
    const requestPath = decodeURIComponent(this.request.url.split("?")[0]);
    const file = this.findFile(requestPath);
    if (!file) {
      console.log(`📄 ${requestPath} [404] - Not Found`);
      this.respond(null, 404);
      return;
    }
    try {
      if (file.stats.isDirectory()) {
        const indexPath = path.join(file.path, "index.html");
        try {
          await fs.promises.access(indexPath);
          await this.serve(indexPath);
          console.log(`📄 ${requestPath} [200] - index.html from ${file.root}`);
          return;
        }
        catch {
          if (this.config.index) {
            try {
              const indexHtml = this.generateDocument(`Index of ${file.path}`, this.ls(file.path));
              this.respond(indexHtml, 200);
              return;
            }
            catch {
              console.log(`📁 ${requestPath} [500] - Directory Index Failed`);
              this.respond(null, 500);
            }
          }
          else {
            console.log(`📁 ${requestPath} [403] - Not Allowed`);
            this.respond(null, 403);
            return;
          }
        }
      }
      console.log(`📄 ${requestPath} [200] - ${file.path}`);
      await this.serve(file.path);
    }
    catch (error) {
      console.log(`📄 ${requestPath} [500] - Internal Server Error`);
      this.respond(null, 500);
    }
  }

  respond(body = null, statusCode = 200, headers = {}) {
    headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      ...headers,
    };
    if (this.config.cors) {
      headers = {
        ...headers,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      };
    }
    if (null === body) {
      const reason = this.getReason(statusCode);
      body = this.generateDocument(reason, reason);
    }
    this.response.writeHead(statusCode, headers);
    this.response.end(body);
  }

  generateDocument(title, content) {
    let html = "";
    switch (typeof content) {
      case "object":
        if (Array.isArray(content))
          html = "<ul>" + content.map((item) => `<li>${item}</li>` ).join("") + "</ul>";
        else
          html = "<pre>" + JSON.stringify(content, null, 2) + "</pre>";
      default:
        html = `<p>${content}</p>`;
    }
    return /*html*/`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      a { color: #007bff; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`;
  }

  getMimeType(ext) {
    return ALLOWED_MIME_TYPES[ext.toLowerCase()] || "application/octet-stream";
  }

  async serve(filePath) {
    const ext = path.extname(filePath)
    const contentType = this.getMimeType(ext);
    try {
      let fileContent = await fs.promises.readFile(filePath)
      // Inject live-reload script into HTML files
      if (this.config.watch && ext === ".html" && this.watcher) {
        let htmlContent = fileContent.toString();
        const liveReloadScript = this.watcher.getLiveReloadScript();

        if (htmlContent.includes("</body>")) {
          htmlContent = htmlContent.replace("</body>", `${liveReloadScript}</body>`)
        } else if (htmlContent.includes("</html>")) {
          htmlContent = htmlContent.replace("</html>", `${liveReloadScript}</html>`)
        } else {
          htmlContent += liveReloadScript
        }

        fileContent = Buffer.from(htmlContent)
      }

      const headers = {
        "Cache-Control": this.config.watch ? "no-cache" : "public, max-age=3600",
      }

      this.sendResponse(response, 200, fileContent, contentType, headers)
    } catch (error) {
      console.error(`Error serving file ${filePath}:`, error)
      this.sendResponse(response, 500)
    }
  }

  async generateDirectoryListing(dirPath, urlPath, rootPath) {
    // ... existing implementation, but update the title to show which root
    const title = `Index of ${urlPath} (from ${path.basename(rootPath)})`

    try {
      const files = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const items = []

      // Add parent directory link if not at root
      if (urlPath !== "/") {
        const parentPath = path.dirname(urlPath)
        items.push({
          name: "..",
          path: parentPath === "/" ? "/" : parentPath,
          isDirectory: true,
          size: "-",
          modified: "-",
          icon: "📁",
        })
      }

      // Process directory contents
      for (const file of files) {
        if (file.name.startsWith(".")) continue // Skip hidden files

        const filePath = path.join(dirPath, file.name)
        const stats = await fs.promises.stat(filePath)
        const relativePath = path.posix.join(urlPath, file.name)

        items.push({
          name: file.name,
          path: relativePath,
          isDirectory: file.isDirectory(),
          size: file.isDirectory() ? "-" : this.formatFileSize(stats.size),
          modified: stats.mtime.toISOString().split("T")[0],
          icon: this.getFileIcon(file.name, file.isDirectory()),
        })
      }

      // Sort: directories first, then files, both alphabetically
      items.sort((a, b) => {
        if (a.name === "..") return -1
        if (b.name === "..") return 1
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name, undefined, { numeric: true })
      })

      return this.generateDirectoryListingHtml(urlPath, items)
    } catch (error) {
      throw new Error(`Failed to read directory: ${error.message}`)
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  getFileIcon(filename, isDirectory) {
    if (isDirectory) return "📁"

    const ext = path.extname(filename).toLowerCase()
    const iconMap = {
      ".html": "🌐",
      ".htm": "🌐",
      ".css": "🎨",
      ".scss": "🎨",
      ".sass": "🎨",
      ".less": "🎨",
      ".js": "⚡",
      ".mjs": "⚡",
      ".ts": "⚡",
      ".jsx": "⚡",
      ".tsx": "⚡",
      ".json": "📋",
      ".xml": "📋",
      ".yaml": "📋",
      ".yml": "📋",
      ".md": "📝",
      ".txt": "📝",
      ".rtf": "📝",
      ".pdf": "📄",
      ".doc": "📄",
      ".docx": "📄",
      ".png": "🖼️",
      ".jpg": "🖼️",
      ".jpeg": "🖼️",
      ".gif": "🖼️",
      ".svg": "🖼️",
      ".webp": "🖼️",
      ".mp3": "🎵",
      ".wav": "🎵",
      ".ogg": "🎵",
      ".m4a": "🎵",
      ".mp4": "🎬",
      ".avi": "🎬",
      ".mov": "🎬",
      ".webm": "🎬",
      ".zip": "📦",
      ".rar": "📦",
      ".7z": "📦",
      ".tar": "📦",
      ".gz": "📦",
      ".exe": "⚙️",
      ".app": "⚙️",
      ".deb": "⚙️",
      ".rpm": "⚙️",
      ".py": "🐍",
      ".rb": "💎",
      ".php": "🐘",
      ".java": "☕",
      ".c": "🔧",
      ".cpp": "🔧",
      ".h": "🔧",
      ".woff": "🔤",
      ".woff2": "🔤",
      ".ttf": "🔤",
      ".otf": "🔤",
      ".eot": "🔤",
    }

    return iconMap[ext] || "📄"
  }

  generateDirectoryListingHtml(urlPath, items) {
    const title = `Index of ${urlPath}`

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f8f9fa;
        color: #333;
        line-height: 1.6;
      }
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 2rem 0;
        text-align: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      .header h1 {
        font-size: 2rem;
        font-weight: 300;
      }
      .container {
        max-width: 1200px;
        margin: 2rem auto;
        padding: 0 1rem;
      }
      .file-list {
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      .file-item {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        gap: 1rem;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #eee;
        transition: background-color 0.2s ease;
        align-items: center;
      }
      .file-item:hover {
        background-color: #f8f9fa;
      }
      .file-item:last-child {
        border-bottom: none;
      }
      .file-icon {
        font-size: 1.5rem;
        width: 2rem;
        text-align: center;
      }
      .file-name {
        color: #667eea;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s ease;
      }
      .file-name:hover {
        color: #764ba2;
        text-decoration: underline;
      }
      .file-size, .file-date {
        color: #666;
        font-size: 0.9rem;
        text-align: right;
        min-width: 80px;
      }
      .directory .file-name {
        color: #e67e22;
      }
      .directory .file-name:hover {
        color: #d35400;
      }
      .parent-dir .file-name {
        color: #95a5a6;
      }
      .parent-dir .file-name:hover {
        color: #7f8c8d;
      }
      .empty-state {
        text-align: center;
        padding: 3rem;
        color: #666;
      }
      .empty-state .icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        display: block;
      }
      @media (max-width: 768px) {
        .file-item {
          grid-template-columns: auto 1fr;
          gap: 0.5rem;
        }
        .file-size, .file-date {
          display: none;
        }
        .container {
          padding: 0 0.5rem;
        }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>📁 ${title}</h1>
    </div>
    <div class="container">
      <div class="file-list">
        ${items.length === 0
        ? `
          <div class="empty-state">
            <span class="icon">📭</span>
            <p>This directory is empty</p>
          </div>
        `
        : items
          .map(
            (item) => `
          <div class="file-item ${item.isDirectory ? "directory" : ""} ${item.name === ".." ? "parent-dir" : ""}">
            <span class="file-icon">${item.icon}</span>
            <a href="${item.path}" class="file-name">${item.name}${item.isDirectory && item.name !== ".." ? "/" : ""}</a>
            <span class="file-size">${item.size}</span>
            <span class="file-date">${item.modified}</span>
          </div>
        `,
          )
          .join("")
      }
      </div>
    </div>
  </body>
</html>`
  }

  /**
   * Find file across multiple root directories (first found wins)
   */
  async findFile(requestPath) {
    for (const root of this.config.root) {
      const paths = [root, requestPath];
      if (requestPath.endsWith("/")) paths.push("index.html");
      const filePath = path.join(...paths);
      const pathTraversal = !filePath.startsWith(root);
      try {
        const exists = await fs.promises.access(filePath).then(...toBool);
        const found = !pathTraversal && exists;
        const stats = found ? await fs.promises.stat(filePath) : null;
        return { path: filePath, stats, root };
      }
      catch (error) {
        // File not found in this root, try next
        continue;
      }
    }
    return null;
  }
}

// CLI Entry Point
if (process.argv[1] === __filename) {
  try {
    const config = parseArgs()

    if (config.help) {
      printHelp()
      process.exit(0)
    }

    if (config.version) {
      const meta = getPkgMeta()
      console.log(meta.version || "1.0.0")
      process.exit(0)
    }

    // Use all positional arguments as root directories
    if (config._.length > 0) {
      config.root = config._
    }

    const webServer = new WebServer(config)
    webServer.start()
  } catch (error) {
    console.error("🚨 Failed to start web server:", error.message)
    process.exit(1)
  }
}
