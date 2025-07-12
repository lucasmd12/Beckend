const cacheService = require('../services/cacheService');
const CacheKeys = require('../utils/cacheKeys');
const winston = require('winston');

// Logger específico para middleware
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [CACHE-MW-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

/**
 * Middleware de cache genérico
 * @param {object} options - Opções de configuração
 * @param {function} options.keyGenerator - Função para gerar chave do cache
 * @param {number} options.ttl - TTL em segundos
 * @param {boolean} options.skipCache - Pular cache (para debug)
 * @param {function} options.condition - Condição para usar cache
 * @returns {function} Middleware Express
 */
function cacheMiddleware(options = {}) {
  const {
    keyGenerator,
    ttl = 3600,
    skipCache = false,
    condition = () => true
  } = options;

  return async (req, res, next) => {
    // Pular cache se desabilitado ou condição não atendida
    if (skipCache || !condition(req) || !cacheService.isAvailable()) {
      return next();
    }

    try {
      // Gerar chave do cache
      let cacheKey;
      if (typeof keyGenerator === 'function') {
        cacheKey = keyGenerator(req);
      } else if (typeof keyGenerator === 'string') {
        cacheKey = keyGenerator;
      } else {
        // Chave padrão baseada na rota
        cacheKey = `route:${req.method}:${req.originalUrl}`;
      }

      // Validar chave
      if (!cacheKey) {
        logger.warn('Cache key not generated, skipping cache');
        return next();
      }

      // Tentar obter do cache
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData !== null) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        
        // Adicionar headers de cache
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'X-Cache-TTL': await cacheService.ttl(cacheKey)
        });
        
        return res.json(cachedData);
      }

      // Cache miss - interceptar resposta
      logger.debug(`Cache miss for key: ${cacheKey}`);
      
      // Salvar método original
      const originalJson = res.json;
      
      // Interceptar resposta
      res.json = function(data) {
        // Adicionar headers de cache
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey
        });
        
        // Cachear apenas respostas de sucesso
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, ttl)
            .then(() => {
              logger.debug(`Data cached for key: ${cacheKey}, TTL: ${ttl}s`);
            })
            .catch(error => {
              logger.error(`Failed to cache data for key ${cacheKey}:`, error);
            });
        }
        
        // Chamar método original
        return originalJson.call(this, data);
      };
      
      next();
      
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next(); // Continuar sem cache em caso de erro
    }
  };
}

/**
 * Middleware para cache de usuário
 * @param {number} ttl - TTL em segundos (padrão: 15 minutos)
 * @returns {function} Middleware
 */
function userCacheMiddleware(ttl = 900) {
  return cacheMiddleware({
    keyGenerator: (req) => {
      const userId = req.user?.id || req.params.userId || req.params.id;
      return userId ? CacheKeys.user(userId) : null;
    },
    ttl,
    condition: (req) => req.method === 'GET'
  });
}

/**
 * Middleware para cache de clã
 * @param {number} ttl - TTL em segundos (padrão: 30 minutos)
 * @returns {function} Middleware
 */
function clanCacheMiddleware(ttl = 1800) {
  return cacheMiddleware({
    keyGenerator: (req) => {
      const clanId = req.params.clanId || req.params.id;
      return clanId ? CacheKeys.clan(clanId) : null;
    },
    ttl,
    condition: (req) => req.method === 'GET'
  });
}

/**
 * Middleware para cache de federação
 * @param {number} ttl - TTL em segundos (padrão: 1 hora)
 * @returns {function} Middleware
 */
function federationCacheMiddleware(ttl = 3600) {
  return cacheMiddleware({
    keyGenerator: (req) => {
      const federationId = req.params.federationId || req.params.id;
      return federationId ? CacheKeys.federation(federationId) : null;
    },
    ttl,
    condition: (req) => req.method === 'GET'
  });
}

/**
 * Middleware para cache de lista de clãs
 * @param {number} ttl - TTL em segundos (padrão: 30 minutos)
 * @returns {function} Middleware
 */
function clanListCacheMiddleware(ttl = 1800) {
  return cacheMiddleware({
    keyGenerator: (req) => {
      const federationId = req.query.federationId || 'all';
      const page = req.query.page || 1;
      const limit = req.query.limit || 10;
      return CacheKeys.clanList(`${federationId}_p${page}_l${limit}`);
    },
    ttl,
    condition: (req) => req.method === 'GET'
  });
}

