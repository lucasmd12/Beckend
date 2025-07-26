const winston = require("winston");

// Logger específico para mensagens espirituais
const spiritualLogger = winston.createLogger({
  level: "info", // Sempre registra informações espirituais
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [ESPIRITUAL-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: "logs/spiritual.log", level: "info" }),
  ],
});

module.exports = spiritualLogger;


