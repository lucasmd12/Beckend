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

// MODELS
const Message = require("./models/Message");
const User = require("./models/User");
const Channel = require("./models/Channel");
const VoiceChannel = require("./models/VoiceChannel");
const GlobalChannel = require("./models/GlobalChannel");

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
const clanMissionRoutes = require("./routes/clanMission.routes"); // <<<<<< ADICIONADO

// --- Basic Setup ---
const app = express();

const { swaggerUi, swaggerSpec } = require('./swagger');

// Defina a URL base do seu serviço no Render
const RENDER_BASE_URL = 'https://beckend-ydd1.onrender.com'; // Certifique-se de que este é o seu domínio real no Render

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    url: `${RENDER_BASE_URL}/api-docs-json` // Endpoint para o JSON do Swagger
  },
  customSiteTitle: "FederacaoMad API Documentation"
}));

// Adicione um endpoint para servir o JSON da especificação Swagger
app.get('/api-docs-json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});


app.set("trust proxy", 1);
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
const logDir = "logs";
if (!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

// --- Security Middleware ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5000",
  "http://localhost",
  "https://beckend-ydd1.onrender.com", // <<<<<< ADICIONADO AQUI
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
app.use("/uploads", express.static("uploads"));

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
app.use("/api/clan-missions", clanMissionRoutes); // <<<<<< ADICIONADO

app.get("/", (req, res) => {
  res.send("FEDERACAOMAD Backend API Running");
});

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

// ... [O restante do seu código Socket.IO permanece igual, sem cortes] ...

// --- Centralized Error Handling Middleware (MUST be last) ---
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
