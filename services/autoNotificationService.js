const notificationService = require('./notificationService');
const segmentedTokenService = require('./segmentedTokenService');
const User = require('../models/User');
const Clan = require('../models/Clan');
const Federation = require('../models/Federation');
const winston = require('winston');

// Logger específico para notificações automáticas
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [AUTO-NOTIFICATION-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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
 * Serviço para envio automático de notificações segmentadas hierárquicas
 */
class AutoNotificationService {

  /**
   * Notifica sobre nova QRR baseado no escopo (clã ou federação)
   */
  static async notifyNewQRR(qrr, createdBy, scope = 'clan') {
    try {
      logger.info('Sending new QRR notification', {
        qrrId: qrr._id,
        qrrTitle: qrr.title,
        scope,
        createdBy: createdBy._id
      });

      if (scope === 'federation') {
        return await this._notifyFederationQRR(qrr, createdBy);
      } else {
        return await this._notifyClanQRR(qrr, createdBy);
      }

    } catch (error) {
      logger.error('Error sending new QRR notification', {
        error: error.message,
        qrrId: qrr._id,
        scope,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifica QRR de clã - apenas membros do clã específico
   */
  static async _notifyClanQRR(qrr, createdBy) {
    logger.info('Sending clan QRR notification', {
      qrrId: qrr._id,
      clanId: qrr.clan
    });

    // Buscar tokens dos membros do clã
    const tokenResult = await segmentedTokenService.getClanMemberTokens(qrr.clan);
    
    if (!tokenResult.success || tokenResult.count === 0) {
      logger.warn('No clan member tokens found for QRR notification', {
        qrrId: qrr._id,
        clanId: qrr.clan,
        error: tokenResult.error
      });
      return { success: false, error: 'Nenhum membro do clã encontrado para notificar' };
    }

    // Filtrar tokens (excluir o criador da QRR)
    const filteredTokens = tokenResult.tokens
      .filter(tokenData => tokenData.userId.toString() !== createdBy._id.toString())
      .map(tokenData => tokenData.token);

    if (filteredTokens.length === 0) {
      logger.info('No other clan members to notify about QRR', { qrrId: qrr._id });
      return { success: true, sent: 0, message: 'Nenhum outro membro para notificar' };
    }

    // Preparar dados da notificação
    const title = '🎯 Nova Missão do Clã!';
    const body = `${createdBy.username} criou uma nova missão: "${qrr.title}"`;
    const data = {
      type: 'new_clan_qrr',
      qrrId: qrr._id.toString(),
      qrrTitle: qrr.title,
      clanId: qrr.clan.toString(),
      createdBy: createdBy._id.toString(),
      createdByName: createdBy.username,
      timestamp: new Date().toISOString(),
      priority: qrr.priority || 'medium',
      startTime: qrr.startTime ? qrr.startTime.toISOString() : null
    };

    // Enviar notificação
    const sendResult = await notificationService.sendToTokens(
      filteredTokens,
      title,
      body,
      data,
      'high'
    );

    logger.info('Clan QRR notification sent', {
      qrrId: qrr._id,
      sent: sendResult.successCount,
      failed: sendResult.failureCount,
      total: filteredTokens.length
    });

    return {
      success: true,
      sent: sendResult.successCount,
      failed: sendResult.failureCount,
      total: filteredTokens.length
    };
  }

  /**
   * Notifica QRR de federação - apenas líderes dos clãs da federação
   */
  static async _notifyFederationQRR(qrr, createdBy) {
    logger.info('Sending federation QRR notification', {
      qrrId: qrr._id,
      federationId: qrr.federation
    });

    // Buscar tokens dos líderes da federação
    const tokenResult = await segmentedTokenService.getFederationLeaderTokens(qrr.federation);
    
    if (!tokenResult.success || tokenResult.count === 0) {
      logger.warn('No federation leader tokens found for QRR notification', {
        qrrId: qrr._id,
        federationId: qrr.federation,
        error: tokenResult.error
      });
      return { success: false, error: 'Nenhum líder da federação encontrado para notificar' };
    }

    // Filtrar tokens (excluir o criador da QRR)
    const filteredTokens = tokenResult.tokens
      .filter(tokenData => tokenData.userId.toString() !== createdBy._id.toString())
      .map(tokenData => tokenData.token);

    if (filteredTokens.length === 0) {
      logger.info('No other federation leaders to notify about QRR', { qrrId: qrr._id });
      return { success: true, sent: 0, message: 'Nenhum outro líder para notificar' };
    }

    // Preparar dados da notificação
    const title = '🏛️ Nova Missão da Federação!';
    const body = `${createdBy.username} criou uma missão de federação: "${qrr.title}". Aceite para seu clã participar.`;
    const data = {
      type: 'new_federation_qrr',
      qrrId: qrr._id.toString(),
      qrrTitle: qrr.title,
      federationId: qrr.federation.toString(),
      createdBy: createdBy._id.toString(),
      createdByName: createdBy.username,
      timestamp: new Date().toISOString(),
      priority: qrr.priority || 'medium',
      startTime: qrr.startTime ? qrr.startTime.toISOString() : null,
      requiresAcceptance: true
    };

    // Enviar notificação
    const sendResult = await notificationService.sendToTokens(
      filteredTokens,
      title,
      body,
      data,
      'high'
    );

    logger.info('Federation QRR notification sent', {
      qrrId: qrr._id,
      sent: sendResult.successCount,
      failed: sendResult.failureCount,
      total: filteredTokens.length
    });

    return {
      success: true,
      sent: sendResult.successCount,
      failed: sendResult.failureCount,
      total: filteredTokens.length
    };
  }

  /**
   * Notifica membros do clã quando líder aceita QRR de federação
   */
  static async notifyQRRAcceptedByClanLeader(qrr, clanId, acceptedBy) {
    try {
      logger.info('Sending QRR acceptance notification to clan members', {
        qrrId: qrr._id,
        clanId,
        acceptedBy: acceptedBy._id
      });

      // Buscar tokens dos membros do clã
      const tokenResult = await segmentedTokenService.getClanMemberTokens(clanId);
      
      if (!tokenResult.success || tokenResult.count === 0) {
        logger.warn('No clan member tokens found for QRR acceptance notification', {
          qrrId: qrr._id,
          clanId
        });
        return { success: false, error: 'Nenhum membro do clã encontrado para notificar' };
      }

      // Filtrar tokens (excluir o líder que aceitou)
      const filteredTokens = tokenResult.tokens
        .filter(tokenData => tokenData.userId.toString() !== acceptedBy._id.toString())
        .map(tokenData => tokenData.token);

      if (filteredTokens.length === 0) {
        logger.info('No other clan members to notify about QRR acceptance', { qrrId: qrr._id, clanId });
        return { success: true, sent: 0, message: 'Nenhum outro membro para notificar' };
      }

      // Preparar dados da notificação
      const title = '✅ Missão Aceita pelo Líder!';
      const body = `${acceptedBy.username} aceitou a missão "${qrr.title}" para nosso clã. Você pode participar!`;
      const data = {
        type: 'qrr_accepted_by_leader',
        qrrId: qrr._id.toString(),
        qrrTitle: qrr.title,
        clanId: clanId.toString(),
        acceptedBy: acceptedBy._id.toString(),
        acceptedByName: acceptedBy.username,
        timestamp: new Date().toISOString(),
        priority: qrr.priority || 'medium',
        startTime: qrr.startTime ? qrr.startTime.toISOString() : null
      };

      // Enviar notificação
      const sendResult = await notificationService.sendToTokens(
        filteredTokens,
        title,
        body,
        data,
        'high'
      );

      logger.info('QRR acceptance notification sent to clan members', {
        qrrId: qrr._id,
        clanId,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: filteredTokens.length
      });

      return {
        success: true,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: filteredTokens.length
      };

    } catch (error) {
      logger.error('Error sending QRR acceptance notification', {
        error: error.message,
        qrrId: qrr._id,
        clanId,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifica participantes sobre mudança de status da QRR
   */
  static async notifyQRRStatusChange(qrr, newStatus, updatedBy) {
    try {
      logger.info('Sending QRR status change notification', {
        qrrId: qrr._id,
        newStatus,
        updatedBy: updatedBy._id,
        participantCount: qrr.participants.length
      });

      if (qrr.participants.length === 0) {
        logger.info('No participants to notify about QRR status change', { qrrId: qrr._id });
        return { success: true, sent: 0, message: 'Nenhum participante para notificar' };
      }

      // Buscar tokens dos participantes
      const participantIds = qrr.participants.map(p => p.user);
      const tokenResult = await segmentedTokenService.getTokensByUserIds(participantIds);

      if (!tokenResult.success || tokenResult.count === 0) {
        logger.warn('No participant tokens found for QRR status notification', {
          qrrId: qrr._id,
          participantIds
        });
        return { success: false, error: 'Nenhum token de participante encontrado' };
      }

      // Filtrar tokens (excluir quem atualizou o status)
      const filteredTokens = tokenResult.tokens
        .filter(tokenData => tokenData.userId.toString() !== updatedBy._id.toString())
        .map(tokenData => tokenData.token);

      if (filteredTokens.length === 0) {
        logger.info('No other participants to notify about QRR status change', { qrrId: qrr._id });
        return { success: true, sent: 0, message: 'Nenhum outro participante para notificar' };
      }

      // Preparar dados da notificação baseado no status
      let title, body, emoji;
      switch (newStatus) {
        case 'active':
          emoji = '🚀';
          title = 'Missão Ativada!';
          body = `A missão "${qrr.title}" foi ativada e está pronta para começar!`;
          break;
        case 'completed':
          emoji = '✅';
          title = 'Missão Concluída!';
          body = `A missão "${qrr.title}" foi concluída com sucesso!`;
          break;
        case 'cancelled':
          emoji = '❌';
          title = 'Missão Cancelada';
          body = `A missão "${qrr.title}" foi cancelada.`;
          break;
        default:
          emoji = '📋';
          title = 'Status da Missão Atualizado';
          body = `O status da missão "${qrr.title}" foi atualizado.`;
      }

      const data = {
        type: 'qrr_status_change',
        qrrId: qrr._id.toString(),
        qrrTitle: qrr.title,
        newStatus,
        updatedBy: updatedBy._id.toString(),
        updatedByName: updatedBy.username,
        timestamp: new Date().toISOString()
      };

      // Enviar notificação
      const sendResult = await notificationService.sendToTokens(
        filteredTokens,
        `${emoji} ${title}`,
        body,
        data,
        newStatus === 'active' ? 'high' : 'normal'
      );

      logger.info('QRR status change notification sent', {
        qrrId: qrr._id,
        newStatus,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: filteredTokens.length
      });

      return {
        success: true,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: filteredTokens.length
      };

    } catch (error) {
      logger.error('Error sending QRR status change notification', {
        error: error.message,
        qrrId: qrr._id,
        newStatus,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  static async notifyQRRNewParticipant(qrr, participant, creator) {
    try {
      logger.info("Sending QRR new participant notification", {
        qrrId: qrr._id,
        participantId: participant._id,
        creatorId: creator._id,
      });

      const creatorTokensResult = await segmentedTokenService.getTokensByUserIds([creator._id]);
      if (!creatorTokensResult.success || creatorTokensResult.count === 0) {
        logger.warn("No creator tokens found for QRR new participant notification", { qrrId: qrr._id });
        return { success: false, error: "Nenhum token do criador encontrado" };
      }

      const title = "👥 Novo Participante na QRR!";
      const body = `${participant.username} entrou na QRR "${qrr.title}".`;
      const data = {
        type: "qrr_new_participant",
        qrrId: qrr._id.toString(),
        qrrTitle: qrr.title,
        participantId: participant._id.toString(),
        participantName: participant.username,
        timestamp: new Date().toISOString(),
      };

      const sendResult = await notificationService.sendToTokens(
        creatorTokensResult.tokens.map(t => t.token),
        title,
        body,
        data,
        "normal"
      );

      logger.info("QRR new participant notification sent", {
        qrrId: qrr._id,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
      });

      return { success: true, sent: sendResult.successCount, failed: sendResult.failureCount };
    } catch (error) {
      logger.error("Error sending QRR new participant notification", { error: error.message, qrrId: qrr._id, stack: error.stack });
      return { success: false, error: error.message };
    }
  }

  static async notifyQRRParticipantLeft(qrr, participant, creator) {
    try {
      logger.info("Sending QRR participant left notification", {
        qrrId: qrr._id,
        participantId: participant._id,
        creatorId: creator._id,
      });

      const creatorTokensResult = await segmentedTokenService.getTokensByUserIds([creator._id]);
      if (!creatorTokensResult.success || creatorTokensResult.count === 0) {
        logger.warn("No creator tokens found for QRR participant left notification", { qrrId: qrr._id });
        return { success: false, error: "Nenhum token do criador encontrado" };
      }

      const title = "🚪 Participante Saiu da QRR";
      const body = `${participant.username} saiu da QRR "${qrr.title}".`;
      const data = {
        type: "qrr_participant_left",
        qrrId: qrr._id.toString(),
        qrrTitle: qrr.title,
        participantId: participant._id.toString(),
        participantName: participant.username,
        timestamp: new Date().toISOString(),
      };

      const sendResult = await notificationService.sendToTokens(
        creatorTokensResult.tokens.map(t => t.token),
        title,
        body,
        data,
        "normal"
      );

      logger.info("QRR participant left notification sent", {
        qrrId: qrr._id,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
      });

      return { success: true, sent: sendResult.successCount, failed: sendResult.failureCount };
    } catch (error) {
      logger.error("Error sending QRR participant left notification", { error: error.message, qrrId: qrr._id, stack: error.stack });
      return { success: false, error: error.message };
    }
  }

  static async notifyQRRPresenceMarked(qrr, participant, isPresent, markedBy) {
    try {
      logger.info("Sending QRR presence marked notification", {
        qrrId: qrr._id,
        participantId: participant._id,
        isPresent,
        markedBy: markedBy._id,
      });

      const participantTokensResult = await segmentedTokenService.getTokensByUserIds([participant._id]);
      if (!participantTokensResult.success || participantTokensResult.count === 0) {
        logger.warn("No participant tokens found for QRR presence marked notification", { qrrId: qrr._id });
        return { success: false, error: "Nenhum token do participante encontrado" };
      }

      const title = isPresent ? "✅ Presença Confirmada!" : "❌ Presença Removida";
      const body = isPresent
        ? `Sua presença na QRR "${qrr.title}" foi confirmada por ${markedBy.username}.`
        : `Sua presença na QRR "${qrr.title}" foi removida por ${markedBy.username}.`;
      const data = {
        type: "qrr_presence_marked",
        qrrId: qrr._id.toString(),
        qrrTitle: qrr.title,
        participantId: participant._id.toString(),
        isPresent,
        markedBy: markedBy._id.toString(),
        markedByName: markedBy.username,
        timestamp: new Date().toISOString(),
      };

      const sendResult = await notificationService.sendToTokens(
        participantTokensResult.tokens.map(t => t.token),
        title,
        body,
        data,
        "normal"
      );

      logger.info("QRR presence marked notification sent", {
        qrrId: qrr._id,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
      });

      return { success: true, sent: sendResult.successCount, failed: sendResult.failureCount };
    } catch (error) {
      logger.error("Error sending QRR presence marked notification", { error: error.message, qrrId: qrr._id, stack: error.stack });
      return { success: false, error: error.message };
    }
  }

  static async notifyQRRCompleted(qrr, completedBy) {
    try {
      logger.info("Sending QRR completed notification", {
        qrrId: qrr._id,
        completedBy: completedBy._id,
      });

      const participantIds = qrr.participants.map(p => p.user);
      const tokensResult = await segmentedTokenService.getTokensByUserIds(participantIds);
      if (!tokensResult.success || tokensResult.count === 0) {
        logger.warn("No participant tokens found for QRR completed notification", { qrrId: qrr._id });
        return { success: false, error: "Nenhum token de participante encontrado" };
      }

      const filteredTokens = tokensResult.tokens
        .filter(tokenData => tokenData.userId.toString() !== completedBy._id.toString())
        .map(t => t.token);

      if (filteredTokens.length === 0) {
        logger.info("No other participants to notify about QRR completion", { qrrId: qrr._id });
        return { success: true, sent: 0, message: "Nenhum outro participante para notificar" };
      }

      const title = "🎉 QRR Concluída!";
      const body = `A QRR "${qrr.title}" foi concluída por ${completedBy.username}.`;
      const data = {
        type: "qrr_completed",
        qrrId: qrr._id.toString(),
        qrrTitle: qrr.title,
        completedBy: completedBy._id.toString(),
        completedByName: completedBy.username,
        timestamp: new Date().toISOString(),
      };

      const sendResult = await notificationService.sendToTokens(
        filteredTokens,
        title,
        body,
        data,
        "high"
      );

      logger.info("QRR completed notification sent", {
        qrrId: qrr._id,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
      });

      return { success: true, sent: sendResult.successCount, failed: sendResult.failureCount };
    } catch (error) {
      logger.error(
        "Error sending QRR completed notification",
        { error: error.message, qrrId: qrr._id, stack: error.stack }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifica sobre chamada recebida
   */
  static async notifyIncomingCall(caller, receiver, callType, receiverTokens) {
    try {
      // Preparar dados da notificação
      const title = `📞 Chamada de ${caller.username}`;
      const body = callType === 'video' ? 'Chamada de vídeo recebida' : 'Chamada de voz recebida';
      const data = {
        type: 'incoming_call',
        callType,
        callerId: caller._id.toString(),
        callerName: caller.username,
        callerAvatar: caller.avatar || null,
        receiverId: receiver._id.toString(),
        timestamp: new Date().toISOString()
      };

      // Enviar notificação com alta prioridade
      const sendResult = await notificationService.sendToTokens(
        receiverTokens,
        title,
        body,
        data,
        'high'
      );

      logger.info('Incoming call notification sent', {
        callerId: caller._id,
        receiverId: receiver._id,
        sent: sendResult.successCount,
        failed: sendResult.failureCount
      });

      return {
        success: true,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: receiverTokens.length
      };

    } catch (error) {
      logger.error('Error sending incoming call notification', {
        error: error.message,
        callerId: caller._id,
        receiverId: receiver._id,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifica sobre promoção/rebaixamento de role (apenas para o usuário afetado)
   */
  static async notifyRoleChange(user, oldRole, newRole, changedBy) {
    try {
      logger.info('Sending role change notification', {
        userId: user._id,
        oldRole,
        newRole,
        changedBy: changedBy._id
      });

      // Buscar tokens do usuário
      const tokenResult = await segmentedTokenService.getTokensByUserIds([user._id]);

      if (!tokenResult.success || tokenResult.count === 0) {
        logger.warn('No user tokens found for role change notification', {
          userId: user._id
        });
        return { success: false, error: 'Token do usuário não encontrado' };
      }

      const userTokens = tokenResult.tokens.map(tokenData => tokenData.token);

      // Preparar dados da notificação
      const isPromotion = this._isPromotion(oldRole, newRole);
      const title = isPromotion ? '⬆️ Promoção!' : '⬇️ Mudança de Cargo';
      const body = `Seu cargo foi alterado de ${oldRole} para ${newRole} por ${changedBy.username}`;
      const data = {
        type: 'role_change',
        userId: user._id.toString(),
        oldRole,
        newRole,
        changedBy: changedBy._id.toString(),
        changedByName: changedBy.username,
        isPromotion,
        timestamp: new Date().toISOString()
      };

      // Enviar notificação
      const sendResult = await notificationService.sendToTokens(
        userTokens,
        title,
        body,
        data,
        'high'
      );

      logger.info('Role change notification sent', {
        userId: user._id,
        sent: sendResult.successCount,
        failed: sendResult.failureCount
      });

      return {
        success: true,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: userTokens.length
      };

    } catch (error) {
      logger.error('Error sending role change notification', {
        error: error.message,
        userId: user._id,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Notificação de ADM para TODOS os usuários
   */
  static async notifyAdminBroadcast(title, body, data, adminUser) {
    try {
      logger.info('Sending admin broadcast notification', {
        adminId: adminUser._id,
        title
      });

      // Buscar todos os tokens ativos
      const tokenResult = await segmentedTokenService.getAllActiveTokens();
      
      if (!tokenResult.success || tokenResult.count === 0) {
        logger.warn('No active tokens found for admin broadcast');
        return { success: false, error: 'Nenhum usuário ativo encontrado' };
      }

      // Filtrar tokens (excluir o próprio admin)
      const filteredTokens = tokenResult.tokens
        .filter(tokenData => tokenData.userId.toString() !== adminUser._id.toString())
        .map(tokenData => tokenData.token);

      if (filteredTokens.length === 0) {
        logger.info('No other users to notify in admin broadcast');
        return { success: true, sent: 0, message: 'Nenhum outro usuário para notificar' };
      }

      // Preparar dados da notificação
      const notificationData = {
        type: 'admin_broadcast',
        senderId: adminUser._id.toString(),
        senderName: adminUser.username,
        timestamp: new Date().toISOString(),
        ...data
      };

      // Enviar notificação
      const sendResult = await notificationService.sendToTokens(
        filteredTokens,
        `📢 ${title}`,
        body,
        notificationData,
        'high'
      );

      logger.info('Admin broadcast notification sent', {
        adminId: adminUser._id,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: filteredTokens.length
      });

      return {
        success: true,
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: filteredTokens.length
      };

    } catch (error) {
      logger.error('Error sending admin broadcast notification', {
        error: error.message,
        adminId: adminUser._id,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Determina se uma mudança de role é uma promoção
   */
  static _isPromotion(oldRole, newRole) {
    const roleHierarchy = {
      'MEMBRO': 1,
      'SUB_LÍDER': 2,
      'LÍDER': 3,
      'ADM': 4
    };

    return (roleHierarchy[newRole] || 0) > (roleHierarchy[oldRole] || 0);
  }
}

module.exports = AutoNotificationService;

