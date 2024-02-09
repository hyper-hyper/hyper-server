import { file, FileSystemRouter, type Server } from "bun";
import { join } from "path";
import { statSync } from "fs";

const RELOAD_CMD = "/hot";

export function renderIndexHtml(): string {
  return `
    <html>
      <head>
        <title>...</title>
      </head>
      <body>
        <main>...</main>
        <script type="module" src="./main.ts"></script>
      </body>
    </html>
  `;
};

export default {
  async fetch(request: Request, server: Server): Promise<Response> {
    if(request.url.endsWith(RELOAD_CMD)) {
      if(server.upgrade(request)) {
        return new Response(`${RELOAD_CMD}`,{status: 101});
      }
    }
    if(request.url.endsWith("/")) {
      return new Response(renderIndexHtml(), {headers:{ "Content-Type": "text/html" }});
    }
    const filePath = join("./src", new URL(request.url).pathname);
    try {
      if(statSync(filePath)?.isFile()) {
        const staticFile = file(filePath);
        return new Response(staticFile, {headers:{ "Content-Type": staticFile.type }});
      }
    }
    catch(error) {}
    return new Response("Not found",{status: 404});
  },
  port: 8000
} as Server;
