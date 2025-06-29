const admin = require('firebase-admin');
const path = require('path');
const winston = require('winston');

// Logger específico para Firebase
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [FIREBASE-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class FirebaseConfig {
  constructor() {
    this.initialized = false;
    this.app = null;
    this.messaging = null;
    this.stats = {
      initialized: false,
      initializationTime: null,
      messagesSent: 0,
      messagesSucceeded: 0,
      messagesFailed: 0,
      lastError: null,
      lastSuccess: null
    };
  }

  /**
   * Inicializa o Firebase Admin SDK
   */
  initialize() {
    try {
      if (this.initialized) {
        logger.info('Firebase Admin SDK already initialized');
        return true;
      }

      // Verificar se as variáveis de ambiente estão configuradas
      const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

      if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        logger.warn('⚠️ Variáveis de ambiente do Firebase não configuradas corretamente.');
        return false;
      }

      // Apenas log de debug seguro, fora do objeto JSON
      if (process.env.NODE_ENV !== 'production') {
        logger.info(
          "DEBUG (Runtime): FIREBASE_PRIVATE_KEY - Início:",
          typeof FIREBASE_PRIVATE_KEY === "string"
            ? FIREBASE_PRIVATE_KEY.substring(0, 100)
            : "(Vazio)"
        );
        logger.info(
          "DEBUG (Runtime): FIREBASE_PRIVATE_KEY - Fim:",
          typeof FIREBASE_PRIVATE_KEY === "string"
            ? FIREBASE_PRIVATE_KEY.slice(-100)
            : "(Vazio)"
        );
        logger.info(
          "DEBUG (Runtime): FIREBASE_PRIVATE_KEY - Comprimento:",
          FIREBASE_PRIVATE_KEY ? FIREBASE_PRIVATE_KEY.length : 0
        );
      }

      // Inicializar usando variáveis
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });

      this.messaging = admin.messaging();
      this.initialized = true;
      this.stats.initialized = true;
      this.stats.initializationTime = new Date().toISOString();

      logger.info('Firebase Admin SDK initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
      this.initialized = false;
      this.stats.lastError = error.message;
      return false;
    }
  }

  /**
   * Testa a conexão com o Firebase
   */
  async testConnection() {
    if (!this.initialized) {
      return { success: false, error: 'Firebase not initialized' };
    }
    try {
      await this.app.auth().createCustomToken('test-uid');
      this.stats.lastSuccess = new Date().toISOString();
      return { success: true };
    } catch (error) {
      logger.error('Firebase connection test failed:', error);
      this.stats.lastError = error.message;
      return { success: false, error: error.message };
    }
  }

  /**
   * Retorna o status da conexão
   */
  getStatus() {
    return this.stats;
  }
}

module.exports = new FirebaseConfig();
