import { serve } from "bun";
import { join } from "path";

// Define the directory where your static files are located
const PUBLIC_DIR = join(process.env.PUBLIC_DIR ?? process.cwd(), "src");

// Hot-reload  command
const RELOAD_CMD = "/hot";

// Start a server
const server = serve({
  fetch(request, server) {
    console.log(`${request.method} ${(new URL(request.url)).pathname}`);
    const url = new URL(request.url);
    if(url.pathname.endsWith(RELOAD_CMD)) {
      if(server.upgrade(request)) {
        return new Response(`${RELOAD_CMD}`, { status: 101 });
      }
      else {
        return new Response("Bad Request", { status: 400 });
      }
    }
    let filePath = join(PUBLIC_DIR, url.pathname);
    if (url.pathname.endsWith("/")) {
      filePath = join(filePath, "index.html");
    }
    try {
      const file = Bun.file(filePath);
      return new Response(file, {
        headers: { 
          "Content-Type": file.type
        }
      });
    }
    catch(error) {
      console.log("ERROR: ", error);
      if(ENOENT === error.code) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  websocket: {
    open: (ws) => {
      console.log("Client connected:", ws);
    },
    message: (ws, message) => {
      console.log("Client sent message", message);
      ws.send(message);
    },
    close: (ws) => {
      console.log("Client disconnected:", ws);
    },
  },

  // Hostname
  hostname: process.env.HOSTNAME ?? "0.0.0.0",

  // Port
  port: process.env.PORT ?? "8080",

  // Add the SSL options to enable HTTPS
  tls: {
    cert: process.env.SSL_CERT ?? "",
    key: process.env.SSL_KEY ?? ""
  }
});

console.log(`Server running at ${server.protocol}://localhost:${server.port}`);