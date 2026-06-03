import User from "../model/userSchema.js";

export const registerSocketEvents = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket Connected:", socket.id);

    socket.on("user-online", async (userId) => {
      console.log("USER ONLINE EVENT", userId);
      socket.userId = userId;
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
      console.log("DISCONNECT CALLED", socket.userId);

      const userId = socket.userId;
      if (!userId) return; // keep it simple

      const lastSeen = new Date();

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen,
      });

      io.emit("user-status-changed", {
        userId,
        isOnline: false,
        lastSeen,
      });
    });
  });
};
