const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const net = require('net');

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    acc[key.replace(/^--/, '')] = value === undefined ? true : value;
    return acc;
}, {});

const WWW_ROOT = args.dir || process.cwd();
const PORT = parseInt(args.port, 10) || 8080;
const WS_PORT = parseInt(args['web-socket-port'], 10) || 8081;
const USE_HTTPS = args.https;
const CERT_FILE = args.cert;
const KEY_FILE = args.key;
const WATCH_ENABLED = args.watch;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const isPortAvailable = (port, host = "0.0.0.0") => {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                reject(err);
            } else {
                reject(err);
            }
        });
        server.listen({ port, host }, () => {
            const { port } = server.address();
            server.close(() => {
                resolve(port);
            });
        });
    });
};

const findAvailablePort = async (startPort, host) => {
    let port = startPort;
    while (true) {
        try {
            await isPortAvailable(port, host);
            return port;
        } catch (error) {
            if (error.code !== 'EADDRINUSE') {
                throw error;
            }
            port++;
        }
    }
};

const generateCertificates = () => {
    const certPath = path.join(process.cwd(), 'server.crt');
    const keyPath = path.join(process.cwd(), 'server.key');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        console.log('Certificates already exist.');
        return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
    }

    try {
        execSync('openssl version', { stdio: 'ignore' });
    } catch (e) {
        console.error('OpenSSL is not installed. Cannot generate certificates.');
        console.error('Please install OpenSSL or provide certificate with --cert and --key options.');
        process.exit(1);
    }

    console.log('Generating self-signed certificates...');
    try {
        execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -subj "/C=US/ST=CA/L=SF/O=Dev/CN=localhost"`, { stdio: 'ignore' });
        console.log(`Certificates generated at ${keyPath} and ${certPath}`);
        return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
    } catch (error) {
        console.error('Failed to generate certificates:', error.message);
        process.exit(1);
    }
};

let wsConnections = [];
const createWebSocketServer = (server) => {
    server.on('upgrade', (req, socket, head) => {
        const key = req.headers['sec-websocket-key'];
        const hash = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
        
        socket.write('HTTP/1.1 101 Switching Protocols\\r\\n' +
                     'Upgrade: websocket\\r\\n' +
                     'Connection: Upgrade\\r\\n' +
                     `Sec-WebSocket-Accept: ${hash}\\r\\n` +
                     '\\r\\n');
        
        wsConnections.push(socket);
        socket.on('close', () => {
            wsConnections = wsConnections.filter(s => s !== socket);
        });
        socket.on('error', (err) => {
            console.error('Socket error:', err);
            wsConnections = wsConnections.filter(s => s !== socket);
        });
    });
};

const broadcastReload = () => {
    wsConnections.forEach(socket => {
        if (socket.writable) {
            const message = 'reload';
            const length = Buffer.byteLength(message);
            const buffer = Buffer.alloc(2 + length);
            buffer[0] = 0x81; // FIN + text frame
            buffer[1] = length;
            buffer.write(message, 2);
            socket.write(buffer);
        }
    });
};

const getLiveReloadScript = (port) => `
    <script>
      const ws = new WebSocket(\`ws\${location.protocol === 'https:' ? 's' : ''}://\${location.hostname}:${port}\`);
      ws.onmessage = (event) => {
        if (event.data === 'reload') {
          location.reload();
        }
      };
      ws.onclose = () => {
        console.log('Live-reload socket closed. Trying to reconnect in 1s...');
        setTimeout(() => {
            // location.reload(); // Optional: force reload on disconnect
        }, 1000);
      };
    </script>
`;

const startServer = async () => {
    try {
        const availablePort = await findAvailablePort(PORT, '0.0.0.0');
        if (availablePort !== PORT) {
            console.log(`Port ${PORT} is busy, using ${availablePort} instead.`);
        }

        let liveReloadScript = '';
        let actualWsPort = WS_PORT;

        if (WATCH_ENABLED) {
            actualWsPort = await findAvailablePort(WS_PORT, '0.0.0.0');
            if (actualWsPort !== WS_PORT) {
                console.log(`WebSocket port ${WS_PORT} is busy, using ${actualWsPort} instead.`);
            }
            liveReloadScript = getLiveReloadScript(actualWsPort);
        }

        const requestListener = (req, res) => {
            console.log(`${req.method} ${req.url}`);
        
            const urlPath = req.url === '/' ? 'index.html' : req.url;
            let filePath = path.join(WWW_ROOT, path.normalize(urlPath).replace(/^(\\..[\\/])/, ''));
        
            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                filePath = path.join(WWW_ROOT, 'index.html');
            }

            const extname = String(path.extname(filePath)).toLowerCase();
            const contentType = MIME_TYPES[extname] || 'application/octet-stream';
        
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<h1>404 Not Found</h1><p>The requested file was not found on this server.</p>', 'utf-8');
                    } else {
                        res.writeHead(500);
                        res.end(`Sorry, check with the site admin for error: ${err.code} ..\\n`);
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    if (WATCH_ENABLED && contentType === 'text/html') {
                        res.end(content.toString() + liveReloadScript, 'utf-8');
                    } else {
                        res.end(content, 'utf-8');
                    }
                }
            });
        };

        let server;
        if (USE_HTTPS) {
            let options = {};
            if (CERT_FILE && KEY_FILE) {
                try {
                    options.key = fs.readFileSync(KEY_FILE);
                    options.cert = fs.readFileSync(CERT_FILE);
                } catch (e) {
                    console.error(`Could not read certificate or key file: ${e.message}`);
                    process.exit(1);
                }
            } else {
                options = generateCertificates();
            }
            server = https.createServer(options, requestListener);
        } else {
            server = http.createServer(requestListener);
        }

        server.listen(availablePort, '0.0.0.0', () => {
            console.log(`Server is running at http${USE_HTTPS ? 's' : ''}://localhost:${availablePort}`);
            console.log(`Serving files from ${WWW_ROOT}`);
        });

        if (WATCH_ENABLED) {
            const wsServer = USE_HTTPS ? https.createServer(server.key, server.cert) : http.createServer();
            createWebSocketServer(wsServer);
            wsServer.listen(actualWsPort, '0.0.0.0', () => {
                console.log(`WebSocket server for live-reload is running on ws${USE_HTTPS ? 's' : ''}://localhost:${actualWsPort}`);
            });

            fs.watch(WWW_ROOT, { recursive: true }, (eventType, filename) => {
                if (filename) {
                    console.log(`File change detected: ${filename}. Sending reload signal.`);
                    broadcastReload();
                }
            });
        }
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();
