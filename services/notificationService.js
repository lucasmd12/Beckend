const firebaseConfig = require('../config/firebase');
const cacheService = require('./cacheService');
const winston = require('winston');

// Logger específico para notificações
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [NOTIFICATION-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class NotificationService {
  constructor() {
    this.initialized = false;
    this.messaging = null;
    this.stats = {
      totalSent: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      lastSent: null,
      lastError: null
    };
  }

  /**
   * Inicializa o serviço de notificações
   */
  initialize() {
    try {
      if (!firebaseConfig.initialized) {
        logger.warn('Firebase not available, notification service disabled');
        return false;
      }

      this.messaging = firebaseConfig.messaging;
      this.initialized = true;

      logger.info('Notification service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  /**
   * Verifica se o serviço está disponível
   */
  isAvailable() {
    return this.initialized && this.messaging !== null;
  }

  /**
   * Envia notificação para um único token
   */
  async sendToToken(token, notification, data = {}, options = {}) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Notification service not available');
      }

      // Validar token
      if (!firebaseConfig.validateRegistrationToken(token)) {
        throw new Error('Invalid registration token');
      }

      // Construir mensagem
      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          ...notification
        },
        data: this._sanitizeData(data),
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#FF6B35',
            sound: 'default',
            channelId: 'default',
            ...options.android?.notification
          },
          priority: 'high',
          ...options.android
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              ...options.apns?.payload?.aps
            }
          },
          ...options.apns
        }
      };

      // Validar mensagem
      const validation = firebaseConfig.validateMessage(message);
      if (!validation.isValid) {
        throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
      }

      // Incrementar contador
      firebaseConfig.incrementMessagesSent();
      this.stats.totalSent++;

      // Enviar mensagem
      const response = await this.messaging.send(message);

      // Sucesso
      firebaseConfig.incrementMessagesSucceeded();
      this.stats.totalSucceeded++;
      this.stats.lastSent = new Date().toISOString();

      logger.info('Notification sent successfully', {
        token: token.substring(0, 20) + '...',
        messageId: response,
        title: notification.title
      });

      return {
        success: true,
        messageId: response,
        token
      };
    } catch (error) {
      // Falha
      firebaseConfig.incrementMessagesFailed(error);
      this.stats.totalFailed++;
      this.stats.lastError = {
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      };

      logger.error('Failed to send notification:', {
        error: error.message,
        code: error.code,
        token: token ? token.substring(0, 20) + '...' : 'unknown'
      });

      return {
        success: false,
        error: error.message,
        code: error.code,
        token
      };
    }
  }

  /**
   * Envia notificação para múltiplos tokens
   */
  async sendToTokens(tokens, notification, data = {}, options = {}) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Notification service not available');
      }

      if (!Array.isArray(tokens) || tokens.length === 0) {
        throw new Error('Tokens must be a non-empty array');
      }

      if (tokens.length > 500) {
        throw new Error('Maximum 500 tokens allowed per batch');
      }

      // Validar tokens
      const validTokens = tokens.filter(token => firebaseConfig.validateRegistrationToken(token));
      
      if (validTokens.length === 0) {
        throw new Error('No valid tokens provided');
      }

      if (validTokens.length !== tokens.length) {
        logger.warn(`${tokens.length - validTokens.length} invalid tokens filtered out`);
      }

      // Construir mensagem
      const message = {
        tokens: validTokens,
        notification: {
          title: notification.title,
          body: notification.body,
          ...notification
        },
        data: this._sanitizeData(data),
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#FF6B35',
            sound: 'default',
            channelId: 'default',
            ...options.android?.notification
          },
          priority: 'high',
          ...options.android
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              ...options.apns?.payload?.aps
            }
          },
          ...options.apns
        }
      };

      // Validar mensagem
      const validation = firebaseConfig.validateMessage(message);
      if (!validation.isValid) {
        throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
      }

      // Incrementar contador
      firebaseConfig.incrementMessagesSent();
      this.stats.totalSent++;

      // Enviar mensagem
      const response = await this.messaging.sendMulticast(message);

      // Processar resultados
      const results = {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses.map((resp, index) => ({
          success: resp.success,
          messageId: resp.messageId,
          error: resp.error ? {
            code: resp.error.code,
            message: resp.error.message
          } : null,
          token: validTokens[index]
        }))
      };

      // Atualizar estatísticas
      this.stats.totalSucceeded += response.successCount;
      this.stats.totalFailed += response.failureCount;
      
      if (response.successCount > 0) {
        firebaseConfig.incrementMessagesSucceeded();
        this.stats.lastSent = new Date().toISOString();
      }
      
      if (response.failureCount > 0) {
        firebaseConfig.incrementMessagesFailed(new Error(`${response.failureCount} messages failed`));
      }

      logger.info('Multicast notification sent', {
        totalTokens: validTokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
        title: notification.title
      });

      return {
        success: true,
        results,
        summary: {
          totalTokens: validTokens.length,
          successCount: response.successCount,
          failureCount: response.failureCount
        }
      };
    } catch (error) {
      firebaseConfig.incrementMessagesFailed(error);
      this.stats.totalFailed++;
      this.stats.lastError = {
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      };

      logger.error('Failed to send multicast notification:', error);

      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Envia notificação para um tópico
   */
  async sendToTopic(topic, notification, data = {}, options = {}) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Notification service not available');
      }

      if (!topic || typeof topic !== 'string') {
        throw new Error('Topic must be a non-empty string');
      }

      // Construir mensagem
      const message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          ...notification
        },
        data: this._sanitizeData(data),
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#FF6B35',
            sound: 'default',
            channelId: 'default',
            ...options.android?.notification
          },
          priority: 'high',
          ...options.android
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              ...options.apns?.payload?.aps
            }
          },
          ...options.apns
        }
      };

      // Validar mensagem
      const validation = firebaseConfig.validateMessage(message);
      if (!validation.isValid) {
        throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
      }

      // Incrementar contador
      firebaseConfig.incrementMessagesSent();
      this.stats.totalSent++;

      // Enviar mensagem
      const response = await this.messaging.send(message);

      // Sucesso
      firebaseConfig.incrementMessagesSucceeded();
      this.stats.totalSucceeded++;
      this.stats.lastSent = new Date().toISOString();

      logger.info('Topic notification sent successfully', {
        topic,
        messageId: response,
        title: notification.title
      });

      return {
        success: true,
        messageId: response,
        topic
      };
    } catch (error) {
      firebaseConfig.incrementMessagesFailed(error);
      this.stats.totalFailed++;
      this.stats.lastError = {
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      };

      logger.error('Failed to send topic notification:', error);

      return {
        success: false,
        error: error.message,
        code: error.code,
        topic
      };
    }
  }

  /**
   * Inscreve tokens em um tópico
   */
  async subscribeToTopic(tokens, topic) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Notification service not available');
      }

      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
      const validTokens = tokensArray.filter(token => firebaseConfig.validateRegistrationToken(token));

      if (validTokens.length === 0) {
        throw new Error('No valid tokens provided');
      }

      const response = await this.messaging.subscribeToTopic(validTokens, topic);

      logger.info('Tokens subscribed to topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors
      };
    } catch (error) {
      logger.error('Failed to subscribe to topic:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Desinscreve tokens de um tópico
   */
  async unsubscribeFromTopic(tokens, topic) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Notification service not available');
      }

      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
      const validTokens = tokensArray.filter(token => firebaseConfig.validateRegistrationToken(token));

      if (validTokens.length === 0) {
        throw new Error('No valid tokens provided');
      }

      const response = await this.messaging.unsubscribeFromTopic(validTokens, topic);

      logger.info('Tokens unsubscribed from topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors
      };
    } catch (error) {
      logger.error('Failed to unsubscribe from topic:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Sanitiza dados para envio (Firebase requer strings)
   */
  _sanitizeData(data) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        sanitized[key] = String(value);
      }
    }
    return sanitized;
  }

  /**
   * Obtém estatísticas do serviço
   */
  getStats() {
    const successRate = this.stats.totalSent > 0 
      ? ((this.stats.totalSucceeded / this.stats.totalSent) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.stats,
      successRate: `${successRate}%`,
      isAvailable: this.isAvailable(),
      firebase: firebaseConfig.getStats()
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats.totalSent = 0;
    this.stats.totalSucceeded = 0;
    this.stats.totalFailed = 0;
    this.stats.lastSent = null;
    this.stats.lastError = null;
    firebaseConfig.resetStats();
    logger.info('Notification service stats reset');
  }

  /**
   * Métodos de conveniência para tipos específicos de notificação
   */

  /**
   * Notificação de nova mensagem
   */
  async sendNewMessageNotification(userToken, senderName, message, chatType = 'direct') {
    return await this.sendToToken(userToken, {
      title: `Nova mensagem de ${senderName}`,
      body: message.length > 100 ? message.substring(0, 100) + '...' : message
    }, {
      type: 'new_message',
      chatType,
      senderName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notificação de chamada recebida
   */
  async sendIncomingCallNotification(userToken, callerName, callType = 'voice') {
    return await this.sendToToken(userToken, {
      title: `Chamada de ${callerName}`,
      body: callType === 'video' ? 'Chamada de vídeo recebida' : 'Chamada de voz recebida'
    }, {
      type: 'incoming_call',
      callType,
      callerName,
      timestamp: new Date().toISOString()
    }, {
      android: {
        notification: {
          channelId: 'calls',
          priority: 'max',
          sound: 'call_ringtone'
        }
      }
    });
  }

  /**
   * Notificação de nova missão
   */
  async sendNewMissionNotification(userTokens, missionTitle, federationName) {
    return await this.sendToTokens(userTokens, {
      title: 'Nova Missão Disponível',
      body: `${missionTitle} - ${federationName}`
    }, {
      type: 'new_mission',
      missionTitle,
      federationName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notificação de promoção
   */
  async sendPromotionNotification(userToken, newRole, federationName) {
    return await this.sendToToken(userToken, {
      title: 'Parabéns! Você foi promovido!',
      body: `Seu novo cargo: ${newRole} em ${federationName}`
    }, {
      type: 'promotion',
      newRole,
      federationName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Envia notificação global (para todos os usuários)
   */
  async sendGlobalNotification(title, body, data = {}) {
    return await this.sendToTopic('global_notifications', {
      title,
      body
    }, {
      type: 'global_message',
      ...data
    });
  }

  /**
   * Envia notificação para um clã específico
   */
  async sendClanNotification(clanId, title, body, data = {}) {
    return await this.sendToTopic(`clan_${clanId}_notifications`, {
      title,
      body
    }, {
      type: 'clan_message',
      clanId,
      ...data
    });
  }

  /**
   * Envia notificação para uma federação específica
   */
  async sendFederationNotification(federationId, title, body, data = {}) {
    return await this.sendToTopic(`federation_${federationId}_notifications`, {
      title,
      body
    }, {
      type: 'federation_message',
      federationId,
      ...data
    });
  }

  /**
   * Envia notificação de convite de clã
   */
  async sendInviteNotification(userToken, senderName, clanName, clanId, senderId) {
    return await this.sendToToken(userToken, {
      title: `Convite para o Clã ${clanName}`,
      body: `${senderName} convidou você para se juntar ao clã ${clanName}.`
    }, {
      type: 'clan_invite',
      senderName,
      clanName,
      clanId,
      senderId,
      timestamp: new Date().toISOString()
    });
  }
}

// Instância singleton
const notificationService = new NotificationService();

module.exports = notificationService;

