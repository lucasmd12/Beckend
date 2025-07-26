const redisConfig = require("../config/redis");
const CacheKeys = require("../utils/cacheKeys");
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [PRESENCE-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
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

class PresenceService {
  constructor() {
    this.redis = null;
    this.userTTL = parseInt(process.env.USER_PRESENCE_TTL) || 300; // 5 minutos
    this.heartbeatInterval = parseInt(process.env.USER_PRESENCE_HEARTBEAT_INTERVAL) || 60; // 1 minuto
    this.heartbeatTimer = null;
  }

  async initialize() {
    try {
      this.redis = redisConfig.getClient();
      if (!this.redis || !this.redis.isReady) {
        logger.warn("Redis client not ready, attempting to reconnect for PresenceService.");
        await redisConfig.connect();
        this.redis = redisConfig.getClient();
      }
      
      if (this.redis && this.redis.isReady) {
        logger.info("Presence service initialized successfully");
        this.startHeartbeat();
      } else {
        throw new Error("Redis client is not available for Presence Service.");
      }
    } catch (error) {
      logger.error("Failed to initialize presence service:", error);
    }
  }

  async setOnline(userId, socketId) {
    if (!this.redis || !this.redis.isReady) return;
    const userIdStr = userId.toString();
    const key = CacheKeys.userOnlineStatus(userIdStr);
    try {
      await this.redis.setEx(key, this.userTTL, socketId.toString());
      logger.debug(`User ${userIdStr} set online with socket ${socketId}. TTL: ${this.userTTL}s`);
    } catch (error) {
      logger.error(`Error setting user ${userIdStr} online:`, error);
    }
  }

  async setOffline(userId) {
    if (!this.redis || !this.redis.isReady) return;
    const userIdStr = userId.toString();
    const key = CacheKeys.userOnlineStatus(userIdStr);
    try {
      await this.redis.del(key);
      logger.debug(`User ${userIdStr} set offline.`);
    } catch (error) {
      logger.error(`Error setting user ${userIdStr} offline:`, error);
    }
  }

  async isOnline(userId) {
    if (!this.redis || !this.redis.isReady) return false;
    const userIdStr = userId.toString();
    const key = CacheKeys.userOnlineStatus(userIdStr);
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking if user ${userIdStr} is online:`, error);
      return false;
    }
  }

  async getSocketId(userId) {
    if (!this.redis || !this.redis.isReady) return null;
    const userIdStr = userId.toString();
    const key = CacheKeys.userOnlineStatus(userIdStr);
    try {
      return await this.redis.get(key);
    } catch (error) {
      logger.error(`Error getting socketId for user ${userIdStr}:`, error);
      return null;
    }
  }

  async getOnlineUsers() {
    if (!this.redis || !this.redis.isReady) return [];
    const pattern = CacheKeys.pattern(CacheKeys.PREFIXES.USER, 'online:*');
    try {
      const keys = [];
      for await (const key of this.redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key);
      }
      return keys.map(key => CacheKeys.parseKey(key).identifier);
    } catch (error) {
      logger.error("Error getting online users:", error);
      return [];
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer) return; 

    this.heartbeatTimer = setInterval(async () => {
      if (!this.redis || !this.redis.isReady) {
        logger.warn("Heartbeat skipped: Redis client not ready.");
        return;
      }
      const pattern = CacheKeys.pattern(CacheKeys.PREFIXES.USER, 'online:*');
      try {
        for await (const key of this.redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
          // ✅ AÇÃO: GARANTIR QUE A CHAVE É UMA STRING ANTES DE USAR
          await this.redis.expire(String(key), this.userTTL);
        }
        logger.debug("Heartbeat: TTLs de usuários online renovados.");
      } catch (error) {
        logger.error("Error during heartbeat for presence service:", error);
      }
    }, this.heartbeatInterval * 1000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      logger.info("Presence heartbeat stopped.");
    }
  }
}

const presenceService = new PresenceService();
module.exports = presenceService;
