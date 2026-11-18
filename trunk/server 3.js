#!/usr/bin/env node

import os from "node:os";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { promisify } from "node:util";

/** Promisified fs functions */
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

/** Server Version */
export const VERSION = "0.0.3";

/** Default configuration */
export const DEFAULT_CONFIG = {
  host: "0.0.0.0", // Listen on all available network interfaces
  port: 0, // 0 means random available port
  https: false, // Use HTTPS
  cert: "server.crt",
  key: "server.key",
  watch: false, // Watch for file changes and Live-Reload
  dir: ".", // Directory to serve files from
};

/** Allowed MIME types to serve */
export const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".woff": "application/font-woff",
  ".woff2": "application/font-woff2",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
};

/** Self-signed certificate for SSL */
export const SELF_SIGNED_CERT = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQCKz8+8GGKbPDANBgkqhkiG9w0BAQsFADCBjDELMAkGA1UEBhMC
VVMxCzAJBgNVBAgMAlRYMQ8wDQYDVQQHDAZBdXN0aW4xEDAOBgNVBAoMB05vZGVU
ZXN0MRAwDgYDVQQLDAdOb2RlVGVzdDEUMBIGA1UEAwwLbG9jYWxob3N0MR8wHQYJ
KoZIhvcNAQkBFhB0ZXN0QGV4YW1wbGUuY29tMB4XDTI0MDEwMTAwMDAwMFoXDTI1
MDEwMTAwMDAwMFowgYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJUWDEPMA0GA1UE
BwwGQXVzdGluMRAwDgYDVQQKDAdOb2RlVGVzdDEQMA4GA1UECwwHTm9kZVRlc3Qx
FDASBgNVBAMMC2xvY2FsaG9zdDEfMB0GCSqGSIb3DQEJARYQdGVzdEBleGFtcGxl
LmNvbTCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEAu1SU1LfVLPHCgWsYZv/E
PJVS5sknZY/C9ZSkFLVO1CsuLNXCCCptp6sCUN22aZOCzYk+JdKSYh/9bF6vxaa2
FDjmc1BiiqfDOCuzeZVfIyIeR6tMCoRdZWI1lod7+2MymcY0/CfS+zBASkAdCiey
oySdZNsCd3VNy+aPUfQnn2ECAwEAATANBgkqhkiG9w0BAQsFAAOBgQBuEdFdBfov
nNpuD0PKPB5OIeVea/FfWeKOzPrz3d1eM+Su3/B9Y+mvc929ktZBdL9mdyuIuVe5
Ni9WvXNytT/ZtleoeAPI9M9WOnuFObdm+1fZN3/C9J9j+au7/VNWvHNhepN1tp+C
+zPIdQ==
-----END CERTIFICATE-----`;

/** Self-signed key for SSL */
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

/**
 * Get public IP address
 * 
 * @returns {string} Public IP address
 */
export const getPublicIP = () => {
  try {
    return fetch("https://api.ipify.org")
      .then((response) => response.text())
      .then((ip) => ip.trim());
  }
  catch (error) {
    console.error(`❌  Error fetching public IP:`, error);
    return "127.0.0.1";
  }
};

/**
 * Get local IP address
 * 
 * @returns {string} Local IP address
 */
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

/**
 * Shuffle values in an array using Fisher-Yates algorithm
 * 
 * @param {array} array 
 * @returns {array}
 */
export const shuffleValues = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Create a range of numbers
 * 
 * @param {number} from 
 * @param {number} to 
 * @param {boolean} shuffled 
 * @returns {array}
 */
export const createRange = (
  from, 
  to, 
  shuffle = false
) => {
  //const range = [];
  //for (let i = from; i <= to; i++) range.push(i);
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return shuffle ? shuffleValues(range) : range;
};

/**
 * Get a random available port assigned by the system (no race condition)
 * 
 * @param {string} host
 * @returns {Promise<number>}
 */
export const getRandomAvailablePort = async (host = "0.0.0.0") => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.listen(0, host, () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

/**
 * Check if a port is available on the specified host
 * 
 * @param {number} port
 * @param {string} host
 * @returns {Promise<boolean>}
 */
export const isPortAvailable = async (
  port, 
  host = "0.0.0.0"
) => new Promise((resolve) => {
  const server = net.createServer();
  server.unref();
  server.on("error", () => resolve(false));
  server.listen(port, host, () => {
    server.close(() => resolve(true));
  });
});

/**
 * Get available port(s) on specified host within provided range
 * 
 * @param {number} from
 * @param {number} to
 * @param {number} limit
 * @param {boolean} random
 * @param {string} host
 * @returns {Promise<number | number[]>}
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
  return 1 === ports.length ? ports[0] : ports;
};

/** WebSocket implementation for Node.js 14+ */
class SimpleWebSocket {
  /**
   * Constructor
   * 
   * @param {http.Server} server
   */
  constructor(server) {
    this.clients = new Set();
    this.server = server;
    this.setupWebSocketHandling();
  }

  /**
   * Setup WebSocket handling
   */
  setupWebSocketHandling() {
    this.server.on('upgrade', (request, socket, head) => {
      const key = request.headers['sec-websocket-key'];
      if (!key) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }

      const acceptKey = this.generateAcceptKey(key);
      const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '\r\n'
      ].join('\r\n');

      socket.write(responseHeaders);
      this.clients.add(socket);

      console.log(`📡  New subscriber connected to ${this.server.protocol}://${this.server.host}:${this.server.port}`);

      socket.on('close', () => {
        console.log(`👋  Subscriber disconnected from ${this.server.protocol}://${this.server.host}:${this.server.port}`);
        this.clients.delete(socket);
      });

      socket.on('error', () => {
        console.log(`🚨  Error occurred while handling WebSocket connection...`);
        this.clients.delete(socket);
      });
    });
  }

  /**
   * Generate WebSocket accept key
   * 
   * @param {string} key 
   * @returns {string}
   */
  generateAcceptKey(key) {
    const magicString = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    return crypto
      .createHash('sha1')
      .update(key + magicString)
      .digest('base64');
  }

  /**
   * Broadcast message to all connected clients
   * 
   * @param {string} message 
   */
  broadcast(message) {
    console.log(`🛰️  Broadcasting message: ${message}`);
    const frame = this.createFrame(message);
    this.clients.forEach(client => {
      if (client.readyState === 'open' || !client.destroyed) {
        try {
          client.write(frame);
        } catch (error) {
          this.clients.delete(client);
        }
      }
    });
  }

  /**
   * Create WebSocket frame
   * 
   * @param {string} message 
   * @returns {string}
   */
  createFrame(message) {
    const payload = Buffer.from(message, 'utf8');
    const payloadLength = payload.length;
    
    let frame;
    if (payloadLength < 126) {
      frame = Buffer.allocUnsafe(2 + payloadLength);
      frame[0] = 0x81; // FIN + text frame
      frame[1] = payloadLength;
      payload.copy(frame, 2);
    } else if (payloadLength < 65536) {
      frame = Buffer.allocUnsafe(4 + payloadLength);
      frame[0] = 0x81;
      frame[1] = 126;
      frame.writeUInt16BE(payloadLength, 2);
      payload.copy(frame, 4);
    } else {
      frame = Buffer.allocUnsafe(10 + payloadLength);
      frame[0] = 0x81;
      frame[1] = 127;
      frame.writeUInt32BE(0, 2);
      frame.writeUInt32BE(payloadLength, 6);
      payload.copy(frame, 10);
    }
    
    return frame;
  }
}

