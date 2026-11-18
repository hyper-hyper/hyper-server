#!/usr/bin/env node

import os from "node:os";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import fs, { watch } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import url from "node:url";
import { URL } from "node:url";
import { EventEmitter } from "node:events";

/** Allowed MIME types */
export const MIME_TYPES = {
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

/** DEFAULTS */
export const DEFAULTS = {
  host: "0.0.0.0",
  port: 3000,
  socket: 3001,
  https: false,
  cert: "server.crt",
  key: "server.key",
  watch: false,
  index: true,
  root: process.cwd()
};

/** SCHEMA */
export const SCHEMA = {
  host: {
    type: "string",
    default: DEFAULTS.host,
    description: "Server host",
    alias: "H"
  },
  port: {
    type: "number",
    default: DEFAULTS.port,
    description: "Server port",
    alias: "p",
  },
  socket: {
    type: "number",
    default: DEFAULTS.socket,
    description: "Web Socket Server port",
    alias: "s",
  },
  https: {
    type: "boolean",
    default: DEFAULTS.https,
    description: "Enable HTTPS",
    alias: "S",
  },
  cert: {
    type: "string",
    default: DEFAULTS.cert,
    description: "Path to the SSL certificate file",
    alias: "c",
  },
  key: {
    type: "string",
    default: DEFAULTS.key,
    description: "Path to the SSL key file",
    alias: "k",
  },
  watch: {
    type: "boolean",
    default: DEFAULTS.watch,
    description: "Enable Live-Reload",
    alias: "w",
  },
  index: {
    type: "boolean",
    default: DEFAULTS.index,
    description: "Enable file listing on directories",
    alias: "i",
  }
};

/** Self-signed certificate */
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
-----END CERTIFICATE-----`

/** Self-signed private key */
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
-----END PRIVATE KEY-----`

/**
 * A polyfill for `fetch()` for Node.js v14.21.3
 */
if(!("fetch" in globalThis)) {
  globalThis.fetch = (url, options = {}) => {
    return new Promise((resolve, reject) => {
      const reqOptions = {
        method: options.method || "GET",
        headers: options.headers || {},
        body: options.body || null,
      };
      const protocol = url.startsWith("https") ? https : http;
      const req = protocol.request(url, reqOptions, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          const response = new Response(body, {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
          });
          resolve(response);
        });
      });
      req.on("error", (err) => {
        reject(err);
      });
      if (reqOptions.body) {
        if (typeof reqOptions.body === "string") {
          req.write(reqOptions.body);
        } else if (Buffer.isBuffer(reqOptions.body)) {
          req.write(reqOptions.body);
        } else {
          reject(new TypeError("Body must be a string or Buffer"));
          return;
        }
      }
      req.end();
    });
  };
  globalThis.Headers = class Headers {
    constructor(init = {}) {
      this.headers = new Map(Object.entries(init));
    }
    get(name) {
      return this.headers.get(name);
    }
    set(name, value) {
      this.headers.set(name, value);
    }
    has(name) {
      return this.headers.has(name);
    }
    entries() {
      return this.headers.entries();
    }
  };
  globalThis.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || "OK";
      this.headers = new Headers(init.headers);
    }
    text() {
      return Promise.resolve(this.body);
    }
    json() {
      return Promise.resolve(JSON.parse(this.body));
    }
  };
  globalThis.Request = class Request {
    constructor(input, init = {}) {
      this.url = input instanceof URL ? input.toString() : input;
      this.method = init.method || "GET";
      this.headers = new Headers(init.headers);
      this.body = init.body || null;
      this.signal = init.signal || null;
    }
  }
}

/**
 * Prints a warning message to the console
 * 
 * @param {string} message - The warning message to print.
 * @param {string} [title="Warning"] - The title of the warning.
 */
export const printWarning = (message, title = "Warning") => {
  const warningMessage = `\x1b[33m${title}: ${message}\x1b[0m`;
  console.warn(warningMessage);
};

/**
 * Prints an error message to the console
 * 
 * @param {string} message 
 * @param {string} title 
 */
export const printError = (message, title = "Error") => {
  const errorMessage = `\x1b[31m${title}: ${message}\x1b[0m`;
  console.error(errorMessage);
};

/**
 * Prints help information to the console
 * 
 * @param {object} schema 
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

/**
 * Prints the version of the package to the console
 * 
 * @returns {Promise<void>} - A promise that resolves when the version is printed.
 */
export const printVersion = async () => {
  const pkg = await getPackageMeta();
  console.log(`${pkg.name} v${pkg.version}`);
  console.log(pkg.description);
};

/**
 * Prints a banner with package information to the console
 * 
 * @returns {Promise<void>} - A promise that resolves when the banner is printed.
 */
