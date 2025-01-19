/**
 * Hyper Server Reboot
 * 
 * Trying out self-discovery over TCP using Bonjour Protocol
 */
import os from "node:os";
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { Bonjour } from "bonjour-service";

/**
 * Get local IP address
 * @returns {String}
 */
const getLocalIP = () => {
  const list = os.networkInterfaces();
  for(const name in list) {
    const device = list[name];
    for(const info of device) {
      if(info.family === "IPv4" && !info.internal) {
        return info.address;
      }
    }
  }
  return false;
};

/**
 * Get random unused port between the givenn range
 * @param {Number} from
 * @param {Number} to
 * @returns {Number[]}
 */
const getUnusedPorts = (from = 3000, to = 65535, limit = null, shuffle = false) => {
  let cmd = "";
  switch(os.platform()) {
    case "darwin":
      cmd = `netstat -anv | grep LISTEN | awk '{print $4}' | cut -d'.' -f5 | sort -u`;
      break;
    case "win32":
      cmd = `netstat -ano | findstr LISTENING | awk '{print $2}' | cut -d':' -f2 | sort /unique`;
      break;
    case "linux":
      cmd = `ss -Htan | awk '{print $4}' | cut -d':' -f2 | sort -u`;
      break;
  }
  let unusedPorts = [];
  let count = 0;
  try {
    const usedPorts = execSync(cmd)
      .toString()
      .split("\n")
      .map(Number)
      .filter(Boolean);
    for(let port = from; port <= to; port++) {
      if (limit && count >= limit) {
        break;
      }
      if (!usedPorts.includes(port)) {
        unusedPorts.push(port);
        count++;
      }
    }
    if (shuffle) {
      const randomIndex = Math.floor(Math.random() * unusedPorts.length);
      return [unusedPorts[randomIndex]];
    }
  }
  catch (error) {
    console.error(error);
  }
  return unusedPorts;
};

/**
 * Get a random unused port between the given range
 * @param {Number} from 
 * @param {Number} to 
 * @returns {Number}
 */
const getRandomUnusedPort = (from = 3000, to = 65535) => {
  const ports = getUnusedPorts(from, to, 1, true);
  return ports.length && ports[0];
};

const HOSTNAME = "0.0.0.0";
const LOCAL_IP = getLocalIP();
const PORT = getRandomUnusedPort(3000, 9000);

// Create a simple web server
const server = createServer((request, response) => {
  console.log(`New request to the web server: ${request.url}`);
  response.writeHead(200, { 'Content-Type': "text/plain" });
  response.end("RAVERS GONNA RAVE!");
});

// Bind to a port and start listening
server.listen(PORT, HOSTNAME, () => {
  console.log(`Started Web Server on: ${"0.0.0.0" !== HOSTNAME ? HOSTNAME : LOCAL_IP}:${PORT}`);
});

// Start up a Bonjour Service
const bonjour = new Bonjour();

// Advertise itself as "hyper-server"
bonjour.publish({
  name: "hyper-server",
  type: "http",
  port: PORT,
  host: LOCAL_IP
});

// Lookup instances like self
bonjour.find({ type: "http" }, service => {
  console.log(`Discovered ${service.name} on: http://${service.host}:${service.port}`);
});
