const cacheService = require('./cacheService');
const CacheKeys = require('../utils/cacheKeys');
const jwt = require('jsonwebtoken');
const winston = require('winston');

// Logger específico para sessões
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [SESSION-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class SessionService {
  constructor() {
    this.defaultTTL = 24 * 60 * 60; // 24 horas
    this.refreshThreshold = 2 * 60 * 60; // 2 horas antes do vencimento
  }

  /**
   * Armazena sessão no cache
   * @param {string | number} userId - ID do usuário
   * @param {object} sessionData - Dados da sessão
   * @param {number} ttl - TTL em segundos
   * @returns {Promise<boolean>} True se sucesso
   */
  async storeSession(userId, sessionData, ttl = this.defaultTTL) {
    if (!cacheService.isAvailable()) return false;
    try {
      const userIdStr = String(userId);
      const sessionKey = CacheKeys.userSession(userIdStr);
      const sessionInfo = {
        userId: userIdStr,
        ...sessionData,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        lastActivity: new Date().toISOString()
      };

      const success = await cacheService.set(sessionKey, sessionInfo, ttl);
      
      if (success) {
        logger.info(`Session stored for user ${userIdStr}, TTL: ${ttl}s`);
        await cacheService.setAdd(CacheKeys.onlineUsers(), userIdStr);
      }
      
      return success;
    } catch (error) {
      logger.error(`Error storing session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Obtém sessão do cache
   * @param {string | number} userId - ID do usuário
   * @returns {Promise<object|null>} Dados da sessão ou null
   */
  async getSession(userId) {
    if (!cacheService.isAvailable()) return null;
    try {
      const userIdStr = String(userId);
      const sessionKey = CacheKeys.userSession(userIdStr);
      const sessionData = await cacheService.get(sessionKey);
      
      if (sessionData) {
        await this.updateLastActivity(userIdStr);
        logger.debug(`Session retrieved for user ${userIdStr}`);
      }
      
      return sessionData;
    } catch (error) {
      logger.error(`Error getting session for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Remove sessão do cache
   * @param {string | number} userId - ID do usuário
   * @returns {Promise<boolean>} True se removida
   */
  async removeSession(userId) {
    if (!cacheService.isAvailable()) return false;
    try {
      const userIdStr = String(userId);
      const sessionKey = CacheKeys.userSession(userIdStr);
      const success = await cacheService.del(sessionKey);
      
      if (success) {
        await cacheService.setRemove(CacheKeys.onlineUsers(), userIdStr);
        logger.info(`Session removed for user ${userIdStr}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Error removing session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Atualiza última atividade da sessão
   * @param {string | number} userId - ID do usuário
   * @returns {Promise<boolean>} True se atualizada
   */
  async updateLastActivity(userId) {
    if (!cacheService.isAvailable()) return false;
    try {
      const userIdStr = String(userId);
      const sessionKey = CacheKeys.userSession(userIdStr);
      const sessionData = await cacheService.get(sessionKey);
      
      if (sessionData) {
        sessionData.lastActivity = new Date().toISOString();
        
        const expiresAt = new Date(sessionData.expiresAt);
        const now = new Date();
        const timeUntilExpiry = (expiresAt.getTime() - now.getTime()) / 1000;
        
        if (timeUntilExpiry < this.refreshThreshold) {
          const newTTL = this.defaultTTL;
          sessionData.expiresAt = new Date(Date.now() + newTTL * 1000).toISOString();
          await cacheService.set(sessionKey, sessionData, newTTL);
          logger.info(`Session renewed for user ${userIdStr}, new TTL: ${newTTL}s`);
        } else {
          const currentTTL = await cacheService.ttl(sessionKey);
          if (currentTTL > 0) {
            await cacheService.set(sessionKey, sessionData, currentTTL);
          }
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error updating last activity for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Verifica se sessão é válida
   * @param {string | number} userId - ID do usuário
   * @returns {Promise<boolean>} True se válida
   */
  async isSessionValid(userId) {
    if (!cacheService.isAvailable()) return false;
    try {
      const userIdStr = String(userId);
      const sessionData = await this.getSession(userIdStr);
      
      if (!sessionData) return false;
      
      const expiresAt = new Date(sessionData.expiresAt);
      const now = new Date();
      
      return expiresAt > now;
    } catch (error) {
      logger.error(`Error validating session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Obtém todas as sessões ativas
   * @returns {Promise<object[]>} Array de sessões ativas
   */
  async getActiveSessions() {
    if (!cacheService.isAvailable()) return [];
    try {
      const onlineUsers = await cacheService.setMembers(CacheKeys.onlineUsers());
      const sessions = [];
      
      for (const userId of onlineUsers) {
        const userIdStr = String(userId);
        const sessionData = await this.getSession(userIdStr);
        if (sessionData && await this.isSessionValid(userIdStr)) {
          sessions.push(sessionData);
        } else {
          await cacheService.setRemove(CacheKeys.onlineUsers(), userIdStr);
        }
      }
      
      return sessions;
    } catch (error) {
      logger.error('Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Limpa sessões expiradas
   * @returns {Promise<number>} Número de sessões removidas
   */
  async cleanupExpiredSessions() {
    if (!cacheService.isAvailable()) return 0;
    try {
      const onlineUsers = await cacheService.setMembers(CacheKeys.onlineUsers());
      let removedCount = 0;
      
      for (const userId of onlineUsers) {
        const userIdStr = String(userId);
        const isValid = await this.isSessionValid(userIdStr);
        if (!isValid) {
          await this.removeSession(userIdStr);
          removedCount++;
        }
      }
      
      if (removedCount > 0) {
        logger.info(`Cleaned up ${removedCount} expired sessions`);
      }
      
      return removedCount;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Obtém estatísticas de sessões
   * @returns {Promise<object>} Estatísticas
   */
  async getSessionStats() {
    if (!cacheService.isAvailable()) return { total: 0, error: 'Cache service not available' };
    try {
      const activeSessions = await this.getActiveSessions();
      const totalOnline = activeSessions.length;
      
      const now = new Date();
      const stats = {
        total: totalOnline,
        byActivity: { last5min: 0, last15min: 0, last1hour: 0, older: 0 },
        byDuration: { under1hour: 0, under6hours: 0, under24hours: 0, over24hours: 0 }
      };
      
      activeSessions.forEach(session => {
        const lastActivity = new Date(session.lastActivity);
        const createdAt = new Date(session.createdAt);
        const activityAge = (now - lastActivity) / 1000 / 60;
        const sessionAge = (now - createdAt) / 1000 / 60 / 60;
        
        if (activityAge <= 5) stats.byActivity.last5min++;
        else if (activityAge <= 15) stats.byActivity.last15min++;
        else if (activityAge <= 60) stats.byActivity.last1hour++;
        else stats.byActivity.older++;
        
        if (sessionAge < 1) stats.byDuration.under1hour++;
        else if (sessionAge < 6) stats.byDuration.under6hours++;
        else if (sessionAge < 24) stats.byDuration.under24hours++;
        else stats.byDuration.over24hours++;
      });
      
      return stats;
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return { total: 0, error: error.message };
    }
  }

  /**
   * Middleware para verificar sessão
   * @returns {function} Middleware Express
   */
  middleware() {
    return async (req, res, next) => {
      try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
          return res.status(401).json({ msg: 'Token não fornecido' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = String(decoded.user.id); // ✅ GARANTIA: Converte para string
        
        const sessionData = await this.getSession(userId);
        
        if (!sessionData || !await this.isSessionValid(userId)) {
          return res.status(401).json({ msg: 'Sessão inválida ou expirada' });
        }
        
        req.user = decoded.user;
        req.session = sessionData;
        
        next();
      } catch (error) {
        logger.error('Session middleware error:', error);
        res.status(401).json({ msg: 'Token inválido' });
      }
    };
  }
}

// Instância singleton
const sessionService = new SessionService();

// Limpeza automática de sessões expiradas (a cada 30 minutos)
setInterval(async () => {
  try {
    await sessionService.cleanupExpiredSessions();
  } catch (error) {
    logger.error('Error in automatic session cleanup:', error);
  }
}, 30 * 60 * 1000);

module.exports = sessionService;