export const printBanner = async () => {
  const pkg = await getPackageMeta();
  console.log(`\n\x1b[1m\x1b[34m${pkg.name} v${pkg.version}\x1b[0m`);
  console.log(`\x1b[2m${pkg.description}\x1b[0m\n`);
  console.log(`\x1b[32mServer is running at:\x1b[0m`);
  console.log(`\x1b[36m${pkg.main}\x1b[0m\n`);
};


/**
 * Gets `bin`, `name`, `description` and `version` from available package.json
 * 
 * @return {Promise<object>} - Returns a promise that resolves to the package.json content.
 */
export const getPackageMeta = async () => {
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  try {
    const main = process.argv[1] || __dirname;
    let dir = path.dirname(main);
    while (dir !== path.dirname(dir)) {
      const packagePath = path.join(dir, "package.json");
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
        return {
          bin: pkg.bin || {},
          name: pkg.name || path.basename(dir),
          description: pkg.description || "",
          version: pkg.version || "1.0.0",
          main: pkg.main || "index.js"
        };
      }
    }
  } catch {}
  return {};
};

/**
 * Get the public IP address of the machine
 * 
 * @returns {Promise<string>} - Returns a promise that resolves to the public IP address.
 */
export const getPublicIP = async () => {
  try {
    const response = await fetch("https://api.ipify.org");
    const ip = await response.text();
    return ip.trim();
  } catch (error) {
    printWarning(`Failed to get public IP address: ${error.message}`);
    return "127.0.0.1";
  }
};

/**
 * Get the first available local IPv4 address
 * 
 * @returns {string} - Returns the first available local IPv4 address or "
 */
export const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips.length > 0 ? ips[0] : "127.0.0.1";
};

/**
 * Get a random available port on the specified host
 * 
 * @param {string} host - The host to check for available ports, defaults to "0.0.0.0".
 * @return {Promise<number>} - Returns a promise that resolves to a random available port.
 */
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

/**
 * Check if a port is available on the specified host
 * 
 * @param {number} port - The port to check.
 * @param {string} host - The host to check for availability
 * @returns {Promise<boolean>} - Returns a promise that resolves to true if the port is available, otherwise false.
 */
export const isPortAvailable = async (port, host = "0.0.0.0") =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    })
  });

/**
 * Get a list of available ports within a specified range
 * 
 * @param {number} from - The starting port number, defaults to 3000.
 * @param {number} to - The ending port number, defaults to 9000.
 * @param {number} limit - The maximum number of available ports to return, defaults to 1.
 * @param {boolean} random - Whether to shuffle the port range, defaults to false.
 * @param {string} host - The host to check for available ports, defaults to "
 * @returns {Promise<number[]>} - Returns a promise that resolves to an array of available ports.
 */
export const getAvailablePorts = async (
  from = 3000, 
  to = 9000, 
  limit = 1, 
  random = false, 
  host = "0.0.0.0"
) => {
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

/**
 * Get a single available port within a specified range
 * 
 * @param {number} from - The starting port number, defaults to 3000.
 * @param {number} to - The ending port number, defaults to 9000.`
 * @param {boolean} random - Whether to shuffle the port range, defaults to false.
 * @param {string} host - The host to check for available ports, defaults to "
 * @returns {Promise<number>} - Returns a promise that resolves to an available port.
 */
export const getAvailablePort = async (from = 3000, to = 9000, random = false, host = "0.0.0.0") => {
  const [port] = await getAvailablePorts(from, to, 1, random, host);
  return port;
}

/**
 * Shuffle values in an array using Fisher-Yates algorithm
 * 
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
 * 
 * @param {number} from
 * @param {number} to
 * @param {boolean} shuffle
 * @returns {array}
 */
export const createRange = (from, to, shuffle = false) => {
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return shuffle ? shuffleValues(range) : range;
};

/**
 * Infer the type of a value
 * 
 * @param {*} value - The value to infer the type of.
 * @returns {string} - Returns the inferred type as a string.
 */
export const inferType = (value) => {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "array";
  return "string";
};

/**
 * Parses command line arguments based on the provided schema.
 * 
 * @param {*} argv - The command line arguments to parse, defaults to `process.argv.slice(2)`.
 * @param {*} schema - The schema to use for parsing arguments, defaults to `SCHEMA`.
 * @returns {object} - Returns an object with parsed arguments.
 */
export const parseArgs = (argv = process.argv.slice(2), schema = SCHEMA) => {
  const args = {
    _: "_" in schema ? (Array.isArray(schema._.default) ? [...schema._.default] : [schema._.default]) : [],
  };
  const flags = new Map();

  if (schema) {
    for (const key in schema) {
      const { alias, default: defaultValue } = schema[key];
      if (alias) {
        const aliases = Array.isArray(alias) ? alias : [alias];
        for (const a of aliases) {
          flags.set(a, key);
        }
      }
      if (defaultValue !== undefined) {
        args[key] = defaultValue;
      }
    }
  }

  let x = 0;
  while (x < argv.length) {
    const arg = argv[x];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--version" || arg === "-v") {
      args.version = true;
    } else if (arg.startsWith("--no-")) {
      const rawKey = arg.slice(5);
      const key = flags.get(rawKey) || rawKey;
      args[key] = false;
    } else if (arg.startsWith("--")) {
      const [rawKey, eqValue] = arg.slice(2).split("=", 2);
      const key = flags.get(rawKey) || rawKey;
      const next = argv[x + 1];
      const value = eqValue !== undefined ? eqValue : next && !next.startsWith("-") ? (x++, next) : true;
      assignValue(args, key, value);
    } else if (arg.startsWith("-") && arg.length > 1) {
      const chars = arg.slice(1);
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const key = flags.get(char) || char;
        const next = argv[x + 1];
        const isLast = i === chars.length - 1;
        const value = isLast && next && !next.startsWith("-") ? (x++, next) : true;
        assignValue(args, key, value);
      }
    } else {
      assignValue(args, "_", arg);
    }
    x++;
  }
  return args;
};

