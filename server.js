require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const winston = require("winston");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const errorHandler = require("./middleware/errorMiddleware");
const spiritualMiddleware = require("./middleware/spiritualMiddleware");
const spiritualLogger = require("./utils/spiritualLogger");
const { swaggerUi, swaggerSpec } = require("./swagger");

// IMPORTS PARA OTIMIZAÇÃO
const performanceMiddleware = require("./middleware/performanceMiddleware");
const optimizedCacheService = require("./services/optimizedCacheService");
const mongooseOptimizer = require("./utils/mongooseOptimizer");

// --- Logging Setup ---
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    ...(process.env.NODE_ENV === "production" ? [
      new winston.transports.File({ filename: "logs/error.log", level: "error" })
    ] : [
      new winston.transports.File({ filename: "logs/combined.log" }),
      new winston.transports.File({ filename: "logs/error.log", level: "error" })
    ]),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Redis Integration
const redis = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

// Tratamento de erros não capturados
process.on("uncaughtException", (error) => {
  console.error("🚨 Erro não capturado:", error.message);
  if (error.code === "EIO" || error.code === "ENOSPC" || error.code === "EPIPE") {
    console.log("⚠️ Erro de I/O detectado - continuando operação...");
    return;
  }
  console.error("💥 Erro crítico:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Promise rejeitada não tratada:", reason);
});

// MODELS
const Message = require("./models/Message");
const User = require("./models/User");
const Channel = require("./models/Channel");
const VoiceChannel = require("./models/VoiceChannel");
const GlobalChannel = require("./models/GlobalChannel");
const Federation = require("./models/Federation");
const Clan = require("./models/Clan");
const QRR = require("./models/QRR");
const GlobalChatMessage = require("./models/GlobalChatMessage");
const JoinRequest = require("./models/JoinRequest");
const presenceService = require("./services/presenceService");

// ROTAS
const uploadRoutes = require("./routes/uploadRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const channelRoutes = require("./routes/channelRoutes");
const voiceChannelRoutes = require("./routes/voiceChannelRoutes");
const globalChannelRoutes = require("./routes/globalChannelRoutes");
const voipRoutes = require("./routes/voipRoutes");
const federationRoutes = require("./routes/federationRoutes");
const clanRoutes = require("./routes/clanRoutes");
const federationChatRoutes = require("./routes/federationChatRoutes");
const clanChatRoutes = require("./routes/clanChatRoutes");
const qrrRoutes = require("./routes/qrrRoutes");
const globalChatRoutes = require("./routes/globalChatRoutes");
const inviteRoutes = require("./routes/inviteRoutes");
const joinRequestRoutes = require("./routes/joinRequestRoutes");
const adminRoutes = require("./routes/adminRoutes");
const hierarchyRoutes = require("./routes/hierarchyRoutes");
const monitoringRoutes = require('./routes/monitoringRoutes');
const clanMissionRoutes = require("./routes/clanMission.routes");
const clanWarRoutes = require("./routes/clanWarRoutes");
const postRoutes = require("./routes/postRoutes");
const statsRoutes = require("./routes/statsRoutes"); // ✅ CORREÇÃO: Importação adicionada aqui

// --- Integração Sentry ---
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

// --- Basic Setup ---
const app = express();

// Inicialização do Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://a561c5c87b25dfea7864b2fb292a25c1@o4509510833995776.ingest.us.sentry.io/4509510909820928",
  environment: process.env.NODE_ENV || "development",
  release: process.env.npm_package_version || "1.0.0",
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  beforeSend(event) {
    if (event.exception) {
      const error = event.exception.values[0];
      if (error && error.type === "EIO") {
        return null;
      }
    }
    return event;
  },
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

app.use(spiritualMiddleware);

app.set("trust proxy", 1);
const server = http.createServer(app);

// --- Inicialização dos Serviços Otimizados ---
(async () => {
  try {
    await optimizedCacheService.initialize();
    logger.info("Optimized cache service initialized successfully");
    if (process.env.NODE_ENV !== 'production' || process.env.CREATE_INDEXES === 'true') {
      await mongooseOptimizer.createRecommendedIndexes();
    }
  } catch (error) {
    logger.error("Failed to initialize optimized services:", error);
    logger.warn("Application will continue with reduced performance");
  }
})();

// --- Cache Service Initialization ---
const cacheService = require("./services/cacheService");
const redisConfig = require("./config/redis");

(async () => {
  try {
    await redisConfig.connect();
    await cacheService.initialize();
    logger.info("Cache service initialized successfully");
    await presenceService.initialize();
    logger.info("Presence service initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize cache service:", error);
    logger.warn("Application will continue without cache");
  }
})();

// --- Cloudinary Service Initialization ---
const cloudinaryConfig = require("./config/cloudinary");
const uploadService = require("./services/uploadService");

(async () => {
  try {
    const cloudinaryInitialized = cloudinaryConfig.initialize();
    if (cloudinaryInitialized) {
      uploadService.initialize();
      logger.info("Cloudinary service initialized successfully");
      const testResult = await cloudinaryConfig.testConnection();
      if (testResult.success) {
        logger.info("Cloudinary connection test passed");
      } else {
        logger.warn("Cloudinary connection test failed:", testResult.error);
      }
    } else {
      logger.warn("Cloudinary service disabled or misconfigured");
    }
  } catch (error) {
    logger.error("Failed to initialize Cloudinary service:", error);
    logger.warn("Application will continue with local file storage");
  }
})();

// --- Firebase Service Initialization ---
const firebaseConfig = require("./config/firebase");
const notificationService = require("./services/notificationService");

(async () => {
  try {
    const firebaseInitialized = firebaseConfig.initialize();
    if (firebaseInitialized) {
      notificationService.initialize();
      logger.info("Firebase service initialized successfully");
      const testResult = await firebaseConfig.testConnection();
      if (testResult.success) {
        logger.info("Firebase connection test passed");
      } else {
        logger.warn("Firebase connection test failed:", testResult.error);
      }
    } else {
      logger.warn("Firebase service disabled or misconfigured");
    }
  } catch (error) {
    logger.error("Failed to initialize Firebase service:", error);
    logger.warn("Application will continue without push notifications");
  }
})();

// Criar diretório de logs
const logDir = "logs";
try {
  if (!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
  }
} catch (error) {
  console.warn("⚠️ Não foi possível criar diretório de logs:", error.message);
}

// --- Security Middleware ---
app.use(cors());

// MIDDLEWARES DE PERFORMANCE
app.use(performanceMiddleware.middleware());
app.use(performanceMiddleware.payloadLimiter());
app.use(performanceMiddleware.mongooseOptimizer());
app.use(performanceMiddleware.responseCache());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Too many login/register attempts from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

app.use(express.json({ limit: "5mb" }));

// --- Serve Uploaded Files Staticly ---
app.use("/uploads", express.static("uploads"));

// Swagger Docs
const RENDER_BASE_URL = process.env.RENDER_EXTERNAL_URL || "http://localhost:5000";
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    servers: [{ url: RENDER_BASE_URL }]
  },
  customSiteTitle: "FederacaoMad API Documentation"
}));
app.get("/api-docs-json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 1e6,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  connectTimeout: 45000,
  upgradeTimeout: 10000,
});

