/** 
 * Hyper Server Configuration File
 * 
 * If not exists or malformed, the hyper-server would use its defaults
 */

/** Service Name (this will be used for self-discovery) */
export const SERVICE_NAME = "hyper-hyper-hyper-server";

/** Mode, could be "production" or "development" (default) */
export const MODE = "development";

/** Path to the root folder to serve */
export const DOCUMENT_ROOT = ".";

/** The default hostname is 0.0.0.0 - to serve all network interfaces */
export const HOST = "0.0.0.0";

/** Port to listen for TCP connections */
export const PUBLIC_PORT = 8110;

/** WebSocket Port that is started in parallell for interal communications between the servers */
export const SOCKET_PORT = 9110;