/** Main server class */
class StaticServer {
  /**
   * Constructor
   */
  constructor() {
    this.config = {};
    this.watcher = null;
    this.server = null;
    this.wsServer = null;
    this.webSocket = null;
  }

  /**
   * Setup
   */
  async init() {
    this.parseArguments();
    
    if (this.config.help) {
      this.showHelp();
      process.exit(0);
      return;
    }

    await this.validateDirectory();
    await this.setupPorts();
    await this.setupSSL();
    this.setupFileWatcher();
    await this.startServers();
    this.showServerInfo();
    this.setupGracefulShutdown();
  }

  /**
   * Parse command-line arguments
   */
  parseArguments(defaults = DEFAULT_CONFIG) {
    const args = process.argv.slice(2);
    const config = {};
    for(let x = 0; x < args.length; x++) {
      switch (args[x]) {
        case "--help":
        case "-h":
          config.help = true;
          break;
        case "--host":
        case "-H":
          config.host = args[++x] || defaults.host;
          break;
        case "--port":
        case "-p":
          config.port = parseInt(args[++x]) || defaults.port;
          break;
        case "--https":
        case "-s":
          config.https = true;
          break;
        case "--cert":
          config.cert = args[++x] || defaults.cert;
          break;
        case "--key":
          config.key = args[++x] || defaults.key;
          break;
        case "--watch":
        case "-w":
          config.watch = true;
          break;
        default:
          if (!args[x].startsWith("-") && !config.dir) {
            config.dir = args[x];
          }
          break;
      }
    }
    this.config = { ...defaults, ...config };
  }

