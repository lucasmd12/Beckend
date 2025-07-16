const redis = require('redis');
const winston = require('winston');

// Logger específico para cache
const cacheLogger = winston.createLogger({
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

class OptimizedCacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.localCache = new Map(); // Cache local como fallback
    this.maxLocalCacheSize = 1000;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0
    };
  }

  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            cacheLogger.error('Redis connection refused, using local cache');
            return false; // Não tentar reconectar
          }
          if (options.attempt > 3) {
            cacheLogger.error('Redis max retries exceeded, using local cache');
            return false;
          }
          return Math.min(options.attempt * 100, 3000);
        },
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      this.client.on('connect', () => {
        cacheLogger.info('Optimized cache service connected to Redis');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        cacheLogger.error('Redis error, falling back to local cache:', err.message);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        cacheLogger.warn('Redis connection ended, using local cache');
        this.isConnected = false;
      });

      await this.client.connect();
      await this.client.ping();
      
      cacheLogger.info('Optimized cache service initialized successfully');
      return true;
    } catch (error) {
      cacheLogger.error('Failed to initialize Redis, using local cache only:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  // Método otimizado para get
  async get(key) {
    try {
      let value = null;

      // Tentar Redis primeiro se conectado
      if (this.isConnected && this.client) {
        try {
          value = await this.client.get(key);
          if (value !== null) {
            this.stats.hits++;
            return JSON.parse(value);
          }
        } catch (error) {
          cacheLogger.warn(`Redis get error for key ${key}:`, error.message);
          this.isConnected = false;
        }
      }

      // Fallback para cache local
      if (this.localCache.has(key)) {
        const cached = this.localCache.get(key);
        if (Date.now() < cached.expiry) {
          this.stats.hits++;
          return cached.value;
        } else {
          this.localCache.delete(key);
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      cacheLogger.error(`Cache get error for key ${key}:`, error.message);
      return null;
    }
  }

  // Método otimizado para set
  async set(key, value, ttl = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      
      // Tentar Redis primeiro se conectado
      if (this.isConnected && this.client) {
        try {
          await this.client.setEx(key, ttl, serializedValue);
          this.stats.sets++;
        } catch (error) {
          cacheLogger.warn(`Redis set error for key ${key}:`, error.message);
          this.isConnected = false;
        }
      }

      // Sempre armazenar no cache local como backup
      this.localCache.set(key, {
        value,
        expiry: Date.now() + (ttl * 1000)
      });

      // Limitar tamanho do cache local
      if (this.localCache.size > this.maxLocalCacheSize) {
        const firstKey = this.localCache.keys().next().value;
        this.localCache.delete(firstKey);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      cacheLogger.error(`Cache set error for key ${key}:`, error.message);
      return false;
    }
  }

  // Método para delete
  async del(key) {
    try {
      // Deletar do Redis se conectado
      if (this.isConnected && this.client) {
        try {
          await this.client.del(key);
        } catch (error) {
          cacheLogger.warn(`Redis del error for key ${key}:`, error.message);
        }
      }

      // Deletar do cache local
      this.localCache.delete(key);
      return true;
    } catch (error) {
      cacheLogger.error(`Cache del error for key ${key}:`, error.message);
      return false;
    }
  }

  // Método para flush
  async flush() {
    try {
      // Flush Redis se conectado
      if (this.isConnected && this.client) {
        try {
          await this.client.flushDb();
        } catch (error) {
          cacheLogger.warn('Redis flush error:', error.message);
        }
      }

      // Limpar cache local
      this.localCache.clear();
      return true;
    } catch (error) {
      cacheLogger.error('Cache flush error:', error.message);
      return false;
    }
  }

  // Cache específico para queries do MongoDB
  async cacheQuery(queryKey, queryFunction, ttl = 300) {
    try {
      const cached = await this.get(queryKey);
      if (cached !== null) {
        return cached;
      }

      const result = await queryFunction();
      await this.set(queryKey, result, ttl);
      return result;
    } catch (error) {
      cacheLogger.error(`Query cache error for key ${queryKey}:`, error.message);
      // Executar query mesmo se o cache falhar
      return await queryFunction();
    }
  }

  // Cache para sessões de usuário
  async cacheUserSession(userId, sessionData, ttl = 1800) {
    const key = `user_session:${userId}`;
    return await this.set(key, sessionData, ttl);
  }

  async getUserSession(userId) {
    const key = `user_session:${userId}`;
    return await this.get(key);
  }

  // Cache para dados de monitoramento
  async cacheMonitoringData(type, data, ttl = 60) {
    const key = `monitoring:${type}`;
    return await this.set(key, data, ttl);
  }

  async getMonitoringData(type) {
    const key = `monitoring:${type}`;
    return await this.get(key);
  }

  // Obter estatísticas do cache
  getStats() {
    return {
      ...this.stats,
      isRedisConnected: this.isConnected,
      localCacheSize: this.localCache.size,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // Limpar estatísticas
  clearStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0
    };
  }

  // Limpeza automática do cache local
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.localCache.entries()) {
        if (now >= cached.expiry) {
          this.localCache.delete(key);
        }
      }
    }, 60000); // Limpar a cada minuto
  }

  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        cacheLogger.info('Optimized cache service disconnected');
      }
    } catch (error) {
      cacheLogger.error('Error disconnecting cache service:', error.message);
    }
  }
}

// Exportar instância singleton
const optimizedCacheService = new OptimizedCacheService();

// Iniciar limpeza automática
optimizedCacheService.startCleanupInterval();

// Graceful shutdown
process.on('SIGINT', async () => {
  await optimizedCacheService.disconnect();
});

process.on('SIGTERM', async () => {
  await optimizedCacheService.disconnect();
});

module.exports = optimizedCacheService;

