#!/usr/bin/env node

import os from "node:os"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import fs from "node:fs"
import path from "node:path"
import url from "node:url"
import crypto from "node:crypto"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Default configuration */
export const DEFAULTS = {
  host: "0.0.0.0",
  port: 3000,
  socket: 3001,
  https: false,
  cert: "server.crt",
  key: "server.key",
  watch: false,
  root: ".",
  cors: false,
  gzip: false,
  index: true,
}

/** Schema for command-line arguments */
const SCHEMA = {
  _: { description: "Document root", default: DEFAULTS.root, type: "string" },
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
}

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
}

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
-----END CERTIFICATE-----`

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
-----END PRIVATE KEY-----`

// Utility functions (keeping them at the top level for simplicity)
export const getPkgMeta = () => {
  try {
    const mainFile = process.argv[1] || __dirname
    let dir = path.dirname(mainFile)

    while (dir !== path.dirname(dir)) {
      const pkgPath = path.join(dir, "package.json")
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
        return {
          main: pkg.main || process.argv[1],
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
        }
      }
      dir = path.dirname(dir)
    }
  } catch (error) {
    // Silently fail and return empty object
  }
  return {}
}

export const printWarning = (message) => {
  console.log(`⚠️  ${message}`)
}

export const printError = (message, exit = false) => {
  console.error(`❌ ${message}`)
  if (exit) {
    printHelp()
    process.exit(1)
  }
}

export const printHelp = (schema = SCHEMA) => {
  const scriptName = path.basename(process.argv[1])
  const meta = getPkgMeta()

  console.log(`🏭 ${meta.name || meta.main || scriptName} ${meta.version || ""}`)
  if (meta.description) console.log(`   ${meta.description}`)

  console.log(
    `\nℹ️  USAGE\n   ${scriptName} ${schema ? "[options] [--]" : ""} ${schema && "_" in schema ? "[...arguments]" : ""}`,
  )

  if (schema) {
    if ("_" in schema) {
      console.log(
        `\n🏭 ARGUMENTS\n   ${schema._.description || ""}${"default" in schema._ ? ` (default: ${Array.isArray(schema._.default) ? `[${schema._.default.join(", ")}]` : schema._.default})` : ""}`,
      )
    }

    console.log(`\n🎛️  OPTIONS`)
    for (const key in schema) {
      if (key === "_") continue

      const { alias, default: defaultValue } = schema[key]
      const flags = [`--${key}`, ...(alias ? [alias].flat().map((a) => `-${a}`) : [])]

      console.log(
        `   ${flags.join(", ")}  ${schema[key].description || ""}${defaultValue !== undefined ? ` (default: ${defaultValue})` : ""}`,
      )
    }
  }
}

export const getPublicIP = async () => {
  try {
    const response = await fetch("https://api.ipify.org", {
      signal: AbortSignal.timeout(5000),
    })
    const ip = await response.text()
    return ip.trim()
  } catch (error) {
    printWarning(`Failed to get public IP address: ${error.message}`)
    return "127.0.0.1"
  }
}

export const getLocalIP = () => {
  const devices = os.networkInterfaces()
  for (const name in devices) {
    for (const device of devices[name]) {
      if (device.family === "IPv4" && !device.internal) {
        return device.address
      }
    }
  }
  return "127.0.0.1"
}

export const shuffleValues = (array) => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export const createRange = (from, to, shuffle = false) => {
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return shuffle ? shuffleValues(range) : range
}

export const getRandomAvailablePort = async (host = "0.0.0.0") =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, host, () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })

export const isPortAvailable = async (port, host = "0.0.0.0") =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on("error", () => resolve(false))
    server.listen(port, host, () => {
      server.close(() => resolve(true))
    })
  })

export const getAvailablePorts = async (from = 3000, to = 9000, limit = 1, random = false, host = "0.0.0.0") => {
  const range = createRange(from, to, random)
  const ports = []

  for (const port of range) {
    if (await isPortAvailable(port, host)) {
      ports.push(port)
      if (ports.length === limit) break
    }
  }

  return ports
}

export const getAvailablePort = async (from = 3000, to = 9000, random = false, host = "0.0.0.0") => {
  const [port] = await getAvailablePorts(from, to, 1, random, host)
  return port
}

