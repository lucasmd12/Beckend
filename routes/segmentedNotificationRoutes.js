const express = require("express");
const router = express.Router();
const notificationService = require("../services/notificationService");
const segmentedTokenService = require("../services/segmentedTokenService");
const { requireAdmin, requireClanLeader, requireFederationLeader, logNotificationAction } = require("../middleware/notificationAuth");
const auth = require("../middleware/auth");
const winston = require("winston");

// Logger específico para rotas de notificação
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [NOTIFICATION-ROUTES-${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
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
 * @swagger
 * tags:
 *   name: Notificações Segmentadas
 *   description: Envio de notificações para segmentos específicos de usuários (Admin, Clã, Federação)
 */

/**
 * @swagger
 * /api/notifications/admin/send-all:
 *   post:
 *     summary: Enviar notificação para todos os usuários (apenas ADMs)
 *     tags: [Notificações Segmentadas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título da notificação
 *               body:
 *                 type: string
 *                 description: Corpo da notificação
 *               data:
 *                 type: object
 *                 description: Dados adicionais para a notificação (opcional)
 *               priority:
 *                 type: string
 *                 enum: [high, normal]
 *                 default: high
 *                 description: Prioridade da notificação (opcional)
 *               sound:
 *                 type: string
 *                 default: default
 *                 description: Som da notificação (opcional)
 *     responses:
 *       200:
 *         description: Notificação enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 sent:
 *                   type: number
 *                 failed:
 *                   type: number
 *                 total:
 *                   type: number
 *                 details:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     recipientCount:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Título e/ou corpo da mensagem são obrigatórios
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas ADMs podem enviar notificações para todos os usuários.
 *       500:
 *         description: Erro interno do servidor ou erro ao buscar destinatários
 */
router.post("/admin/send-all", auth, requireAdmin, async (req, res) => {
  try {
    const { title, body, data, priority = "high", sound = "default" } = req.body;
    const adminUser = req.adminUser;
    
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Título e corpo da mensagem são obrigatórios"
      });
    }
    
    logger.info("Admin broadcast notification request", {
      adminId: adminUser._id,
      adminName: adminUser.name || "Unknown",
      title,
      bodyLength: body.length
    });
    
    const tokenResult = await segmentedTokenService.getAllActiveTokens();
    
    if (!tokenResult.success) {
      logger.error("Failed to fetch tokens for admin broadcast", {
        error: tokenResult.error,
        adminId: adminUser._id
      });
      
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar destinatários da notificação",
        error: tokenResult.error
      });
    }
    
    if (tokenResult.count === 0) {
      logger.warn("No active tokens found for admin broadcast", {
        adminId: adminUser._id
      });
      
      return res.status(200).json({
        success: true,
        message: "Nenhum usuário ativo encontrado para receber a notificação",
        sent: 0,
        failed: 0,
        total: 0
      });
    }
    
    const notificationData = {
      type: "admin_broadcast",
      senderId: adminUser._id.toString(),
      senderName: adminUser.name || "Administrador",
      timestamp: new Date().toISOString(),
      ...data
    };
    
    const tokens = tokenResult.tokens.map(t => t.token);
    
    const sendResult = await notificationService.sendToTokens(
      tokens,
      title,
      body,
      notificationData,
      {
        priority,
        sound,
        badge: 1,
        channelId: "admin_broadcast"
      }
    );
    
    logNotificationAction(
      "admin_broadcast",
      adminUser._id,
      { targetCount: tokenResult.count },
      sendResult
    );
    
    if (sendResult.success) {
      logger.info("Admin broadcast notification sent successfully", {
        adminId: adminUser._id,
        totalSent: sendResult.successCount,
        totalFailed: sendResult.failureCount,
        totalTokens: tokenResult.count
      });
      
      res.json({
        success: true,
        message: "Notificação enviada com sucesso",
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: tokenResult.count,
        details: {
          title,
          recipientCount: tokenResult.count,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      logger.error("Admin broadcast notification failed", {
        adminId: adminUser._id,
        error: sendResult.error,
        totalTokens: tokenResult.count
      });
      
      res.status(500).json({
        success: false,
        message: "Erro ao enviar notificação",
        error: sendResult.error,
        sent: sendResult.successCount || 0,
        failed: sendResult.failureCount || tokenResult.count,
        total: tokenResult.count
      });
    }
  } catch (error) {
    logger.error("Error in admin broadcast route:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/notifications/clan/send/{clanId}:
 *   post:
 *     summary: Enviar notificação para membros de um clã (apenas Líderes do clã)
 *     tags: [Notificações Segmentadas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã para o qual a notificação será enviada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título da notificação
 *               body:
 *                 type: string
 *                 description: Corpo da notificação
 *               data:
 *                 type: object
 *                 description: Dados adicionais para a notificação (opcional)
 *               priority:
 *                 type: string
 *                 enum: [high, normal]
 *                 default: high
 *                 description: Prioridade da notificação (opcional)
 *               sound:
 *                 type: string
 *                 default: default
 *                 description: Som da notificação (opcional)
 *     responses:
 *       200:
 *         description: Notificação enviada com sucesso para os membros do clã
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 sent:
 *                   type: number
 *                 failed:
 *                   type: number
 *                 total:
 *                   type: number
 *                 details:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     clanInfo:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         memberCount:
 *                           type: number
 *                     recipientCount:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Título e/ou corpo da mensagem são obrigatórios
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas Líderes do clã podem enviar notificações para o clã.
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro interno do servidor ou erro ao buscar membros do clã
 */
router.post("/clan/send/:clanId", auth, requireClanLeader, async (req, res) => {
  try {
    const { title, body, data, priority = "high", sound = "default" } = req.body;
    const clanLeaderUser = req.clanLeaderUser;
    const targetClan = req.targetClan;
    const clanId = req.params.clanId;
    
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Título e corpo da mensagem são obrigatórios"
      });
    }
    
    logger.info("Clan notification request", {
      leaderId: clanLeaderUser._id,
      leaderName: clanLeaderUser.name || "Unknown",
      clanId,
      clanName: targetClan.name || "Unknown",
      title,
      bodyLength: body.length
    });
    
    const tokenResult = await segmentedTokenService.getClanMemberTokens(clanId);
    
    if (!tokenResult.success) {
      logger.error("Failed to fetch clan member tokens", {
        error: tokenResult.error,
        leaderId: clanLeaderUser._id,
        clanId
      });
      
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar membros do clã",
        error: tokenResult.error
      });
    }
    
    if (tokenResult.count === 0) {
      logger.warn("No active tokens found for clan members", {
        leaderId: clanLeaderUser._id,
        clanId,
        clanName: targetClan.name
      });
      
      return res.status(200).json({
        success: true,
        message: "Nenhum membro ativo encontrado no clã para receber a notificação",
        sent: 0,
        failed: 0,
        total: 0,
        clanInfo: {
          id: clanId,
          name: targetClan.name
        }
      });
    }
    
    const notificationData = {
      type: "clan_notification",
      senderId: clanLeaderUser._id.toString(),
      senderName: clanLeaderUser.name || "Líder do Clã",
      clanId: clanId,
      clanName: targetClan.name || "Clã",
      timestamp: new Date().toISOString(),
      ...data
    };
    
    const tokens = tokenResult.tokens.map(t => t.token);
    
    const sendResult = await notificationService.sendToTokens(
      tokens,
      title,
      body,
      notificationData,
      {
        priority,
        sound,
        badge: 1,
        channelId: "clan_notification"
      }
    );
    
    logNotificationAction(
      "clan_notification",
      clanLeaderUser._id,
      { clanId, clanName: targetClan.name, targetCount: tokenResult.count },
      sendResult
    );
    
    if (sendResult.success) {
      logger.info("Clan notification sent successfully", {
        leaderId: clanLeaderUser._id,
        clanId,
        clanName: targetClan.name,
        totalSent: sendResult.successCount,
        totalFailed: sendResult.failureCount,
        totalTokens: tokenResult.count
      });
      
      res.json({
        success: true,
        message: "Notificação enviada com sucesso para os membros do clã",
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: tokenResult.count,
        details: {
          title,
          clanInfo: {
            id: clanId,
            name: targetClan.name,
            memberCount: tokenResult.metadata?.totalMembers || 0
          },
          recipientCount: tokenResult.count,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      logger.error("Clan notification failed", {
        leaderId: clanLeaderUser._id,
        clanId,
        error: sendResult.error,
        totalTokens: tokenResult.count
      });
      
      res.status(500).json({
        success: false,
        message: "Erro ao enviar notificação para o clã",
        error: sendResult.error,
        sent: sendResult.successCount || 0,
        failed: sendResult.failureCount || tokenResult.count,
        total: tokenResult.count,
        clanInfo: {
          id: clanId,
          name: targetClan.name
        }
      });
    }
  } catch (error) {
    logger.error("Error in clan notification route:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/notifications/federation/send/{federationId}:
 *   post:
 *     summary: Enviar notificação para membros de uma federação (apenas Líderes da federação)
 *     tags: [Notificações Segmentadas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação para a qual a notificação será enviada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título da notificação
 *               body:
 *                 type: string
 *                 description: Corpo da notificação
 *               data:
 *                 type: object
 *                 description: Dados adicionais para a notificação (opcional)
 *               priority:
 *                 type: string
 *                 enum: [high, normal]
 *                 default: high
 *                 description: Prioridade da notificação (opcional)
 *               sound:
 *                 type: string
 *                 default: default
 *                 description: Som da notificação (opcional)
 *     responses:
 *       200:
 *         description: Notificação enviada com sucesso para os membros da federação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 sent:
 *                   type: number
 *                 failed:
 *                   type: number
 *                 total:
 *                   type: number
 *                 details:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     federationInfo:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         clanCount:
 *                           type: number
 *                         memberCount:
 *                           type: number
 *                     recipientCount:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Título e/ou corpo da mensagem são obrigatórios
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas Líderes da federação podem enviar notificações para a federação.
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro interno do servidor ou erro ao buscar membros da federação
 */
router.post("/federation/send/:federationId", auth, requireFederationLeader, async (req, res) => {
  try {
    const { title, body, data, priority = "high", sound = "default" } = req.body;
    const federationLeaderUser = req.federationLeaderUser;
    const targetFederation = req.targetFederation;
    const federationId = req.params.federationId;
    
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Título e corpo da mensagem são obrigatórios"
      });
    }
    
    logger.info("Federation notification request", {
      leaderId: federationLeaderUser._id,
      leaderName: federationLeaderUser.name || "Unknown",
      federationId,
      federationName: targetFederation.name || "Unknown",
      title,
      bodyLength: body.length
    });
    
    const tokenResult = await segmentedTokenService.getFederationMemberTokens(federationId);
    
    if (!tokenResult.success) {
      logger.error("Failed to fetch federation member tokens", {
        error: tokenResult.error,
        leaderId: federationLeaderUser._id,
        federationId
      });
      
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar membros da federação",
        error: tokenResult.error
      });
    }
    
    if (tokenResult.count === 0) {
      logger.warn("No active tokens found for federation members", {
        leaderId: federationLeaderUser._id,
        federationId,
        federationName: targetFederation.name
      });
      
      return res.status(200).json({
        success: true,
        message: "Nenhum membro ativo encontrado na federação para receber a notificação",
        sent: 0,
        failed: 0,
        total: 0,
        federationInfo: {
          id: federationId,
          name: targetFederation.name
        }
      });
    }
    
    const notificationData = {
      type: "federation_notification",
      senderId: federationLeaderUser._id.toString(),
      senderName: federationLeaderUser.name || "Líder da Federação",
      federationId: federationId,
      federationName: targetFederation.name || "Federação",
      timestamp: new Date().toISOString(),
      ...data
    };
    
    const tokens = tokenResult.tokens.map(t => t.token);
    
    const sendResult = await notificationService.sendToTokens(
      tokens,
      title,
      body,
      notificationData,
      {
        priority,
        sound,
        badge: 1,
        channelId: "federation_notification"
      }
    );
    
    logNotificationAction(
      "federation_notification",
      federationLeaderUser._id,
      { federationId, federationName: targetFederation.name, targetCount: tokenResult.count },
      sendResult
    );
    
    if (sendResult.success) {
      logger.info("Federation notification sent successfully", {
        leaderId: federationLeaderUser._id,
        federationId,
        federationName: targetFederation.name,
        totalSent: sendResult.successCount,
        totalFailed: sendResult.failureCount,
        totalTokens: tokenResult.count
      });
      
      res.json({
        success: true,
        message: "Notificação enviada com sucesso para os membros da federação",
        sent: sendResult.successCount,
        failed: sendResult.failureCount,
        total: tokenResult.count,
        details: {
          title,
          federationInfo: {
            id: federationId,
            name: targetFederation.name,
            clanCount: tokenResult.metadata?.totalClans || 0,
            memberCount: tokenResult.metadata?.totalMembers || 0
          },
          recipientCount: tokenResult.count,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      logger.error("Federation notification failed", {
        leaderId: federationLeaderUser._id,
        federationId,
        error: sendResult.error,
        totalTokens: tokenResult.count
      });
      
      res.status(500).json({
        success: false,
        message: "Erro ao enviar notificação para a federação",
        error: sendResult.error,
        sent: sendResult.successCount || 0,
        failed: sendResult.failureCount || tokenResult.count,
        total: tokenResult.count,
        federationInfo: {
          id: federationId,
          name: targetFederation.name
        }
      });
    }
  } catch (error) {
    logger.error("Error in federation notification route:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/notifications/admin/preview-recipients:
 *   get:
 *     summary: Visualizar quantos usuários receberão a notificação (apenas ADMs)
 *     tags: [Notificações Segmentadas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contagem de destinatários e pré-visualização retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 recipientCount:
 *                   type: number
 *                 metadata:
 *                   type: object
 *                   description: Metadados adicionais sobre os destinatários
 *                 preview:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userName:
 *                         type: string
 *                       userRole:
 *                         type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas ADMs podem visualizar a pré-visualização de destinatários.
 *       500:
 *         description: Erro interno do servidor ou erro ao buscar destinatários
 */
router.get("/admin/preview-recipients", auth, requireAdmin, async (req, res) => {
  try {
    const tokenResult = await segmentedTokenService.getAllActiveTokens();
    
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar destinatários",
        error: tokenResult.error
      });
    }
    
    res.json({
      success: true,
      recipientCount: tokenResult.count,
      metadata: tokenResult.metadata,
      preview: tokenResult.tokens.slice(0, 10).map(t => ({
        userName: t.userName,
        userRole: t.userRole
      }))
    });
  } catch (error) {
    logger.error("Error in admin preview recipients route:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/notifications/clan/preview-recipients/{clanId}:
 *   get:
 *     summary: Visualizar quantos membros do clã receberão a notificação (apenas Líderes do clã)
 *     tags: [Notificações Segmentadas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do clã para pré-visualizar os destinatários
 *     responses:
 *       200:
 *         description: Contagem de destinatários e pré-visualização retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 recipientCount:
 *                   type: number
 *                 metadata:
 *                   type: object
 *                   description: Metadados adicionais sobre os destinatários
 *                 preview:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userName:
 *                         type: string
 *                       userRole:
 *                         type: string
 *                 clanInfo:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas Líderes do clã podem visualizar a pré-visualização de destinatários.
 *       404:
 *         description: Clã não encontrado
 *       500:
 *         description: Erro interno do servidor ou erro ao buscar membros do clã
 */
router.get("/clan/preview-recipients/:clanId", auth, requireClanLeader, async (req, res) => {
  try {
    const clanId = req.params.clanId;
    const tokenResult = await segmentedTokenService.getClanMemberTokens(clanId);
    
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar membros do clã",
        error: tokenResult.error
      });
    }
    
    res.json({
      success: true,
      recipientCount: tokenResult.count,
      metadata: tokenResult.metadata,
      preview: tokenResult.tokens.slice(0, 10).map(t => ({
        userName: t.userName,
        userRole: t.userRole
      })),
      clanInfo: {
        id: clanId,
        name: req.targetClan.name
      }
    });
  } catch (error) {
    logger.error("Error in clan preview recipients route:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/notifications/federation/preview-recipients/{federationId}:
 *   get:
 *     summary: Visualizar quantos membros da federação receberão a notificação (apenas Líderes da federação)
 *     tags: [Notificações Segmentadas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da federação para pré-visualizar os destinatários
 *     responses:
 *       200:
 *         description: Contagem de destinatários e pré-visualização retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 recipientCount:
 *                   type: number
 *                 metadata:
 *                   type: object
 *                   description: Metadados adicionais sobre os destinatários
 *                 preview:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userName:
 *                         type: string
 *                       userRole:
 *                         type: string
 *                 federationInfo:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado. Apenas Líderes da federação podem visualizar a pré-visualização de destinatários.
 *       404:
 *         description: Federação não encontrada
 *       500:
 *         description: Erro interno do servidor ou erro ao buscar membros da federação
 */
router.get("/federation/preview-recipients/:federationId", auth, requireFederationLeader, async (req, res) => {
  try {
    const federationId = req.params.federationId;
    const tokenResult = await segmentedTokenService.getFederationMemberTokens(federationId);
    
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar membros da federação",
        error: tokenResult.error
      });
    }
    
    res.json({
      success: true,
      recipientCount: tokenResult.count,
      metadata: tokenResult.metadata,
      preview: tokenResult.tokens.slice(0, 10).map(t => ({
        userName: t.userName,
        userRole: t.userRole
      })),
      federationInfo: {
        id: federationId,
        name: req.targetFederation.name
      }
    });
  } catch (error) {
    logger.error("Error in federation preview recipients route:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

module.exports = router;


