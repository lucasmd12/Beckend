const Sentry = require("@sentry/node");

/**
 * Middleware para adicionar contexto do usuário ao Sentry
 * Deve ser usado após a autenticação do usuário
 */
const sentryUserContext = (req, res, next) => {
  try {
    // Verificar se há um usuário autenticado na requisição
    if (req.user) {
      Sentry.setUser({
        id: req.user._id || req.user.id,
        username: req.user.username,
        role: req.user.role,
        clan: req.user.clan,
        federation: req.user.federation
      });

      // Adicionar tags personalizadas baseadas no usuário
      Sentry.setTag("user_role", req.user.role);
      if (req.user.clan) {
        Sentry.setTag("user_clan", req.user.clan);
      }
      if (req.user.federation) {
        Sentry.setTag("user_federation", req.user.federation);
      }
    }

    // Adicionar contexto da requisição
    Sentry.setContext("request", {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    // Se houver erro no middleware do Sentry, não deve quebrar a aplicação
    console.error("Erro no middleware do Sentry:", error);
    next();
  }
};

/**
 * Função para capturar erros personalizados com contexto adicional
 */
const captureError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    // Adicionar contexto adicional
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });
    
    Sentry.captureException(error);
  });
};

/**
 * Função para capturar mensagens de log com diferentes níveis
 */
const captureMessage = (message, level = "info", context = {}) => {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    
    // Adicionar contexto adicional
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });
    
    Sentry.captureMessage(message);
  });
};

/**
 * Função para iniciar uma transação personalizada
 */
const startTransaction = (name, operation = "custom") => {
  return Sentry.startTransaction({
    name,
    op: operation,
  });
};

module.exports = {
  sentryUserContext,
  captureError,
  captureMessage,
  startTransaction
};
