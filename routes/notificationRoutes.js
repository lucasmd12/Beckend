const express = require("express");
const router = express.Router();
const notificationService = require("../services/notificationService");
const notificationController = require("../controllers/notificationController");
const firebaseConfig = require("../config/firebase");
const auth = require("../middleware/auth");
const permissionMiddleware = require("../middleware/permissionMiddleware");
const { body, validationResult } = require("express-validator");
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
 *   name: Notificações
 *   description: Gerenciamento de envio e inscrição de notificações via FCM
 */

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Envia notificação para um token específico
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - notification
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token FCM do dispositivo
 *               notification:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: Título da notificação
 *                   body:
 *                     type: string
 *                     description: Corpo da notificação
 *               data:
 *                 type: object
 *                 description: Dados adicionais (opcional)
 *               options:
 *                 type: object
 *                 description: Opções de envio (opcional)
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                     token:
 *                       type: string
 *       400:
 *         description: Erro na validação ou falha ao enviar notificação
 *       401:
 *         description: Não autorizado
 *       503:
 *         description: Serviço de notificação indisponível
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/send",
  auth,
  [
    body("token").notEmpty().withMessage("Token é obrigatório"),
    body("notification.title").notEmpty().withMessage("Título da notificação é obrigatório"),
    body("notification.body").notEmpty().withMessage("Corpo da notificação é obrigatório")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: errors.array()
        });
      }

      if (!notificationService.isAvailable()) {
        return res.status(503).json({
          success: false,
          message: "Serviço de notificação indisponível"
        });
      }

      const { token, notification, data = {}, options = {} } = req.body;

      const result = await notificationService.sendToToken(token, notification, data, options);

      if (result.success) {
        logger.info("Notification sent via API", {
          userId: req.user.id,
          messageId: result.messageId
        });

        res.json({
          success: true,
          message: "Notificação enviada com sucesso",
          data: {
            messageId: result.messageId,
            token: result.token
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Falha ao enviar notificação",
          error: result.error,
          code: result.code
        });
      }
    } catch (error) {
      logger.error("Error in send notification route:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/send-multiple:
 *   post:
 *     summary: Envia notificação para múltiplos tokens
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokens
 *               - notification
 *             properties:
 *               tokens:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array de tokens FCM
 *               notification:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: Título da notificação
 *                   body:
 *                     type: string
 *                     description: Corpo da notificação
 *               data:
 *                 type: object
 *                 description: Dados adicionais (opcional)
 *               options:
 *                 type: object
 *                 description: Opções de envio (opcional)
 *     responses:
 *       200:
 *         description: Notificações enviadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalTokens:
 *                       type: number
 *                     successCount:
 *                       type: number
 *                     failureCount:
 *                       type: number
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       success:
 *                         type: boolean
 */
router.post("/send-multiple",
  auth,
  [
    body("tokens").isArray({ min: 1 }).withMessage("Tokens deve ser um array não vazio"),
    body("notification.title").notEmpty().withMessage("Título da notificação é obrigatório"),
    body("notification.body").notEmpty().withMessage("Corpo da notificação é obrigatório")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: errors.array()
        });
      }

      if (!notificationService.isAvailable()) {
        return res.status(503).json({
          success: false,
          message: "Serviço de notificação indisponível"
        });
      }

      const { tokens, notification, data = {}, options = {} } = req.body;

      const result = await notificationService.sendToTokens(tokens, notification, data, options);

      if (result.success) {
        logger.info("Multiple notifications sent via API", {
          userId: req.user.id,
          totalTokens: result.summary.totalTokens,
          successCount: result.summary.successCount,
          failureCount: result.summary.failureCount
        });

        res.json({
          success: true,
          message: "Notificações enviadas",
          data: result.summary,
          results: result.results
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Falha ao enviar notificações",
          error: result.error,
          code: result.code
        });
      }
    } catch (error) {
      logger.error("Error in send multiple notifications route:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/send-topic:
 *   post:
 *     summary: Envia notificação para um tópico
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *               - notification
 *             properties:
 *               topic:
 *                 type: string
 *                 description: Nome do tópico
 *               notification:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: Título da notificação
 *                   body:
 *                     type: string
 *                     description: Corpo da notificação
 *               data:
 *                 type: object
 *                 description: Dados adicionais (opcional)
 *               options:
 *                 type: object
 *                 description: Opções de envio (opcional)
 *     responses:
 *       200:
 *         description: Notificação enviada para o tópico com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                     topic:
 *                       type: string
 *       400:
 *         description: Erro na validação ou falha ao enviar notificação
 *       401:
 *         description: Não autorizado
 *       503:
 *         description: Serviço de notificação indisponível
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/send-topic",
  auth,
  [
    body("topic").notEmpty().withMessage("Tópico é obrigatório"),
    body("notification.title").notEmpty().withMessage("Título da notificação é obrigatório"),
    body("notification.body").notEmpty().withMessage("Corpo da notificação é obrigatório")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: errors.array()
        });
      }

      if (!notificationService.isAvailable()) {
        return res.status(503).json({
          success: false,
          message: "Serviço de notificação indisponível"
        });
      }

      const { topic, notification, data = {}, options = {} } = req.body;

      const result = await notificationService.sendToTopic(topic, notification, data, options);

      if (result.success) {
        logger.info("Topic notification sent via API", {
          userId: req.user.id,
          topic,
          messageId: result.messageId
        });

        res.json({
          success: true,
          message: "Notificação enviada para o tópico",
          data: {
            messageId: result.messageId,
            topic: result.topic
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Falha ao enviar notificação para o tópico",
          error: result.error,
          code: result.code
        });
      }
    } catch (error) {
      logger.error("Error in send topic notification route:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/subscribe:
 *   post:
 *     summary: Inscreve tokens em um tópico
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokens
 *               - topic
 *             properties:
 *               tokens:
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items:
 *                       type: string
 *                 description: Token(s) FCM do(s) dispositivo(s)
 *               topic:
 *                 type: string
 *                 description: Nome do tópico
 *     responses:
 *       200:
 *         description: Tokens inscritos no tópico com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     topic:
 *                       type: string
 *                     successCount:
 *                       type: number
 *                     failureCount:
 *                       type: number
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           token:
 *                             type: string
 *                           error:
 *                             type: string
 *                             description: "Mensagem de erro"
 *       401:
 *         description: Não autorizado
 *       503:
 *         description: Serviço de notificação indisponível
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/subscribe",
  auth,
  [
    body("topic").notEmpty().withMessage("Tópico é obrigatório"),
    body("tokens").custom((value) => {
      if (typeof value === "string" || (Array.isArray(value) && value.length > 0)) {
        return true;
      }
      throw new Error("Tokens deve ser uma string ou array não vazio");
    })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: errors.array()
        });
      }

      if (!notificationService.isAvailable()) {
        return res.status(503).json({
          success: false,
          message: "Serviço de notificação indisponível"
        });
      }

      const { tokens, topic } = req.body;

      const result = await notificationService.subscribeToTopic(tokens, topic);

      if (result.success) {
        logger.info("Tokens subscribed to topic via API", {
          userId: req.user.id,
          topic,
          successCount: result.successCount,
          failureCount: result.failureCount
        });

        res.json({
          success: true,
          message: "Tokens inscritos no tópico",
          data: {
            topic,
            successCount: result.successCount,
            failureCount: result.failureCount,
            errors: result.errors
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Falha ao inscrever tokens no tópico",
          error: result.error,
          code: result.code
        });
      }
    } catch (error) {
      logger.error("Error in subscribe to topic route:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/unsubscribe:
 *   post:
 *     summary: Desinscreve tokens de um tópico
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokens
 *               - topic
 *             properties:
 *               tokens:
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items:
 *                       type: string
 *                 description: Token(s) FCM do(s) dispositivo(s)
 *               topic:
 *                 type: string
 *                 description: Nome do tópico
 *     responses:
 *       200:
 *         description: Tokens desinscritos do tópico com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     topic:
 *                       type: string
 *                     successCount:
 *                       type: number
 *                     failureCount:
 *                       type: number
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           token:
 *                             type: string
 *                           error:
 *                             type: string
 *       400:
 *         description: Erro na validação ou falha ao desinscrever tokens
 *       401:
 *         description: Não autorizado
 *       503:
 *         description: Serviço de notificação indisponível
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/unsubscribe",
  auth,
  [
    body("topic").notEmpty().withMessage("Tópico é obrigatório"),
    body("tokens").custom((value) => {
      if (typeof value === "string" || (Array.isArray(value) && value.length > 0)) {
        return true;
      }
      throw new Error("Tokens deve ser uma string ou array não vazio");
    })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: errors.array()
        });
      }

      if (!notificationService.isAvailable()) {
        return res.status(503).json({
          success: false,
          message: "Serviço de notificação indisponível"
        });
      }

      const { tokens, topic } = req.body;

      const result = await notificationService.unsubscribeFromTopic(tokens, topic);

      if (result.success) {
        logger.info("Tokens unsubscribed from topic via API", {
          userId: req.user.id,
          topic,
          successCount: result.successCount,
          failureCount: result.failureCount
        });

        res.json({
          success: true,
          message: "Tokens desinscritos do tópico",
          data: {
            topic,
            successCount: result.successCount,
            failureCount: result.failureCount,
            errors: result.errors
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Falha ao desinscrever tokens do tópico",
          error: result.error,
          code: result.code
        });
      }
    } catch (error) {
      logger.error("Error in unsubscribe from topic route:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Obtém estatísticas do serviço de notificações
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do serviço de notificações retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSent:
 *                       type: number
 *                       description: Número total de notificações enviadas
 *                     totalFailed:
 *                       type: number
 *                       description: Número total de notificações que falharam
 *                     available:
 *                       type: boolean
 *                       description: Indica se o serviço de notificação está disponível
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/stats", auth, async (req, res) => {
  try {
    const stats = notificationService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error("Error in notification stats route:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

module.exports = router;





/**
 * @swagger
 * /api/notifications/global:
 *   post:
 *     summary: Envia notificação global (apenas ADM)
 *     tags: [Notificações]
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
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Notificação global enviada com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/global", auth, permissionMiddleware.hasRole(["admMaster"]), notificationController.sendGlobalNotification);

/**
 * @swagger
 * /api/notifications/clan/{clanId}:
 *   post:
 *     summary: Envia notificação para um clã (Líder de Clã, ADM)
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clanId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do clã
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
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Notificação enviada para o clã com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/clan/:clanId", auth, permissionMiddleware.isClanLeaderOrAdmin, notificationController.sendClanNotification);

/**
 * @swagger
 * /api/notifications/federation/{federationId}:
 *   post:
 *     summary: Envia notificação para uma federação (Líder de Federação, ADM)
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: federationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da federação
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
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Notificação enviada para a federação com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/federation/:federationId", auth, permissionMiddleware.isFederationLeaderOrAdmin, notificationController.sendFederationNotification);

/**
 * @swagger
 * /api/notifications/invite:
 *   post:
 *     summary: Envia convite de clã (ADM, Líder de Federação, Líder de Clã)
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *               - clanId
 *             properties:
 *               targetUserId:
 *                 type: string
 *               clanId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Convite de clã enviado com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário ou clã não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/invite", auth, permissionMiddleware.canInviteToClan, notificationController.sendInviteNotification);