export const inferType = (value) => {
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return "number"
  if (Array.isArray(value)) return "array"
  return "string"
}

export const assignValue = (obj, key, value) => {
  if (Array.isArray(obj[key])) {
    obj[key].push(value)
  } else if (obj[key] !== undefined && inferType(obj[key]) === inferType(value)) {
    obj[key] = value
  } else if (obj[key] !== undefined) {
    obj[key] = [obj[key], value]
  } else {
    obj[key] = value
  }
}

export const parseArgs = (argv = process.argv.slice(2), schema = SCHEMA) => {
  const args = {
    _: "_" in schema ? (Array.isArray(schema._.default) ? [...schema._.default] : [schema._.default]) : [],
  }
  const flags = new Map()

  if (schema) {
    for (const key in schema) {
      const { alias, default: defaultValue } = schema[key]
      if (alias) {
        const aliases = Array.isArray(alias) ? alias : [alias]
        for (const a of aliases) {
          flags.set(a, key)
        }
      }
      if (defaultValue !== undefined) {
        args[key] = defaultValue
      }
    }
  }

  let x = 0
  while (x < argv.length) {
    const arg = argv[x]

    if (arg === "--help" || arg === "-h") {
      args.help = true
    } else if (arg === "--version" || arg === "-v") {
      args.version = true
    } else if (arg.startsWith("--no-")) {
      const rawKey = arg.slice(5)
      const key = flags.get(rawKey) || rawKey
      args[key] = false
    } else if (arg.startsWith("--")) {
      const [rawKey, eqValue] = arg.slice(2).split("=", 2)
      const key = flags.get(rawKey) || rawKey
      const next = argv[x + 1]
      const value = eqValue !== undefined ? eqValue : next && !next.startsWith("-") ? (x++, next) : true
      assignValue(args, key, value)
    } else if (arg.startsWith("-") && arg.length > 1) {
      const chars = arg.slice(1)
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i]
        const key = flags.get(char) || char
        const next = argv[x + 1]
        const isLast = i === chars.length - 1
        const value = isLast && next && !next.startsWith("-") ? (x++, next) : true
        assignValue(args, key, value)
      }
    } else {
      assignValue(args, "_", arg)
    }

    x++
  }

  return args
}

/**
 * Base Server class with common functionality
 */
export class Server {
  constructor(config = {}) {
    this.config = { ...DEFAULTS, ...config }
    this.server = null
    this.isRunning = false
  }

  /**
   * Start the server - to be implemented by subclasses
   */
  async start() {
    throw new Error("start() method must be implemented by subclass")
  }

  /**
   * Stop the server - to be implemented by subclasses
   */
  async stop() {
    throw new Error("stop() method must be implemented by subclass")
  }

