import { serve } from "bun";
import { readFileSync } from "fs";
import { join } from "path";

// Define the directory where your static files are located
const staticDir = join(process.cwd(), "public");

// SSL certificate and key paths
const sslOptions = {
  cert: readFileSync("path/to/your/certificate.crt", "utf8"),
  key: readFileSync("path/to/your/private.key", "utf8")
};

serve({
  fetch(req) {
    // Construct the file path
    const url = new URL(req.url);
    let filePath = join(staticDir, url.pathname);

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

  // Add the SSL options to enable HTTPS
  ...sslOptions,

  // Specify the port to listen on
  port: 443, // Default HTTPS port
});

console.log(`Server running at https://localhost:${sslOptions.port}`);
