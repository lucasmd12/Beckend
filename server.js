require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const channelRoutes = require("./routes/channelRoutes");
const userRoutes = require("./routes/userRoutes");
const Message = require("./models/Message");
const User = require("./models/User");
const Channel = require("./models/Channel");
const jwt = require("jsonwebtoken");
const winston = require("winston");
const errorHandler = require("./middleware/errorMiddleware");
// Removed listEndpoints import

// --- Basic Setup ---
const app = express();
app.set(	"trust proxy"	, 1);
const server = http.createServer(app);

// --- Database Connection ---
connectDB();

// --- Logging Setup ---
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}
const fs = require(	"fs"	);
const logDir = 	"logs"	;
if (!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

// --- Security Middleware ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5000",
  "http://localhost",
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many login/register attempts from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use(express.json());

// --- Serve Uploaded Files Staticly ---
app.use(	"/uploads"	, express.static(	"uploads"	));

// --- API Routes ---
logger.info("Registering /api/auth routes...");
app.use("/api/auth", authRoutes);
logger.info("Registering /api/channels routes...");
app.use("/api/channels", channelRoutes);
logger.info("Registering /api routes (userRoutes)...");
app.use("/api", userRoutes); // Routes for users, including upload and clan members

app.get("/", (req, res) => {
  res.send("FEDERACAOMAD Backend API Running");
});

// Removed endpoint listing code

// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logger.warn("Socket connection attempt without token", { socketId: socket.id });
    return next(new Error("Authentication error: No token provided"));
  }
  try {
    if (!process.env.JWT_SECRET) {
        logger.error("JWT_SECRET is not defined in environment variables.");
        return next(new Error("Server configuration error: Missing JWT secret."));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      logger.warn(`Socket connection attempt with invalid token (user not found)`, { userId: decoded.id, socketId: socket.id });
      return next(new Error("Authentication error: User not found"));
    }
    socket.user = user;
    await User.findByIdAndUpdate(user._id, { online: true, ultimaAtividade: new Date() });
    logger.info(`Socket authenticated & user marked online`, { username: user.username, socketId: socket.id });
    next();
  } catch (err) {
    logger.error(`Socket authentication error: ${err.message}`, { tokenProvided: !!token, socketId: socket.id });
    if (err.name === 	"JsonWebTokenError"	 || err.name === 	"TokenExpiredError"	) {
        return next(new Error("Authentication error: Invalid or expired token"));
    } else {
        return next(new Error("Authentication error: Could not verify token"));
    }
  }
});

io.on("connection", (socket) => {
  logger.info(`User connected`, { username: socket.user.username, socketId: socket.id });

  socket.on("join_channel", async ({ channelId }, callback) => {
    try {
      if (!channelId) {
          return callback({ status: "error", message: "Channel ID is required" });
      }
      const channel = await Channel.findById(channelId);
      if (!channel) {
        logger.warn(`User tried to join non-existent channel`, { username: socket.user.username, channelId, socketId: socket.id });
        return callback({ status: "error", message: "Channel not found" });
      }
      if (!channel.members.some(memberId => memberId.equals(socket.user._id))) {
         logger.warn(`Unauthorized attempt to join channel socket room`, { username: socket.user.username, channelId, socketId: socket.id });
         return callback({ status: "error", message: "Not authorized to join this channel" });
      }
      socket.join(channelId);
      logger.info(`User joined channel room`, { username: socket.user.username, channelId, socketId: socket.id });
      const messages = await Message.find({ channel: channelId })
        .populate("sender", "username avatar")
        .sort({ timestamp: -1 })
        .limit(50);
      callback({ status: "ok", messages: messages.reverse() });
      await User.findByIdAndUpdate(socket.user._id, { ultimaAtividade: new Date() });
    } catch (error) {
      logger.error(`Error joining channel`, { username: socket.user.username, channelId, error: error.message, stack: error.stack, socketId: socket.id });
      callback({ status: "error", message: "Server error joining channel" });
    }
  });

  socket.on("send_message", async ({ channelId, content }, callback) => {
    if (!content || !channelId) {
      logger.warn(`Send message attempt with missing data`, { username: socket.user.username, channelId: !!channelId, content: !!content, socketId: socket.id });
      return callback({ status: "error", message: "Missing channelId or content" });
    }
    try {
      const channel = await Channel.findById(channelId);
      if (!channel || !channel.members.some(memberId => memberId.equals(socket.user._id))) {
          logger.warn(`Unauthorized attempt to send message to channel`, { username: socket.user.username, channelId, socketId: socket.id });
          return callback({ status: "error", message: "Cannot send message to this channel" });
      }
      const message = new Message({
        channel: channelId,
        sender: socket.user._id,
        content: content.trim(),
      });
      await message.save();
      const populatedMessage = await Message.findById(message._id).populate("sender", "username avatar");
      io.to(channelId).emit("receive_message", populatedMessage);
      logger.info(`Message sent`, { username: socket.user.username, channelId, socketId: socket.id });
      callback({ status: "ok", message: populatedMessage });
      await User.findByIdAndUpdate(socket.user._id, { ultimaAtividade: new Date() });
    } catch (error) {
      logger.error(`Error sending message`, { username: socket.user.username, channelId, error: error.message, stack: error.stack, socketId: socket.id });
      callback({ status: "error", message: "Server error sending message" });
    }
  });

  socket.on("signal", async ({ channelId, signalData }) => {
    try {
        if (!channelId || !signalData) {
            logger.warn(`Signal attempt with missing data`, { username: socket.user.username, channelId: !!channelId, signalData: !!signalData, socketId: socket.id });
            return;
        }
        const channel = await Channel.findById(channelId);
        if (!channel || !channel.members.some(memberId => memberId.equals(socket.user._id))) {
            logger.warn(`Unauthorized attempt to send signal to channel`, { username: socket.user.username, channelId, socketId: socket.id });
            return;
        }
        logger.info(`Relaying signal`, { fromUser: socket.user.username, channelId, socketId: socket.id });
        socket.to(channelId).emit("signal", { userId: socket.user._id, username: socket.user.username, signalData });
        await User.findByIdAndUpdate(socket.user._id, { ultimaAtividade: new Date() });
    } catch (error) {
        logger.error(`Error relaying signal`, { username: socket.user.username, channelId, error: error.message, stack: error.stack, socketId: socket.id });
    }
  });

  socket.on("leave_channel", ({ channelId }) => {
    if (!channelId) return;
    socket.leave(channelId);
    logger.info(`User left channel room`, { username: socket.user.username, channelId, socketId: socket.id });
  });

  socket.on("disconnect", async (reason) => {
    logger.info(`User disconnected`, { username: socket.user ? socket.user.username : 	"Unknown"	, socketId: socket.id, reason });
    if (socket.user) {
        try {
            await User.findByIdAndUpdate(socket.user._id, { online: false, ultimaAtividade: new Date() });
            logger.info(`User marked offline`, { username: socket.user.username, socketId: socket.id });
        } catch (err) {
            logger.error(`Error marking user offline on disconnect`, { username: socket.user.username, socketId: socket.id, error: err.message });
        }
    }
  });

  socket.on("error", (err) => {
    logger.error(`Socket error`, { username: socket.user ? socket.user.username : 	"Unknown"	, socketId: socket.id, error: err.message, stack: err.stack });
  });
});

// --- Centralized Error Handling Middleware (MUST be last) ---
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