  /**
   * Show help message
   */
  showHelp() {
    console.log(`
🚀  Hyper Server v${VERSION}
  Static web server with Live-Reload and HTTPS support optimized for Node.js v14.21.3

USAGE:
  server.js <directory> [options]

ARGUMENTS:
  <directory>         Directory to serve static content from (default: '${DEFAULT_CONFIG.DIR}')

OPTIONS:
  --host, -H <host>   Host to bind to (default: '${DEFAULT_CONFIG.host}')
  --port, -p <port>   Port to listen on (default: '${DEFAULT_CONFIG.port}')
  --https, -s         Enable HTTPS (default: '${DEFAULT_CONFIG.https}')
  --cert, -c <path>   Path to SSL certificate file (default: '${DEFAULT_CONFIG.cert}')
  --key, -k <path>    Path to SSL private key file (default: '${DEFAULT_CONFIG.key}')
  --watch, -w         Watch for file changes and live-reload (default: ${DEFAULT_CONFIG.watch})
  --open, -o          Open browser after starting the server (default: ${DEFAULT_CONFIG.open})
  --help, -h          Prints this help message

EXAMPLES:
  server.js --https --watch           # Enable HTTPS, Live-Reload and listen to random port
  server.js -H localhost -p 3000      # Serve current working directory on localhost:3000
  server.js ./dist --port 8080        # Serve ./dist on port 8080
  server.js ./public --host 0.0.0.0   # Serve on all interfaces

NOTES:
  * When --https is used without --cert and --key, self-signed certificate will be created
  * Generated certificates are saved in the current working directory
  * Live-Reload injects a client script into HTML files automatically
`);
  }

