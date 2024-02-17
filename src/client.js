/** Client-Side Script (minimal) */
const socket = new WebSocket(`ws://${window.location.host}/hot`);
socket.addEventListener("message", event => window.location.reload());