/**
 * ServerConfig
 * 
 * It provides methods to validate and retrieve server configuration.
 */
export class Config {
  /**
   * Constructor for the Config class
   * 
   * @param {object} options - Configuration options for the server.
   */
  constructor(options = {}) {
    this.host = options.host || DEFAULTS.host;
    this.port = options.port || DEFAULTS.port;
    this.socket = options.socket || DEFAULTS.socket;
    this.https = options.https || DEFAULTS.https;
    this.cert = options.cert || DEFAULTS.cert;
    this.key = options.key || DEFAULTS.key;
    this.watch = options.watch || DEFAULTS.watch;
    this.index = options.index !== undefined ? options.index : DEFAULTS.index;
    this.root = path.resolve(options.root || DEFAULTS.root);
  }

  /**
   * Returns the resolved path to the certificate file.
   * @returns {boolean} - Returns true if the configuration is valid, otherwise false.
   */
  get certPath() {
    return path.resolve(this.root, this.cert);
  }

  /**
   * Returns the resolved path to the key file.
   * @returns {string} - The absolute path to the key file.
   */
  get keyPath() {
    return path.resolve(this.root, this.key);
  }

  /**
   * Returns the absolute path to the root directory.
   * @returns {boolean} - Returns true if the configuration is valid, otherwise false.
   */
  get rootPath() {
    return path.resolve(this.root);
  }

  /**
   * Reuturns the protocol used by the server.
   * @returns {string} - The protocol used by the server, either "http" or "https".
   */
  get protocol() {
    return this.https ? "https" : "http";
  }
  
  /**
   * Returns the hostname of the server.
   * If the host is "0.0.0.0", it returns the public IP address.
   * @returns {string} - The hostname of the server.
   */
  get hostname() {
    // return "0.0.0.0" === this.host ? os.hostname() : this.host;
    return "0.0.0.0" === this.host ? getPublicIP() : this.host;
  }

  /**
   * Returns the server URL.
   * @returns {URL} - The URL of the server.
   */
  get serverURL() {
    return new URL(`${this.protocol}://${this.hostname}:${this.port}`);
  }

  /**
   * Returns the socket URL.
   * @returns {string} - The WebSocket URL of the server.
   */
  get socketURL() {
    return `${"https" === this.protocol ? "wss" : "ws"}://${this.hostname}:${this.socket}`;
  }
}

/**
 * Basic Server class
 */
export class Server {
  /**
   * Constructor
   * 
   * @param {object} config 
   */
  constructor(config) {
    this.config = config;
    this.server = null;
  }

  /**
   * Start the server
   * 
   * @returns {Promise<void>} - A promise that resolves when the server is started.
   */
  async start() {
    if(this.running) return;
    this.running = true;
    const serverOptions = https ? {
      key: fs.readFileSync(this.config.keyPath),
      cert: fs.readFileSync(this.config.certPath),
    } : {
      key: SELF_SIGNED_KEY,
      cert: SELF_SIGNED_CERT,
    };
    const module = this.config.https ? https : http;
    this.server = module.createServer(serverOptions, (request, response) => {
      console.log(request);
      // Handle HTTP requests here
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("Hello, World!");
    });
  }

  /**
   * Stop server
   * 
   * @returns {Promise<void>} - A promise that resolves when the server is stopped.
   */
  async stop() {
    if(!this.running) return;
    this.running = false;
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if(err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Handle Response and emit it to the client
   * 
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  async respond(body = null, status = 200, headers = {}) {
    return new Promise((resolve, reject) => {
      if(!this.server) {
        return reject(new Error("Server is not running"));
      }
      const response = new Response(body, { status, headers });
      this.server.emit("response", response);
      resolve(response);
    });    
  }
}
