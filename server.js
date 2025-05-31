require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const channelRoutes = require("./routes/channelRoutes");
const Message = require("./models/Message");
const User = require("./models/User");
const Channel = require("./models/Channel");
const jwt = require("jsonwebtoken");
const winston = require("winston"); // For logging

// --- Basic Setup ---
const app = express();
const server = http.createServer(app);

// --- Database Connection ---
connectDB();

// --- Logging Setup ---
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// --- Middleware ---
// Configure CORS - Make this more restrictive in production!
app.use(cors({ origin: "*" })); // Allow all origins for now
app.use(express.json()); // Body parser for JSON requests

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes); // Channel management API

app.get("/", (req, res) => {
  res.send("VoIP Backend API Running");
});

// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"],
  },
});

// Socket.IO Authentication Middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logger.warn("Socket connection attempt without token");
    return next(new Error("Authentication error: No token provided"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach user info to the socket object
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      logger.warn(`Socket connection attempt with invalid token (user not found): ${decoded.id}`);
      return next(new Error("Authentication error: User not found"));
    }
    socket.user = user;
    logger.info(`Socket authenticated for user: ${user.username} (${socket.id})`);
    next();
  } catch (err) {
    logger.error(`Socket authentication error: ${err.message}`);
    next(new Error("Authentication error: Invalid token"));
  }
});

// --- Socket.IO Event Handling ---
io.on("connection", (socket) => {
  logger.info(`User connected: ${socket.user.username} (${socket.id})`);

  // Join Channel Event
  socket.on("join_channel", async ({ channelId }, callback) => {
    try {
      const channel = await Channel.findById(channelId);
      if (!channel) {
        return callback({ status: "error", message: "Channel not found" });
      }
      // Check if user is a member (redundant if API enforces this, but good practice)
      if (!channel.members.some(memberId => memberId.equals(socket.user._id))) {
         // Optionally add the user if they aren't a member via socket?
         // Or just deny joining the socket room.
         // For now, assume API handles membership, just join the socket room.
         // await channel.updateOne({ $addToSet: { members: socket.user._id } }); // Example if adding member here
         logger.warn(`User ${socket.user.username} tried to join socket room for channel ${channelId} they are not a member of.`);
         // return callback({ status: "error", message: "Not a member of this channel" });
      }

      socket.join(channelId);
      logger.info(`User ${socket.user.username} joined channel room: ${channelId}`);

      // Notify others in the room (optional)
      // socket.to(channelId).emit("user_joined", { userId: socket.user._id, username: socket.user.username });

      // Send message history (implementing step 4.6 here)
      const messages = await Message.find({ channel: channelId })
        .populate("sender", "username")
        .sort({ timestamp: -1 })
        .limit(50); // Limit history size

      callback({ status: "ok", messages: messages.reverse() }); // Send history back to the joining user

    } catch (error) {
      logger.error(`Error joining channel ${channelId} for user ${socket.user.username}: ${error.message}`);
      callback({ status: "error", message: "Server error joining channel" });
    }
  });

  // Send Message Event
  socket.on("send_message", async ({ channelId, content }, callback) => {
    if (!content || !channelId) {
      return callback({ status: "error", message: "Missing channelId or content" });
    }
    try {
      // Verify user is actually in the channel they are sending to (optional, belt-and-suspenders)
      const channel = await Channel.findById(channelId);
      if (!channel || !channel.members.some(memberId => memberId.equals(socket.user._id))) {
          logger.warn(`User ${socket.user.username} attempted to send message to channel ${channelId} they are not part of.`);
          return callback({ status: "error", message: "Cannot send message to this channel" });
      }

      // Create and save the message
      const message = new Message({
        channel: channelId,
        sender: socket.user._id,
        content: content,
      });
      await message.save();

      // Populate sender info before broadcasting
      const populatedMessage = await Message.findById(message._id).populate("sender", "username");

      // Broadcast the message to the channel room
      io.to(channelId).emit("receive_message", populatedMessage);
      logger.info(`Message sent by ${socket.user.username} to channel ${channelId}`);
      callback({ status: "ok", message: populatedMessage }); // Acknowledge to sender

    } catch (error) {
      logger.error(`Error sending message to channel ${channelId} by user ${socket.user.username}: ${error.message}`);
      callback({ status: "error", message: "Server error sending message" });
    }
  });

  // WebRTC Signaling Event (Pass-through)
  socket.on("signal", ({ channelId, signalData }) => {
    // Simply broadcast the signal data to others in the same channel room
    // The client sending the signal should not receive it back.
    logger.info(`Relaying signal from ${socket.user.username} in channel ${channelId}`);
    socket.to(channelId).emit("signal", { userId: socket.user._id, signalData });
  });

  // Leave Channel Event
  socket.on("leave_channel", ({ channelId }) => {
    socket.leave(channelId);
    logger.info(`User ${socket.user.username} left channel room: ${channelId}`);
    // Notify others (optional)
    // socket.to(channelId).emit("user_left", { userId: socket.user._id, username: socket.user.username });
  });

  // Disconnect Event
  socket.on("disconnect", (reason) => {
    logger.info(`User disconnected: ${socket.user ? socket.user.username : 'Unknown'} (${socket.id}), Reason: ${reason}`);
    // Handle cleanup if necessary, e.g., notify rooms the user was in
  });

  // Error Handling
  socket.on("error", (err) => {
    logger.error(`Socket error for user ${socket.user ? socket.user.username : 'Unknown'} (${socket.id}): ${err.message}`);
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