  /**
   * Validate serve directory
   */
  async validateDirectory() {
    try {
      await access(this.config.dir);
      const stats = await stat(this.config.dir);
      if (!stats.isDirectory()) {
        console.error(`❌  Error: "${this.config.dir}" is not a directory`);
        this.showHelp();
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌  Error: Directory "${this.config.dir}" does not exist`);
      this.showHelp();
      process.exit(1);
    }
  }

  /**
   * Setup server ports
   */
  async setupPorts() {
    if (this.config.port) {
      this.config.wsPort = await getAvailablePorts(this.config.port + 1, 9000, 1);
    } 
    else {
      const [port, wsPort] = await getAvailablePorts(3000, 9000, 2);
      this.config.port = port;
      this.config.wsPort = wsPort;
    }
  }
  
  async setupSSL() {
    if (!this.config.https) return;

    const certPath = path.resolve( this.config.cert || "./server.crt" );
    const keyPath = path.resolve( this.config.key || "./server.key" );
    
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      await this.createBasicCertificate();
    }
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      this.config.tlsOptions = {
        cert: await readFile(certPath),
        key: await readFile(keyPath),
      };
      console.log(`🔒  Using SSL certificate: ${certPath}`);
    } else {
      console.error("❌  SSL certificates not found and generation failed...");
      process.exit(1);
    }
  }

  async generateSelfSignedCert() {
    console.log("🔐  Generating self-signed SSL certificate...");
    
    return new Promise((resolve, reject) => {
      const openssl = spawn('openssl', [
        'req', '-x509', '-newkey', 'rsa:2048', 
        '-keyout', 'server.key', '-out', 'server.crt', 
        '-days', '365', '-nodes', '-subj', 
        `/C=US/ST=Dev/L=Local/O=NodeServer/CN=${this.config.host}`
      ]);
      
      openssl.on('close', (code) => {
        if (code === 0) {
          console.log("✅  Self-signed certificate generated (server.crt, server.key)");
          resolve();
        } else {
          // Fallback: create basic certificate
          this.createBasicCertificate().then(resolve).catch(reject);
        }
      });
      
      openssl.on('error', () => {
        this.createBasicCertificate().then(resolve).catch(reject);
      });
    });
  }

  async createBasicCertificate() {
    console.log("⚠️  OpenSSL not available, creating basic certificate...");
    
    const certContent = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQCKz8+8GGKbPDANBgkqhkiG9w0BAQsFADCBjDELMAkGA1UEBhMC
VVMxCzAJBgNVBAgMAlRYMQ8wDQYDVQQHDAZBdXN0aW4xEDAOBgNVBAoMB05vZGVU
ZXN0MRAwDgYDVQQLDAdOb2RlVGVzdDEUMBIGA1UEAwwLbG9jYWxob3N0MR8wHQYJ
KoZIhvcNAQkBFhB0ZXN0QGV4YW1wbGUuY29tMB4XDTI0MDEwMTAwMDAwMFoXDTI1
MDEwMTAwMDAwMFowgYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJUWDEPMA0GA1UE
BwwGQXVzdGluMRAwDgYDVQQKDAdOb2RlVGVzdDEQMA4GA1UECwwHTm9kZVRlc3Qx
FDASBgNVBAMMC2xvY2FsaG9zdDEfMB0GCSqGSIb3DQEJARYQdGVzdEBleGFtcGxl
LmNvbTCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEAu1SU1LfVLPHCgWsYZv/E
PJVS5sknZY/C9ZSkFLVO1CsuLNXCCCptp6sCUN22aZOCzYk+JdKSYh/9bF6vxaa2
FDjmc1BiiqfDOCuzeZVfIyIeR6tMCoRdZWI1lod7+2MymcY0/CfS+zBASkAdCiey
oySdZNsCd3VNy+aPUfQnn2ECAwEAATANBgkqhkiG9w0BAQsFAAOBgQBuEdFdBfov
nNpuD0PKPB5OIeVea/FfWeKOzPrz3d1eM+Su3/B9Y+mvc929ktZBdL9mdyuIuVe5
Ni9WvXNytT/ZtleoeAPI9M9WOnuFObdm+1fZN3/C9J9j+au7/VNWvHNhepN1tp+C
+zPIdQ==
-----END CERTIFICATE-----`;

    const keyContent = `-----BEGIN PRIVATE KEY-----
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

    await writeFile("server.crt", certContent);
    await writeFile("server.key", keyContent);
    
    console.log("✅  Basic certificate created (server.crt, server.key)");
  }

  setupFileWatcher() {
    if (!this.config.watch) return;

    console.log(`👀  Watching ${this.config.dir} for changes...`);
    
    this.watcher = fs.watch(this.config.dir, { recursive: true }, (eventType, filename) => {
      if (filename) {
        console.log(`📝  File ${eventType}: ${filename}`);
        if (this.webSocket) {
          this.webSocket.broadcast('reload');
        }
      }
    });
  }

  async startServers() {
    await this.startMainServer();
    if (this.config.watch) {
      await this.startWebSocketServer();
    }
  }

  async startMainServer() {
    const serverModule = this.config.https ? https : http;
    const options = this.config.https ? this.config.tlsOptions : {};
    
    this.server = serverModule.createServer(options, (req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  async startWebSocketServer() {
    const serverModule = this.config.https ? https : http;
    const options = this.config.https ? this.config.tlsOptions : {};
    
    this.wsServer = serverModule.createServer(options);
    this.webSocket = new SimpleWebSocket(this.wsServer);

    return new Promise((resolve, reject) => {
      this.wsServer.listen(this.config.wsPort, this.config.host, () => {
        console.log(`📡  Live-Reload WebSocket server running on: ${this.config.https ? 'wss' : 'ws'}://${this.config.host}:${this.config.wsPort}`);
        resolve();
      });
      this.wsServer.on('error', reject);
    });
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `${this.server.protocol}://${req.headers.host}`);
    let pathname = url.pathname;
    console.log(`📄  [${req.method}] ${pathname}`);
    
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.join(this.config.dir, pathname.slice(1));
    
    try {
      await access(filePath);
      const stats = await stat(filePath);
      
      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, "index.html");
        try {
          await access(indexPath);
          return this.serveFile(indexPath, res);
        } catch {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('403 - Forbidden');
          return;
        }
      }
      
      return this.serveFile(filePath, res);
      
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 - File Not Found');
    }
  }

  async serveFile(filePath, res) {
    const mimeType = this.getMimeType(filePath);

    try {
      let fileContent = await readFile(filePath);
      
      // Inject live reload script into HTML files
      if (this.config.watch && ext === ".html") {
        let htmlContent = fileContent.toString();
        const liveReloadScript = this.getLiveReloadScript();
        
        if (htmlContent.includes("</body>")) {
          htmlContent = htmlContent.replace("</body>", `${liveReloadScript}</body>`);
        } else {
          htmlContent += liveReloadScript;
        }
        
        fileContent = Buffer.from(htmlContent);
      }
      
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache',
        'Content-Length': fileContent.length
      });
      res.end(fileContent);
      
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 - Internal Server Error');
    }
  }

  getMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return MIME_TYPES[extension] || "application/octet-stream";
  }

  getLiveReloadScript() {
    return `
<script>
(() {
  const ws = new WebSocket("${this.config.https ? 'wss' : 'ws'}://${this.config.host}:${this.config.wsPort}");
  ws.addEventListener("message", event => {
    console.log("🔄  File changed, reloading...");
    window.location.reload();
  });
  ws.addEventListener("open", () => {
    console.log("📡  Live-Reload connected");
  });
  ws.addEventListener("error", () => {
    console.error("❌  Live-Reload connection failed");
  });
})();
</script>
`;
  }

  async showServerInfo() {
    const protocol = this.config.https ? "https" : "http";
    
    console.log(`
🚀  Hyper Server started!

📁  Serving: ${path.resolve(this.config.dir)}
📡  Live-Reload: ${this.config.watch ? `${this.config.https ? "wss" : "ws"}://${this.config.host}:${this.config.wsPort}/` : "disabled"}
`);

    if (this.config.watch) {
      console.log(`👀  Live-Reload: enabled`);
    }

    if (this.config.https) {
      console.log(`🔒  HTTPS: enabled`);
    }

    if (this.config.host === "0.0.0.0") {
      console.log(`🔗  ${protocol}://localhost:${this.config.port}/`);
      console.log(`🔗  ${protocol}://${getLocalIP()}:${this.config.port}/`);
      console.log(`🔗  ${protocol}://${await getPublicIP()}:${this.config.port}/`);
    }
    else {
      console.log(`🔗  ${protocol}://${this.config.host}:${this.config.port}/`);
    }

    console.log(`
⌨️  Press Ctrl+C to stop the server
`);

  }

  setupGracefulShutdown() {
    process.on("SIGINT", () => {
      console.log("\n👋  Shutting down server...");
      
      if (this.watcher) {
        this.watcher.close();
      }
      
      if (this.server) {
        this.server.close();
      }
      
      if (this.wsServer) {
        this.wsServer.close();
      }
      
      process.exit(0);
    });
  }
}

// Start the server (wrapped in async function for Node.js 14 compatibility)
(async () => {
  try {
    const server = new StaticServer();
    await server.init();
  } catch (error) {
    console.error('❌  Failed to start server:', error.message);
    process.exit(1);
  }
})();