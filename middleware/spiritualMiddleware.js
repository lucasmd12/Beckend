const spiritualLogger = require("../utils/spiritualLogger");

const spiritualMiddleware = (req, res, next) => {
  // Registra o início da requisição como um "impulso espiritual"
  spiritualLogger.info(`Impulso espiritual recebido: ${req.method} ${req.originalUrl}`);

  // Adiciona um listener para quando a resposta for finalizada
  res.on("finish", () => {
    // Registra o fim da requisição como uma "resposta espiritual"
    spiritualLogger.info(`Resposta espiritual enviada para ${req.method} ${req.originalUrl} com status ${res.statusCode}`);
  });

  next();
};

module.exports = spiritualMiddleware;


