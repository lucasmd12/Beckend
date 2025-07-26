const spiritualLogger = require("../utils/spiritualLogger");
const Log = require("../models/Log"); // Importa o modelo de Log

const spiritualMiddleware = (req, res, next) => {
  const start = process.hrtime();

  res.on("finish", async () => {
    const diff = process.hrtime(start);
    const responseTime = (diff[0] * 1e9 + diff[1]) / 1e6; // Convert to milliseconds

    const logEntry = {
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      message: `Requisição ${req.method} ${req.originalUrl} finalizada com status ${res.statusCode} em ${responseTime.toFixed(2)}ms.`, 
      meta: {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: responseTime.toFixed(2),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        userId: req.user ? req.user._id : null, // Se houver usuário autenticado
      },
    };

    try {
      await Log.create(logEntry);
      spiritualLogger.info("Log de requisição salvo no MongoDB.", logEntry);
    } catch (error) {
      spiritualLogger.error("Erro ao salvar log no MongoDB:", error);
    }
  });

  next();
};

module.exports = spiritualMiddleware;


