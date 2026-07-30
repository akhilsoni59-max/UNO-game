import { io, Socket } from "socket.io-client";

const URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

export const socket: Socket = io(URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
