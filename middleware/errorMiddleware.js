const winston = require("winston");
const { captureError } = require("./sentryMiddleware");

// Configuração do Winston com integração ao Sentry
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
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

// Adicionar transporte personalizado para enviar logs ao Sentry
logger.add(new winston.transports.Console({
  level: 'error',
  handleExceptions: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      // Enviar erros para o Sentry
      if (level === 'error') {
        const error = new Error(message);
        if (stack) error.stack = stack;
        captureError(error, { 
          level, 
          timestamp, 
          metadata: meta 
        });
      }
      return `${timestamp} [${level}]: ${message}`;
    })
  )
}));

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode ? res.statusCode : 500;

  // Log the error with more details
  logger.error(`${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
    error: err,
    user: req.user ? { id: req.user._id, username: req.user.username } : null,
    requestId: req.id || 'unknown'
  });

  // Capturar erro no Sentry com contexto adicional
  captureError(err, {
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("User-Agent")
    },
    user: req.user ? {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role
    } : null,
    statusCode
  });

  res.status(statusCode);

  res.json({
    message: err.message,
    // Avoid sending stack trace in production environment
    stack: process.env.NODE_ENV === "production" ? "🥞" : err.stack,
  });
};

module.exports = errorHandler;

