const Sentry = require("@sentry/node");

/**
 * Instrumentação para operações de banco de dados
 */
const instrumentDatabaseOperation = async (operationName, operation, context = {}) => {
  const transaction = Sentry.startTransaction({
    name: `Database: ${operationName}`,
    op: "db.query",
  });

  Sentry.getCurrentHub().configureScope(scope => {
    scope.setSpan(transaction);
    scope.setContext("database", context);
  });

  try {
    const result = await operation();
    transaction.setStatus("ok");
    return result;
  } catch (error) {
    transaction.setStatus("internal_error");
    Sentry.captureException(error);
    throw error;
  } finally {
    transaction.finish();
  }
};

/**
 * Instrumentação para requisições HTTP externas
 */
const instrumentHttpRequest = async (url, requestFunction, context = {}) => {
  const transaction = Sentry.startTransaction({
    name: `HTTP Request: ${url}`,
    op: "http.client",
  });

  Sentry.getCurrentHub().configureScope(scope => {
    scope.setSpan(transaction);
    scope.setContext("http", {
      url,
      ...context
    });
  });

  try {
    const result = await requestFunction();
    transaction.setStatus("ok");
    return result;
  } catch (error) {
    transaction.setStatus("internal_error");
    Sentry.captureException(error);
    throw error;
  } finally {
    transaction.finish();
  }
};

/**
 * Instrumentação para operações de cache
 */
const instrumentCacheOperation = async (operation, key, operationType = "get") => {
  const span = Sentry.getCurrentHub().getScope()?.getSpan()?.startChild({
    op: `cache.${operationType}`,
    description: `Cache ${operationType}: ${key}`,
  });

  try {
    const result = await operation();
    span?.setStatus("ok");
    span?.setData("cache.key", key);
    span?.setData("cache.hit", result !== null && result !== undefined);
    return result;
  } catch (error) {
    span?.setStatus("internal_error");
    Sentry.captureException(error);
    throw error;
  } finally {
    span?.finish();
  }
};

/**
 * Instrumentação para upload de arquivos
 */
const instrumentFileUpload = async (filename, uploadFunction, context = {}) => {
  const transaction = Sentry.startTransaction({
    name: `File Upload: ${filename}`,
    op: "file.upload",
  });

  Sentry.getCurrentHub().configureScope(scope => {
    scope.setSpan(transaction);
    scope.setContext("file", {
      filename,
      ...context
    });
  });

  try {
    const result = await uploadFunction();
    transaction.setStatus("ok");
    transaction.setData("file.size", context.size);
    transaction.setData("file.type", context.type);
    return result;
  } catch (error) {
    transaction.setStatus("internal_error");
    Sentry.captureException(error);
    throw error;
  } finally {
    transaction.finish();
  }
};

/**
 * Instrumentação para operações de autenticação
 */
const instrumentAuthOperation = async (operationType, operation, context = {}) => {
  const span = Sentry.getCurrentHub().getScope()?.getSpan()?.startChild({
    op: `auth.${operationType}`,
    description: `Authentication: ${operationType}`,
  });

  try {
    const result = await operation();
    span?.setStatus("ok");
    span?.setData("auth.operation", operationType);
    span?.setData("auth.success", true);
    return result;
  } catch (error) {
    span?.setStatus("unauthenticated");
    span?.setData("auth.operation", operationType);
    span?.setData("auth.success", false);
    Sentry.captureException(error);
    throw error;
  } finally {
    span?.finish();
  }
};

/**
 * Instrumentação para operações de notificação
 */
const instrumentNotificationOperation = async (notificationType, operation, context = {}) => {
  const span = Sentry.getCurrentHub().getScope()?.getSpan()?.startChild({
    op: `notification.${notificationType}`,
    description: `Notification: ${notificationType}`,
  });

  try {
    const result = await operation();
    span?.setStatus("ok");
    span?.setData("notification.type", notificationType);
    span?.setData("notification.recipients", context.recipients || 1);
    return result;
  } catch (error) {
    span?.setStatus("internal_error");
    span?.setData("notification.type", notificationType);
    Sentry.captureException(error);
    throw error;
  } finally {
    span?.finish();
  }
};

module.exports = {
  instrumentDatabaseOperation,
  instrumentHttpRequest,
  instrumentCacheOperation,
  instrumentFileUpload,
  instrumentAuthOperation,
  instrumentNotificationOperation
};

