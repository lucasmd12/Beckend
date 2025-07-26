const User = require('../models/User');
const Clan = require('../models/Clan');
const Federation = require('../models/Federation');
const FCMToken = require('../models/FCMToken');
const winston = require('winston');

// Logger específico para segmentação
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [SEGMENT-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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
 * Serviço para buscar tokens FCM segmentados
 */
class SegmentedTokenService {
  
  /**
   * Busca todos os tokens FCM ativos (para ADMs)
   */
  static async getAllActiveTokens() {
    try {
      logger.info('Fetching all active FCM tokens for admin broadcast');
      
      const tokens = await FCMToken.find({
        isActive: true,
        lastUsed: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
      })
    .populate("user", "name role username")   .select('token deviceInfo user')
      .lean();
      
      const validTokens = tokens
        .filter(tokenDoc => tokenDoc.token && tokenDoc.user)
        .map(tokenDoc => ({
          token: tokenDoc.token,
          userId: tokenDoc.user._id,
          userName: tokenDoc.user.name || tokenDoc.user.username,
          userRole: tokenDoc.user.role,
          deviceInfo: tokenDoc.deviceInfo
        }));
      
      logger.info(`Found ${validTokens.length} active tokens for admin broadcast`, {
        totalTokens: tokens.length,
        validTokens: validTokens.length
      });
      
      return {
        success: true,
        tokens: validTokens,
        count: validTokens.length,
        metadata: {
          totalFound: tokens.length,
          validTokens: validTokens.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error fetching all active tokens:', error);
      return {
        success: false,
        error: error.message,
        tokens: [],
        count: 0
      };
    }
  }
  
  /**
   * Busca tokens FCM dos membros de um clã específico
   */
  static async getClanMemberTokens(clanId) {
    try {
      logger.info('Fetching FCM tokens for clan members', { clanId });
      
      // Buscar o clã e seus membros
      const clan = await Clan.findById(clanId)
        .populate("members", "_id name role username")
        .select('name members leader')
        .lean();
      
      if (!clan) {
        logger.warn('Clan not found for token fetch', { clanId });
        return {
          success: false,
          error: 'Clã não encontrado',
          tokens: [],
          count: 0
        };
      }
      
      // Extrair IDs dos membros
      const memberIds = clan.members.map(member => member._id);
      
      if (memberIds.length === 0) {
        logger.info('No members found in clan', { clanId, clanName: clan.name });
        return {
          success: true,
          tokens: [],
          count: 0,
          metadata: {
            clanId,
            clanName: clan.name,
            memberCount: 0,
            lastUpdated: new Date().toISOString()
          }
        };
      }
      
      // Buscar tokens FCM dos membros
      const tokens = await FCMToken.find({
        user: { $in: memberIds },
        isActive: true,
        lastUsed: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
      })
      .populate('user', 'name role username')
      .select('token deviceInfo user')
      .lean();
      
      const validTokens = tokens
        .filter(tokenDoc => tokenDoc.token && tokenDoc.user)
        .map(tokenDoc => ({
          token: tokenDoc.token,
          userId: tokenDoc.user._id,
          userName: tokenDoc.user.name || tokenDoc.user.username,
          userRole: tokenDoc.user.role,
          deviceInfo: tokenDoc.deviceInfo
        }));
      
      logger.info(`Found ${validTokens.length} active tokens for clan members`, {
        clanId,
        clanName: clan.name,
        totalMembers: memberIds.length,
        tokensFound: tokens.length,
        validTokens: validTokens.length
      });
      
      return {
        success: true,
        tokens: validTokens,
        count: validTokens.length,
        metadata: {
          clanId,
          clanName: clan.name,
          totalMembers: memberIds.length,
          tokensFound: tokens.length,
          validTokens: validTokens.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error fetching clan member tokens:', error);
      return {
        success: false,
        error: error.message,
        tokens: [],
        count: 0
      };
    }
  }
  
  /**
   * Busca tokens FCM dos líderes de uma federação específica
   */
  static async getFederationLeaderTokens(federationId) {
    try {
      logger.info('Fetching FCM tokens for federation leaders', { federationId });
      
      // Buscar a federação e seus clãs
      const federation = await Federation.findById(federationId)
        .populate({
          path: 'clans',
          select: 'name leader',
          populate: {
            path: 'leader',
            select: '_id name role username'
          }
        })
        .select('name clans leader')
        .lean();
      
      if (!federation) {
        logger.warn('Federation not found for token fetch', { federationId });
        return {
          success: false,
          error: 'Federação não encontrada',
          tokens: [],
          count: 0
        };
      }
      
      // Extrair IDs dos líderes dos clãs
      const leaderIds = federation.clans
        .filter(clan => clan.leader)
        .map(clan => clan.leader._id);
      
      // Adicionar o líder da federação se existir
      if (federation.leader) {
        leaderIds.push(federation.leader);
      }
      
      if (leaderIds.length === 0) {
        logger.info('No leaders found in federation', { federationId, federationName: federation.name });
        return {
          success: true,
          tokens: [],
          count: 0,
          metadata: {
            federationId,
            federationName: federation.name,
            leaderCount: 0,
            lastUpdated: new Date().toISOString()
          }
        };
      }
      
      // Buscar tokens FCM dos líderes
      const tokens = await FCMToken.find({
        user: { $in: leaderIds },
        isActive: true,
        lastUsed: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
      })
      .populate('user', 'name role username')
      .select('token deviceInfo user')
      .lean();
      
      const validTokens = tokens
        .filter(tokenDoc => tokenDoc.token && tokenDoc.user)
        .map(tokenDoc => ({
          token: tokenDoc.token,
          userId: tokenDoc.user._id,
          userName: tokenDoc.user.name || tokenDoc.user.username,
          userRole: tokenDoc.user.role,
          deviceInfo: tokenDoc.deviceInfo
        }));
      
      logger.info(`Found ${validTokens.length} active tokens for federation leaders`, {
        federationId,
        federationName: federation.name,
        totalLeaders: leaderIds.length,
        tokensFound: tokens.length,
        validTokens: validTokens.length
      });
      
      return {
        success: true,
        tokens: validTokens,
        count: validTokens.length,
        metadata: {
          federationId,
          federationName: federation.name,
          totalLeaders: leaderIds.length,
          tokensFound: tokens.length,
          validTokens: validTokens.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error fetching federation leader tokens:', error);
      return {
        success: false,
        error: error.message,
        tokens: [],
        count: 0
      };
    }
  }
  
  /**
   * Busca tokens FCM por role específico
   */
  static async getTokensByRole(role) {
    try {
      logger.info('Fetching FCM tokens by role', { role });
      
      // Buscar usuários com o role específico
      const users = await User.find({ role })
        .select('_id name username')
        .lean();
      
      if (users.length === 0) {
        logger.info('No users found with specified role', { role });
        return {
          success: true,
          tokens: [],
          count: 0,
          metadata: {
            role,
            userCount: 0,
            lastUpdated: new Date().toISOString()
          }
        };
      }
      
      const userIds = users.map(user => user._id);
      
      // Buscar tokens FCM dos usuários
      const tokens = await FCMToken.find({
        user: { $in: userIds },
        isActive: true,
        lastUsed: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
      })
      .populate('user', 'name role username')
      .select('token deviceInfo user')
      .lean();
      
      const validTokens = tokens
        .filter(tokenDoc => tokenDoc.token && tokenDoc.user)
        .map(tokenDoc => ({
          token: tokenDoc.token,
          userId: tokenDoc.user._id,
          userName: tokenDoc.user.name || tokenDoc.user.username,
          userRole: tokenDoc.user.role,
          deviceInfo: tokenDoc.deviceInfo
        }));
      
      logger.info(`Found ${validTokens.length} active tokens for role`, {
        role,
        totalUsers: users.length,
        tokensFound: tokens.length,
        validTokens: validTokens.length
      });
      
      return {
        success: true,
        tokens: validTokens,
        count: validTokens.length,
        metadata: {
          role,
          totalUsers: users.length,
          tokensFound: tokens.length,
          validTokens: validTokens.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error fetching tokens by role:', error);
      return {
        success: false,
        error: error.message,
        tokens: [],
        count: 0
      };
    }
  }
  
  /**
   * Busca tokens FCM por lista de IDs de usuários
   */
  static async getTokensByUserIds(userIds) {
    try {
      logger.info('Fetching FCM tokens by user IDs', { userCount: userIds.length });
      
      if (!userIds || userIds.length === 0) {
        return {
          success: true,
          tokens: [],
          count: 0,
          metadata: {
            userCount: 0,
            lastUpdated: new Date().toISOString()
          }
        };
      }
      
      // Buscar tokens FCM dos usuários
      const tokens = await FCMToken.find({
        user: { $in: userIds },
        isActive: true,
        lastUsed: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
      })
      .populate('user', 'name role username')
      .select('token deviceInfo user')
      .lean();
      
      const validTokens = tokens
        .filter(tokenDoc => tokenDoc.token && tokenDoc.user)
        .map(tokenDoc => ({
          token: tokenDoc.token,
          userId: tokenDoc.user._id,
          userName: tokenDoc.user.name || tokenDoc.user.username,
          userRole: tokenDoc.user.role,
          deviceInfo: tokenDoc.deviceInfo
        }));
      
      logger.info(`Found ${validTokens.length} active tokens for user IDs`, {
        requestedUsers: userIds.length,
        tokensFound: tokens.length,
        validTokens: validTokens.length
      });
      
      return {
        success: true,
        tokens: validTokens,
        count: validTokens.length,
        metadata: {
          requestedUsers: userIds.length,
          tokensFound: tokens.length,
          validTokens: validTokens.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error fetching tokens by user IDs:', error);
      return {
        success: false,
        error: error.message,
        tokens: [],
        count: 0
      };
    }
  }

  /**
   * Busca tokens FCM de usuários ativos recentemente (para chat global)
   */
  static async getRecentlyActiveTokens(hoursAgo = 24) {
    try {
      logger.info('Fetching FCM tokens for recently active users', { hoursAgo });
      
      const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      
      // Buscar tokens de usuários ativos recentemente
      const tokens = await FCMToken.find({
        isActive: true,
        lastUsed: { $gte: cutoffDate }
      })
      .populate('user', 'name role username')
      .select('token deviceInfo user')
      .lean();
      
      const validTokens = tokens
        .filter(tokenDoc => tokenDoc.token && tokenDoc.user)
        .map(tokenDoc => ({
          token: tokenDoc.token,
          userId: tokenDoc.user._id,
          userName: tokenDoc.user.name || tokenDoc.user.username,
          userRole: tokenDoc.user.role,
          deviceInfo: tokenDoc.deviceInfo
        }));
      
      logger.info(`Found ${validTokens.length} tokens for recently active users`, {
        hoursAgo,
        tokensFound: tokens.length,
        validTokens: validTokens.length
      });
      
      return {
        success: true,
        tokens: validTokens,
        count: validTokens.length,
        metadata: {
          hoursAgo,
          cutoffDate: cutoffDate.toISOString(),
          tokensFound: tokens.length,
          validTokens: validTokens.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error fetching recently active tokens:', error);
      return {
        success: false,
        error: error.message,
        tokens: [],
        count: 0
      };
    }
  }
}

module.exports = SegmentedTokenService;













