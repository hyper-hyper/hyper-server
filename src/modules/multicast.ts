import dgram from "node:dgram";
import { Buffer } from "node:buffer";

const MULTICAST_GROUP = "224.1.1.1";
const MULTICAST_PORT = 5004;
const DISCOVERY_MESSAGE = Buffer.from("Server Discovery Message");

class MulticastServer {
  private socket: dgram.Socket;

  constructor() {
    // Create a datagram socket
    this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    // Bind to the multicast port
    this.socket.bind(MULTICAST_PORT, () => {
      // Add socket to the multicast group
      this.socket.addMembership(MULTICAST_GROUP);
      console.log(`Joined multicast group ${MULTICAST_GROUP}`);
    });

    // Setup event listeners
    this.socket.on("message", (message, rinfo) => {
      this.onMessage(message, rinfo);
    });

    this.socket.on("error", (err) => {
      console.error(`Socket error:\n${err.stack}`);
      this.socket.close();
    });
  }

  private onMessage(message: Buffer, rinfo: dgram.RemoteInfo) {
    console.log(`Received ${message} from ${rinfo.address}:${rinfo.port}`);
  }

  public sendDiscoveryMessage() {
    this.socket.send(DISCOVERY_MESSAGE, 0, DISCOVERY_MESSAGE.length, MULTICAST_PORT, MULTICAST_GROUP, (err) => {
      if (err) {
        console.error(`Error sending discovery message: ${err}`);
      } else {
        console.log(`Discovery message sent to ${MULTICAST_GROUP}:${MULTICAST_PORT}`);
      }
    });
  }

  public start() {
    // Periodically send discovery messages
    setInterval(() => this.sendDiscoveryMessage, 5000);
  }
}

// Initialize and start the multicast server
const server = new MulticastServer();
server.start();