app.set("socketio", io);

// Redis Adapter for Socket.IO
const pubClient = redis.createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Redis adapter for Socket.IO connected.");
  })
  .catch((err) => {
    logger.error("Failed to connect Redis for Socket.IO adapter:", err);
  });

let activeConnections = 0;
const MAX_CONNECTIONS = 200;

io.on("connection", (socket) => {
  if (activeConnections >= MAX_CONNECTIONS) {
    socket.emit("error", { message: "Servidor lotado. Tente novamente em alguns minutos." });
    socket.disconnect(true);
    return;
  }
  activeConnections++;
  
  if (process.env.NODE_ENV !== "production") {
    logger.info(`Novo cliente conectado: ${socket.id} (Total: ${activeConnections})`);
  }

  socket.on("error", (error) => {
    console.error(`🚨 Erro no socket ${socket.id}:`, error.message);
  });

  socket.on("user_connected", async (userId) => {
    try {
      const userIdStr = String(userId);
      socket.userId = userIdStr;
      await presenceService.setOnline(userIdStr, socket.id);
      if (process.env.NODE_ENV !== "production") {
        logger.info(`Usuário ${userIdStr} conectado com socket ID: ${socket.id}`);
      }
      socket.broadcast.emit("user_online", userIdStr);
    } catch (error) {
      console.error("Erro na autenticação do usuário via socket:", error.message);
    }
  });

  // Eventos VoIP
  socket.on("join_voice_room", async (data) => { /* ... seu código voip ... */ });
  socket.on("leave_voice_room", async (data) => { /* ... seu código voip ... */ });
  socket.on("webrtc_signal", async (data) => { /* ... seu código webrtc ... */ });

  socket.on("disconnect", async (reason) => {
    try {
      activeConnections--;
      if (socket.userId) {
        await presenceService.setOffline(socket.userId);
        if (process.env.NODE_ENV !== "production") {
          logger.info(`Usuário ${socket.userId} desconectado. (Total: ${activeConnections})`);
        }
        socket.broadcast.emit("user_offline", socket.userId);
      }
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit("user_left_voice", { userId: socket.userId });
      }
    } catch (error) {
      console.error("Erro na desconexão:", error.message);
    }
  });
});

// Limpeza automática de recursos
setInterval(() => {
  try {
    if (activeConnections > 0 && process.env.NODE_ENV !== "production") {
      console.log(`📊 Status: ${activeConnections} conexões ativas`);
    }
  } catch (error) {
    console.error("Erro no intervalo de manutenção:", error.message);
  }
}, 60000);

// --- Função Principal de Inicialização ---
const startServer = async () => {
  try {
    logger.info("Connecting to MongoDB...");
    await connectDB();
    logger.info("MongoDB Connected.");

    // --- ROTAS - Configuração das rotas da API ---
    app.use("/api/monitoring", monitoringRoutes(app));
    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/channels", channelRoutes);
    app.use("/api/voice-channels", voiceChannelRoutes);
    app.use("/api/global-channels", globalChannelRoutes);
    app.use("/api/voip", voipRoutes);
    app.use("/api/federations", federationRoutes);
    app.use("/api/clans", clanRoutes);
    app.use("/api/federation-chat", federationChatRoutes);
    app.use("/api/clan-chat", clanChatRoutes);
    app.use("/api/qrrs", qrrRoutes);
    app.use("/api/global-chat", globalChatRoutes);
    app.use("/api/uploads", uploadRoutes);
    app.use("/api/invites", inviteRoutes);
    app.use("/api/join-requests", joinRequestRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/hierarchy", hierarchyRoutes);
    app.use("/api/clan-missions", clanMissionRoutes);
    app.use("/api/clan-wars", clanWarRoutes);
    app.use("/api/posts", postRoutes);
    app.use("/api/stats", statsRoutes); // ✅ CORREÇÃO: Uso da rota adicionado aqui

    // Middlewares de erro (devem ser os últimos)
    app.use(Sentry.Handlers.errorHandler());
    app.use(errorHandler);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("💥 Failed to start server:", error);
    process.exit(1);
  }
};

// Inicia todo o processo
startServer();

// ✅ CORREÇÃO: Todo o código duplicado que estava aqui foi removido.
