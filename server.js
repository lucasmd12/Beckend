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
const spiritualMiddleware = require("./middleware/spiritualMiddleware"); // NOVO
const spiritualLogger = require("./utils/spiritualLogger"); // NOVO
const { swaggerUi, swaggerSpec } = require("./swagger");

// NOVOS IMPORTS PARA OTIMIZAÇÃO
const performanceMiddleware = require("./middleware/performanceMiddleware");
const optimizedCacheService = require("./services/optimizedCacheService");
const mongooseOptimizer = require("./utils/mongooseOptimizer");

// --- Logging Setup (MOVIDO PARA O INÍCIO) ---
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "info", // 🚨 Menos logs em produção
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // 🚨 NOVO: Só criar logs de erro em produção para reduzir I/O
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

// 🚨 NOVO: Tratamento robusto de erros I/O
process.on("uncaughtException", (error) => {
  console.error("🚨 Erro I/O capturado:", error.message);
  // NÃO encerrar o processo para erros I/O
  if (error.code === "EIO" || error.code === "ENOSPC" || error.code === "EPIPE") {
    console.log("⚠️ Erro de I/O detectado - continuando operação...");
    return; // Não derrubar o servidor
  }
  // Para outros erros críticos, ainda encerrar
  if (error.code !== "EIO") {
    console.error("💥 Erro crítico não-I/O:", error);
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Promise rejeitada:", reason);
  // Não encerrar o processo
});

// MODELS
const Message = require("./models/Message");
const User = require("./models/User");
const Channel = require("./models/Channel");
const VoiceChannel = require("./models/VoiceChannel");
const GlobalChannel = require("./models/GlobalChannel");
const Federation = require("./models/Federation"); // Adicionado
const Clan = require("./models/Clan"); // Adicionado
const QRR = require("./models/QRR"); // Restaurado - célula vital do sistema endócrino
const GlobalChatMessage = require("./models/GlobalChatMessage"); // Adicionado
const JoinRequest = require("./models/JoinRequest"); // Adicionado
const presenceService = require("./services/presenceService"); // NOVO: Serviço de Presença

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
const qrrRoutes = require("./routes/qrrRoutes"); // Adicionado
const globalChatRoutes = require("./routes/globalChatRoutes"); // Adicionado
const inviteRoutes = require("./routes/inviteRoutes"); // Restaurado - parte vital do cérebro
const joinRequestRoutes = require("./routes/joinRequestRoutes"); // Restaurado - parte vital do cérebro
const adminRoutes = require("./routes/adminRoutes"); // Adicionado - painel de controle do ADM
const hierarchyRoutes = require("./routes/hierarchyRoutes"); // NOVO - estrutura hierárquica
const monitoringRoutes = require('./routes/monitoringRoutes'); // ADICIONADO
const clanMissionRoutes = require("./routes/clanMission.routes");
const clanWarRoutes = require("./routes/clanWarRoutes");
const postRoutes = require("./routes/postRoutes");


// --- Integração Sentry ---
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

// --- Basic Setup ---
const app = express();

// Middleware CORS personalizado
// Inicialização do Sentry (antes dos middlewares e rotas)
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
    // Filtrar erros sensíveis ou irrelevantes
    if (event.exception) {
      const error = event.exception.values[0];
      if (error && error.type === "EIO") {
        return null; // Não enviar erros de I/O para o Sentry
      }
    }
    return event;
  },
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

app.use(spiritualMiddleware); // NOVO: Middleware Espiritual

app.set("trust proxy", 1);
const server = http.createServer(app);

