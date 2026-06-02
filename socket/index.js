import { Server } from "socket.io";

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  return io;
};

export const getIO = () => io;
