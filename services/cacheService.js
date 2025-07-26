const redisConfig = require('../config/redis');
const CacheKeys = require('../utils/cacheKeys');
const winston = require('winston');

// Logger específico para cache
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [CACHE-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class CacheService {
  constructor() {
    this.redis = null;
    this.isEnabled = process.env.REDIS_CACHE_ENABLED !== 'false';
    this.defaultTTL = parseInt(process.env.CACHE_DEFAULT_TTL) || 3600; // 1 hora
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      sets: 0,
      deletes: 0
    };
  }

  async initialize() {
    try {
      if (!this.isEnabled) {
        logger.info('Cache service disabled via environment variable');
        return;
      }

      this.redis = redisConfig.getClient();
      if (!this.redis) {
        await redisConfig.connect();
        this.redis = redisConfig.getClient();
      }

      logger.info('Cache service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cache service:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Verifica se o cache está disponível
   * @returns {boolean}
   */
  isAvailable() {
    return this.isEnabled && redisConfig.isReady();
  }

  /**
   * Obtém valor do cache
   * @param {string} key - Chave do cache
   * @returns {Promise<any|null>} Valor ou null se não encontrado
   */
  async get(key) {
    if (!this.isAvailable()) {
      this.metrics.misses++;
      return null;
    }

    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.metrics.misses++;
        logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      this.metrics.hits++;
      logger.debug(`Cache hit for key: ${key}`);
      
      // Tentar parsear JSON, se falhar retornar string
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Define valor no cache
   * @param {string} key - Chave do cache
   * @param {any} value - Valor a ser armazenado
   * @param {number} ttl - TTL em segundos (opcional)
   * @returns {Promise<boolean>} True se sucesso
   */
  async set(key, value, ttl = null) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const expiration = ttl || this.defaultTTL;

      await this.redis.setEx(key, expiration, serializedValue);
      
      this.metrics.sets++;
      logger.debug(`Cache set for key: ${key}, TTL: ${expiration}s`);
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove valor do cache
   * @param {string} key - Chave do cache
   * @returns {Promise<boolean>} True se removido
   */
  async del(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.redis.del(key);
      this.metrics.deletes++;
      logger.debug(`Cache delete for key: ${key}, result: ${result}`);
      return result > 0;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove múltiplas chaves por padrão
   * @param {string} pattern - Padrão de busca
   * @returns {Promise<number>} Número de chaves removidas
   */
  async delPattern(pattern) {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(keys);
      this.metrics.deletes += result;
      logger.info(`Cache pattern delete: ${pattern}, removed ${result} keys`);
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache pattern delete error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Verifica se chave existe
   * @param {string} key - Chave do cache
   * @returns {Promise<boolean>} True se existe
   */
  async exists(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Define TTL para uma chave existente
   * @param {string} key - Chave do cache
   * @param {number} ttl - TTL em segundos
   * @returns {Promise<boolean>} True se sucesso
   */
  async expire(key, ttl) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Obtém TTL restante de uma chave
   * @param {string} key - Chave do cache
   * @returns {Promise<number>} TTL em segundos (-1 se sem TTL, -2 se não existe)
   */
  async ttl(key) {
    if (!this.isAvailable()) {
      return -2;
    }

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Incrementa valor numérico
   * @param {string} key - Chave do cache
   * @param {number} increment - Valor a incrementar (padrão: 1)
   * @returns {Promise<number|null>} Novo valor ou null se erro
   */
  async incr(key, increment = 1) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = increment === 1 
        ? await this.redis.incr(key)
        : await this.redis.incrBy(key, increment);
      return result;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Adiciona item a uma lista
   * @param {string} key - Chave da lista
   * @param {any} value - Valor a adicionar
   * @param {string} direction - 'left' ou 'right' (padrão: 'right')
   * @returns {Promise<number|null>} Tamanho da lista ou null se erro
   */
  async listPush(key, value, direction = 'right') {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const result = direction === 'left' 
        ? await this.redis.lPush(key, serializedValue)
        : await this.redis.rPush(key, serializedValue);
      return result;
    } catch (error) {
      logger.error(`Cache list push error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove e retorna item de uma lista
   * @param {string} key - Chave da lista
   * @param {string} direction - 'left' ou 'right' (padrão: 'left')
   * @returns {Promise<any|null>} Valor removido ou null
   */
  async listPop(key, direction = 'left') {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = direction === 'left' 
        ? await this.redis.lPop(key)
        : await this.redis.rPop(key);
      
      if (value === null) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error(`Cache list pop error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Obtém range de uma lista
   * @param {string} key - Chave da lista
   * @param {number} start - Índice inicial
   * @param {number} stop - Índice final
   * @returns {Promise<any[]>} Array de valores
   */
  async listRange(key, start = 0, stop = -1) {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const values = await this.redis.lRange(key, start, stop);
      return values.map(value => {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      });
    } catch (error) {
      logger.error(`Cache list range error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Adiciona item a um set
   * @param {string} key - Chave do set
   * @param {any} value - Valor a adicionar
   * @returns {Promise<boolean>} True se adicionado (não existia)
   */
  async setAdd(key, value) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const result = await this.redis.sAdd(key, serializedValue);
      return result === 1;
    } catch (error) {
      logger.error(`Cache set add error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove item de um set
   * @param {string} key - Chave do set
   * @param {any} value - Valor a remover
   * @returns {Promise<boolean>} True se removido (existia)
   */
  async setRemove(key, value) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const result = await this.redis.sRem(key, serializedValue);
      return result === 1;
    } catch (error) {
      logger.error(`Cache set remove error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Obtém todos os membros de um set
   * @param {string} key - Chave do set
   * @returns {Promise<any[]>} Array de valores
   */
  async setMembers(key) {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const values = await this.redis.sMembers(key);
      return values.map(value => {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      });
    } catch (error) {
      logger.error(`Cache set members error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Limpa todo o cache
   * @returns {Promise<boolean>} True se sucesso
   */
  async flush() {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.redis.flushDb();
      logger.info('Cache flushed successfully');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Obtém métricas do cache
   * @returns {object} Métricas atuais
   */
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total * 100).toFixed(2) : 0;
    
    return {
      ...this.metrics,
      hitRate: `${hitRate}%`,
      total: total,
      isEnabled: this.isEnabled,
      isAvailable: this.isAvailable()
    };
  }

  /**
   * Reseta métricas
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      sets: 0,
      deletes: 0
    };
    logger.info('Cache metrics reset');
  }

  /**
   * Obtém informações de saúde do cache
   * @returns {Promise<object>} Status de saúde
   */
  async getHealth() {
    const health = await redisConfig.healthCheck();
    const metrics = this.getMetrics();
    
    return {
      ...health,
      metrics,
      defaultTTL: this.defaultTTL,
      enabled: this.isEnabled
    };
  }
}

// Instância singleton
const cacheService = new CacheService();

module.exports = cacheService;