// --- Inicialização dos Serviços Otimizados ---
(async () => {
  try {
    // Inicializar cache otimizado
    await optimizedCacheService.initialize();
    logger.info("Optimized cache service initialized successfully");
    
    // Criar índices recomendados (apenas em desenvolvimento ou primeira execução)
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

// Inicializar Redis e Cache Service
(async () => {
  try {
    await redisConfig.connect();
    await cacheService.initialize();
    logger.info("Cache service initialized successfully");
    await presenceService.initialize(); // Ativado
     logger.info("Presence service initialized successfully"); // Ativado
  } catch (error) {
    logger.error("Failed to initialize cache service:", error);
    logger.warn("Application will continue without cache");
  }
})(); // ✅✅✅ CORREÇÃO DE SINTAXE APLICADA AQUI ✅✅✅

// --- Cloudinary Service Initialization ---
const cloudinaryConfig = require("./config/cloudinary");
const uploadService = require("./services/uploadService");

// Inicializar Cloudinary
(async () => {
  try {
    const cloudinaryInitialized = cloudinaryConfig.initialize();
    if (cloudinaryInitialized) {
      uploadService.initialize();
      logger.info("Cloudinary service initialized successfully");
      
      // Testar conexão
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

// Inicializar Firebase
(async () => {
  try {
    const firebaseInitialized = firebaseConfig.initialize();
    if (firebaseInitialized) {
      notificationService.initialize();
      logger.info("Firebase service initialized successfully");
      
      // Testar conexão
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

// 🚨 NOVO: Criar diretório de logs com tratamento de erro
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

// NOVOS MIDDLEWARES DE PERFORMANCE
app.use(performanceMiddleware.middleware());
app.use(performanceMiddleware.payloadLimiter());
app.use(performanceMiddleware.mongooseOptimizer());
app.use(performanceMiddleware.responseCache());

// 🚨 NOVO: Rate limiting mais agressivo para reduzir carga
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Reduzido de 100 para 50
  message: "Too many login/register attempts from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// 🚨 NOVO: Limite geral de requisições
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto por IP
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

app.use(express.json({ limit: "5mb" })); // 🚨 Reduzido de padrão para 5mb

// --- Serve Uploaded Files Staticly ---
app.use("/uploads", express.static("uploads"));

// Defina a URL base do seu serviço no Render
const RENDER_BASE_URL = "https://beckend-ydd1.onrender.com";

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    url: `${RENDER_BASE_URL}/api-docs-json`
  },
  customSiteTitle: "FederacaoMad API Documentation"
}));

app.get("/api-docs-json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// --- Socket.IO Setup (OTIMIZADO) ---
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  // 🚨 NOVO: Configurações otimizadas para reduzir I/O
  maxHttpBufferSize: 1e6, // 1MB máximo
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  connectTimeout: 45000,
  upgradeTimeout: 10000,
});

// Disponibilizar Socket.IO para os controllers
app.set("socketio", io);

// Redis Adapter for Socket.IO
const pubClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Redis adapter for Socket.IO connected.");
  })
  .catch((err) => {
    logger.error("Failed to connect Redis for Socket.IO adapter:", err);
  });

// 🚨 NOVO: Controle de conexões simultâneas
let activeConnections = 0;
const MAX_CONNECTIONS = 200; // Limite para evitar sobrecarga

io.on("connection", (socket) => {
  // 🚨 NOVO: Verificar limite de conexões
  if (activeConnections >= MAX_CONNECTIONS) {
    console.log(`⚠️ Limite de conexões atingido: ${activeConnections}`);
    socket.emit("error", { message: "Servidor lotado. Tente novamente em alguns minutos." });
    socket.disconnect(true);
    return;
  }

  activeConnections++;
  
  // 🚨 NOVO: Log reduzido em produção
  if (process.env.NODE_ENV !== "production") {
    logger.info(`Novo cliente conectado: ${socket.id} (Total: ${activeConnections})`);
  }

  // 🚨 NOVO: Tratamento de erro por socket
  socket.on("error", (error) => {
    console.error(`🚨 Erro no socket ${socket.id}:`, error.message);
  });

  // ✅✅✅ CORREÇÃO APLICADA AQUI ✅✅✅
  socket.on("user_connected", async (userId) => {
    try {
      // GARANTIA: Converte o userId para string, não importa o que chegue.
      const userIdStr = String(userId);

      socket.userId = userIdStr;
      await presenceService.setOnline(userIdStr, socket.id); // Ativado
      if (process.env.NODE_ENV !== "production") {
        logger.info(`Usuário ${userIdStr} conectado com socket ID: ${socket.id}`);
      }
      socket.broadcast.emit("user_online", userIdStr);
    } catch (error) {
      console.error("Erro na autenticação do usuário via socket:", error.message);
    }
  });

  // 🚨 NOVO: Eventos VoIP com tratamento de erro
  socket.on("join_voice_room", async (data) => {
    try {
      const { roomId, userId, username, password } = data;
      
      if (!roomId || !userId) {
        socket.emit("voice_room_error", { message: "Dados inválidos para entrar na sala" });
        return;
      }

      // 🚨 NOVO: Verificar senha da sala se necessário
      const voiceChannel = await VoiceChannel.findOne({ name: roomId }).select("+password");
      
      if (voiceChannel && voiceChannel.isPrivate) {
        const isPasswordCorrect = await voiceChannel.checkPassword(password); // Assumindo que checkPassword existe
        if (!isPasswordCorrect) {
          socket.emit("voice_room_error", { message: "Senha incorreta" });
          return;
        }
      }

      socket.join(roomId);
      socket.currentRoom = roomId;
      
      // Atualizar participantes no banco
      if (voiceChannel) {
        await voiceChannel.addParticipant(userId); // Assumindo que addParticipant existe
      }
      
      // Notificar outros usuários na sala
      socket.to(roomId).emit("user_joined_voice", {
        userId,
        username: username || "Usuário",
        timestamp: new Date().toISOString()
      });

      socket.emit("voice_room_joined", { roomId, success: true });
      
      if (process.env.NODE_ENV !== "production") {
        console.log(`🎤 ${username} entrou na sala de voz: ${roomId}`);
      }
      
    } catch (error) {
      console.error("Erro ao entrar na sala de voz:", error.message);
      socket.emit("voice_room_error", { message: "Erro ao entrar na sala de voz" });
    }
  });

  socket.on("leave_voice_room", async (data) => {
    try {
      const { roomId, userId, username } = data;
      
      if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
        socket.to(socket.currentRoom).emit("user_left_voice", {
          userId,
          username: "Usuário",
          timestamp: new Date().toISOString()
        });

        // Atualizar participantes no banco
        const voiceChannel = await VoiceChannel.findOne({ name: socket.currentRoom });
        if (voiceChannel) {
          await voiceChannel.removeParticipant(userId); // Assumindo que removeParticipant existe
        }

        socket.currentRoom = null;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`🚪 ${username} saiu da sala de voz: ${roomId}`);
      }
      
    } catch (error) {
      console.error("Erro ao sair da sala de voz:", error.message);
    }
  });

  // WebRTC Signaling Events
  socket.on("webrtc_signal", async (data) => {
    try {
      const { targetUserId, signalType, signalData } = data;
      const targetSocketId = await presenceService.getSocketId(targetUserId); // Ativado

      if (targetSocketId) {
        if (process.env.NODE_ENV !== "production") {
          logger.info(`Retransmitindo sinal ${signalType} para ${targetUserId} de ${socket.userId}`);
        }
        
        io.to(targetSocketId).emit("webrtc_signal", {
          senderUserId: socket.userId, // Sender's userId
          signalType,
          signalData,
        });
      } else {
        if (process.env.NODE_ENV !== "production") {
          logger.warn(`Usuário ${targetUserId} não encontrado para sinalização.`);
        }
      }
    } catch (error) {
      console.error("Erro na sinalização WebRTC:", error.message);
    }
  });

  socket.on("disconnect", async (reason) => {
    try {
      activeConnections--;
      
      // Remove user from map and broadcast presence
      if (socket.userId) {
        await presenceService.setOffline(socket.userId); // Ativado
        
        if (process.env.NODE_ENV !== "production") {
          logger.info(`Usuário ${socket.userId} desconectado. (Total: ${activeConnections})`);
        }
        
        socket.broadcast.emit("user_offline", socket.userId);
      }

      // Sair da sala de voz se estiver em uma
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit("user_left_voice", {
          userId: socket.userId,
          username: "Usuário",
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error("Erro na desconexão:", error.message);
    }
  });
});

// 🚨 NOVO: Limpeza automática de recursos
setInterval(() => {
  try {
    // Log de status apenas se houver conexões ativas
    if (activeConnections > 0 && process.env.NODE_ENV !== "production") {
      console.log(`📊 Status: ${activeConnections} conexões ativas`);
    }

    // TODO: Implementar aqui a lógica para limpar salas vazias, se necessário
  } catch (error) {
    console.error("Erro no intervalo de manutenção:", error.message);
  }
}, 60000); // executa a cada 60s (60.000 ms)

// --- Função Principal de Inicialização ---
const startServer = async () => {
  try {
    // ✅ CORREÇÃO: Conexão com o DB é a primeira coisa e é esperada
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


    // Middleware de captura de erros do Sentry (deve vir antes do errorHandler personalizado)
    app.use(Sentry.Handlers.errorHandler());
    app.use(errorHandler);

    // ✅ CORREÇÃO: Servidor só inicia no final de tudo
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

app.use("/api/stats", statsRoutes);


const postRoutes = require("./routes/postRoutes");


app.use("/api/posts", postRoutes);


app.use("/api/stats", statsRoutes);

