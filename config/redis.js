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
    this.maxRetries = 10; // Aumentado para mais resiliência
  }

  async connect() {
    if (this.client && this.client.isOpen) {
      logger.info('Redis client is already connected.');
      return this.client;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          // ✅ CORREÇÃO: Usando a estratégia de reconexão da v4
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              logger.error('Redis max reconnection attempts exceeded. Stopping reconnection.');
              return new Error('Max reconnection attempts reached');
            }
            // Backoff exponencial com um teto
            const delay = Math.min(retries * 100, 3000); 
            logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries + 1}/${this.maxRetries})`);
            return delay;
          }
        }
      });

      // Event listeners
      this.client.on('connect', () => {
        logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis client is ready.');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false; // Garante que o status seja falso em caso de erro
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection has been closed.');
        this.isConnected = false;
      });

      // Conectar
      await this.client.connect();
      
      return this.client;
    } catch (error) {
      logger.error('💥 Failed to connect to Redis during initial setup:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client && this.client.isOpen) {
        await this.client.quit();
        logger.info('Redis client disconnected gracefully.');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis client:', error);
    }
  }

  getClient() {
    // ✅ CORREÇÃO: Garante que só retorna um cliente pronto para uso
    if (this.isReady()) {
      return this.client;
    }
    logger.warn('Attempted to get Redis client, but it is not ready.');
    return null;
  }

  isReady() {
    return this.isConnected && this.client && this.client.isOpen;
  }

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

const redisConfig = new RedisConfig();

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
