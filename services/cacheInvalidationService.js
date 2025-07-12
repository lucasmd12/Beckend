const cacheService = require('./cacheService');
const CacheKeys = require('../utils/cacheKeys');
const winston = require('winston');

// Logger específico para invalidação
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [INVALIDATION-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

class CacheInvalidationService {
  constructor() {
    this.invalidationRules = new Map();
    this.setupDefaultRules();
  }

  /**
   * Configura regras padrão de invalidação
   */
  setupDefaultRules() {
    // Regras para usuários
    this.addRule('user_updated', (data) => [
      CacheKeys.user(data.userId),
      CacheKeys.userProfile(data.userId),
      CacheKeys.userPermissions(data.userId),
      CacheKeys.userStats(data.userId)
    ]);

    this.addRule('user_online_status', (data) => [
      CacheKeys.userOnlineStatus(data.userId),
      CacheKeys.onlineUsers(),
      CacheKeys.globalStats()
    ]);

    // Regras para clãs
    this.addRule('clan_updated', (data) => [
      CacheKeys.clan(data.clanId),
      CacheKeys.clanMembers(data.clanId),
      CacheKeys.clanStats(data.clanId),
      CacheKeys.pattern('clan', 'list*'), // Todas as listas de clãs
      CacheKeys.globalStats()
    ]);

    this.addRule('clan_member_added', (data) => [
      CacheKeys.clan(data.clanId),
      CacheKeys.clanMembers(data.clanId),
      CacheKeys.user(data.userId),
      CacheKeys.pattern('clan', 'list*'),
      CacheKeys.globalStats()
    ]);

    this.addRule('clan_member_removed', (data) => [
      CacheKeys.clan(data.clanId),
      CacheKeys.clanMembers(data.clanId),
      CacheKeys.user(data.userId),
      CacheKeys.pattern('clan', 'list*'),
      CacheKeys.globalStats()
    ]);

    // Regras para federações
    this.addRule('federation_updated', (data) => [
      CacheKeys.federation(data.federationId),
      CacheKeys.federationConfig(data.federationId),
      CacheKeys.federationMembers(data.federationId),
      CacheKeys.federationStats(data.federationId),
      CacheKeys.federationList(),
      CacheKeys.pattern('clan', 'list*'), // Clãs podem estar afetados
      CacheKeys.globalStats()
    ]);

    // Regras para missões
    this.addRule('mission_created', (data) => [
      CacheKeys.mission(data.missionId),
      CacheKeys.missionList(data.clanId),
      CacheKeys.activeMissions(),
      CacheKeys.clanMissions(data.clanId)
    ]);

    this.addRule('mission_updated', (data) => [
      CacheKeys.mission(data.missionId),
      CacheKeys.missionList(data.clanId),
      CacheKeys.activeMissions(),
      CacheKeys.clanMissions(data.clanId)
    ]);

    this.addRule('mission_completed', (data) => [
      CacheKeys.mission(data.missionId),
      CacheKeys.missionList(data.clanId),
      CacheKeys.activeMissions(),
      CacheKeys.clanMissions(data.clanId),
      CacheKeys.clanStats(data.clanId),
      CacheKeys.globalStats()
    ]);

    // Regras para chat
    this.addRule('chat_message_sent', (data) => [
      CacheKeys.chatHistory(data.channelId, 1), // Primeira página do histórico
      CacheKeys.chatOnlineUsers(data.channelId)
    ]);

    // Regras para voz
    this.addRule('voice_room_joined', (data) => [
      CacheKeys.voiceRoom(data.roomId),
      CacheKeys.voiceParticipants(data.roomId),
      CacheKeys.activeVoiceRooms()
    ]);

    this.addRule('voice_room_left', (data) => [
      CacheKeys.voiceRoom(data.roomId),
      CacheKeys.voiceParticipants(data.roomId),
      CacheKeys.activeVoiceRooms()
    ]);
  }

  /**
   * Adiciona regra de invalidação
   * @param {string} event - Nome do evento
   * @param {function} keyGenerator - Função que gera chaves a invalidar
   */
  addRule(event, keyGenerator) {
    this.invalidationRules.set(event, keyGenerator);
    logger.debug(`Invalidation rule added for event: ${event}`);
  }

  /**
   * Remove regra de invalidação
   * @param {string} event - Nome do evento
   */
  removeRule(event) {
    const removed = this.invalidationRules.delete(event);
    if (removed) {
      logger.debug(`Invalidation rule removed for event: ${event}`);
    }
    return removed;
  }

  /**
   * Invalida cache baseado em evento
   * @param {string} event - Nome do evento
   * @param {object} data - Dados do evento
   * @returns {Promise<number>} Número de chaves invalidadas
   */
  async invalidate(event, data = {}) {
    try {
      const rule = this.invalidationRules.get(event);
      
      if (!rule) {
        logger.warn(`No invalidation rule found for event: ${event}`);
        return 0;
      }

      const keysToInvalidate = rule(data);
      let invalidatedCount = 0;

      for (const key of keysToInvalidate) {
        if (key.includes('*')) {
          // É um padrão - usar delPattern
          const count = await cacheService.delPattern(key);
          invalidatedCount += count;
          logger.debug(`Invalidated pattern ${key}: ${count} keys`);
        } else {
          // É uma chave específica
          const success = await cacheService.del(key);
          if (success) {
            invalidatedCount++;
            logger.debug(`Invalidated key: ${key}`);
          }
        }
      }

      if (invalidatedCount > 0) {
        logger.info(`Event '${event}' invalidated ${invalidatedCount} cache entries`);
      }

      return invalidatedCount;
    } catch (error) {
      logger.error(`Error invalidating cache for event '${event}':`, error);
      return 0;
    }
  }

  /**
   * Invalida cache relacionado a um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<number>} Número de chaves invalidadas
   */
  async invalidateUser(userId) {
    return await this.invalidate('user_updated', { userId });
  }

  /**
   * Invalida cache relacionado a um clã
   * @param {string} clanId - ID do clã
   * @returns {Promise<number>} Número de chaves invalidadas
   */
  async invalidateClan(clanId) {
    return await this.invalidate('clan_updated', { clanId });
  }

  /**
   * Invalida cache relacionado a uma federação
   * @param {string} federationId - ID da federação
   * @returns {Promise<number>} Número de chaves invalidadas
   */
  async invalidateFederation(federationId) {
    return await this.invalidate('federation_updated', { federationId });
  }

  /**
   * Invalida cache relacionado a missões
   * @param {string} missionId - ID da missão
   * @param {string} clanId - ID do clã
   * @returns {Promise<number>} Número de chaves invalidadas
   */
  async invalidateMission(missionId, clanId) {
    return await this.invalidate('mission_updated', { missionId, clanId });
  }

  /**
   * Invalida todas as estatísticas
   * @returns {Promise<number>} Número de chaves invalidadas
   */
  async invalidateStats() {
    try {
      const pattern = CacheKeys.pattern('stats', '*');
      const count = await cacheService.delPattern(pattern);
      logger.info(`Invalidated all stats cache: ${count} keys`);
      return count;
    } catch (error) {
      logger.error('Error invalidating stats cache:', error);
      return 0;
    }
  }

  /**
   * Invalida cache por categoria
   * @param {string} category - Categoria (user, clan, federation, etc.)
   * @returns {Promise<number>} Número de chaves invalidadas
   */
  async invalidateCategory(category) {
    try {
      const pattern = CacheKeys.pattern(category, '*');
      const count = await cacheService.delPattern(pattern);
      logger.info(`Invalidated category '${category}' cache: ${count} keys`);
      return count;
    } catch (error) {
      logger.error(`Error invalidating category '${category}' cache:`, error);
      return 0;
    }
  }

  /**
   * Invalida cache com base em dependências
   * @param {string[]} dependencies - Array de dependências
   * @returns {Promise<number>} Número de chaves invalidadas
   */
  async invalidateDependencies(dependencies) {
    let totalInvalidated = 0;

    for (const dependency of dependencies) {
      const [type, id] = dependency.split(':');
      
      switch (type) {
        case 'user':
          totalInvalidated += await this.invalidateUser(id);
          break;
        case 'clan':
          totalInvalidated += await this.invalidateClan(id);
          break;
        case 'federation':
          totalInvalidated += await this.invalidateFederation(id);
          break;
        case 'stats':
          totalInvalidated += await this.invalidateStats();
          break;
        case 'category':
          totalInvalidated += await this.invalidateCategory(id);
          break;
        default:
          logger.warn(`Unknown dependency type: ${type}`);
      }
    }

    return totalInvalidated;
  }

  /**
   * Middleware para invalidação automática
   * @param {object} options - Opções de configuração
   * @returns {function} Middleware Express
   */
  middleware(options = {}) {
    const { 
      event,
      dataExtractor = (req, res) => ({}),
      condition = () => true 
    } = options;

    return async (req, res, next) => {
      // Salvar método original
      const originalJson = res.json;
      
      // Interceptar resposta
      res.json = function(data) {
        // Invalidar cache apenas em respostas de sucesso
        if (res.statusCode >= 200 && res.statusCode < 300 && condition(req, res)) {
          const eventData = dataExtractor(req, res, data);
          
          // Invalidar de forma assíncrona para não bloquear resposta
          setImmediate(async () => {
            try {
              await this.invalidate(event, eventData);
            } catch (error) {
              logger.error(`Error in invalidation middleware for event '${event}':`, error);
            }
          });
        }
        
        // Chamar método original
        return originalJson.call(this, data);
      }.bind(this);
      
      next();
    };
  }

  /**
   * Obtém estatísticas de invalidação
   * @returns {object} Estatísticas
   */
  getStats() {
    return {
      rulesCount: this.invalidationRules.size,
      rules: Array.from(this.invalidationRules.keys()),
      isEnabled: cacheService.isAvailable()
    };
  }
}

// Instância singleton
const cacheInvalidationService = new CacheInvalidationService();

module.exports = cacheInvalidationService;

