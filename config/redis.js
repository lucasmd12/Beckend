const redis = require('redis');
const winston = require('winston');

// Logger específico para Redis
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [REDIS-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class RedisConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 2000; // 2 segundos
  }

  async connect() {
    try {
      // Configuração do cliente Redis
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > this.maxRetries) {
            logger.error(`Redis max retries (${this.maxRetries}) exceeded`);
            return undefined;
          }
          // Retry com backoff exponencial
          return Math.min(options.attempt * 100, 3000);
        },
        socket: {
          connectTimeout: 10000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              logger.error('Redis reconnection attempts exceeded');
              return false;
            }
            return Math.min(retries * 50, 1000);
          }
        }
      });

      // Event listeners
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
        this.connectionAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.connectionAttempts++;
        logger.info(`Redis client reconnecting (attempt ${this.connectionAttempts})`);
      });

      // Conectar
      await this.client.connect();
      
      // Testar conexão
      await this.client.ping();
      logger.info('Redis connection established and tested successfully');
      
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        logger.info('Redis client disconnected gracefully');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis client:', error);
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client && this.client.isReady;
  }

  // Método para verificar saúde da conexão
  async healthCheck() {
    try {
      if (!this.isReady()) {
        return { status: 'disconnected', message: 'Redis client not ready' };
      }
      
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        connected: this.isConnected,
        ready: this.client.isReady
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        connected: this.isConnected
      };
    }
  }

  // Método para obter estatísticas
  async getStats() {
    try {
      if (!this.isReady()) {
        return { error: 'Redis not connected' };
      }

      const info = await this.client.info();
      const memory = await this.client.info('memory');
      const stats = await this.client.info('stats');
      
      return {
        connection: 'active',
        memory_usage: this.parseRedisInfo(memory, 'used_memory_human'),
        total_commands: this.parseRedisInfo(stats, 'total_commands_processed'),
        connected_clients: this.parseRedisInfo(info, 'connected_clients'),
        uptime: this.parseRedisInfo(info, 'uptime_in_seconds')
      };
    } catch (error) {
      logger.error('Error getting Redis stats:', error);
      return { error: error.message };
    }
  }

  // Helper para parsear info do Redis
  parseRedisInfo(info, key) {
    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith(`${key}:`)) {
        return line.split(':')[1];
      }
    }
    return 'N/A';
  }
}

// Instância singleton
const redisConfig = new RedisConfig();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing Redis connection...');
  await redisConfig.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing Redis connection...');
  await redisConfig.disconnect();
  process.exit(0);
});

module.exports = redisConfig;

