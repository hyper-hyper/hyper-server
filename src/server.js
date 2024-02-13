import { serve } from "bun";
import { join } from "path";

// Define the directory where your static files are located
const PUBLIC_DIR = join(process.env.PUBLIC_DIR ?? process.cwd(), "src");

// Hot-reload  command
const HOT_CMD = "/hot";

// Start a server
const server = serve({
  websocket: {
    open: (ws) => {
      console.log("Client connected");

    },
    message: (ws, message) => {
      console.log("Client sent message", message);

    },
    close: (ws) => {
      console.log("Client disconnected");
      
    },
  },

  fetch(request, server) {
    console.log(server);
    // URL
    const url = new URL(request.url);
    
    // Log request
    console.log(`${request.method} ${(new URL(request.url)).pathname} from ${(server.requestIP(request)).address}`);
    
    if (url.pathname.endsWith(HOT_CMD)) {
      const upgraded = server.upgrade(request);
      if (!upgraded) {
        return new Response("Upgrade failed", { status: 400 });
      }
    }

    // Construct the file path
    let filePath = join(PUBLIC_DIR, url.pathname);
    
    // Default to index.html if the request is for a directory
    if (url.pathname.endsWith("/")) {
      filePath = join(filePath, "index.html");
    }

    try {
      // Read the file from the file system
      const file = Bun.file(filePath);

      // Return the file contents
      return new Response(file, {
        headers: {
          "Content-Type": file.type,
        },
      });
    } catch (error) {
      // If the file is not found, return a 404 response
      if (error.code === "ENOENT") {
        return new Response("Not Found", { status: 404 });
      }

      // For any other errors, return a 500 response
      return new Response("Internal Server Error", { status: 500 });
    }
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