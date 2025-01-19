import net from "node:net";
import { Bonjour } from "bonjour-service";

export const bonjour = new Bonjour();

export const publishBonjourService = async (name, type, host, port) => {
  return new Promise((resolve, reject) => {
    const service = bonjour.publish(
      {
        name,
        type,
        host,
        port
      }, 
      error => {
        if (error) {
          reject(error);
        }
        else {
          resolve(service);
        }
      }
    );
  });
}