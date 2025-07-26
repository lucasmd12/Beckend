const winston = require('winston');

// Logger específico para performance
const performanceLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [PERF-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class PerformanceMiddleware {
  constructor() {
    this.requestCount = 0;
    this.slowRequests = [];
    this.maxSlowRequests = 100; // Manter apenas os últimos 100 requests lentos
    this.slowThreshold = 1000; // 1 segundo
  }

  // Middleware principal de performance
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.requestCount++;

      // Adicionar headers de cache para recursos estáticos
      if (req.url.includes('/uploads/') || req.url.includes('/api-docs/')) {
        res.set('Cache-Control', 'public, max-age=3600'); // 1 hora
      }

      // Adicionar headers de compressão
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('X-Frame-Options', 'DENY');

      // Override do res.json para otimizar serialização
      const originalJson = res.json;
      res.json = function(data) {
        // Remover campos desnecessários em produção
        if (process.env.NODE_ENV === 'production' && data && typeof data === 'object') {
          if (data.stack) delete data.stack;
          if (data.trace) delete data.trace;
        }
        return originalJson.call(this, data);
      };

      // Monitorar tempo de resposta
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log apenas requests lentos em produção
        if (duration > this.slowThreshold) {
          const slowRequest = {
            method: req.method,
            url: req.url,
            duration,
            timestamp: new Date().toISOString(),
            userAgent: req.get('User-Agent'),
            ip: req.ip
          };

          this.slowRequests.push(slowRequest);
          
          // Manter apenas os últimos requests lentos
          if (this.slowRequests.length > this.maxSlowRequests) {
            this.slowRequests.shift();
          }

          if (process.env.NODE_ENV !== 'production') {
            performanceLogger.warn(`Slow request detected: ${req.method} ${req.url} - ${duration}ms`);
          }
        }

        // Log detalhado apenas em desenvolvimento
        if (process.env.NODE_ENV !== 'production' && duration > 500) {
          performanceLogger.info(`Request: ${req.method} ${req.url} - ${duration}ms`);
        }
      });

      next();
    };
  }

  // Middleware para limitar payload
  payloadLimiter() {
    return (req, res, next) => {
      // Verificar tamanho do payload para diferentes rotas
      const contentLength = parseInt(req.get('Content-Length') || '0');
      
      // Limites específicos por rota
      const limits = {
        '/api/uploads': 10 * 1024 * 1024, // 10MB para uploads
        '/api/auth': 1024, // 1KB para auth
        '/api/monitoring': 1024, // 1KB para monitoring
        default: 5 * 1024 * 1024 // 5MB padrão
      };

      let limit = limits.default;
      for (const [path, pathLimit] of Object.entries(limits)) {
        if (path !== 'default' && req.url.startsWith(path)) {
          limit = pathLimit;
          break;
        }
      }

      if (contentLength > limit) {
        return res.status(413).json({
          error: 'Payload too large',
          maxSize: `${Math.round(limit / 1024 / 1024)}MB`,
          receivedSize: `${Math.round(contentLength / 1024 / 1024)}MB`
        });
      }

      next();
    };
  }

  // Middleware para otimizar queries do MongoDB
  mongooseOptimizer() {
    return (req, res, next) => {
      // Adicionar lean() automaticamente para requests GET que não precisam de métodos do documento
      if (req.method === 'GET' && req.url.includes('/api/')) {
        req.useLean = true;
      }

      // Limitar resultados por padrão
      if (req.method === 'GET' && !req.query.limit) {
        req.query.limit = '50'; // Limite padrão de 50 itens
      }

      next();
    };
  }

  // Middleware para cache de responses
  responseCache() {
    const cache = new Map();
    const cacheTimeout = 60000; // 1 minuto

    return (req, res, next) => {
      // Apenas cachear GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Não cachear rotas de monitoramento em tempo real
      if (req.url.includes('/api/monitoring/status') || 
          req.url.includes('/api/monitoring/sockets')) {
        return next();
      }

      const cacheKey = `${req.method}:${req.url}`;
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < cacheTimeout) {
        res.set('X-Cache', 'HIT');
        return res.json(cached.data);
      }

      // Override res.json para cachear a resposta
      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode === 200) {
          cache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });

          // Limpar cache antigo
          if (cache.size > 100) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
          }
        }
        
        res.set('X-Cache', 'MISS');
        return originalJson.call(this, data);
      };

      next();
    };
  }

  // Obter estatísticas de performance
  getStats() {
    return {
      totalRequests: this.requestCount,
      slowRequests: this.slowRequests.length,
      slowThreshold: this.slowThreshold,
      recentSlowRequests: this.slowRequests.slice(-10), // Últimos 10
      averageSlowDuration: this.slowRequests.length > 0 
        ? Math.round(this.slowRequests.reduce((sum, req) => sum + req.duration, 0) / this.slowRequests.length)
        : 0
    };
  }

  // Limpar estatísticas
  clearStats() {
    this.requestCount = 0;
    this.slowRequests = [];
  }
}

// Exportar instância singleton
const performanceMiddleware = new PerformanceMiddleware();

module.exports = performanceMiddleware;

