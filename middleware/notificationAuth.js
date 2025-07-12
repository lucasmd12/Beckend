const User = require('../models/User');
const Clan = require('../models/Clan');
const winston = require('winston');

// Logger específico para autorização
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [AUTH-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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
 * Middleware para verificar se o usuário é administrador
 */
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Buscar usuário no banco de dados
    const user = await User.findById(userId).select('role permissions');
    
    if (!user) {
      logger.warn('User not found for admin check', { userId });
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se é administrador
    const isAdmin = user.role === 'admin' || 
                   user.role === 'superadmin' ||
                   (user.permissions && user.permissions.includes('admin'));
    
    if (!isAdmin) {
      logger.warn('Non-admin user attempted admin action', {
        userId,
        userRole: user.role,
        userPermissions: user.permissions
      });
      
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem realizar esta ação.'
      });
    }
    
    // Adicionar informações do usuário ao request
    req.adminUser = user;
    
    logger.info('Admin access granted', {
      userId,
      userRole: user.role
    });
    
    next();
  } catch (error) {
    logger.error('Error in admin authorization middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware para verificar se o usuário é líder de um clã específico
 */
const requireClanLeader = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const clanId = req.params.clanId || req.body.clanId;
    
    if (!clanId) {
      return res.status(400).json({
        success: false,
        message: 'ID do clã é obrigatório'
      });
    }
    
    // Buscar usuário no banco de dados
    const user = await User.findById(userId).select('role permissions clan');
    
    if (!user) {
      logger.warn('User not found for clan leader check', { userId });
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se é administrador (admins podem enviar para qualquer clã)
    const isAdmin = user.role === 'admin' || 
                   user.role === 'superadmin' ||
                   (user.permissions && user.permissions.includes('admin'));
    
    if (isAdmin) {
      req.adminUser = user;
      req.targetClanId = clanId;
      
      logger.info('Admin access granted for clan notification', {
        userId,
        userRole: user.role,
        targetClanId: clanId
      });
      
      return next();
    }
    
    // Buscar clã para verificar liderança
    const clan = await Clan.findById(clanId).select('leader members');
    
    if (!clan) {
      logger.warn('Clan not found for leader check', { clanId });
      return res.status(404).json({
        success: false,
        message: 'Clã não encontrado'
      });
    }
    
    // Verificar se o usuário é líder do clã
    const isLeader = clan.leader && clan.leader.toString() === userId.toString();
    
    // Verificar se o usuário tem role de leader e está no clã
    const hasLeaderRole = user.role === 'leader' || user.role === 'clanLeader';
    const isInClan = user.clan && user.clan.toString() === clanId.toString();
    
    if (!isLeader && !(hasLeaderRole && isInClan)) {
      logger.warn('Non-leader user attempted clan notification', {
        userId,
        userRole: user.role,
        userClan: user.clan,
        targetClanId: clanId,
        clanLeader: clan.leader,
        isLeader,
        hasLeaderRole,
        isInClan
      });
      
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas líderes do clã podem enviar notificações para seus membros.'
      });
    }
    
    // Adicionar informações ao request
    req.clanLeaderUser = user;
    req.targetClan = clan;
    req.targetClanId = clanId;
    
    logger.info('Clan leader access granted', {
      userId,
      userRole: user.role,
      clanId,
      clanName: clan.name
    });
    
    next();
  } catch (error) {
    logger.error('Error in clan leader authorization middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware para verificar se o usuário pode enviar notificações
 * (admin ou leader)
 */
const requireNotificationSender = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Buscar usuário no banco de dados
    const user = await User.findById(userId).select('role permissions');
    
    if (!user) {
      logger.warn('User not found for notification sender check', { userId });
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se tem permissão para enviar notificações
    const canSendNotifications = user.role === 'admin' || 
                                user.role === 'superadmin' ||
                                user.role === 'leader' ||
                                user.role === 'clanLeader' ||
                                (user.permissions && (
                                  user.permissions.includes('admin') ||
                                  user.permissions.includes('send_notifications')
                                ));
    
    if (!canSendNotifications) {
      logger.warn('User without notification permissions attempted to send', {
        userId,
        userRole: user.role,
        userPermissions: user.permissions
      });
      
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você não tem permissão para enviar notificações.'
      });
    }
    
    // Adicionar informações do usuário ao request
    req.senderUser = user;
    
    logger.info('Notification sender access granted', {
      userId,
      userRole: user.role
    });
    
    next();
  } catch (error) {
    logger.error('Error in notification sender authorization middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware para verificar se o usuário é líder de federação
 */
const requireFederationLeader = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const federationId = req.params.federationId || req.body.federationId;
    
    if (!federationId) {
      return res.status(400).json({
        success: false,
        message: 'ID da federação é obrigatório'
      });
    }
    
    // Buscar usuário no banco de dados
    const user = await User.findById(userId).select('role permissions federation');
    
    if (!user) {
      logger.warn('User not found for federation leader check', { userId });
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se é administrador (admins podem enviar para qualquer federação)
    const isAdmin = user.role === 'admin' || 
                   user.role === 'superadmin' ||
                   (user.permissions && user.permissions.includes('admin'));
    
    if (isAdmin) {
      req.adminUser = user;
      req.targetFederationId = federationId;
      
      logger.info('Admin access granted for federation notification', {
        userId,
        userRole: user.role,
        targetFederationId: federationId
      });
      
      return next();
    }
    
    // Buscar federação para verificar liderança
    const Federation = require('../models/Federation');
    const federation = await Federation.findById(federationId).select('leader members');
    
    if (!federation) {
      logger.warn('Federation not found for leader check', { federationId });
      return res.status(404).json({
        success: false,
        message: 'Federação não encontrada'
      });
    }
    
    // Verificar se o usuário é líder da federação
    const isLeader = federation.leader && federation.leader.toString() === userId.toString();
    
    // Verificar se o usuário tem role de federation leader e está na federação
    const hasFederationLeaderRole = user.role === 'federationLeader' || user.role === 'leader';
    const isInFederation = user.federation && user.federation.toString() === federationId.toString();
    
    if (!isLeader && !(hasFederationLeaderRole && isInFederation)) {
      logger.warn('Non-leader user attempted federation notification', {
        userId,
        userRole: user.role,
        userFederation: user.federation,
        targetFederationId: federationId,
        federationLeader: federation.leader,
        isLeader,
        hasFederationLeaderRole,
        isInFederation
      });
      
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas líderes da federação podem enviar notificações para seus membros.'
      });
    }
    
    // Adicionar informações ao request
    req.federationLeaderUser = user;
    req.targetFederation = federation;
    req.targetFederationId = federationId;
    
    logger.info('Federation leader access granted', {
      userId,
      userRole: user.role,
      federationId,
      federationName: federation.name
    });
    
    next();
  } catch (error) {
    logger.error('Error in federation leader authorization middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Função utilitária para verificar permissões de usuário
 */
const checkUserPermissions = async (userId, requiredPermissions = []) => {
  try {
    const user = await User.findById(userId).select('role permissions');
    
    if (!user) {
      return { hasPermission: false, reason: 'Usuário não encontrado' };
    }
    
    // Admins sempre têm permissão
    if (user.role === 'admin' || user.role === 'superadmin') {
      return { hasPermission: true, user };
    }
    
    // Verificar permissões específicas
    if (requiredPermissions.length > 0) {
      const hasRequiredPermissions = requiredPermissions.some(permission => 
        user.permissions && user.permissions.includes(permission)
      );
      
      if (!hasRequiredPermissions) {
        return { 
          hasPermission: false, 
          reason: `Permissões necessárias: ${requiredPermissions.join(', ')}`,
          user 
        };
      }
    }
    
    return { hasPermission: true, user };
  } catch (error) {
    logger.error('Error checking user permissions:', error);
    return { hasPermission: false, reason: 'Erro interno do servidor' };
  }
};

/**
 * Função utilitária para log de ações de notificação
 */
const logNotificationAction = (action, userId, targetInfo, result) => {
  const logData = {
    action,
    userId,
    targetInfo,
    result: result.success ? 'success' : 'failure',
    timestamp: new Date().toISOString()
  };
  
  if (result.success) {
    logger.info(`Notification action completed: ${action}`, logData);
  } else {
    logger.error(`Notification action failed: ${action}`, {
      ...logData,
      error: result.error
    });
  }
};

module.exports = {
  requireAdmin,
  requireClanLeader,
  requireNotificationSender,
  requireFederationLeader,
  checkUserPermissions,
  logNotificationAction
};