/**
 * Middleware para cache de estatísticas
 * @param {number} ttl - TTL em segundos (padrão: 5 minutos)
 * @returns {function} Middleware
 */
function statsCacheMiddleware(ttl = 300) {
  return cacheMiddleware({
    keyGenerator: (req) => {
      const type = req.params.type || 'global';
      return CacheKeys.generateKey('stats', type);
    },
    ttl,
    condition: (req) => req.method === 'GET'
  });
}

/**
 * Middleware para invalidar cache
 * @param {object} options - Opções de invalidação
 * @param {function} options.keyGenerator - Função para gerar chaves a invalidar
 * @param {string[]} options.patterns - Padrões de chaves a invalidar
 * @returns {function} Middleware
 */
function invalidateCacheMiddleware(options = {}) {
  const { keyGenerator, patterns = [] } = options;

  return async (req, res, next) => {
    // Salvar método original
    const originalJson = res.json;
    
    // Interceptar resposta
    res.json = function(data) {
      // Invalidar cache apenas em respostas de sucesso
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Invalidar por chaves específicas
        if (typeof keyGenerator === 'function') {
          const keys = keyGenerator(req, data);
          if (Array.isArray(keys)) {
            keys.forEach(key => {
              cacheService.del(key).catch(error => {
                logger.error(`Failed to invalidate cache key ${key}:`, error);
              });
            });
          }
        }
        
        // Invalidar por padrões
        patterns.forEach(pattern => {
          cacheService.delPattern(pattern).catch(error => {
            logger.error(`Failed to invalidate cache pattern ${pattern}:`, error);
          });
        });
      }
      
      // Chamar método original
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Middleware para invalidar cache de usuário
 * @returns {function} Middleware
 */
function invalidateUserCacheMiddleware() {
  return invalidateCacheMiddleware({
    keyGenerator: (req) => {
      const userId = req.user?.id || req.params.userId || req.params.id;
      if (!userId) return [];
      
      return [
        CacheKeys.user(userId),
        CacheKeys.userProfile(userId),
        CacheKeys.userPermissions(userId),
        CacheKeys.userStats(userId)
      ];
    }
  });
}

/**
 * Middleware para invalidar cache de clã
 * @returns {function} Middleware
 */
function invalidateClanCacheMiddleware() {
  return invalidateCacheMiddleware({
    keyGenerator: (req) => {
      const clanId = req.params.clanId || req.params.id;
      if (!clanId) return [];
      
      return [
        CacheKeys.clan(clanId),
        CacheKeys.clanMembers(clanId),
        CacheKeys.clanStats(clanId)
      ];
    },
    patterns: [
      CacheKeys.pattern('clan', 'list*'), // Invalidar todas as listas de clãs
      CacheKeys.pattern('stats', '*') // Invalidar estatísticas
    ]
  });
}

/**
 * Middleware para invalidar cache de federação
 * @returns {function} Middleware
 */
function invalidateFederationCacheMiddleware() {
  return invalidateCacheMiddleware({
    keyGenerator: (req) => {
      const federationId = req.params.federationId || req.params.id;
      if (!federationId) return [];
      
      return [
        CacheKeys.federation(federationId),
        CacheKeys.federationConfig(federationId),
        CacheKeys.federationMembers(federationId),
        CacheKeys.federationStats(federationId)
      ];
    },
    patterns: [
      CacheKeys.pattern('federation', 'list*'),
      CacheKeys.pattern('clan', 'list*'),
      CacheKeys.pattern('stats', '*')
    ]
  });
}

/**
 * Middleware para cache condicional baseado em query params
 * @param {object} options - Opções de configuração
 * @returns {function} Middleware
 */
function conditionalCacheMiddleware(options = {}) {
  const { 
    cacheParam = 'cache',
    noCacheParam = 'nocache',
    ...cacheOptions 
  } = options;

  return cacheMiddleware({
    ...cacheOptions,
    condition: (req) => {
      // Não cachear se nocache=true
      if (req.query[noCacheParam] === 'true') return false;
      
      // Cachear se cache=true ou se não especificado
      return req.query[cacheParam] !== 'false';
    }
  });
}

module.exports = {
  cacheMiddleware,
  userCacheMiddleware,
  clanCacheMiddleware,
  federationCacheMiddleware,
  clanListCacheMiddleware,
  statsCacheMiddleware,
  invalidateCacheMiddleware,
  invalidateUserCacheMiddleware,
  invalidateClanCacheMiddleware,
  invalidateFederationCacheMiddleware,
  conditionalCacheMiddleware
};

