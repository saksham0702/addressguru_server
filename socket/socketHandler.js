import User from "../model/userSchema.js";

export const registerSocketEvents = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket Connected:", socket.id);

    socket.on("user-online", async (userId) => {
      socket.userId = userId;
      console.log("USER ONLINE EVENT", userId);
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: null,
      });

      io.emit("user-status-changed", {
        userId,
        isOnline: true,
        lastSeen: null,
      });
    });

    socket.on("disconnect", async () => {
      if (!socket.userId) return;

      const lastSeen = new Date();

      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen,
      });

      io.emit("user-status-changed", {
        userId: socket.userId,
        isOnline: false,
        lastSeen,
      });
    });
  });
};