  /**
   * Handle incoming requests - to be implemented by subclasses
   */
  async handleRequest(request, response) {
    throw new Error("handleRequest() method must be implemented by subclass")
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
      const statusText = this.getStatusText(statusCode)
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
  getStatusText(statusCode) {
    const statusTexts = {
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
    }
    return statusTexts[statusCode] || "Unknown Status"
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
      <div class="status-code">${statusCode}</div>
      <div class="status-text">${statusText}</div>
      ${isError ? '<a href="/" class="back-link">← Go back home</a>' : ""}
    </div>
  </body>
</html>`
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
 * Watcher class for file system changes
 */
export class Watcher {
  constructor(config, webSocketServer) {
    this.config = config
    this.webSocketServer = webSocketServer
    this.isRunning = false
    this.timeout = null
  }

  async start() {
    if (this.isRunning) return

    this.watcher = fs.watch(this.config.root, { recursive: true }, (eventType, filename) => {
      if (filename) {
        if (this.timeout) clearTimeout(this.timeout)
        this.timeout = setTimeout(() => {
          console.log(`\n👀 File changed: ${filename} [${eventType}]`)
          this.webSocketServer.broadcast("reload")
        }, 50)
      }
    })

    this.isRunning = true
    console.log("✔️  Live-reload enabled")
  }

  async stop() {
    if (!this.isRunning) return

    this.watcher.close()
    this.isRunning = false
    console.log("❌ Live-reload disabled")
  }

  getLiveReloadScript() {
    const protocol = this.config.https ? "wss" : "ws"
    const script = /*html*/`
<script>
  (function() {
    function connect() {
      var ws = new WebSocket('${protocol}://' + window.location.hostname + ':${this.config.socket}');

      ws.onopen = function() {
        console.log('Live-reload connected');
      };

      ws.onmessage = function(event) {
        if (event.data === 'reload') {
          console.log('Reloading page...');
          window.location.reload();
        }
      };

      ws.onclose = function() {
        console.log('Live-reload disconnected, reconnecting in 3 seconds...');
        setTimeout(connect, 3000);
      };

      ws.onerror = function(error) {
        console.error('Live-reload error:', error);
        ws.close();
      };
    }

    connect();
  })();
</script>`
    return script
  }
}

/**
 * WebSocket Server class
 */
export class WebSocketServer extends Server {
  constructor(config = {}) {
    super(config)
    this.sockets = new Set()
  }

  async start() {
    if (this.isRunning) return

    // Handle port configuration
    if (this.config.socket && !(await isPortAvailable(this.config.socket, this.config.host))) {
      printWarning(`WebSocket port ${this.config.socket} is already in use, looking for available one...`)
      this.config.socket = await getAvailablePort(this.config.socket + 1, 9000, false, this.config.host)
    } else if (this.config.socket === 0) {
      this.config.socket = await getRandomAvailablePort(this.config.host)
    } else if (!this.config.socket) {
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
        resolve()
      })

      this.server.on("error", reject)
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
      })

      socket.on("error", (error) => {
        console.error("WebSocket error:", error)
        this.sockets.delete(socket)
      })

      socket.on("data", (buffer) => {
        try {
          this.handleFrame(socket, buffer)
        } catch (error) {
          console.error("Error handling WebSocket frame:", error)
        }
      })

      this.sockets.add(socket)
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
    this.sockets.forEach((socket) => {
      if (!socket.destroyed && socket.readyState !== "closed") {
        try {
          socket.write(frame)
        } catch (error) {
          console.error("Error broadcasting to socket:", error)
          this.sockets.delete(socket)
        }
      } else {
        this.sockets.delete(socket)
      }
    })
  }
}

/**
 * Web Server class that orchestrates HTTP server, WebSocket server, and file watcher
 */
export class WebServer extends Server {
  constructor(config = {}) {
    super(config)
    this.httpServer = null
    this.webSocketServer = null
    this.watcher = null
  }

  async start() {
    if (this.isRunning) return

    try {
      // Validate root directory
      await fs.promises.access(this.config.root)
      const stats = await fs.promises.stat(this.config.root)
      if (!stats.isDirectory()) {
        throw new Error(`${this.config.root} is not a directory`)
      }

      // Handle port configuration
      if (this.config.port && !(await isPortAvailable(this.config.port, this.config.host))) {
        printWarning(`Port ${this.config.port} is already in use, looking for available one...`)
        this.config.port = await getAvailablePort(this.config.port + 1, 9000, false, this.config.host)
      } else if (this.config.port === 0) {
        this.config.port = await getRandomAvailablePort(this.config.host)
      } else if (!this.config.port) {
        this.config.port = await getAvailablePort(3000, 9000, true, this.config.host)
      }

      // Setup HTTPS if needed
      if (this.config.https) {
        await this.setupHTTPS()
      }

      // Start HTTP server
      await this.startHttpServer()

      // Start WebSocket server and watcher if live-reload is enabled
      if (this.config.watch) {
        await this.startWebSocketServer()
        await this.startWatcher()
      }

      this.isRunning = true
      this.setupGracefulShutdown()
    } catch (error) {
      console.error("Failed to start web server:", error.message)
      process.exit(1)
    }
  }

  async stop() {
    if (!this.isRunning) return

    console.log("\n👋 Shutting down web server...")

    // Stop watcher first
    if (this.watcher) {
      await this.watcher.stop()
    }

    // Stop WebSocket server
    if (this.webSocketServer) {
      await this.webSocketServer.stop()
    }

    // Stop HTTP server
    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(() => {
          console.log("✅ HTTP Server stopped")
          resolve()
        })
      })
    }

    this.isRunning = false
  }

  async startHttpServer() {
    const serverModule = this.config.https ? https : http
    const options = this.config.https ? this.config.tls : {}

    this.httpServer = serverModule.createServer(options, (request, response) => {
      // Handle CORS preflight requests
      if (this.config.cors && request.method === "OPTIONS") {
        this.sendResponse(response, 200, "", "text/plain", {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        })
        return
      }

      this.handleRequest(request, response)
    })

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.port, this.config.host, async () => {
        const protocol = this.config.https ? "https" : "http"
        const host = this.config.host === "0.0.0.0" ? await getPublicIP() : this.config.host
        console.log(`🚀 Web server started on ${protocol}://${host}:${this.config.port}`)
        console.log(`📁 Serving files from: ${path.resolve(this.config.root)}`)
        resolve()
      })

