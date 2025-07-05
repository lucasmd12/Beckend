const express = require("express");
const router = express.Router();
const voipController = require("../controllers/voipController");
const { protect } = require("../middleware/authMiddleware");
const voipAuth = require("../middleware/voipAuth");

/**
 * @swagger
 * tags:
 *   name: VoIP
 *   description: Rotas para gerenciamento de chamadas de voz e vídeo (VoIP)
 */

/**
 * @swagger
 * /api/voip/call/initiate:
 *   post:
 *     summary: Iniciar uma nova chamada VoIP
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *               - callType
 *             properties:
 *               receiverId:
 *                 type: string
 *                 description: ID do usuário que receberá a chamada
 *               callType:
 *                 type: string
 *                 enum: [audio, video]
 *                 description: Tipo de chamada (áudio ou vídeo)
 *     responses:
 *       200:
 *         description: Chamada iniciada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/call/initiate", protect, voipAuth, voipController.initiateCall);

/**
 * @swagger
 * /api/voip/call/accept:
 *   post:
 *     summary: Aceitar uma chamada VoIP
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callId
 *             properties:
 *               callId:
 *                 type: string
 *                 description: ID da chamada a ser aceita
 *     responses:
 *       200:
 *         description: Chamada aceita com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Chamada não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/call/accept", protect, voipAuth, voipController.acceptCall);

/**
 * @swagger
 * /api/voip/call/reject:
 *   post:
 *     summary: Rejeitar uma chamada VoIP
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callId
 *             properties:
 *               callId:
 *                 type: string
 *                 description: ID da chamada a ser rejeitada
 *     responses:
 *       200:
 *         description: Chamada rejeitada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Chamada não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/call/reject", protect, voipAuth, voipController.rejectCall);

/**
 * @swagger
 * /api/voip/call/end:
 *   post:
 *     summary: Encerrar uma chamada VoIP
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callId
 *             properties:
 *               callId:
 *                 type: string
 *                 description: ID da chamada a ser encerrada
 *     responses:
 *       200:
 *         description: Chamada encerrada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Chamada não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/call/end", protect, voipAuth, voipController.endCall);

/**
 * @swagger
 * /api/voip/call/history:
 *   get:
 *     summary: Obter histórico de chamadas VoIP do usuário
 *     tags: [VoIP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Histórico de chamadas retornado com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/call/history", protect, voipAuth, voipController.getCallHistory);

module.exports = router;


