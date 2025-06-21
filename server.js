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

// ROTAS
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

// --- INTEGRAÇÃO DAS MISSÕES QRR ---
const clanMissionRoutes = require("./routes/clanMission.routes");

// --- Integração Sentry ---
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

// --- Basic Setup ---
const app = express();

const { swaggerUi, swaggerSpec } = require("./swagger");

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

// Inicialização do Sentry (antes dos middlewares e rotas)
Sentry.init({
  dsn: "https://a561c5c87b25dfea7864b2fb292a25c1@o4509510833995776.ingest.us.sentry.io/4509510909820928",
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

app.set("trust proxy", 1);
const server = http.createServer(app);

// --- Database Connection ---
connectDB();

// --- Logging Setup (OTIMIZADO para reduzir I/O) ---
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
      new winston.transports.File({ filename: "logs/error.log", level: "error" }),
      new winston.transports.File({ filename: "logs/combined.log" })
    ])
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
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5000",
  "http://localhost",
  "https://beckend-ydd1.onrender.com",
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

// --- Socket.IO Setup (OTIMIZADO) ---
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
  // 🚨 NOVO: Configurações otimizadas para reduzir I/O
  maxHttpBufferSize: 1e6, // 1MB máximo
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  connectTimeout: 45000,
  upgradeTimeout: 10000,
});

// 🚨 NOVO: Controle de conexões simultâneas
let activeConnections = 0;
const MAX_CONNECTIONS = 200; // Limite para evitar sobrecarga

// Map to store connected users by their userId
const connectedUsers = new Map(); // userId -> socket.id

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

  // When a user connects and authenticates, associate their userId with the socket
  socket.on("user_connected", (userId) => {
    try {
      socket.userId = userId; // Store userId on the socket object
      connectedUsers.set(userId, socket.id);
      
      if (process.env.NODE_ENV !== "production") {
        logger.info(`Usuário ${userId} conectado com socket ID: ${socket.id}`);
      }
      
      // Optionally, broadcast presence to other users
      socket.broadcast.emit("user_online", userId);
    } catch (error) {
      console.error("Erro na autenticação do usuário:", error.message);
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
        if (!voiceChannel.checkPassword(password)) {
          socket.emit("voice_room_error", { message: "Senha incorreta" });
          return;
        }
      }

      socket.join(roomId);
      socket.currentRoom = roomId;
      
      // Atualizar participantes no banco
      if (voiceChannel) {
        voiceChannel.addParticipant(userId);
        await voiceChannel.save();
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
          username: username || "Usuário",
          timestamp: new Date().toISOString()
        });

        // Atualizar participantes no banco
        const voiceChannel = await VoiceChannel.findOne({ name: socket.currentRoom });
        if (voiceChannel) {
          voiceChannel.removeParticipant(userId);
          await voiceChannel.save();
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
  socket.on("webrtc_signal", (data) => {
    try {
      const { targetUserId, signalType, signalData } = data;
      const targetSocketId = connectedUsers.get(targetUserId);

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

  socket.on("disconnect", (reason) => {
    try {
      activeConnections--;
      
      // Remove user from map and broadcast presence
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        
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
    
    // Limpeza de salas vazias (implementar se necessário)
    // cleanupEmptyRooms();
    
  } catch (error) {
    console.error("Erro na limpeza automática:", error.message);
  }
}, 300000); // 5 minutos

// --- API ROUTES ---
// Autenticação
logger.info("Registering /api/auth routes...");
app.use("/api/auth", authRoutes);

// Usuários
logger.info("Registering /api/users routes...");
app.use("/api/users", userRoutes);

// Clãs
logger.info("Registering /api/clans routes...");
app.use("/api/clans", clanRoutes);

// Federações
logger.info("Registering /api/federations routes...");
app.use("/api/federations", federationRoutes);

// Canais de texto
logger.info("Registering /api/channels routes...");
app.use("/api/channels", channelRoutes);

// Canais de voz
logger.info("Registering /api/voice-channels routes...");
app.use("/api/voice-channels", voiceChannelRoutes);

// Canais globais
logger.info("Registering /api/global-channels routes...");
app.use("/api/global-channels", globalChannelRoutes);

// VoIP
logger.info("Registering /api/voip routes...");
app.use("/api/voip", (req, res, next) => {
  req.io = io;
  next();
}, voipRoutes);

// Estatísticas
const statsRoutes = require("./routes/statsRoutes");
logger.info("Registering /api/stats routes...");
app.use("/api/stats", statsRoutes);

// Admin
const adminRoutes = require("./routes/adminRoutes");
logger.info("Registering /api/admin routes...");
app.use("/api/admin", adminRoutes);

// Chat da federação
logger.info("Registering /api/federation-chat routes...");
app.use("/api/federation-chat", (req, res, next) => {
  req.io = io;
  next();
}, federationChatRoutes);

// Chat do clã
logger.info("Registering /api/clan-chat routes...");
app.use("/api/clan-chat", (req, res, next) => {
  req.io = io;
  next();
}, clanChatRoutes);

// --- MISSÕES QRR DE CLÃ ---
logger.info("Registering /api/clan-missions routes...");
app.use("/api/clan-missions", clanMissionRoutes);

app.get("/", (req, res) => {
  res.send("FEDERACAOMAD Backend API Running");
});

// --- Centralized Error Handling Middleware (MUST be last) ---
app.use(Sentry.Handlers.errorHandler());
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});





// Função para garantir que o usuário 'idcloned' tenha o papel de ADM
async function ensureAdminUser() {
  try {
    console.log("Verificando e garantindo o usuário admin...");
    const User = require("./models/User"); // Importar o modelo User aqui para evitar problemas de carregamento

    let user = await User.findOne({ username: "idcloned" });

    if (!user) {
      console.log("Usuário \"idcloned\" não encontrado. Criando como ADM...");
      const newUser = new User({
        username: "idcloned",
        password: "admin123", // Senha padrão - MUDE ISSO EM PRODUÇÃO!
        role: "ADM"
      });
      await newUser.save();
      console.log("Usuário \"idcloned\" criado com sucesso como ADM!");
    } else {
      if (user.role !== "ADM") {
        console.log(`Usuário \"${user.username}\" (role atual: ${user.role}) não é ADM. Promovendo para ADM...`);
        user.role = "ADM";
        await user.save();
        console.log(`Usuário \"${user.username}\" promovido para ADM com sucesso!`);
      } else {
        console.log(`Usuário \"${user.username}\" já é ADM.`);
      }
    }
  } catch (error) {
    console.error("Erro ao garantir usuário admin:", error);
  }
}

// Chamar a função após a conexão com o banco de dados
connectDB().then(() => {
  ensureAdminUser();
});