      this.httpServer.on("error", reject)
    })
  }

  async startWebSocketServer() {
    this.webSocketServer = new WebSocketServer(this.config)
    await this.webSocketServer.start()
  }

  async startWatcher() {
    this.watcher = new Watcher(this.config, this.webSocketServer)
    await this.watcher.start()
  }

  async handleRequest(request, response) {
    const urlPath = decodeURIComponent(request.url.split("?")[0])
    const safePath = path.normalize(path.join(this.config.root, urlPath))

    // Security check: prevent directory traversal
    if (!safePath.startsWith(path.resolve(this.config.root))) {
      console.log(`🚫 ${urlPath} [403] - Directory traversal attempt`)
      this.sendResponse(response, 403)
      return
    }

    try {
      const stats = await fs.promises.stat(safePath)

      if (stats.isDirectory()) {
        // Try to serve index.html from directory first
        const indexPath = path.join(safePath, "index.html")
        try {
          await fs.promises.access(indexPath)
          await this.serveFile(indexPath, response)
          console.log(`📄 ${urlPath} [200] - index.html`)
          return
        } catch {
          // No index.html found
          if (this.config.index) {
            // Generate directory listing
            try {
              const directoryHtml = await this.generateDirectoryListing(safePath, urlPath)
              this.sendResponse(response, 200, directoryHtml)
              console.log(`📁 ${urlPath} [200] - directory listing`)
              return
            } catch (error) {
              console.log(`📁 ${urlPath} [500] - Failed to generate directory listing: ${error.message}`)
              this.sendResponse(response, 500)
              return
            }
          } else {
            console.log(`📁 ${urlPath} [403] - Directory listing disabled`)
            this.sendResponse(response, 403)
            return
          }
        }
      }

      await this.serveFile(safePath, response)
      console.log(`📄 ${urlPath} [200]`)
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(`📄 ${urlPath} [404] - File not found`)
        this.sendResponse(response, 404)
      } else {
        console.log(`📄 ${urlPath} [500] - ${error.message}`)
        this.sendResponse(response, 500)
      }
    }
  }

  getMimeType(ext) {
    return ALLOWED_MIME_TYPES[ext.toLowerCase()] || "application/octet-stream"
  }

  async serveFile(filePath, response) {
    const ext = path.extname(filePath)
    const contentType = this.getMimeType(ext)

    try {
      let fileContent = await fs.promises.readFile(filePath)

      // Inject live-reload script into HTML files
      if (this.config.watch && ext === ".html" && this.watcher) {
        let htmlContent = fileContent.toString()
        const liveReloadScript = this.watcher.getLiveReloadScript()

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

  async generateDirectoryListing(dirPath, urlPath) {
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

    return /*html*/`<!DOCTYPE html>
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
        ${
          items.length === 0
            ? /*html*/`
          <div class="empty-state">
            <span class="icon">📭</span>
            <p>This directory is empty</p>
          </div>
        `
            : items
                .map(
                  (item) => /*html*/`
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
}

// CLI Entry Point
if (process.argv[1] === __filename) {
  try {
    const config = parseArgs()

    console.log("PARSED CONFIG: ", config)

    if (config.help) {
      printHelp()
      process.exit(0)
    }

    if (config.version) {
      const meta = getPkgMeta()
      console.log(meta.version || "1.0.0")
      process.exit(0)
    }

    // Use the first positional argument as root if provided
    if (config._.length > 0) {
      config.root = config._[0]
    }

    const webServer = new WebServer(config)
    webServer.start()
  } catch (error) {
    console.error("🚨 Failed to start web server:", error.message)
    process.exit(1)
  }
}
