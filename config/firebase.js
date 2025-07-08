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

  initialize() {
    try {
      if (this.initialized) {
        logger.info('Firebase Admin SDK already initialized');
        return true;
      }

      // Usando o nome exato do seu JSON
      const serviceAccountPath = path.resolve(__dirname, 'lucasbeats-2025-firebase-adminsdk-fbsvc-55a1eb3029.json');
      const serviceAccount = require(serviceAccountPath);

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
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

  getStatus() {
    return this.stats;
  }
}

module.exports = new FirebaseConfig();
