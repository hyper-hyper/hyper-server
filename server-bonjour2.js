/**
 * Hyper Server Reboot
 * 
 * Trying out self-discovery over TCP using Bonjour Protocol
 */
import { Bonjour } from "bonjour-service";
import { createServer } from "node:http";

// Create a simple web server
const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': "text/plain" });
  response.end("Hyper Hyper!");
});

// Grab a random available port
server.listen(8111, "0.0.0.0", () => {
  console.log("Started Web Server on:", server.address());
});

// Start up a Bonjour Service
const instance = new Bonjour();

// Advertise itself as "hyper-server"
instance.publish({
  name: "hyper-server",
  type: "http",
  port: 8110
});

// Lookup instances like self
instance.find({ type: "http" }, service => {
  console.log("Yey! Discovered service...", service);
  // ...
});
